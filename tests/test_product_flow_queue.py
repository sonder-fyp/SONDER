"""The teacher's queue of finished checks (migration 0013, sonder.teacher_queue) on real PostgreSQL."""

from __future__ import annotations

import unittest

from flow_base import FlowTestCase


class TeacherQueueTests(FlowTestCase):
    def queue(self, teacher=None):
        return self.call(
            "SELECT session_id::text, class_name, student_name, assignment_id::text, assignment_title, unit_code, review_status "
            "FROM sonder.teacher_queue(%s)", (teacher or self.teacher,))

    def test_queue_lists_finished_unreviewed_latest_attempts(self):
        done, going = self.assign("Done"), self.assign("Going")
        finished = self.answer(self.start(done), "BBAB")  # D1 opens on T1-001 after the link changes.
        self.answer(self.start(going), "DB")
        rows = self.queue()
        self.assertEqual(rows, [(finished["session_id"], "Mine", "Test student", done, "Done", "U1", None)])

    def test_review_removes_and_follow_up_keeps(self):
        finished = self.answer(self.start(self.assign("A")), "BBAB")  # D1 opens on T1-001 after the link changes.
        sid = finished["session_id"]
        self.review(sid, 0, "reviewed")
        self.assertEqual(self.queue(), [])
        self.review(sid, 1, "follow_up_required")
        rows = self.queue()
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0][0], sid)
        self.assertEqual(rows[0][6], "follow_up_required")

    def test_only_latest_attempt_of_repeat(self):
        a = self.assign("Rep", "repeat")
        first = self.answer(self.start(a), "BBAB")  # D1 opens on T1-001 after the link changes.
        second = self.answer(self.start(a), "BBAB")  # D1 opens on T1-001 after the link changes.
        self.assertEqual([r[0] for r in self.queue()], [second["session_id"]])
        self.assertNotEqual(first["session_id"], second["session_id"])
        self.start(a)
        self.assertEqual(self.queue(), [])

    def test_closed_assignment_still_queued(self):
        a = self.assign("A")
        self.answer(self.start(a), "BBAB")  # D1 opens on T1-001 after the link changes.
        self.call("SELECT sonder.set_assignment_status(%s, %s, 'closed')", (self.teacher, a))
        self.assertEqual(len(self.queue()), 1)

    def test_archived_class_and_left_student_excluded(self):
        self.answer(self.start(self.assign("A")), "BBAB")  # D1 opens on T1-001 after the link changes.
        self.assertEqual(len(self.queue()), 1)
        self.call("SELECT sonder.remove_student(%s, %s, %s)", (self.teacher, self.class_id, self.student))
        self.assertEqual(self.queue(), [])
        self.call("SELECT * FROM sonder.join_class(%s, %s)", (self.student, self.code))
        self.assertEqual(len(self.queue()), 1)
        self.call("SELECT sonder.set_class_status(%s, %s, 'archived')", (self.teacher, self.class_id))
        self.assertEqual(self.queue(), [])

    def test_assignment_less_check_is_queued(self):
        finished = self.answer(self.start(), "BBAB")  # D1 opens on T1-001 after the link changes.
        rows = self.queue()
        self.assertEqual(rows, [(finished["session_id"], "Mine", "Test student", None, None, "U1", None)])

    def test_other_teacher_sees_nothing(self):
        self.answer(self.start(self.assign("A")), "BBAB")  # D1 opens on T1-001 after the link changes.
        self.assertEqual(self.queue(self.user("teacher")), [])


if __name__ == "__main__":
    unittest.main()
