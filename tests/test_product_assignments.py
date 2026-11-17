"""Class assignments of a frozen Maths unit (I2-H11, migration 0005) on real PostgreSQL.

Uses the frozen U1 development release from sonder_api.devseed, the content the persistent
service runs today.
"""

from __future__ import annotations

import unittest

from product_db import HAVE_PSYCOPG, ProductDatabaseTestCase

if HAVE_PSYCOPG:
    import psycopg


class AssignmentTestCase(ProductDatabaseTestCase):
    with_dev_release = True

    def new_class(self, teacher=None):
        teacher = teacher or self.user("teacher")
        class_id, code = self.call("SELECT class_id::text, join_code FROM sonder.create_class(%s, 'Grade 8')",
                                   (teacher,))[0]
        return teacher, class_id, code

    def assign(self, teacher, class_id, unit="U1", title="Rounding check", rule="single", version=None):
        return self.call("SELECT sonder.create_assignment(%s, %s, %s, %s, %s, %s)::text",
                         (teacher, class_id, version or self.release_version, unit, title, rule))[0][0]

    def teacher_list(self, teacher, class_id):
        return self.call("SELECT assignment_id::text, title, unit_code, status, attempt_rule "
                         "FROM sonder.class_assignments(%s, %s) ORDER BY created_at, assignment_id", (teacher, class_id))

    def student_list(self, student):
        return self.call("SELECT assignment_id::text, title, unit_code, unit_name, class_name "
                         "FROM sonder.student_assignments(%s) ORDER BY created_at, assignment_id", (student,))


class CreateAssignmentTests(AssignmentTestCase):
    def test_assigns_a_unit_of_the_running_release(self):
        teacher, class_id, _ = self.new_class()
        assignment = self.assign(teacher, class_id, title="  Rounding check ", rule="repeat")
        self.assertEqual(self.teacher_list(teacher, class_id), [(assignment, "Rounding check", "U1", "open", "repeat")])
        self.assertEqual(self.call("SELECT version_code FROM sonder.class_assignments(%s, %s)", (teacher, class_id)),
                         [(self.release_version,)])
        unit_version = self.call(
            "SELECT cv.version_code, cv.status FROM sonder.class_assignment a JOIN sonder.diagnostic_unit u ON u.id = a.unit_id "
            "JOIN sonder.content_version cv ON cv.id = u.content_version_id WHERE a.id = %s", (assignment,))
        self.assertEqual(unit_version, [(self.release_version, "frozen")])
        self.assertEqual(self.call("SELECT actor_id::text, event_type FROM sonder.audit_event WHERE row_id = %s",
                                   (assignment,)), [(teacher, "INSERT")])

    def test_default_rule_is_single(self):
        teacher, class_id, _ = self.new_class()
        assignment = self.call("SELECT sonder.create_assignment(%s, %s, %s, 'U1', 'Default rule')::text",
                               (teacher, class_id, self.release_version))[0][0]
        self.assertEqual(self.call("SELECT attempt_rule FROM sonder.class_assignment WHERE id = %s", (assignment,)),
                         [("single",)])

    def test_input_checks(self):
        teacher, class_id, _ = self.new_class()
        for title in ("", "   ", None, "t" * 121):
            with self.subTest(title=title), self.assertProductError("assignment_title_invalid"):
                self.assign(teacher, class_id, title=title)
        for rule in ("twice", "", None):
            with self.subTest(rule=rule), self.assertProductError("attempt_rule_invalid"):
                self.assign(teacher, class_id, rule=rule)
        for unit, version in (("U9", None), ("U1", "Some-other-version"), ("", None)):
            with self.subTest(unit=unit, version=version), self.assertProductError("unit_not_found"):
                self.assign(teacher, class_id, unit=unit, version=version)
        self.assertEqual(self.teacher_list(teacher, class_id), [])

    def test_only_the_class_teacher_of_an_active_class_can_assign(self):
        teacher, class_id, _ = self.new_class()
        for outsider in (self.user("teacher"), self.user("student"), self.user("admin")):
            with self.subTest(outsider=outsider), self.assertProductError("class_not_found"):
                self.assign(outsider, class_id)
        self.call("SELECT sonder.set_class_status(%s, %s, 'archived')", (teacher, class_id))
        with self.assertProductError("class_archived"):
            self.assign(teacher, class_id)

    def test_a_draft_content_version_cannot_be_assigned(self):
        teacher, class_id, _ = self.new_class()
        with self.connect() as conn:
            version = conn.execute(
                "INSERT INTO sonder.content_version (subject_id, version_code) "
                "SELECT id, 'Draft-version' FROM sonder.subject WHERE code = 'MATH' RETURNING id").fetchone()[0]
            conn.execute("INSERT INTO sonder.diagnostic_unit (content_version_id, unit_code, name) VALUES (%s, 'U1', 'Draft U1')",
                         (version,))
        with self.assertProductError("unit_not_found"):
            self.assign(teacher, class_id, version="Draft-version")

    def test_a_class_that_does_not_teach_maths_cannot_receive_it(self):
        teacher = self.user("teacher")
        with self.connect() as conn:
            class_id = conn.execute("INSERT INTO sonder.classroom (name, join_code) VALUES ('No subject', 'NOSUBJECT2') "
                                    "RETURNING id::text").fetchone()[0]
            conn.execute("INSERT INTO sonder.class_teacher (class_id, teacher_id) VALUES (%s, %s)", (class_id, teacher))
        with self.assertProductError("unit_not_found"):
            self.assign(teacher, class_id)

    def test_direct_inserts_are_checked_too(self):
        teacher, class_id, _ = self.new_class()
        unit = self.call("SELECT u.id FROM sonder.diagnostic_unit u JOIN sonder.content_version cv ON cv.id = u.content_version_id "
                         "WHERE cv.version_code = %s AND u.unit_code = 'U1'", (self.release_version,))[0][0]
        with self.assertRaisesRegex(psycopg.Error, "active teacher of its class"):
            self.call("INSERT INTO sonder.class_assignment (class_id, unit_id, title, created_by) VALUES (%s, %s, 'x', %s)",
                      (class_id, unit, self.user("teacher")))
        with self.assertRaises(psycopg.errors.CheckViolation):
            self.call("INSERT INTO sonder.class_assignment (class_id, unit_id, title, created_by) VALUES (%s, %s, ' padded ', %s)",
                      (class_id, unit, teacher))


