"""Every attempt at one assignment, for the teacher (migration 0013, sonder.session_attempts)."""

from __future__ import annotations

import unittest
from uuid import uuid4

from flow_base import FlowTestCase


class SessionAttemptsTests(FlowTestCase):
    def attempts(self, session_id, teacher=None):
        return self.call("SELECT session_id::text, attempt_number, state FROM sonder.session_attempts(%s, %s)",
                         (teacher or self.teacher, session_id))

    def test_three_attempts_in_order(self):
        a = self.assign("Rep", "repeat")
        one = self.answer(self.start(a), "BBAB")  # D1 opens on T1-001 after the link changes.
        two = self.answer(self.start(a), "BBAB")  # D1 opens on T1-001 after the link changes.
        three = self.answer(self.start(a), "DB")
        expected = [(one["session_id"], 1, "completed"), (two["session_id"], 2, "completed"),
                    (three["session_id"], 3, "in_progress")]
        for s in (one, two, three):
            self.assertEqual(self.attempts(s["session_id"]), expected)

    def test_other_students_attempts_not_included(self):
        a = self.assign("Rep", "repeat")
        classmate = self.user("student")
        self.call("SELECT * FROM sonder.join_class(%s, %s)", (classmate, self.code))
        mine = self.start(a)
        theirs = self.start(a, classmate)
        self.assertEqual([r[0] for r in self.attempts(mine["session_id"])], [mine["session_id"]])
        self.assertEqual([r[0] for r in self.attempts(theirs["session_id"])], [theirs["session_id"]])

    def test_empty_cases(self):
        plain = self.start()
        self.assertEqual(self.attempts(plain["session_id"]), [])
        started = self.start(self.assign("A"))
        self.assertEqual(self.attempts(started["session_id"], self.user("teacher")), [])
        self.assertEqual(self.attempts(str(uuid4())), [])


if __name__ == "__main__":
    unittest.main()
