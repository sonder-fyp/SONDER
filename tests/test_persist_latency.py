"""Fewer database round trips (I2-L12): catalogue cache, idle-aware checks, one retry, one-statement reads."""
import threading
from contextlib import contextmanager
from uuid import uuid4

from pgtest import ADMIN_URL, DatabaseTestCase, HAVE_PSYCOPG

if HAVE_PSYCOPG:
    import psycopg
    from fastapi.testclient import TestClient
    from sonder_api.app import create_app
    from sonder_api.contracts import AnswerRequest, StartRequest
    from sonder_api.devseed import seed
    from sonder_api.pgstore import PostgresStore
    from sonder_api.store import ServiceError
    from sonder_api.stored_evidence import verify_session
    from sonder_db.migrate import up

TOKEN = 't' * 32


class LatencyTests(DatabaseTestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        up(cls.url)
        with psycopg.connect(cls.url) as conn:
            seeded = seed(conn, synthetic_students=12)
        cls.students = list(seeded['students'].values())
        cls.label = seeded['release']

    def setUp(self):
        self.store = PostgresStore(self.url, self.label)
        self.addCleanup(self.store.close)

    def begin(self, actor, store=None):
        return (store or self.store).create(actor, StartRequest(unit_id='U1', create_request_id=str(uuid4())))

    def request(self, value, option='D'):
        q = value['question']
        return AnswerRequest(step_index=q['step_index'], item_id=q['item_id'], option_id=option)

    def step_count(self, sid):
        with psycopg.connect(self.url) as conn:
            return conn.execute('SELECT count(*) FROM sonder.session_step WHERE session_id=%s', (sid,)).fetchone()[0]

    def kill_pool_backends(self):
        with psycopg.connect(ADMIN_URL, autocommit=True) as conn:
            conn.execute('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=%s AND pid <> pg_backend_pid()', (self.db_name,))

    def test_catalogue_is_read_once_and_copies_are_independent(self):
        first = self.store.catalogue()
        self.store.pool.close()  # a second read must not need the database
        second = self.store.catalogue()
        self.assertEqual(first, second)
        second['units'][0]['name'] = 'changed'
        second['units'].append({})
        self.assertEqual(self.store.catalogue(), first)

    def test_read_only_operations_leave_connections_transactional(self):
        actor = self.students[0]
        value = self.begin(actor)
        self.store.health(); self.store.catalogue(); self.store.list_sessions(actor)
        self.store.current(value['session_id'], actor); self.store.inspect(value['session_id'])
        with self.store.pool.connection() as conn:
            self.assertFalse(conn.autocommit)
        self.assertTrue(self.store.submit(value['session_id'], actor, self.request(value))[1])
        self.assertEqual(self.step_count(value['session_id']), 1)

    def test_killed_connections_inside_the_idle_window_are_served_by_the_retry(self):
        actor = self.students[1]
        value = self.begin(actor)  # the pooled connection was just returned, so the next checkout skips the check
        with TestClient(create_app(TOKEN, store=self.store)) as client:
            headers = {'X-Sonder-Token': TOKEN, 'X-Sonder-Actor': actor}
            for path in ('/engine/health', '/engine/sessions/' + value['session_id'], '/engine/sessions'):
                self.kill_pool_backends()
                response = client.get(path, headers=headers)
                self.assertEqual(response.status_code, 200, path)
            self.kill_pool_backends()
            body = self.request(value).model_dump()
            response = client.post('/engine/sessions/' + value['session_id'] + '/answers', json=body, headers=headers)
            self.assertEqual(response.status_code, 200)
            self.kill_pool_backends()
            again = self.begin(actor)  # a write: the start itself is retried
            self.assertEqual(self.store.current(again['session_id'], actor), again)
        self.assertEqual(self.step_count(value['session_id']), 1)

    def test_lost_commit_is_retried_without_a_second_write(self):
        actor = self.students[2]
        value = self.begin(actor)
        real, calls = self.store.pool.connection, []

        @contextmanager
        def commit_then_fail():
            with real() as conn:
                yield conn
            if not calls:  # the transaction has committed, but the caller is told the connection failed
                calls.append(1)
                raise psycopg.OperationalError('commit acknowledgement lost')
        self.store.pool.connection = commit_then_fail
        reply, accepted = self.store.submit(value['session_id'], actor, self.request(value))
        self.assertEqual(calls, [1])
        self.assertFalse(accepted)  # the retry found the committed step and returned its original reply
        self.assertEqual(self.step_count(value['session_id']), 1)
        self.assertEqual(reply, self.store.current(value['session_id'], actor))

    def test_second_failure_maps_to_503_and_is_not_retried_again(self):
        attempts = []

        @contextmanager
        def broken():
            attempts.append(1)
            raise psycopg.OperationalError('down')
            yield
        self.store.pool.connection = broken
        with self.assertRaises(ServiceError) as caught:
            self.store.health()
        self.assertEqual((caught.exception.status, caught.exception.code), (503, 'storage_unavailable'))
        self.assertEqual(len(attempts), 2)

    def test_other_database_errors_are_not_retried(self):
        attempts = []

        @contextmanager
        def broken():
            attempts.append(1)
            raise psycopg.errors.SyntaxError('bad')
            yield
        self.store.pool.connection = broken
        with self.assertRaises(ServiceError) as caught:
            self.store.health()
        self.assertEqual((caught.exception.status, caught.exception.code), (500, 'storage_error'))
        self.assertEqual(len(attempts), 1)

    def test_reads_during_answers_never_see_a_torn_session(self):
        actor = self.students[3]
        other = PostgresStore(self.url, self.label)
        self.addCleanup(other.close)
        errors, done = [], threading.Event()

        def reader():
            while not done.is_set():
                try:
                    self.store.current(sid, actor)
                    self.store.inspect(sid)
                except ServiceError as exc:  # replay_mismatch would show here
                    errors.append((exc.status, exc.code))
                    return
        value = self.begin(actor)
        sid = value['session_id']
        threads = [threading.Thread(target=reader) for _ in range(3)]
        for thread in threads:
            thread.start()
        try:
            while value['status'] != 'complete':
                value, _ = other.submit(sid, actor, self.request(value, 'B'))
        finally:
            done.set()
            for thread in threads:
                thread.join(timeout=30)
        self.assertEqual(errors, [])
        with psycopg.connect(self.url) as conn:
            self.assertEqual(verify_session(conn, sid), [])
