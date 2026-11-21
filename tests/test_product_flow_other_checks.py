"""A class's checks started without an assignment (migration 0013, sonder.class_other_checks)."""

from __future__ import annotations

import unittest

from flow_base import FlowTestCase

COLUMNS = {"session_id", "student_name", "unit_code", "unit_name", "state", "answered",
           "question_budget", "started_at", "ended_at", "review_status"}


class OtherChecksTests(FlowTestCase):
    def other(self, teacher=None, class_id=None):
        return self.call("SELECT session_id::text, state, answered, review_status FROM sonder.class_other_checks(%s, %s)",
                         (teacher or self.teacher, class_id or self.class_id))

    def test_only_assignment_less_sessions_with_state_and_review(self):
        self.answer(self.start(self.assign("A")), "DB")  # assignment session: not listed
        going = self.start()
        self.assertEqual(self.other(), [(going["session_id"], "in_progress", 0, None)])
        done = self.answer(going, "DBBA")
        self.assertEqual(self.other(), [(done["session_id"], "completed", 4, None)])
        self.review(done["session_id"], 0, "reviewed")
        self.assertEqual(self.other()[0][3], "reviewed")

    def test_session_of_a_student_who_left_is_still_returned(self):
        done = self.answer(self.start(), "DBBA")
        self.call("SELECT sonder.remove_student(%s, %s, %s)", (self.teacher, self.class_id, self.student))
        self.assertEqual([r[0] for r in self.other()], [done["session_id"]])

    def test_other_teacher_or_other_class_gets_nothing(self):
        self.answer(self.start(), "DBBA")
        other_teacher = self.user("teacher")
        self.assertEqual(self.other(other_teacher), [])
        other_class = self.call("SELECT class_id::text FROM sonder.create_class(%s, 'Other')", (self.teacher,))[0][0]
        self.assertEqual(self.other(class_id=other_class), [])

    def test_columns(self):
        with self.connect() as conn, conn.cursor() as cur:
            cur.execute("SELECT * FROM sonder.class_other_checks(%s, %s)", (self.teacher, self.class_id))
            self.assertEqual({c.name for c in cur.description}, COLUMNS)


if __name__ == "__main__":
    unittest.main()
