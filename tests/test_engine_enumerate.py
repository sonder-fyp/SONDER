"""The answer-sequence enumeration used for KF-08 and KF-15 (I2-A05).

Synthetic units with a small budget keep the tree small; the full Maths_v2 run is
the command in experiments/enumerate_sequences.py and its result is recorded in
sonder_engine/KNOWN_FAULTS.md.
"""

from __future__ import annotations

import unittest
from itertools import product

from experiments.enumerate_sequences import enumerate_unit
from sonder_engine import Params, replay

from engine_rows import exact_item, make_unit, near_item, separating_item

SMALL = Params(default_budget=3)


def by_replay(unit, params):
    """Independent count: replay every letter sequence and keep the distinct finished ones."""
    seen = {}
    for length in range(1, params.default_budget + 1):
        for letters in product("ABCD", repeat=length):
            try:
                state = replay(unit, params, list(letters))
            except ValueError:
                continue  # the session ended before this sequence was used up
            if state.finished and len(state.steps) == length:
                seen[letters] = state.decision
    return seen


class EnumerationTests(unittest.TestCase):
    def test_every_sequence_is_counted_once_and_matches_replay(self):
        unit = make_unit([separating_item("S1"), exact_item("E1"), exact_item("E2"), exact_item("E3")])
        result = enumerate_unit(unit, SMALL)
        expected = by_replay(unit, SMALL)
        self.assertEqual(result.sequences, len(expected))
        counts = {}
        for decision in expected.values():
            counts[decision.outcome.value] = counts.get(decision.outcome.value, 0) + 1
        self.assertEqual(dict(result.outcomes), counts)

    def test_exact_rows_give_only_exact_refusals(self):
        unit = make_unit([exact_item(f"E{i}") for i in range(1, 6)])
        result = enumerate_unit(unit, SMALL)
        self.assertGreater(result.r4_refusals, 0)
        self.assertEqual(result.r4_not_exact, 0)
        self.assertEqual(result.r4_shortest, len(result.r4_shortest_example))

    def test_near_rows_are_reported_as_not_exact(self):
        # w_stretch 0.99 brings one stretch row within delta_sep of its sound twin,
        # the KF-15 near-row case. With answers left, R4 can still refuse while the
        # reachable share is above the leader share; the counter must catch those.
        # (With no answers left the two shares are equal even for near rows.)
        unit = make_unit([near_item(f"N{i}") for i in range(1, 6)])
        result = enumerate_unit(unit, Params(default_budget=3, w_stretch=0.99))
        self.assertGreater(result.r4_refusals, 0)
        self.assertGreater(result.r4_not_exact, 0)
        self.assertLess(result.r4_not_exact, result.r4_refusals)


if __name__ == "__main__":
    unittest.main()
