"""Join by code, roster, removal, new codes and archiving (I2-H10, migration 0004) on real PostgreSQL."""

from __future__ import annotations

import threading
import unittest

from product_db import ProductDatabaseTestCase


class MembershipTestCase(ProductDatabaseTestCase):
    def new_class(self, teacher=None, name="Grade 8 Blue"):
        teacher = teacher or self.user("teacher")
        class_id, code = self.call("SELECT class_id::text, join_code FROM sonder.create_class(%s, %s)",
                                   (teacher, name))[0]
        return teacher, class_id, code

    def join(self, student, code):
        return self.call("SELECT class_id::text, enrolment_id::text, joined FROM sonder.join_class(%s, %s)",
                         (student, code))[0]

    def roster(self, teacher, class_id):
        return [r[0] for r in self.call("SELECT student_id::text FROM sonder.class_roster(%s, %s)",
                                        (teacher, class_id))]


class JoinTests(MembershipTestCase):
    def test_join_is_idempotent_and_normalises_the_code(self):
        _, class_id, code = self.new_class()
        student = self.user("student")
        typed = f" {code[:4].lower()} {code[4:7]}-{code[7:]} "
        first = self.join(student, typed)
        self.assertEqual((first[0], first[2]), (class_id, True))
        again = self.join(student, code)
        self.assertEqual(again, (class_id, first[1], False))
        self.assertEqual(self.call("SELECT count(*) FROM sonder.enrolment WHERE student_id = %s", (student,)), [(1,)])
        self.assertEqual(self.call("SELECT actor_id::text FROM sonder.audit_event WHERE row_id = %s", (first[1],)),
                         [(student,)])

    def test_simultaneous_joins_by_one_student_make_one_enrolment(self):
        _, class_id, code = self.new_class()
        student = self.user("student")
        first, second = self.connect(), self.connect()
        try:
            first.execute("BEGIN")
            a = first.execute("SELECT enrolment_id::text, joined FROM sonder.join_class(%s, %s)", (student, code)).fetchone()
            # The second join blocks on the first one's uncommitted row until it commits.
            done = {}
            thread = threading.Thread(target=lambda: done.setdefault("row", second.execute(
                "SELECT enrolment_id::text, joined FROM sonder.join_class(%s, %s)", (student, code)).fetchone()))
            thread.start()
            thread.join(0.5)
            self.assertTrue(thread.is_alive())
            first.execute("COMMIT")
            thread.join(10)
            self.assertEqual(a[1], True)
            self.assertEqual(done["row"], (a[0], False))
        finally:
            first.close()
            second.close()
        self.assertEqual(self.call("SELECT count(*) FROM sonder.enrolment WHERE class_id = %s", (class_id,)), [(1,)])

    def test_unknown_and_archived_codes_give_the_same_error(self):
        teacher, class_id, code = self.new_class()
        student = self.user("student")
        for bad in ("", None, "NOPE", "ABCDEFGHJK" if code != "ABCDEFGHJK" else "ZZZZZZZZZZ"):
            with self.subTest(code=bad), self.assertProductError("join_code_invalid"):
                self.join(student, bad)
        self.call("SELECT sonder.set_class_status(%s, %s, 'archived')", (teacher, class_id))
        with self.assertProductError("join_code_invalid"):
            self.join(student, code)
        self.assertEqual(self.call("SELECT count(*) FROM sonder.enrolment WHERE student_id = %s", (student,)), [(0,)])

    def test_only_an_active_student_can_join(self):
        _, _, code = self.new_class()
        for who in (self.user("teacher"), self.user("parent"), self.user("admin"),
                    self.user("student", active=False), "00000000-0000-4000-8000-000000000000"):
            with self.subTest(who=who), self.assertProductError("student_required"):
                self.join(who, code)

    def test_a_removed_student_can_rejoin_with_the_current_code(self):
        teacher, class_id, code = self.new_class()
        student = self.user("student")
        enrolment = self.join(student, code)[1]
        self.call("SELECT sonder.remove_student(%s, %s, %s)", (teacher, class_id, student))
        self.assertEqual(self.roster(teacher, class_id), [])
        self.assertEqual(self.join(student, code), (class_id, enrolment, True))
        self.assertEqual(self.roster(teacher, class_id), [student])

    def test_student_class_list_shows_active_classes_with_teachers_and_no_code(self):
        teacher, class_id, code = self.new_class(name="Blue")
        other_teacher, other_id, other_code = self.new_class(name="Green")
        student = self.user("student")
        self.join(student, code)
        self.join(student, other_code)
        self.call("SELECT sonder.set_class_status(%s, %s, 'archived')", (other_teacher, other_id))
        rows = self.call("SELECT * FROM sonder.student_classes(%s)", (student,))
        self.assertEqual([(str(r[0]), r[1], r[3]) for r in rows], [(class_id, "Blue", "Test teacher")])
        columns = [c.name for c in self._columns("SELECT * FROM sonder.student_classes(%s)", (student,))]
        self.assertNotIn("join_code", columns)
        self.assertEqual(self.call("SELECT * FROM sonder.student_classes(%s)", (self.user("student"),)), [])

    def _columns(self, sql, params):
        with self.connect() as conn, conn.cursor() as cur:
            cur.execute(sql, params)
            return cur.description


