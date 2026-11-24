"""Stored evidence and deterministic replay, including tamper detection."""
import contextlib
import io
from uuid import uuid4

from pgtest import DatabaseTestCase, HAVE_PSYCOPG

if HAVE_PSYCOPG:
    import psycopg
    import sonder_engine
    from engine_students import deterministic_answer
    from sonder_api.contracts import AnswerRequest, StartRequest
    from sonder_api.devseed import params_sha256, seed
    from sonder_api.pgpack import load_release, load_unit
    from sonder_api.pgstore import PostgresStore
    from sonder_api.store import ServiceError
    from sonder_api.stored_evidence import main, stored_evidence, verify_session
    from sonder_db.migrate import up
    from sonder_engine import Params, answer, next_question, start
    from sonder_engine.trace import trace_of, trace_to_dict


class EvidenceTests(DatabaseTestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        up(cls.url)
        with psycopg.connect(cls.url) as conn:
            cls.seeded = seed(conn, synthetic_students=20)
        cls.students = list(cls.seeded['students'].values())
        cls.label = cls.seeded['release']

    def setUp(self):
        self.store = PostgresStore(self.url, self.label)
        self.addCleanup(self.store.close)

    def begin(self, actor, store=None):
        return (store or self.store).create(actor, StartRequest(unit_id='U1', create_request_id=str(uuid4())))

    def submit(self, actor, value, option, store=None):
        q = value['question']
        return (store or self.store).submit(value['session_id'], actor, AnswerRequest(step_index=q['step_index'], item_id=q['item_id'], option_id=option))[0]

    def d1(self, actor):
        value = self.begin(actor)
        for option in 'BBAB':  # D1 opens on T1-001 after the link changes.
            value = self.submit(actor, value, option)
        return value

    def test_every_session_matches_its_replay(self):
        with psycopg.connect(self.url) as conn:
            unit, _ = load_unit(conn, load_release(conn, self.label), 'U1')
        policies = [lambda item, h=h: deterministic_answer(item, h) for h in unit.hyps[:-1]]
        policies += [lambda item, i=i: i for i in range(4)]
        policies += [lambda item: next((i for i, links in enumerate(item.links) if i != item.correct_index and not links), item.correct_index)]
        self.assertEqual(len(policies), 10)
        ids = []
        for actor, policy in zip(self.students, policies):
            value = self.begin(actor)
            while value['status'] != 'complete':
                item = next(item for item in unit.engine_items if item.item_id == value['question']['item_id'])
                value = self.submit(actor, value, item.option_ids[policy(item)])
            ids.append(value['session_id'])
        ids.append(self.d1(self.students[10])['session_id'])
        partial = self.begin(self.students[11])
        for option in 'DB':
            partial = self.submit(self.students[11], partial, option)
        ids.append(partial['session_id'])
        with psycopg.connect(self.url) as conn:
            for sid in ids:
                self.assertEqual(verify_session(conn, sid), [], sid)

    def test_stored_evidence_shape(self):
        finished = self.d1(self.students[12])
        partial = self.begin(self.students[13])
        for option in 'DB':
            partial = self.submit(self.students[13], partial, option)
        with psycopg.connect(self.url) as conn:
            evidence = stored_evidence(conn, finished['session_id'])
            unfinished = stored_evidence(conn, partial['session_id'])
        self.assertEqual(evidence['outcome']['outcome'], 'diagnosed')
        self.assertEqual((len(evidence['steps']), len(evidence['questions'])), (4, 4))
        self.assertEqual(len(unfinished['questions']), len(unfinished['steps']) + 1)
        self.assertEqual(evidence['release'], self.label)
        self.assertTrue(evidence['engine_release'].startswith(sonder_engine.__version__ + '+'))
        self.assertEqual(evidence['params_sha256'], params_sha256(Params()))

    def test_restart_resume_continues_identically(self):
        actor = self.students[14]
        value = self.begin(actor)
        for option in 'DB':
            value = self.submit(actor, value, option)
        self.store.close()
        replacement = PostgresStore(self.url, self.label)
        self.addCleanup(replacement.close)
        self.assertEqual(replacement.current(value['session_id'], actor), value)
        for option in 'BA':
            value = self.submit(actor, value, option, replacement)
        with psycopg.connect(self.url) as conn:
            self.assertEqual(verify_session(conn, value['session_id']), [])
            release = load_release(conn, self.label)
            unit, _ = load_unit(conn, release, 'U1')
        direct = next_question(start(unit, release.params))
        for option in 'DBBA':
            direct = answer(direct, direct.pending.item_id, option)
            if not direct.finished:
                direct = next_question(direct)
        self.assertEqual(replacement.inspect(value['session_id'])['trace'], trace_to_dict(trace_of(direct)))

    def test_tampered_posterior_is_detected(self):
        value = self.d1(self.students[15])
        with psycopg.connect(self.url) as conn:
            with conn.transaction():
                conn.execute('SET LOCAL session_replication_role = replica')
                conn.execute('UPDATE sonder.step_posterior sp SET probability=probability+0.0000001 FROM sonder.session_step st WHERE st.id=sp.step_id AND st.session_id=%s AND st.step_index=0', (value['session_id'],))
            differences = verify_session(conn, value['session_id'])
        self.assertTrue(differences)
        self.assertIn('posterior', differences[0])

    def test_tampered_answer_makes_service_refuse(self):
        actor = self.students[16]
        value = self.begin(actor)
        for option in 'BBA':  # On the revised D1 path, tampering with A changes the questions.
            value = self.submit(actor, value, option)
        with psycopg.connect(self.url) as conn:
            with conn.transaction():
                conn.execute('SET LOCAL session_replication_role = replica')
                conn.execute("UPDATE sonder.session_step st SET answer_option_id=o.id FROM sonder.item_option old JOIN sonder.item_option o ON o.item_id=old.item_id AND o.label='A' WHERE st.answer_option_id=old.id AND st.session_id=%s AND st.step_index=0", (value['session_id'],))
            self.assertTrue(verify_session(conn, value['session_id']))
        try:
            current = self.store.current(value['session_id'], actor)
            self.submit(actor, current, 'A')
        except ServiceError as exc:
            self.assertEqual(exc.code, 'replay_mismatch')
        else:
            self.fail('tampered answer was not refused')



class EvidenceCliTests(DatabaseTestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        up(cls.url)
        with psycopg.connect(cls.url) as conn:
            seeded = seed(conn, synthetic_students=1)
        cls.actor = next(iter(seeded['students'].values()))
        cls.label = seeded['release']

    def d1(self, actor):
        store = PostgresStore(self.url, self.label)
        self.addCleanup(store.close)
        value = store.create(actor, StartRequest(unit_id='U1', create_request_id=str(uuid4())))
        for option in 'BBAB':  # D1 opens on T1-001 after the link changes.
            q = value['question']
            value, _ = store.submit(value['session_id'], actor, AnswerRequest(step_index=q['step_index'], item_id=q['item_id'], option_id=option))
        return value

    def test_cli_all_exit_codes(self):
        value = self.d1(self.actor)
        with contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(main(['--all', '--database-url', self.url]), 0)
        with psycopg.connect(self.url) as conn:
            with conn.transaction():
                conn.execute('SET LOCAL session_replication_role = replica')
                conn.execute('UPDATE sonder.step_posterior sp SET probability=probability+0.0000001 FROM sonder.session_step st WHERE st.id=sp.step_id AND st.session_id=%s AND st.step_index=0', (value['session_id'],))
        with contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(main(['--all', '--database-url', self.url]), 1)
