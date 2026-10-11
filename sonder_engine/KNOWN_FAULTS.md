# Known faults of the diagnostic engine

The Maths_v2 dataset is synthetic, and no real student has answered it. Every probability and threshold in the engine is an assumed value (spec v2, honesty rule). This file lists the engine's known limitations so that they are stated rather than discovered. Each entry names the check that backs it: a loader warning printed by `python -m sonder_pack.maths_v2`, or a test in `tests/`. An entry cites only checks that exist in the repository. Entries are added as the engine is built, so the numbers have gaps.

Decision IDs (D-1 … D-6, T-1) refer to `docs/ENGINE_SPEC_DRAFT.md` §7. Item and misconception data are never changed to work around a fault; exclusions exist only in the unit table `sonder_pack/maths_v2_units.json`.

Each entry has these fields: what is wrong, what it affects, what the user sees, evidence, the fix and its owner, the decision, and what backs it.

---

## KF-01. Three U6 items are skipped (D-2)

- **What is wrong:** T6-011B, T6-014B and T6-016B each link MATH-1416 to three options. At `guess = 0.30` each predicted option gets probability 0.233 and the correct option 0.300, so the model would say a holder prefers the correct answer (spec §3.1). Rule P1 refuses such an item at this `guess`.
- **Affects:** U6. Its 17 items become 14. The twin groups stay at 12 because the A-twins (T6-011, T6-014, T6-016) remain, so rule V9 still holds.
- **What the user sees:** those three questions are never asked.
- **Evidence:** spec §1.1, §3.1, §3.6 (P1).
- **Fix and owner:** rework each item so that one of the three options is unlinked or linked to a different misconception, or adopt `guess < 0.25` for them (spec D-2). The content is Harris's; the parameter is a team decision.
- **Decision:** D-2. Excluded at load time with a warning. The items stay in the bank unchanged.
- **Backed by:** `SKIPPED_ITEM` warning (three, on every load). `tests/test_engine_pack.py`: unit counts; removing the skip at the default `guess` is refused under V11; removing it with `guess = 0.24` restores the 17-item U6.

## KF-02. MATH-1416 is not a U6 hypothesis (D-2 side effect)

- **What is wrong:** the three skipped items are the only U6 items with an option linked to MATH-1416. Once they are skipped, no U6 question can give evidence for it. Its trigger groups fall from 3 to 0.
- **Affects:** U6 only. MATH-1416 is a companion in U6; its home unit U4 keeps it.
- **What the user sees:** U6 has five misconception hypotheses instead of six. If 1416 were kept, it would predict the correct answer on every U6 item, exactly like NONE, so the two could never be told apart. A student with no misconception could then be refused as "cannot separate".
- **Evidence:** the data (trigger counts); the inseparability is shown by the test below.
- **Fix and owner:** as KF-01 (Harris), then delete the `drop_hypotheses` entry.
- **Decision:** D-2 side effect, accepted by Ahmed.
- **Backed by:** `DROPPED_HYPOTHESIS` warning. `tests/test_engine_pack.py`: keeping 1416 produces W1 for MATH-1416/NONE and W3 for MATH-1416.

## KF-04. Companions that cannot be diagnosed in their unit (D-5)

- **What is wrong:** four companion hypotheses have fewer than 3 trigger groups: MATH-2093 in U4 (1), MATH-2359 in U6 (2), MATH-1514 and MATH-1773 in U7 (1 each).
- **Affects:** those units. MATH-2093 and MATH-2359 can be diagnosed in their home unit, U7. MATH-1514 and MATH-1773 cannot be diagnosed in their home unit U4 either, because of KF-06.
- **What the user sees:** sessions with students holding these misconceptions in these units cannot end in a diagnosis of them (spec §6.1: `escalated_exhausted` for 2093 in U4 and 2359 in U6).
- **Evidence:** spec §1.5, §2.1, §6.1.
- **Fix and owner:** write more trigger items (spec T-2, Harris), or drop the companion together with the items that link it (a unit-table change).
- **Decision:** D-5 (keep them).
- **Backed by:** W3 warning (four). `tests/test_engine_pack.py`: trigger-group counts, and the check that dropping a companion without its items is refused under V5'.

## KF-05. Three items belong to no unit (D-4)

- **What is wrong:** T6-019B, T6-020B and T6-021B link 8 misconceptions from three topics. No unit with at most 8 hypotheses and enough items can hold them.
- **Affects:** no session uses them. Because they are in no unit, they also block nothing: their A-twins in U6 are asked normally.
- **What the user sees:** nothing; the items are unused.
- **Evidence:** spec §1.2.
- **Fix and owner:** leave them unplaced for Mid-1, or define a unit that can hold them (Harris and Ahmed).
- **Decision:** D-4.
- **Backed by:** `UNPLACED_ITEM` warning (three). `tests/test_engine_pack.py`: mapping the label to U6 is refused under V7 (too many hypotheses).

