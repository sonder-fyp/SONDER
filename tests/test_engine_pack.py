"""Checks for the pack loader (spec v2 sections 1, 2 and 4) and the Maths_v2 unit table.

The real-bank expectations were derived independently from items.csv and
topics.csv and match spec v2 sections 1.2, 1.5 and 2.2 (U6 after decision D-2).
Synthetic packs are built in memory; nothing is written anywhere.
"""

from __future__ import annotations

import copy
import hashlib
import json
import unittest
from dataclasses import replace

from sonder_engine import Params
from sonder_engine.pack import (
    PackError, build_pack, derive_twin_groups, separating_items, trigger_groups,
)
from sonder_engine.stopping import total_variation
from sonder_pack.maths_v2 import DEFAULT_CONFIG, DEFAULT_ROOT, load_maths_v2, read_csv_rows

SOURCES = (DEFAULT_ROOT / "bank" / "items.csv", DEFAULT_ROOT / "topics.csv", DEFAULT_CONFIG)


def m(*numbers):
    return tuple(f"MATH-{n}" for n in numbers)


# --------------------------------------------------------------------------- synthetic packs
TOPICS = [
    {"topic": "Topic one", "MisconceptionId": "M-1", "MisconceptionName": "first"},
    {"topic": "Topic one", "MisconceptionId": "M-2", "MisconceptionName": "second"},
    {"topic": "Topic two", "MisconceptionId": "M-3", "MisconceptionName": "third"},
]
SMALL = Params(default_budget=2)


def item_rows(item_id, label="L1", links=None, correct="A", stem=None, status="approved"):
    links = links or {}
    return [{
        "item_id": item_id, "topic": label, "target": "M-1", "stem": stem or f"Stem of {item_id}",
        "option_id": o, "option_text": f"{item_id} option {o}", "is_correct": str(o == correct),
        "misconceptions": links.get(o, ""), "status": status, "batch": "B00",
    } for o in "ABCD"]


def small_bank():
    return item_rows("I1", links={"B": "M-1"}) + item_rows("I2", links={"C": "M-2"})


def small_config():
    return {
        "pack_format": 2, "content_version": "test", "subject": "mathematics",
        "labels": [{"label": "L1", "unit": "U1"}],
        "units": [{"unit_id": "U1", "name": "One", "topic": "Topic one"}],
    }


def real_rows():
    return (read_csv_rows(DEFAULT_ROOT / "bank" / "items.csv"),
            read_csv_rows(DEFAULT_ROOT / "topics.csv"),
            json.loads(DEFAULT_CONFIG.read_text(encoding="utf-8")))


def without_d2(config):
    """The unit table with decision D-2 (skip and drop) reversed, for reversal tests only."""
    config = copy.deepcopy(config)
    u6 = next(u for u in config["units"] if u["unit_id"] == "U6")
    del u6["skip_items"], u6["drop_hypotheses"]
    return config


def codes(pack, code, unit_id="any"):
    return [w.subject for w in pack.warnings
            if w.code == code and (unit_id == "any" or w.unit_id == unit_id)]