class AssignmentStateTests(AssignmentTestCase):
    def test_close_and_reopen_by_the_class_teacher_only(self):
        teacher, class_id, _ = self.new_class()
        assignment = self.assign(teacher, class_id)
        self.call("SELECT sonder.set_assignment_status(%s, %s, 'closed')", (teacher, assignment))
        self.call("SELECT sonder.set_assignment_status(%s, %s, 'closed')", (teacher, assignment))  # no-op
        self.assertEqual(self.teacher_list(teacher, class_id)[0][3], "closed")
        for outsider in (self.user("teacher"), self.user("student")):
            with self.subTest(outsider=outsider), self.assertProductError("assignment_not_found"):
                self.call("SELECT sonder.set_assignment_status(%s, %s, 'open')", (outsider, assignment))
        with self.assertProductError("assignment_not_found"):
            self.call("SELECT sonder.set_assignment_status(%s, %s, 'open')", (teacher, "00000000-0000-4000-8000-000000000000"))
        for bad in ("archived", None):
            with self.subTest(status=bad), self.assertProductError("assignment_status_invalid"):
                self.call("SELECT sonder.set_assignment_status(%s, %s, %s)", (teacher, assignment, bad))
        self.call("SELECT sonder.set_assignment_status(%s, %s, 'open')", (teacher, assignment))
        self.assertEqual(self.teacher_list(teacher, class_id)[0][3], "open")

    def test_unit_rule_and_owner_are_fixed(self):
        teacher, class_id, _ = self.new_class()
        assignment = self.assign(teacher, class_id)
        for column, value in (("attempt_rule", "'repeat'"), ("created_by", "gen_random_uuid()"), ("class_id", "gen_random_uuid()")):
            with self.subTest(column=column), self.assertRaisesRegex(psycopg.Error, "Immutable key"):
                self.call(f"UPDATE sonder.class_assignment SET {column} = {value} WHERE id = %s", (assignment,))
        self.call("UPDATE sonder.class_assignment SET title = 'Renamed' WHERE id = %s", (assignment,))
        with self.assertRaisesRegex(psycopg.Error, "Illegal class_assignment transition|Invalid initial"):
            self.call("UPDATE sonder.class_assignment SET status = 'done' WHERE id = %s", (assignment,))

    def test_teacher_list_is_private_to_the_class_teacher(self):
        teacher, class_id, _ = self.new_class()
        self.assign(teacher, class_id)
        self.assertEqual(self.teacher_list(self.user("teacher"), class_id), [])
        self.assertEqual(self.teacher_list(self.user("student"), class_id), [])


class StudentAssignmentTests(AssignmentTestCase):
    def test_students_see_open_assignments_of_their_active_classes_only(self):
        teacher, class_id, code = self.new_class()
        member, outsider, leaver = self.user("student"), self.user("student"), self.user("student")
        for student in (member, leaver):
            self.call("SELECT * FROM sonder.join_class(%s, %s)", (student, code))
        shown = self.assign(teacher, class_id, title="Open one")
        hidden = self.assign(teacher, class_id, title="Closed one")
        self.call("SELECT sonder.set_assignment_status(%s, %s, 'closed')", (teacher, hidden))
        self.call("SELECT sonder.remove_student(%s, %s, %s)", (teacher, class_id, leaver))

        unit_name = self.call("SELECT unit_name FROM sonder.class_assignments(%s, %s) LIMIT 1", (teacher, class_id))[0][0]
        self.assertEqual(self.student_list(member), [(shown, "Open one", "U1", unit_name, "Grade 8")])
        self.assertEqual(self.student_list(outsider), [])
        self.assertEqual(self.student_list(leaver), [])
        self.call("SELECT sonder.set_class_status(%s, %s, 'archived')", (teacher, class_id))
        self.assertEqual(self.student_list(member), [])

    def test_student_rows_carry_no_content_or_result_fields(self):
        with self.connect() as conn, conn.cursor() as cur:
            cur.execute("SELECT * FROM sonder.student_assignments(%s)", (self.user("student"),))
            columns = {c.name for c in cur.description}
        self.assertEqual(columns, {"assignment_id", "class_id", "class_name", "title", "unit_code", "unit_name",
                                   "attempt_rule", "created_at"})


if __name__ == "__main__":
    unittest.main()