class TeacherControlTests(MembershipTestCase):
    def test_roster_lists_active_students_for_the_class_teacher_only(self):
        teacher, class_id, code = self.new_class()
        a, b = self.user("student"), self.user("student")
        self.join(a, code)
        self.join(b, code)
        self.assertEqual(set(self.roster(teacher, class_id)), {a, b})
        self.assertEqual(self.call("SELECT display_name FROM sonder.class_roster(%s, %s) LIMIT 1", (teacher, class_id)),
                         [("Test student",)])
        self.assertEqual(self.roster(self.user("teacher"), class_id), [])
        self.assertEqual(self.roster(a, class_id), [])

    def test_only_the_class_teacher_can_remove_regenerate_or_archive(self):
        teacher, class_id, code = self.new_class()
        student = self.user("student")
        self.join(student, code)
        for outsider in (self.user("teacher"), student):
            with self.subTest(outsider=outsider):
                with self.assertProductError("class_not_found"):
                    self.call("SELECT sonder.remove_student(%s, %s, %s)", (outsider, class_id, student))
                with self.assertProductError("class_not_found"):
                    self.call("SELECT sonder.regenerate_join_code(%s, %s)", (outsider, class_id))
                with self.assertProductError("class_not_found"):
                    self.call("SELECT sonder.set_class_status(%s, %s, 'archived')", (outsider, class_id))
        self.assertEqual(self.roster(teacher, class_id), [student])
        self.assertEqual(self.call("SELECT join_code, status FROM sonder.classroom WHERE id = %s", (class_id,)),
                         [(code, "active")])

    def test_removing_a_student_who_is_not_active_is_not_found(self):
        teacher, class_id, _ = self.new_class()
        with self.assertProductError("student_not_found"):
            self.call("SELECT sonder.remove_student(%s, %s, %s)", (teacher, class_id, self.user("student")))

    def test_a_new_code_replaces_the_old_one_at_once(self):
        teacher, class_id, old = self.new_class()
        new = self.call("SELECT sonder.regenerate_join_code(%s, %s)", (teacher, class_id))[0][0]
        self.assertNotEqual(new, old)
        self.assertRegex(new, r"^[A-HJ-NP-Z2-9]{10}$")
        with self.assertProductError("join_code_invalid"):
            self.join(self.user("student"), old)
        self.assertEqual(self.join(self.user("student"), new)[0], class_id)

    def test_archive_and_restore(self):
        teacher, class_id, code = self.new_class()
        member = self.user("student")
        self.join(member, code)
        self.call("SELECT sonder.set_class_status(%s, %s, 'archived')", (teacher, class_id))
        self.call("SELECT sonder.set_class_status(%s, %s, 'archived')", (teacher, class_id))  # no-op
        self.assertEqual(self.call("SELECT status FROM sonder.teacher_classes(%s)", (teacher,)), [("archived",)])
        self.assertEqual(self.roster(teacher, class_id), [member])  # enrolments are kept
        self.call("SELECT sonder.set_class_status(%s, %s, 'active')", (teacher, class_id))
        self.assertEqual(self.join(self.user("student"), code)[0], class_id)
        for bad in ("closed", "", None):
            with self.subTest(status=bad), self.assertProductError("class_status_invalid"):
                self.call("SELECT sonder.set_class_status(%s, %s, %s)", (teacher, class_id, bad))

    def test_a_departed_teacher_loses_control(self):
        teacher, class_id, _ = self.new_class()
        self.call("UPDATE sonder.class_teacher SET status = 'departed' WHERE teacher_id = %s", (teacher,))
        with self.assertProductError("class_not_found"):
            self.call("SELECT sonder.regenerate_join_code(%s, %s)", (teacher, class_id))


if __name__ == "__main__":
    unittest.main()