# --------------------------------------------------------------------------- real bank
class RealBankUnitTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pack = load_maths_v2()

    def test_items_and_groups_per_unit(self):
        units = {u.unit_id: u for u in self.pack.units}
        self.assertEqual({k: len(u.items) for k, u in units.items()},
                         {"U1": 20, "U2": 25, "U3": 10, "U4": 16, "U5": 10, "U6": 14, "U7": 16})
        groups = {k: len({p.item.twin_group or p.item.item_id for p in u.items}) for k, u in units.items()}
        self.assertEqual(groups, {"U1": 20, "U2": 25, "U3": 10, "U4": 16, "U5": 10, "U6": 12, "U7": 16})

    def test_every_bank_item_is_placed_skipped_or_unplaced(self):
        placed = sum(len(u.items) for u in self.pack.units)
        self.assertEqual([p.item.item_id for p in self.pack.unplaced], ["T6-019B", "T6-020B", "T6-021B"])
        self.assertEqual(codes(self.pack, "SKIPPED_ITEM", "U6"), ["T6-011B", "T6-014B", "T6-016B"])
        self.assertEqual(placed + 3 + len(self.pack.unplaced), 117)

    def test_hypotheses_in_the_agreed_order(self):
        # Own misconceptions in topics.csv order, then companions by number; 1416 dropped from U6.
        self.assertEqual({u.unit_id: u.hyps[:-2] for u in self.pack.units}, {
            "U1": m(1248, 1379, 1988, 2392),
            "U2": m(61, 658, 1715, 1965, 2039),
            "U3": m(2138, 2206, 1074, 1651, 2359),
            "U4": m(126, 228, 1416, 1514, 1773, 2093),
            "U5": m(414, 734, 952, 1072),
            "U6": m(1074, 161, 767, 1651, 2359),
            "U7": m(2359, 1639, 2093, 2271, 1514, 1715, 1773),
        })
        for unit in self.pack.units:
            self.assertEqual(unit.hyps[-2:], ("NONE", "UNMODELLED"))

    def test_companions_match_spec_section_2_1(self):
        companions = {u.unit_id: tuple(h.misconception_id for h in u.hypotheses if h.companion)
                      for u in self.pack.units}
        self.assertEqual(companions, {"U1": (), "U2": (), "U3": m(1074, 1651, 2359), "U4": m(2093),
                                      "U5": (), "U6": m(2359), "U7": m(1514, 1715, 1773)})

    def test_pack_order_is_bank_file_order(self):
        self.assertEqual([p.item.item_id for p in self.pack.unit("U6").items], [
            "T6-010", "T6-011", "T6-012", "T6-013", "T6-014", "T6-015", "T6-016", "T6-017", "T6-018",
            "T6-010B", "T6-015B", "T6-019A", "T6-020A", "T6-021A"])

    def test_fourteen_twin_groups_from_identical_stems(self):
        bank, _, _ = real_rows()
        groups = {}
        for item_id, group in derive_twin_groups(bank).items():
            groups.setdefault(group, []).append(item_id)
        expected = [[f"T5-{a:03d}", f"T5-{a + 6:03d}"] for a in range(5, 11)]
        expected += [[f"T6-{n}", f"T6-{n}B"] for n in ("010", "011", "014", "015", "016")]
        expected += [[f"T6-{n}A", f"T6-{n}B"] for n in ("019", "020", "021")]
        self.assertEqual(sorted(sorted(g) for g in groups.values()), sorted(expected))

    def test_trigger_groups_per_misconception(self):
        expected = {
            "U1": {1248: 20, 1379: 11, 1988: 9, 2392: 20},
            "U2": {61: 10, 658: 15, 1715: 15, 1965: 10, 2039: 25},
            "U3": {2138: 7, 2206: 9, 1074: 5, 1651: 5, 2359: 6},
            "U4": {126: 6, 228: 12, 1416: 6, 1514: 13, 1773: 13, 2093: 1},
            "U5": {414: 8, 734: 8, 952: 7, 1072: 8},
            "U6": {1074: 5, 161: 12, 767: 12, 1651: 5, 2359: 2, 1416: 0},
            "U7": {2359: 7, 1639: 5, 2093: 6, 2271: 5, 1514: 1, 1715: 4, 1773: 1},
        }
        for unit in self.pack.units:
            actual = {n: trigger_groups(unit, f"MATH-{n}") for n in expected[unit.unit_id]}
            self.assertEqual(actual, expected[unit.unit_id], unit.unit_id)

    def test_warning_lists(self):
        p = self.pack
        self.assertEqual({u: codes(p, "W1", u) for u in ("U3", "U4", "U6", "U7")}, {
            "U3": ["MATH-1074/MATH-1651"], "U4": ["MATH-1514/MATH-1773"],
            "U6": ["MATH-1074/MATH-1651"], "U7": ["MATH-1514/MATH-1773"]})
        self.assertEqual(len(codes(p, "W1")), 4)
        self.assertEqual(codes(p, "W2"), [
            "MATH-2093/NONE", "MATH-414/MATH-734", "MATH-2359/NONE",
            "MATH-2271/MATH-1514", "MATH-2271/MATH-1773", "MATH-1514/NONE",
            "MATH-1715/NONE", "MATH-1773/NONE"])
        self.assertEqual([(w.unit_id, w.subject) for w in p.warnings if w.code == "W3"], [
            ("U4", "MATH-2093"), ("U6", "MATH-2359"), ("U7", "MATH-1514"), ("U7", "MATH-1773")])
        self.assertEqual(codes(p, "W4"), ["T5-011", "T5-012", "T5-014", "T5-015", "T6-010B",
                                          "T6-015B", "T7-003", "T7-008", "T7-013", "T7-014"])
        self.assertEqual(codes(p, "W5"), [])
        self.assertEqual(codes(p, "W6"), ["items.csv"])
        self.assertEqual(codes(p, "DROPPED_HYPOTHESIS", "U6"), ["MATH-1416"])
        self.assertEqual(codes(p, "UNPLACED_ITEM"), ["T6-019B", "T6-020B", "T6-021B"])
        self.assertEqual(codes(p, "TWIN_CROSS_UNIT"), [f"T5-{n:03d}" for n in range(5, 11)])

    def test_decision_warnings_carry_their_decision_ids(self):
        by_code = {}
        for w in self.pack.warnings:
            by_code.setdefault(w.code, set()).add(w.decision)
        self.assertEqual(by_code["SKIPPED_ITEM"], {"D-2"})
        self.assertEqual(by_code["DROPPED_HYPOTHESIS"], {"D-2 side effect"})
        self.assertEqual(by_code["UNPLACED_ITEM"], {"D-4"})
        self.assertEqual(by_code["W3"], {"D-5"})  # all four W3 hypotheses are companions

    def test_exclusion_warnings_are_reported_on_every_load(self):
        again = load_maths_v2()
        for code in ("SKIPPED_ITEM", "DROPPED_HYPOTHESIS", "UNPLACED_ITEM"):
            self.assertTrue(codes(again, code))
            self.assertEqual(codes(again, code), codes(self.pack, code))

    def test_separating_items_count_matches_spec_examples(self):
        params = Params()
        self.assertEqual(len(separating_items(self.pack.unit("U5"), "MATH-414", "MATH-734", params)), 3)
        self.assertEqual(separating_items(self.pack.unit("U4"), "MATH-1514", "MATH-1773", params), ())
        self.assertEqual(len(separating_items(self.pack.unit("U2"), "MATH-1965", "MATH-2039", params)), 15)

    def test_every_link_is_sound_without_a_grade_column(self):
        for unit in self.pack.units:
            for p in unit.items:
                self.assertTrue(all(g == "S" for grades in p.item.link_grades for g in grades))

    def test_identity_names_the_sources(self):
        names = [name for name, _ in self.pack.identity.source_sha256]
        self.assertEqual(names, ["bank/items.csv", "topics.csv", "maths_v2_units.json"])
        for unit in self.pack.units:
            self.assertIs(unit.pack, self.pack.identity)

    def test_loading_never_changes_the_source_files(self):
        def snapshot():
            return [(hashlib.sha256(p.read_bytes()).hexdigest(), p.stat().st_mtime_ns) for p in SOURCES]
        before = snapshot()
        load_maths_v2()
        self.assertEqual(snapshot(), before)


