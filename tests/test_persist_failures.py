"""Failures, concurrency and process restart against PostgreSQL."""
import concurrent.futures
import os
import socket
import subprocess
import sys
import time
from pathlib import Path
from uuid import uuid4

from pgtest import ADMIN_URL, DatabaseTestCase, HAVE_PSYCOPG

if HAVE_PSYCOPG:
    import httpx
    import psycopg
    from fastapi.testclient import TestClient
    from sonder_api.app import create_app
    from sonder_api.contracts import AnswerRequest, StartRequest
    from sonder_api.devseed import seed
    from sonder_api.pgstore import PostgresStore
    from sonder_api.store import ServiceError
    from sonder_api.stored_evidence import verify_session
    from sonder_db.migrate import up


class FailureTests(DatabaseTestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        up(cls.url)
        with psycopg.connect(cls.url) as conn:
            seeded = seed(conn, synthetic_students=8)
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

    def test_terminated_connections_recover(self):
        actor = self.students[0]
        value = self.begin(actor)
        with psycopg.connect(ADMIN_URL, autocommit=True) as conn:
            conn.execute("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=%s AND pid <> pg_backend_pid()", (self.db_name,))
        outcomes = []
        for _ in range(3):
            try:
                self.assertEqual(self.store.current(value['session_id'], actor), value)
                outcomes.append('ok')
            except ServiceError as exc:
                outcomes.append((exc.status, exc.code))
        self.assertEqual(outcomes[-1], 'ok')
        self.assertTrue(all(result == 'ok' for result in outcomes[1:]))
        if outcomes[0] != 'ok':
            self.assertEqual(outcomes[0], (503, 'storage_unavailable'))

    def test_failure_after_writes_before_commit_rolls_back(self):
        class Boom(PostgresStore):
            def _before_commit(self, sid, step_index):
                raise psycopg.OperationalError('simulated')
        actor = self.students[1]
        value = self.begin(actor)
        boom = Boom(self.url, self.label)
        self.addCleanup(boom.close)
        with self.assertRaises(ServiceError) as caught:
            boom.submit(value['session_id'], actor, self.request(value))
        self.assertEqual((caught.exception.status, caught.exception.code), (503, 'storage_unavailable'))
        self.assertEqual(self.step_count(value['session_id']), 0)
        self.assertTrue(self.store.submit(value['session_id'], actor, self.request(value))[1])

    def test_failure_after_commit_retry_is_harmless(self):
        actor = self.students[2]
        value = self.begin(actor)
        first, accepted = self.store.submit(value['session_id'], actor, self.request(value))
        self.assertTrue(accepted)
        again, accepted = self.store.submit(value['session_id'], actor, self.request(value))
        self.assertFalse(accepted)
        self.assertEqual(first, again)
        self.assertEqual(self.step_count(value['session_id']), 1)

    def test_two_service_instances_serialise_answers(self):
        actor = self.students[3]
        other = PostgresStore(self.url, self.label)
        self.addCleanup(other.close)
        for _ in range(10):
            value = self.begin(actor)
            def submit(pair):
                store, option = pair
                try:
                    store.submit(value['session_id'], actor, self.request(value, option))
                    return (200, '')
                except ServiceError as exc:
                    return (exc.status, exc.code)
            with concurrent.futures.ThreadPoolExecutor(2) as pool:
                results = list(pool.map(submit, [(self.store, 'A'), (other, 'D')]))
            self.assertCountEqual(results, [(200, ''), (409, 'answer_conflict')])
            self.assertEqual(self.step_count(value['session_id']), 1)

    def test_startup_without_database_exits_nonzero(self):
        env = {**os.environ, 'SONDER_DATABASE_URL': 'host=127.0.0.1 port=1 dbname=none user=sonder password=x', 'SONDER_ENGINE_TOKEN': 't' * 32}
        result = subprocess.run([sys.executable, '-m', 'sonder_api', '--store', 'postgres', '--release', self.label], env=env, capture_output=True, text=True, timeout=60)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Application startup failed', result.stderr)

    def test_postgres_mode_requires_release(self):
        env = {**os.environ, 'SONDER_ENGINE_TOKEN': 't' * 32}
        env.pop('SONDER_RELEASE', None)
        result = subprocess.run([sys.executable, '-m', 'sonder_api', '--store', 'postgres'], env=env, capture_output=True, text=True, timeout=60)
        self.assertEqual(result.returncode, 2)

    def test_health_reports_storage_unavailable(self):
        with TestClient(create_app('t' * 32, store=self.store)) as client:
            self.store.pool.close()
            response = client.get('/engine/health', headers={'X-Sonder-Token': 't' * 32})
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json(), {'error': {'code': 'storage_unavailable'}})
