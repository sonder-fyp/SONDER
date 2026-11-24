"""Shared helpers for the assignment-only-flow database tests (migration 0013); not a test module."""

from __future__ import annotations

from uuid import uuid4

from product_db import HAVE_PSYCOPG, ProductDatabaseTestCase

if HAVE_PSYCOPG:
    from sonder_api.contracts import AnswerRequest, StartRequest
    from sonder_api.pgstore import PostgresStore


class FlowTestCase(ProductDatabaseTestCase):
    with_dev_release = True

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.store = PostgresStore(cls.url, cls.release_label)

    @classmethod
    def tearDownClass(cls):
        cls.store.close()
        super().tearDownClass()

    def setUp(self):
        self.teacher = self.user("teacher")
        self.class_id, self.code = self.call("SELECT class_id::text, join_code FROM sonder.create_class(%s, 'Mine')", (self.teacher,))[0]
        self.student = self.user("student")
        self.call("SELECT * FROM sonder.join_class(%s, %s)", (self.student, self.code))

    def assign(self, title, rule="single", class_id=None):
        return self.call("SELECT sonder.create_assignment(%s, %s, %s, 'U1', %s, %s)::text",
                         (self.teacher, class_id or self.class_id, self.release_version, title, rule))[0][0]

    def start(self, assignment=None, student=None):
        return self.store.create(student or self.student,
                                 StartRequest(unit_id="U1", create_request_id=str(uuid4()), assignment_id=assignment))

    def answer(self, value, options, student=None):
        for option in options:
            q = value["question"]
            value, _ = self.store.submit(value["session_id"], student or self.student, AnswerRequest(
                step_index=q["step_index"], item_id=q["item_id"], option_id=option))
        return value

    def review(self, session_id, revision, status, teacher=None):
        self.call("SELECT sonder.add_session_review(%s, %s, %s, %s, '', %s)",
                  (teacher or self.teacher, session_id, revision, status, str(uuid4())))