class DecisionReversalTests(unittest.TestCase):
    """Each decision lives in the unit table or Params, so reversing it needs no code change."""

    def test_removing_the_d2_skip_at_default_guess_is_refused_by_p1(self):
        bank, topics, config = real_rows()
        with self.assertRaises(PackError) as caught:
            build_pack(bank, topics, without_d2(config), Params())
        self.assertEqual((caught.exception.code, caught.exception.location), ("V11", "U6"))

    def test_removing_the_d2_skip_with_a_lower_guess_restores_the_original_u6(self):
        bank, topics, config = real_rows()
        pack = build_pack(bank, topics, without_d2(config), Params(guess=0.24))
        u6 = pack.unit("U6")
        self.assertEqual(len(u6.items), 17)
        self.assertEqual(u6.hyps[:-2], m(1074, 161, 767, 1651, 1416, 2359))
        self.assertEqual(trigger_groups(u6, "MATH-1416"), 3)
        self.assertEqual(codes(pack, "W5", "U6"), ["T6-011B", "T6-014B", "T6-016B"])
        self.assertEqual(codes(pack, "SKIPPED_ITEM"), [])

    def test_keeping_1416_with_the_skip_makes_it_inseparable_from_none(self):
        # The measured reason for the drop (decision Q1): with no trigger item, 1416 answers like NONE.
        bank, topics, config = real_rows()
        u6 = next(u for u in config["units"] if u["unit_id"] == "U6")
        del u6["drop_hypotheses"]
        pack = build_pack(bank, topics, config, Params())
        self.assertIn("MATH-1416/NONE", codes(pack, "W1", "U6"))
        self.assertIn("MATH-1416", codes(pack, "W3", "U6"))

    def test_dropping_a_companion_without_its_items_is_refused_by_v5(self):
        # Reversing D-5 needs both a drop and skips; a drop alone fails loudly.
        bank, topics, config = real_rows()
        u4 = next(u for u in config["units"] if u["unit_id"] == "U4")
        u4["drop_hypotheses"] = [{"misconception_id": "MATH-2093", "decision": "test", "reason": "test"}]
        with self.assertRaises(PackError) as caught:
            build_pack(bank, topics, config, Params())
        self.assertEqual(caught.exception.code, "V5'")

    def test_mapping_an_unplaced_label_needs_only_the_table(self):
        bank, topics, config = real_rows()
        label = next(e for e in config["labels"] if e["unit"] is None)
        label.update(unit="U6")
        del label["decision"], label["reason"]
        with self.assertRaises(PackError) as caught:  # its 8 misconceptions overflow k_max = 8
            build_pack(bank, topics, config, Params())
        self.assertEqual(caught.exception.code, "V7")


