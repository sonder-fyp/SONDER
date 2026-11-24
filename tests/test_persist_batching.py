"""Batched writes (I2-L13): one pipeline batch to read, one to write and commit; same rows, same errors."""
import concurrent.futures
from contextlib import contextmanager
from uuid import uuid4

from pgtest import DatabaseTestCase, HAVE_PSYCOPG

if HAVE_PSYCOPG:
    import psycopg
    from sonder_api.contracts import AnswerRequest, StartRequest
    from sonder_api.devseed import seed
    from sonder_api.pgstore import PostgresStore
    from sonder_api.store import ServiceError
    from sonder_api.stored_evidence import stored_evidence, verify_session
    from sonder_db.migrate import up


class BatchingTests(DatabaseTestCase):
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

    def begin(self, actor, nonce=None, store=None):
        return (store or self.store).create(actor, StartRequest(unit_id='U1', create_request_id=nonce or str(uuid4())))

    def request(self, value, option='D'):
        q = value['question']
        return AnswerRequest(step_index=q['step_index'], item_id=q['item_id'], option_id=option)

    def counts(self, sid):
        with psycopg.connect(self.url) as conn:
            return conn.execute(
                'SELECT (SELECT count(*) FROM sonder.session_question WHERE session_id=%s), '
                '(SELECT count(*) FROM sonder.session_step WHERE session_id=%s), '
                '(SELECT count(*) FROM sonder.step_posterior p JOIN sonder.session_step s ON s.id=p.step_id WHERE s.session_id=%s), '
                '(SELECT count(*) FROM sonder.question_candidate c JOIN sonder.session_question q ON q.id=c.session_question_id WHERE q.session_id=%s)',
                (sid,) * 4).fetchone()

    @contextmanager
    def commit_acknowledgement_lost(self):
        real, calls = self.store.pool.connection, []

        @contextmanager
        def commit_then_fail():
            with real() as conn:
                yield conn
            if not calls:  # the unit has committed, but the caller is told the connection failed
                calls.append(1)
                raise psycopg.OperationalError('commit acknowledgement lost')
        self.store.pool.connection = commit_then_fail
        try:
            yield calls
        finally:
            self.store.pool.connection = real

    def test_a_full_run_is_stored_exactly_as_the_engine_replays_it(self):
        actor = self.students[0]
        value = self.begin(actor)
        sid = value['session_id']
        for option in 'BBAB':  # D1 opens on T1-001 after the link changes.
            value, accepted = self.store.submit(sid, actor, self.request(value, option))
            self.assertTrue(accepted)
        self.assertEqual(value['status'], 'complete')
        with psycopg.connect(self.url) as conn:
            self.assertEqual(verify_session(conn, sid), [])  # replays the engine and compares every stored row
            stored = stored_evidence(conn, sid)
            self.assertEqual(conn.execute('SELECT status FROM sonder.diagnostic_session WHERE id=%s', (sid,)).fetchone()[0], 'diagnosed')
            self.assertEqual(conn.execute('SELECT count(*) FROM sonder.diagnosis_candidate c JOIN sonder.diagnosis d ON d.id=c.diagnosis_id WHERE d.session_id=%s', (sid,)).fetchone()[0] > 0, True)
        self.assertIsNotNone(stored)
        self.assertEqual(self.store.inspect(sid), self.store.inspect(sid))
        self.assertEqual(self.store.current(sid, actor), value)

    def test_a_run_to_a_refusal_is_stored_as_the_engine_replays_it(self):
        actor = self.students[1]
        value = self.begin(actor)
        while value['status'] != 'complete':
            value, _ = self.store.submit(value['session_id'], actor, self.request(value, 'A'))
        with psycopg.connect(self.url) as conn:
            self.assertEqual(verify_session(conn, value['session_id']), [])

    def test_start_retry_is_idempotent(self):
        actor, nonce = self.students[2], str(uuid4())
        first = self.begin(actor, nonce)
        self.assertEqual(self.begin(actor, nonce), first)
        self.assertEqual(self.counts(first['session_id']), (1, 0, 0, self.counts(first['session_id'])[3]))
        with psycopg.connect(self.url) as conn:
            self.assertEqual(conn.execute('SELECT count(*) FROM sonder.diagnostic_session WHERE request_key=%s', (nonce,)).fetchone()[0], 1)

    def test_answer_retry_is_idempotent_and_a_changed_answer_conflicts(self):
        actor = self.students[3]
        value = self.begin(actor)
        reply, accepted = self.store.submit(value['session_id'], actor, self.request(value, 'D'))
        again, accepted_again = self.store.submit(value['session_id'], actor, self.request(value, 'D'))
        self.assertEqual((accepted, accepted_again), (True, False))
        self.assertEqual(again, reply)
        with self.assertRaises(ServiceError) as caught:
            self.store.submit(value['session_id'], actor, self.request(value, 'B'))
        self.assertEqual((caught.exception.status, caught.exception.code), (409, 'answer_conflict'))
        self.assertEqual(self.counts(value['session_id'])[1], 1)

    def test_a_lost_start_commit_is_retried_without_a_second_session(self):
        actor, nonce = self.students[4], str(uuid4())
        with self.commit_acknowledgement_lost() as calls:
            value = self.begin(actor, nonce)
        self.assertEqual(calls, [1])
        with psycopg.connect(self.url) as conn:
            self.assertEqual(conn.execute('SELECT count(*) FROM sonder.diagnostic_session WHERE request_key=%s', (nonce,)).fetchone()[0], 1)
        self.assertEqual(self.store.current(value['session_id'], actor), value)
        self.assertEqual(self.begin(actor, nonce), value)

    def test_a_lost_answer_commit_is_retried_without_a_second_write(self):
        actor = self.students[5]
        value = self.begin(actor)
        with self.commit_acknowledgement_lost() as calls:
            reply, accepted = self.store.submit(value['session_id'], actor, self.request(value))
        self.assertEqual(calls, [1])
        self.assertFalse(accepted)  # the retry found the committed step and returned its original reply
        self.assertEqual(self.counts(value['session_id'])[1], 1)
        self.assertEqual(reply, self.store.current(value['session_id'], actor))
        with psycopg.connect(self.url) as conn:
            self.assertEqual(verify_session(conn, value['session_id']), [])

    def test_an_error_inside_the_write_batch_rolls_the_whole_answer_back(self):
        class BadPosterior(PostgresStore):
            @staticmethod
            def _write_question(conn, sid, index, state):  # a real database error in the middle of the batch
                PostgresStore._write_question(conn, sid, index, state)
                conn.execute('INSERT INTO sonder.step_posterior (step_id, session_hypothesis_id, probability) '
                             'SELECT s.id, h.id, 2 FROM sonder.session_step s JOIN sonder.session_hypothesis h '
                             'ON h.session_id = s.session_id WHERE s.session_id = %s LIMIT 1', (sid,))
        actor = self.students[6]
        value = self.begin(actor)
        before = self.counts(value['session_id'])
        bad = BadPosterior(self.url, self.label)
        self.addCleanup(bad.close)
        with self.assertRaises(ServiceError) as caught:
            bad.submit(value['session_id'], actor, self.request(value))
        self.assertEqual((caught.exception.status, caught.exception.code), (500, 'storage_error'))
        self.assertEqual(self.counts(value['session_id']), before)  # no step, posterior or second question
        self.assertEqual(self.store.current(value['session_id'], actor), value)
        self.assertTrue(self.store.submit(value['session_id'], actor, self.request(value))[1])

    def test_a_trace_rejected_at_commit_leaves_no_partial_rows(self):
        class NoCandidates(PostgresStore):
            @staticmethod
            def _write_question(conn, sid, index, state):  # a next question without its ranked candidates
                q = state.pending
                conn.execute(
                    'INSERT INTO sonder.session_question (session_id, step_index, item_id, selection_reason, '
                    'entropy_before, expected_ig) VALUES (%s, %s, %s, %s, 1, 0)',
                    (sid, q.step_index, index.item_ids[q.item_id], q.selection_reason))
        actor = self.students[7]
        value = self.begin(actor)
        before = self.counts(value['session_id'])
        bad = NoCandidates(self.url, self.label)
        self.addCleanup(bad.close)
        with self.assertRaises(ServiceError) as caught:
            bad.submit(value['session_id'], actor, self.request(value))
        self.assertEqual(caught.exception.status, 500)
        self.assertEqual(self.counts(value['session_id']), before)
        self.assertTrue(self.store.submit(value['session_id'], actor, self.request(value))[1])

    def test_concurrent_answers_accept_one_step_per_index_with_no_replay_mismatch(self):
        actor = self.students[8]
        value = self.begin(actor)
        sid = value['session_id']
        allowed = {(409, 'answer_conflict'), (409, 'step_conflict'), (409, 'item_conflict'), (409, 'session_finished')}
        seen = []

        def worker(option):
            while True:
                try:
                    current = self.store.current(sid, actor)
                    if current['status'] == 'complete':
                        return
                    self.store.submit(sid, actor, self.request(current, option))
                except ServiceError as exc:
                    seen.append((exc.status, exc.code))
                    if (exc.status, exc.code) not in allowed:
                        return
        with concurrent.futures.ThreadPoolExecutor(4) as pool:
            list(pool.map(worker, 'BBBB'))
        self.assertTrue(set(seen) <= allowed, seen)
        with psycopg.connect(self.url) as conn:
            indexes = [r[0] for r in conn.execute('SELECT step_index FROM sonder.session_step WHERE session_id=%s ORDER BY step_index', (sid,)).fetchall()]
            self.assertEqual(verify_session(conn, sid), [])
        self.assertEqual(indexes, list(range(len(indexes))))
        self.assertGreater(len(indexes), 0)