## KF-06. Inseparable pairs MATH-1514/1773 and MATH-1074/1651 (D-1)

- **What is wrong:** in each pair, both misconceptions predict the same answers on every item of the units that contain them.
- **Affects:** 1074/1651 in U3 and U6; 1514/1773 in U4 and U7.
- **What the user sees:** students holding either one end as "cannot separate" (`escalated_no_separator`) naming both (spec §5 D2, §6.1).
- **Evidence:** spec §1.4, §5 D2, §6.1.
- **Fix and owner:** merge each pair in the catalogue (spec D-1), Harris, with team approval.
- **Decision:** D-1.
- **Backed by:** W1 warning (four). `tests/test_engine_pack.py`: W1 list, and zero separating items for 1514/1773 in U4.

## KF-08. Weakly separable pairs (W2)

- **What is wrong:** some pairs are separated by very few item groups: MATH-414/734 by 3 in U5; 2093/NONE by 1 in U4; 2359/NONE by 2 in U6; 1514/NONE and 1773/NONE by 1 each in U7; and 2271/1514, 2271/1773 and 1715/NONE by 4 each in U7.
- **Affects:** those units. A student who answers noisily can use up the few separating items.
- **What the user sees:** more refusals and exhausted sessions for students holding these misconceptions.
- **Evidence:** spec §1.4, §4 W2 (4 or fewer separating items). The spec's list also names 1416 vs NONE in U6; that pair no longer exists because MATH-1416 is not a U6 hypothesis (KF-02).
- **Fix and owner:** write separating items (spec D-1, T-2), Harris.
- **Decision:** none.
- **Backed by:** W2 warning (eight). `tests/test_engine_pack.py`: W2 list.

## KF-09. No link grades, so every link counts as sound (T-1)

- **What is wrong:** `items.csv` has no `link_grade` column. About 90 links that the link audit rated "stretch" therefore carry full weight.
- **Affects:** every unit.
- **What the user sees:** weak links count as strong evidence. The effect of the stretch weight on outcomes is untested (spec §3.3).
- **Evidence:** spec §3.3, §7 T-1.
- **Fix and owner:** add the column once the owner confirms the ratings (Harris). The loader already reads it when present.
- **Decision:** T-1.
- **Backed by:** W6 warning. `tests/test_engine_pack.py`: every loaded grade is `S`; a `link_grade` column is read when present.

## KF-13. Wrong options with no link push toward UNMODELLED (W4)

- **What is wrong:** 10 unit items have two or more wrong options that link no misconception.
- **Affects:** U4 (T5-011, 012, 014, 015), U6 (T6-010B, 015B), U7 (T7-003, 008, 013, 014).
- **What the user sees:** choosing such an option moves probability to UNMODELLED (spec §3.1); repeated, it can end a session as `escalated_unmodelled`.
- **Evidence:** spec §3.1, §4 W4.
- **Fix and owner:** link or rewrite those options, Harris.
- **Decision:** none.
- **Backed by:** W4 warning (ten). `tests/test_engine_pack.py`: W4 list.

---

## What backs each entry

| Entry | Loader warning | Test |
|---|---|---|
| KF-01 | `SKIPPED_ITEM` ×3 | `test_engine_pack.py`: `RealBankUnitTests`, `DecisionReversalTests` |
| KF-02 | `DROPPED_HYPOTHESIS` | `test_engine_pack.py`: `test_keeping_1416_with_the_skip_makes_it_inseparable_from_none` |
| KF-04 | W3 ×4 | `test_engine_pack.py`: `test_trigger_groups_per_misconception`, `test_dropping_a_companion_without_its_items_is_refused_by_v5` |
| KF-05 | `UNPLACED_ITEM` ×3 | `test_engine_pack.py`: `test_mapping_an_unplaced_label_needs_only_the_table` |
| KF-06 | W1 ×4 | `test_engine_pack.py`: `test_warning_lists`, `test_separating_items_count_matches_spec_examples` |
| KF-08 | W2 ×8 | `test_engine_pack.py`: `test_warning_lists` |
| KF-09 | W6 | `test_engine_pack.py`: `test_every_link_is_sound_without_a_grade_column`, `test_link_grade_column_is_read_when_present` |
| KF-13 | W4 ×10 | `test_engine_pack.py`: `test_warning_lists` |