# --------------------------------------------------------------------------- hard rules
class HardRuleTests(unittest.TestCase):
    def assertRefused(self, code, bank=None, topics=None, config=None, params=SMALL):
        with self.assertRaises(PackError) as caught:
            build_pack(small_bank() if bank is None else bank, TOPICS if topics is None else topics,
                       small_config() if config is None else config, params)
        self.assertEqual(caught.exception.code, code, str(caught.exception))
        return caught.exception

    def test_the_small_pack_loads(self):
        pack = build_pack(small_bank(), TOPICS, small_config(), SMALL)
        unit = pack.unit("U1")
        self.assertEqual(unit.hyps, ("M-1", "M-2", "NONE", "UNMODELLED"))
        self.assertEqual([p.item.item_id for p in unit.items], ["I1", "I2"])
        self.assertEqual(unit.items[0].option_texts[1], "I1 option B")

    def test_v1_four_options(self):
        self.assertRefused("V1", bank=small_bank()[:-1])

    def test_v2_exactly_one_correct(self):
        bank = small_bank()
        bank[1]["is_correct"] = "True"
        self.assertRefused("V2", bank=bank)
        bank = small_bank()
        bank[0]["is_correct"] = "yes"
        self.assertRefused("V2", bank=bank)

    def test_v3_unique_option_ids_and_texts(self):
        bank = small_bank()
        bank[1]["option_id"] = "A"
        self.assertRefused("V3", bank=bank)
        bank = small_bank()
        bank[1]["option_text"] = bank[0]["option_text"].upper()
        self.assertRefused("V3", bank=bank)

    def test_v4_correct_option_unlinked(self):
        self.assertRefused("V4", bank=item_rows("I1", links={"A": "M-1"}) + item_rows("I2"))

    def test_v5_links_inside_the_unit(self):
        self.assertRefused("V5'", bank=item_rows("I1", links={"B": "M-9"}) + item_rows("I2"))
        config = small_config()
        config["units"][0]["drop_hypotheses"] = [{"misconception_id": "M-1", "decision": "t", "reason": "t"}]
        self.assertRefused("V5'", config=config)

    def test_v6_unique_ids(self):
        self.assertRefused("V6", topics=TOPICS + [dict(TOPICS[0])])
        bank = small_bank()
        bank[3]["stem"] = "a different stem"
        self.assertRefused("V6", bank=bank)

    def test_v7_hypothesis_count(self):
        self.assertRefused("V7", params=replace(SMALL, k_max=1))

    def test_v8_no_repeated_link(self):
        self.assertRefused("V8", bank=item_rows("I1", links={"B": "M-1|M-1"}) + item_rows("I2"))
        self.assertRefused("V8", bank=item_rows("I1", links={"B": "M-1|"}) + item_rows("I2"))

    def test_v9_enough_item_groups(self):
        self.assertRefused("V9", params=Params())  # 2 groups, budget 8
        twins = item_rows("I1", stem="same") + item_rows("I2", stem="same")
        self.assertRefused("V9", bank=twins)  # 2 items but 1 group, budget 2

    def test_v10_pack_format(self):
        config = small_config()
        config["pack_format"] = 1
        self.assertRefused("V10", config=config)

    def test_v11_p1_over_the_unit(self):
        three = item_rows("I1", links={"B": "M-1", "C": "M-1", "D": "M-1"}) + item_rows("I2")
        error = self.assertRefused("V11", bank=three)
        self.assertIn("guess must be < 0.25", error.detail)
        build_pack(three, TOPICS, small_config(), replace(SMALL, guess=0.24))  # loads below 0.25


