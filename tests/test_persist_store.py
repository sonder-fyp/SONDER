"""Persistent session parity, transactions, access and release pinning."""
import concurrent.futures
import itertools
import os
from dataclasses import replace
from unittest.mock import patch
from uuid import uuid4

from pgtest import DatabaseTestCase, HAVE_PSYCOPG

if HAVE_PSYCOPG:
    import psycopg
    from fastapi.testclient import TestClient
    from psycopg_pool import PoolTimeout
    from engine_students import deterministic_answer
    from sonder_api.app import create_app
    from sonder_api.contract_check import run_checks
    from sonder_api.contracts import AnswerRequest, StartRequest
    from sonder_api.devseed import main, seed
    from sonder_api.pgpack import ReleaseError, load_release, load_unit
    from sonder_api.pgstore import PostgresStore
    from sonder_api.store import ServiceError
    from sonder_db.migrate import up
    from sonder_engine import Params, answer, next_question, start
    from sonder_engine.bayes import likelihood_matrix
    from sonder_engine.trace import trace_of, trace_to_dict
    from sonder_pack.maths_v2 import load_maths_v2


class StoreTests(DatabaseTestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        up(cls.url)
        with psycopg.connect(cls.url) as conn:
            cls.seeded = seed(conn, synthetic_students=40)
        cls.students = list(cls.seeded['students'].values())
        cls.label = cls.seeded['release']

    def setUp(self):
        self.store = PostgresStore(self.url, self.label)
        self.addCleanup(self.store.close)

    def begin(self, actor, unit='U1', nonce=None, store=None, **kwargs):
        return (store or self.store).create(actor, StartRequest(unit_id=unit, create_request_id=nonce or str(uuid4()), **kwargs))

    def submit(self, actor, value, option, store=None):
        q = value['question']
        return (store or self.store).submit(value['session_id'], actor, AnswerRequest(step_index=q['step_index'], item_id=q['item_id'], option_id=option))

    def finish(self, actor, options='DBBA', store=None):
        value = self.begin(actor, store=store)
        seen = []
        for option in options:
            seen.append(value['question']['item_id'])
            value, _ = self.submit(actor, value, option, store)
        return value, seen

    def assert_service_error(self, status, code, operation):
        with self.assertRaises(ServiceError) as caught:
            operation()
        self.assertEqual((caught.exception.status, caught.exception.code), (status, code))

    def test_d1_worked_example(self):
        value, seen = self.finish(self.students[10])
        self.assertEqual(seen, ['T1-005', 'T1-006', 'T1-007', 'T1-009'])
        self.assertEqual(value['status'], 'complete')
        outcome = self.store.inspect(value['session_id'])['trace']['outcome']
        self.assertEqual((outcome['outcome'], outcome['rule']), ('diagnosed', 'R1'))

    def test_database_unit_equals_csv_unit(self):
        with psycopg.connect(self.url) as conn:
            release = load_release(conn, self.label)
            db_unit, _ = load_unit(conn, release, 'U1')
        file_unit = load_maths_v2().unit('U1')
        self.assertEqual(db_unit.engine_items, file_unit.engine_items)
        self.assertEqual(db_unit.hyps, file_unit.hyps)
        self.assertEqual([(p.stem, p.option_texts, p.target_misconception_id, p.batch) for p in db_unit.items], [(p.stem, p.option_texts, p.target_misconception_id, p.batch) for p in file_unit.items])
        self.assertEqual([(h.misconception_id, h.name) for h in db_unit.hypotheses], [(h.misconception_id, h.name) for h in file_unit.hypotheses])
        self.assertEqual(release.params, Params())

    def test_policies_match_engine_after_every_step_and_restart(self):
        with psycopg.connect(self.url) as conn:
            release = load_release(conn, self.label)
            unit, _ = load_unit(conn, release, 'U1')
        policies = [lambda item, h=h: deterministic_answer(item, h) for h in unit.hyps[:-1]]
        policies += [lambda item, i=i: i for i in range(4)]
        policies += [lambda item: next((i for i, links in enumerate(item.links) if i != item.correct_index and not links), item.correct_index)]
        self.assertEqual(len(policies), 10)
        for index, policy in enumerate(policies):
            actor = self.students[index]
            value = self.begin(actor)
            direct = next_question(start(unit, release.params))
            store = self.store
            self.assertEqual(store.inspect(value['session_id'])['trace'], trace_to_dict(trace_of(direct)))
            restarted = None
            try:
                while not direct.finished:
                    if len(direct.steps) == 1 and restarted is None:
                        restarted = PostgresStore(self.url, self.label)
                        store = restarted
                        self.assertEqual(store.current(value['session_id'], actor), value)
                    item = next(i for i in unit.engine_items if i.item_id == value['question']['item_id'])
                    option = item.option_ids[policy(item)]
                    value, _ = self.submit(actor, value, option, store)
                    direct = answer(direct, item.item_id, option)
                    if not direct.finished:
                        direct = next_question(direct)
                    self.assertEqual(store.inspect(value['session_id'])['trace'], trace_to_dict(trace_of(direct)))
            finally:
                if restarted:
                    restarted.close()

    def test_stored_numbers_are_exact(self):
        value, _ = self.finish(self.students[11])
        sid = value['session_id']
        trace = self.store.inspect(sid)['trace']
        with psycopg.connect(self.url) as conn:
            rows = conn.execute('SELECT st.step_index, sh.slot, sp.probability FROM sonder.step_posterior sp JOIN sonder.session_step st ON st.id=sp.step_id JOIN sonder.session_hypothesis sh ON sh.id=sp.session_hypothesis_id WHERE st.session_id=%s ORDER BY 1,2', (sid,)).fetchall()
            stored = {}
            for step, _, probability in rows:
                stored.setdefault(step, []).append(float(probability))
            self.assertEqual([stored[i] for i in sorted(stored)], [s['posterior'] for s in trace['steps']])
            rows = conn.execute('SELECT step_index, slot, support FROM sonder.step_support WHERE session_id=%s ORDER BY 1,2', (sid,)).fetchall()
            supports = {}
            for step, _, support in rows:
                supports.setdefault(step, []).append(support)
            self.assertEqual([supports[i] for i in sorted(supports)], [s['support'] for s in trace['steps']])
            release = load_release(conn, self.label)
            unit, _ = load_unit(conn, release, 'U1')
            probs = conn.execute("SELECT i.external_id, m.external_id, h.kind, o.label, rp.probability FROM sonder.response_probability rp JOIN sonder.item_option o ON o.id=rp.option_id JOIN sonder.item i ON i.id=o.item_id JOIN sonder.hypothesis h ON h.id=rp.hypothesis_id LEFT JOIN sonder.misconception_revision mr ON mr.id=h.misconception_revision_id LEFT JOIN sonder.misconception m ON m.id=mr.misconception_id WHERE rp.response_model_id=%s", (release.response_model_id,)).fetchall()
        table = {(item, misconception or kind.upper(), option): float(probability) for item, misconception, kind, option, probability in probs}
        self.assertEqual(len(table), 480)
        for item in unit.engine_items:
            matrix = likelihood_matrix(item, unit.hyps, release.params)
            for hi, hyp in enumerate(unit.hyps):
                for oi, option in enumerate(item.option_ids):
                    self.assertEqual(table[item.item_id, hyp, option], float(matrix[hi][oi]))

    def test_audit_rows_name_the_actor(self):
        actor = self.students[12]
        value, _ = self.finish(actor)
        with psycopg.connect(self.url) as conn:
            rows = conn.execute("SELECT event_type, actor_id FROM sonder.audit_event WHERE relation_name='diagnostic_session' AND row_id=%s", (value['session_id'],)).fetchall()
        self.assertEqual({row[0] for row in rows}, {'INSERT', 'UPDATE'})
        self.assertTrue(all(str(row[1]) == actor for row in rows))

    def test_parallel_identical_starts_create_one_session(self):
        actor, nonce = self.students[13], str(uuid4())
        with concurrent.futures.ThreadPoolExecutor(4) as pool:
            values = list(pool.map(lambda _: self.begin(actor, nonce=nonce), range(4)))
        self.assertTrue(all(value == values[0] for value in values))
        with psycopg.connect(self.url) as conn:
            self.assertEqual(conn.execute('SELECT count(*) FROM sonder.diagnostic_session WHERE request_key=%s', (nonce,)).fetchone()[0], 1)

    def test_parallel_identical_answers_accept_once(self):
        actor = self.students[14]
        value = self.begin(actor)
        with concurrent.futures.ThreadPoolExecutor(4) as pool:
            replies = list(pool.map(lambda _: self.submit(actor, value, 'D'), range(4)))
        self.assertTrue(all(reply[0] == replies[0][0] for reply in replies))
        self.assertEqual(sum(accepted for _, accepted in replies), 1)

    def test_competing_answers_accept_exactly_one(self):
        actor = self.students[15]
        value = self.begin(actor)
        def send(option):
            try:
                self.submit(actor, value, option)
                return (200, '')
            except ServiceError as exc:
                return (exc.status, exc.code)
        with concurrent.futures.ThreadPoolExecutor(2) as pool:
            results = list(pool.map(send, 'AB'))
        self.assertCountEqual(results, [(200, ''), (409, 'answer_conflict')])

    def test_start_retry_after_answers_returns_original(self):
        actor, nonce = self.students[16], str(uuid4())
        original = self.begin(actor, nonce=nonce)
        self.submit(actor, original, 'D')
        self.assertEqual(self.begin(actor, nonce=nonce), original)

    def test_same_key_other_unit_is_create_conflict(self):
        actor, nonce = self.students[17], str(uuid4())
        self.begin(actor, nonce=nonce)
        self.assert_service_error(409, 'create_conflict', lambda: self.begin(actor, 'U9', nonce))

    def test_step_item_and_finished_conflicts(self):
        actor = self.students[18]
        value = self.begin(actor)
        sid, q = value['session_id'], value['question']
        self.assert_service_error(409, 'step_conflict', lambda: self.store.submit(sid, actor, AnswerRequest(step_index=5, item_id=q['item_id'], option_id='A')))
        self.assert_service_error(409, 'item_conflict', lambda: self.store.submit(sid, actor, AnswerRequest(step_index=0, item_id='T0-000', option_id='A')))
        for option in 'DBBA':
            value, _ = self.submit(actor, value, option)
        self.assert_service_error(409, 'session_finished', lambda: self.store.submit(sid, actor, AnswerRequest(step_index=value['answered_count'], item_id=q['item_id'], option_id='A')))

    def test_other_student_cannot_read_or_answer(self):
        value = self.begin(self.students[19])
        other, sid, q = self.students[20], value['session_id'], value['question']
        self.assert_service_error(404, 'session_unavailable', lambda: self.store.current(sid, other))
        self.assert_service_error(404, 'session_unavailable', lambda: self.store.submit(sid, other, AnswerRequest(step_index=0, item_id=q['item_id'], option_id='A')))

    def test_crash_before_commit_leaves_no_step(self):
        class Boom(PostgresStore):
            def _before_commit(self, sid, step_index):
                raise RuntimeError('crash before commit')
        actor = self.students[21]
        value = self.begin(actor)
        boom = Boom(self.url, self.label)
        self.addCleanup(boom.close)
        with self.assertRaises(RuntimeError):
            self.submit(actor, value, 'D', boom)
        with psycopg.connect(self.url) as conn:
            self.assertEqual(conn.execute('SELECT (SELECT count(*) FROM sonder.session_step WHERE session_id=%s), (SELECT count(*) FROM sonder.session_question WHERE session_id=%s)', (value['session_id'],) * 2).fetchone(), (0, 1))
        self.assertEqual(self.store.current(value['session_id'], actor), value)
        self.assertTrue(self.submit(actor, value, 'D')[1])

    def test_enrolment_required_and_bad_ids(self):
        with psycopg.connect(self.url) as conn:
            loner = str(conn.execute("INSERT INTO sonder.app_user (email,role,display_name) VALUES ('loner@sonder.invalid','student','Loner') RETURNING id").fetchone()[0])
        for actor in (loner, str(uuid4())):
            self.assert_service_error(403, 'enrolment_required', lambda: self.begin(actor))
        self.assert_service_error(404, 'session_unavailable', lambda: self.begin('bad'))
        self.assert_service_error(404, 'session_unavailable', lambda: self.store.current('guessed', self.students[22]))
        self.assert_service_error(404, 'unit_not_found', lambda: self.begin(self.students[22], 'U2'))

    def test_assignment_id_refused(self):
        self.assert_service_error(404, 'assignment_not_found', lambda: self.begin(self.students[23], assignment_id=str(uuid4())))

    def test_later_release_does_not_change_existing_sessions(self):
        actor = self.students[24]
        value = self.begin(actor)
        value, _ = self.submit(actor, value, 'D')
        before = self.store.inspect(value['session_id'])
        with psycopg.connect(self.url) as conn:
            info = seed(conn, version_code='Maths_v2-U1-dev-b', params=replace(Params(), guess=0.2, theta=0.85), synthetic_students=40)
        newer = PostgresStore(self.url, info['release'])
        self.addCleanup(newer.close)
        self.assertEqual(newer.inspect(value['session_id']), before)
        value, _ = self.submit(actor, value, 'B', newer)
        self.assertEqual(dict(map(tuple, newer.inspect(value['session_id'])['trace']['params']))['guess'], 0.3)
        fresh = self.begin(self.students[25], store=newer)
        self.assertEqual(dict(map(tuple, newer.inspect(fresh['session_id'])['trace']['params']))['guess'], 0.2)

    def test_budget_refusal_writes_escalation(self):
        with psycopg.connect(self.url) as conn:
            info = seed(conn, version_code='Maths_v2-U1-dev-budget2', params=replace(Params(), default_budget=2), synthetic_students=40)
        store = PostgresStore(self.url, info['release'])
        self.addCleanup(store.close)
        actor = self.students[26]
        for options in itertools.product('ABCD', repeat=2):
            value = self.begin(actor, store=store)
            for option in options:
                if value['status'] == 'complete':
                    break
                value, _ = self.submit(actor, value, option, store)
            outcome = store.inspect(value['session_id'])['trace']['outcome']['outcome']
            if outcome.startswith('escalated_'):
                break
        else:
            self.fail('no two-answer sequence refused')
        self.assertEqual(value['status'], 'complete')
        with psycopg.connect(self.url) as conn:
            row = conn.execute('SELECT s.status, count(ec.*) FROM sonder.diagnostic_session s JOIN sonder.escalation e ON e.session_id=s.id JOIN sonder.escalation_candidate ec ON ec.escalation_id=e.id WHERE s.id=%s GROUP BY s.status', (value['session_id'],)).fetchone()
        self.assertEqual(row[0], outcome)
        self.assertGreaterEqual(row[1], 1)

    def test_list_sessions(self):
        actor = self.students[27]
        completed, _ = self.finish(actor)
        active = self.begin(actor)
        ongoing = self.store.list_sessions(actor, status='in_progress', unit_id='U1')['sessions']
        self.assertEqual(ongoing[0]['session_id'], active['session_id'])
        self.assertNotIn(completed['session_id'], [r['session_id'] for r in ongoing])
        self.assertIn(completed['session_id'], [r['session_id'] for r in self.store.list_sessions(actor, status='complete')['sessions']])
        self.assertFalse(self.store.list_sessions(actor, unit_id='U2')['sessions'])
        self.assertNotIn(active['session_id'], [r['session_id'] for r in self.store.list_sessions(self.students[28])['sessions']])

    def test_contract_check_passes_on_postgres(self):
        with TestClient(create_app('t' * 32, store=self.store)) as client:
            self.assertEqual(run_checks(client, 't' * 32, self.students[30], self.students[31], 'U1'), [])

    def test_unknown_release_and_missing_database_fail_startup(self):
        with self.assertRaises(ReleaseError):
            PostgresStore(self.url, 'nope/nope')
        with self.assertRaises(PoolTimeout):
            PostgresStore('host=127.0.0.1 port=1 dbname=none user=sonder password=x', self.label, timeout=1.0)

    def test_devseed_refuses_without_flag(self):
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop('SONDER_ALLOW_DEV_SEED', None)
            self.assertEqual(main([]), 2)

    def test_devseed_is_repeatable(self):
        with psycopg.connect(self.url) as conn:
            again = seed(conn, synthetic_students=40)
        self.assertEqual(again['release'], self.seeded['release'])
        self.assertEqual(again['class_id'], self.seeded['class_id'])
