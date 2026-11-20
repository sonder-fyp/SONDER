"""Class creation and the teacher's class list (I2-H09, migration 0003_classes) on real PostgreSQL."""

from __future__ import annotations

import re
import unittest

from product_db import HAVE_PSYCOPG, ProductDatabaseTestCase

if HAVE_PSYCOPG:
    import psycopg

CODE = re.compile(r"^[A-HJ-NP-Z2-9]{10}$")  # no 0/O, no 1/I


class CreateClassTests(ProductDatabaseTestCase):
    def create(self, teacher, name="Grade 8 Blue", note=""):
        return self.call("SELECT class_id::text, join_code FROM sonder.create_class(%s, %s, %s)",
                         (teacher, name, note))[0]

    def test_creates_owned_maths_class(self):
        teacher = self.user("teacher")
        class_id, code = self.create(teacher, "  Grade 8 Blue  ", "  Morning group ")
        self.assertRegex(code, CODE)
        self.assertEqual(self.call("SELECT name, note, join_code, status, grade_level FROM sonder.classroom "
                                   "WHERE id = %s", (class_id,)),
                         [("Grade 8 Blue", "Morning group", code, "active", 8)])
        self.assertEqual(self.call("SELECT teacher_id::text, status FROM sonder.class_teacher WHERE class_id = %s",
                                   (class_id,)), [(teacher, "active")])
        self.assertEqual(self.call("SELECT s.code FROM sonder.class_subject cs JOIN sonder.subject s "
                                   "ON s.id = cs.subject_id WHERE cs.class_id = %s", (class_id,)), [("MATH",)])

    def test_audit_records_the_teacher_as_actor(self):
        teacher = self.user("teacher")
        class_id, _ = self.create(teacher)
        rows = self.call("SELECT relation_name, event_type FROM sonder.audit_event WHERE actor_id = %s "
                         "ORDER BY relation_name", (teacher,))
        self.assertIn(("classroom", "INSERT"), rows)
        self.assertIn(("class_teacher", "INSERT"), rows)
        self.assertEqual(self.call("SELECT count(*) FROM sonder.audit_event WHERE row_id = %s AND actor_id = %s",
                                   (class_id, teacher)), [(1,)])

    def test_only_an_active_teacher_can_create(self):
        for who in (self.user("student"), self.user("parent"), self.user("admin"),
                    self.user("teacher", active=False), "00000000-0000-4000-8000-000000000000"):
            with self.subTest(who=who), self.assertProductError("teacher_required"):
                self.create(who, "Should not exist")
        self.assertEqual(self.call("SELECT count(*) FROM sonder.classroom WHERE name = 'Should not exist'"), [(0,)])

    def test_name_and_note_limits(self):
        teacher = self.user("teacher")
        for name in ("", "   ", None, "x" * 81):
            with self.subTest(name=name), self.assertProductError("class_name_invalid"):
                self.create(teacher, name)
        with self.assertProductError("class_note_invalid"):
            self.create(teacher, "Fine name", "n" * 501)
        self.assertRegex(self.create(teacher, "x" * 80, "n" * 500)[1], CODE)

    def test_join_codes_use_the_safe_alphabet_and_vary(self):
        codes = [row[0] for row in self.call("SELECT sonder.new_join_code() FROM generate_series(1, 300)")]
        for code in codes:
            self.assertRegex(code, CODE)
        self.assertGreaterEqual(len(set(codes)), 299)

    def test_code_collisions_are_retried_then_reported(self):
        teacher = self.user("teacher")
        with self.connect() as conn, conn.transaction(force_rollback=True):
            # Within this rolled-back transaction every generated code is the same, so the
            # second class collides on all five attempts.
            conn.execute("CREATE OR REPLACE FUNCTION sonder.new_join_code() RETURNS text LANGUAGE sql "
                         "AS $$ SELECT 'SAMECODE22' $$")
            conn.execute("SELECT * FROM sonder.create_class(%s, 'First', '')", (teacher,))
            with self.assertRaises(psycopg.Error) as caught, conn.transaction():
                conn.execute("SELECT * FROM sonder.create_class(%s, 'Second', '')", (teacher,))
            self.assertEqual(caught.exception.sqlstate, "SN001")
            self.assertEqual(caught.exception.diag.message_primary, "join_code_unavailable")
        self.assertRegex(self.call("SELECT sonder.new_join_code()")[0][0], CODE)


class TeacherClassesTests(ProductDatabaseTestCase):
    def test_each_teacher_sees_only_their_own_classes(self):
        alice, bob = self.user("teacher"), self.user("teacher")
        a1 = self.call("SELECT class_id::text FROM sonder.create_class(%s, 'Alice 1')", (alice,))[0][0]
        a2 = self.call("SELECT class_id::text FROM sonder.create_class(%s, 'Alice 2')", (alice,))[0][0]
        b1 = self.call("SELECT class_id::text FROM sonder.create_class(%s, 'Bob 1')", (bob,))[0][0]
        mine = lambda t: {r[0] for r in self.call("SELECT class_id::text FROM sonder.teacher_classes(%s)", (t,))}
        self.assertEqual(mine(alice), {a1, a2})
        self.assertEqual(mine(bob), {b1})
        self.assertEqual(mine(self.user("student")), set())

    def test_counts_only_active_students_and_drops_departed_teachers(self):
        teacher = self.user("teacher")
        class_id = self.call("SELECT class_id::text FROM sonder.create_class(%s, 'Counted')", (teacher,))[0][0]
        stay, leave = self.user("student"), self.user("student")
        with self.connect() as conn:
            for student in (stay, leave):
                conn.execute("INSERT INTO sonder.enrolment (class_id, student_id) VALUES (%s, %s)", (class_id, student))
            conn.execute("UPDATE sonder.enrolment SET status = 'left' WHERE student_id = %s", (leave,))
        rows = self.call("SELECT name, status, student_count FROM sonder.teacher_classes(%s)", (teacher,))
        self.assertEqual(rows, [("Counted", "active", 1)])
        with self.connect() as conn:
            conn.execute("UPDATE sonder.class_teacher SET status = 'departed' WHERE teacher_id = %s", (teacher,))
        self.assertEqual(self.call("SELECT * FROM sonder.teacher_classes(%s)", (teacher,)), [])


class MissingSubjectTests(ProductDatabaseTestCase):
    with_math_subject = False

    def test_class_creation_needs_the_maths_subject(self):
        with self.assertProductError("subject_missing"):
            self.call("SELECT * FROM sonder.create_class(%s, 'No subject yet')", (self.user("teacher"),))
        self.assertEqual(self.call("SELECT count(*) FROM sonder.classroom"), [(0,)])


if __name__ == "__main__":
    unittest.main()