class ConfigAndWarningTests(unittest.TestCase):
    def build(self, bank=None, config=None, params=SMALL):
        return build_pack(small_bank() if bank is None else bank, TOPICS,
                          small_config() if config is None else config, params)

    def assertConfigError(self, code="CONFIG", **kwargs):
        with self.assertRaises(PackError) as caught:
            self.build(**kwargs)
        self.assertEqual(caught.exception.code, code, str(caught.exception))

    def test_unknown_label_in_the_bank(self):
        self.assertConfigError("LABEL", bank=small_bank() + item_rows("I3", label="L2"))

    def test_table_errors(self):
        for change in (
            lambda c: c["labels"].append({"label": "unused", "unit": "U1"}),
            lambda c: c["labels"].append({"label": "L1", "unit": "U1"}),
            lambda c: c["labels"][0].update(unit="U9"),
            lambda c: c["labels"][0].update(unit=None),  # null unit needs a decision and reason
            lambda c: c["units"][0].update(topic="No such topic"),
            lambda c: c["units"][0].update(colour="blue"),
            lambda c: c["units"][0].update(skip_items=[{"item_id": "I9", "decision": "t", "reason": "t"}]),
            lambda c: c["units"][0].update(drop_hypotheses=[{"misconception_id": "M-3", "decision": "t", "reason": "t"}]),
            lambda c: c["units"].append(dict(c["units"][0])),
        ):
            config = small_config()
            change(config)
            with self.subTest(config=config):
                self.assertConfigError(config=config)

    def test_companion_from_another_topic_joins_the_unit(self):
        pack = self.build(bank=item_rows("I1", links={"B": "M-3"}) + item_rows("I2", links={"C": "M-2"}))
        unit = pack.unit("U1")
        self.assertEqual(unit.hyps[:-2], ("M-1", "M-2", "M-3"))
        self.assertEqual([h.companion for h in unit.hypotheses], [False, False, True])

    def test_skip_and_unapproved_items_are_reported_not_used(self):
        config = small_config()
        config["units"][0]["skip_items"] = [{"item_id": "I3", "decision": "D-x", "reason": "test"}]
        bank = small_bank() + item_rows("I3") + item_rows("I4", status="draft")
        pack = self.build(bank=bank, config=config)
        self.assertEqual([p.item.item_id for p in pack.unit("U1").items], ["I1", "I2"])
        self.assertEqual(codes(pack, "SKIPPED_ITEM"), ["I3"])
        self.assertEqual(codes(pack, "UNAPPROVED_ROW"), ["I4"])

    def test_twins_inside_a_unit_and_across_units(self):
        bank = (item_rows("I1", stem="same", links={"B": "M-1"}) + item_rows("I2", links={"C": "M-2"})
                + item_rows("I3", stem="same") + item_rows("J1", label="L2", stem="shared")
                + item_rows("J2", label="L2", links={"B": "M-3"}) + item_rows("I4", stem="shared"))
        config = small_config()
        config["labels"].append({"label": "L2", "unit": "U2"})
        config["units"].append({"unit_id": "U2", "name": "Two", "topic": "Topic two"})
        pack = self.build(bank=bank, config=config)
        u1 = pack.unit("U1")
        self.assertEqual([p.item.twin_group for p in u1.items], ["I1", None, "I1", "J1"])
        self.assertEqual(codes(pack, "TWIN_CROSS_UNIT"), ["J1"])

    def test_link_grade_column_is_read_when_present(self):
        bank = small_bank()
        for row in bank:
            row["link_grade"] = "T" if row["misconceptions"] else ""
        pack = self.build(bank=bank)
        self.assertEqual(pack.unit("U1").items[0].item.link_grades[1], ("T",))
        self.assertEqual(codes(pack, "W6"), [])
        bank[1]["link_grade"] = "S|T"
        self.assertConfigError("V8", bank=bank)

    def test_w1_w2_w3_on_a_small_unit(self):
        # M-1 and M-2 share every option, so they are inseparable (W1) and each has
        # one trigger group (W3); each is separated from NONE by one item (W2).
        bank = item_rows("I1", links={"B": "M-1|M-2"}) + item_rows("I2")
        pack = self.build(bank=bank)
        self.assertEqual(codes(pack, "W1"), ["M-1/M-2"])
        self.assertEqual(codes(pack, "W2"), ["M-1/NONE", "M-2/NONE"])
        self.assertEqual(codes(pack, "W3"), ["M-1", "M-2"])
        self.assertEqual(codes(pack, "W4"), ["I1", "I2"])


class TotalVariationTests(unittest.TestCase):
    def test_hand_values(self):
        self.assertAlmostEqual(total_variation([0.9, 0.1, 0.0, 0.0], [0.1, 0.9, 0.0, 0.0]), 0.8, places=15)
        self.assertEqual(total_variation([0.25] * 4, [0.25] * 4), 0.0)

    def test_rejects_mismatched_rows(self):
        with self.assertRaises(ValueError):
            total_variation([0.5, 0.5], [1.0])


if __name__ == "__main__":
    unittest.main()
