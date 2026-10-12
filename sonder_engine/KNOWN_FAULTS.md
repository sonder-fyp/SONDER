# Known faults of the diagnostic engine

The Maths_v2 dataset is synthetic, and no real student has answered it. Every probability and threshold in the engine is an assumed value (spec v2, honesty rule). This file lists the engine's known limitations so that they are stated rather than discovered. Each entry names the check that backs it: a loader warning printed by `python -m sonder_pack.maths_v2`, or a test in `tests/`. An entry cites only checks that exist in the repository.

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
- **What the user sees:** U6 has five misconception hypotheses instead of six. If 1416 were kept, it would predict the correct answer on every U6 item, exactly like NONE, so the two could never be told apart: a deterministic student with no misconception, and a MATH-1416 student, would both end `escalated_no_separator` naming {1416, 2359, NONE}.
- **Evidence:** the data (trigger counts); the inseparability is shown by the test below.
- **Fix and owner:** as KF-01 (Harris), then delete the `drop_hypotheses` entry.
- **Decision:** D-2 side effect, accepted by Ahmed.
- **Backed by:** `DROPPED_HYPOTHESIS` warning. `tests/test_engine_pack.py`: keeping 1416 produces W1 for MATH-1416/NONE and W3 for MATH-1416. `tests/test_engine_stopping.py` and `tests/test_engine_students.py`: the recomputed U6 deterministic students (six instead of the spec's seven; every remaining outcome unchanged). `tests/test_engine_students.py`: `test_kf02_keeping_1416_in_u6_refuses_a_student_with_no_misconception`.

## KF-03. Random answering is often diagnosed at `min_support = 2` (D-3)

- **What is wrong:** 286 of the bank's 351 wrong options (81.5%) link at least one misconception, so random answers often land on linked options, and two such answers can satisfy rule R1.
- **Affects:** every unit.
- **What the user sees:** a student who always picks option A is diagnosed in six of seven units: MATH-2392 (U1), MATH-61 (U2), MATH-1416 (U4), MATH-952 (U5), MATH-161 (U6) and MATH-2271 (U7), after 2 to 5 answers; in U3 the session runs out. The spec measured 21.5–56.0% of random clickers diagnosed per unit (39.6% pooled), falling to 18.3% at `min_support = 3` at a cost of about 2.7 points of correct diagnoses for noisy students. Those percentages were measured on the spec's configuration, which includes the old U6, and depend on random seeds; they are cited, not re-run.
- **Evidence:** spec §6.4; the deterministic "always A" student.
- **Fix and owner:** set `min_support = 3`, a one-line `Params` change; it departs from the project's "at least 2 answers" rule, so it is a team decision.
- **Decision:** D-3 (keep 2).
- **Backed by:** `tests/test_engine_students.py`: `test_kf03_a_student_who_always_picks_a_is_often_diagnosed` (at 2, and at 3, where U4 is no longer diagnosed).

## KF-04. Companions that cannot be diagnosed in their unit (D-5)

- **What is wrong:** four companion hypotheses have fewer than 3 trigger groups: MATH-2093 in U4 (1), MATH-2359 in U6 (2), MATH-1514 and MATH-1773 in U7 (1 each).
- **Affects:** those units. MATH-2093 and MATH-2359 can be diagnosed in their home unit, U7. MATH-1514 and MATH-1773 cannot be diagnosed in their home unit U4 either, because of KF-06.
- **What the user sees:** sessions with students holding these misconceptions in these units cannot end in a diagnosis of them: a deterministic 2093 student in U4 and 2359 student in U6 end `escalated_exhausted`; 1514 and 1773 students in U7 end `escalated_no_separator` with NONE in the tied set.
- **Evidence:** spec §1.5, §2.1, §6.1.
- **Fix and owner:** write more trigger items (spec T-2, Harris), or drop the companion together with the items that link it (a unit-table change).
- **Decision:** D-5 (keep them).
- **Backed by:** W3 warning (four). `tests/test_engine_pack.py`: trigger-group counts, and the check that dropping a companion without its items is refused under V5'. `tests/test_engine_stopping.py`: deterministic-student outcomes.

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
- **What the user sees:** students holding either one end as "cannot separate" (`escalated_no_separator`) naming both: 8 of the 43 deterministic students (spec §5 D2, §6.1).
- **Evidence:** spec §1.4, §5 D2, §6.1.
- **Fix and owner:** merge each pair in the catalogue (spec D-1), Harris, with team approval.
- **Decision:** D-1.
- **Backed by:** W1 warning (four). `tests/test_engine_pack.py`: W1 list, and zero separating items for 1514/1773 in U4. `tests/test_engine_stopping.py`: worked example D2 and the deterministic-student outcomes.

## KF-07. MATH-1965 is a subset of MATH-2039 (D-1)

- **What is wrong:** every option linked to MATH-1965 is also linked to MATH-2039. The two are told apart only through correct answers, on the items where 2039 is linked and 1965 is not.
- **Affects:** U2.
- **What the user sees:** a 2039 holder who answers the 2039-only items correctly is diagnosed MATH-1965, a wrong diagnosis. A deterministic student of this kind is diagnosed 1965 after 3 answers (T2-005 A, T2-001 C, T2-002 C). The spec measured 3.7% wrong diagnoses for noisy U2 students, 29 of 33 of them this case.
- **Evidence:** spec §1.4, §6.3; the deterministic case above.
- **Fix and owner:** redefine MATH-1965 so it has an option that 2039 does not take, or merge the two (spec D-1), Harris, with team approval.
- **Decision:** D-1.
- **Backed by:** `tests/test_engine_students.py`: `test_kf07_a_partial_2039_holder_is_diagnosed_as_1965`. The test asserts the wrong diagnosis, so a catalogue fix will visibly change it.

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

## KF-10. Every probability and threshold is assumed, and the data is synthetic

- **What is wrong:** no real student has answered the bank. `slip`, `guess`, the priors, θ, the support counts, δ, η and the link weights are assumptions, not estimates. The items were drafted with AI help and approved by Harris; that is content provenance, recorded by the importer later (T05.07). No AI runs during a session.
- **Affects:** every result.
- **What the user sees:** all measured behaviour comes from simulated students. It shows the machinery works as specified, not how real students will be diagnosed.
- **Evidence:** spec v2 honesty rule (header), §1.1, §3.6.
- **Fix and owner:** calibrate on real responses in a later iteration (team).
- **Decision:** none.
- **Backed by:** every trace records the engine version, all parameter values and the SHA-256 of its source files (`tests/test_engine_trace.py`: `test_header_names_content_engine_and_parameters`). `tests/test_engine_no_ai.py` checks that the engine imports no network, clock, randomness, file or model code. No test can remove the limit itself.

## KF-11. Values of θ other than 0.80 are untested (D-6)

- **What is wrong:** the outcomes depend on the confidence threshold θ. With every float parameter varied by ×0.8 and ×1.2 (16 variants), only θ changes any deterministic student's outcome: at θ = 0.96, the NONE students in U4, U6 and U7, the 2093 student in U4 and the 2359 student in U6 end `escalated_no_separator`. The spec's sixth change (1416 in U6 at θ = 0.64) no longer exists, because MATH-1416 is not a U6 hypothesis (KF-02).
- **Affects:** any change of θ, in every unit.
- **What the user sees:** nothing at θ = 0.80; different outcomes if θ is changed.
- **Evidence:** spec §6.2; recomputed on the current units.
- **Fix and owner:** keep θ at 0.80 and treat 0.64–0.96 as untested (spec D-6), team.
- **Decision:** D-6 (recommended by the spec, not yet decided).
- **Backed by:** `tests/test_engine_stopping.py`: `test_sensitivity_of_deterministic_outcomes_spec_6_2`.

## KF-12. Students who apply a misconception only sometimes often look like NONE

- **What is wrong:** a holder who applies the misconception only part of the time answers correctly on the other items, which is evidence for NONE.
- **Affects:** every unit. The spec measured about 17–24% of noisy holders ending `none_detected` (seed-dependent, cited, not re-run).
- **What the user sees:** missed diagnoses. Worked example D1 shows the mechanism: a MATH-1379 holder answers correctly twice; with `min_support_none = 2` the session would end there as `none_detected`. The default of 3 keeps it open, and it ends diagnosed.
- **Evidence:** spec §5 D1, §6.3.
- **Fix and owner:** inherent in the evidence rule; revisit with real data (team).
- **Decision:** none.
- **Backed by:** `tests/test_engine_students.py`: `test_kf12_one_slip_would_hide_a_misconception_without_the_three_answer_rule`; `tests/test_engine_stopping.py`: `test_d1_none_blocked_by_support_then_1379_diagnosed`.

## KF-13. Wrong options with no link push toward UNMODELLED (W4)

- **What is wrong:** 10 unit items have two or more wrong options that link no misconception.
- **Affects:** U4 (T5-011, 012, 014, 015), U6 (T6-010B, 015B), U7 (T7-003, 008, 013, 014).
- **What the user sees:** choosing such an option moves probability to UNMODELLED (spec §3.1); repeated, it can end a session as `escalated_unmodelled`.
- **Evidence:** spec §3.1, §4 W4.
- **Fix and owner:** link or rewrite those options, Harris.
- **Decision:** none.
- **Backed by:** W4 warning (ten). `tests/test_engine_pack.py`: W4 list.

## KF-14. Selection reasons quote option letters, not text

- **What is wrong:** the engine's `Item` holds option IDs but not option text, so the selection reason from `select_next` says "B" rather than "B (48,600)".
- **Affects:** the teacher-facing trace, in every unit.
- **What the user sees:** a selection reason needs the item open beside it to be read. The answer note does quote the text (for example "Chose B (8,300), linked to MATH-1379."), because the pack keeps option texts.
- **Evidence:** `sonder_engine/README.md`, "Known presentation limit".
- **Fix and owner:** pass option text to the reason, an adapter change agreed between Harris (selection) and Ashher (`Item`).
- **Decision:** none.
- **Backed by:** `tests/test_engine_session.py`: `test_answer_notes_quote_the_option_text`.

---

## What backs each entry

| Entry | Loader warning | Test |
|---|---|---|
| KF-01 | `SKIPPED_ITEM` ×3 | `test_engine_pack.py`: `RealBankUnitTests`, `DecisionReversalTests` |
| KF-02 | `DROPPED_HYPOTHESIS` | `test_engine_pack.py`: `test_keeping_1416_with_the_skip_makes_it_inseparable_from_none`; `test_engine_stopping.py`: `test_deterministic_students_spec_6_1`; `test_engine_students.py`: `test_kf02_keeping_1416_in_u6_refuses_a_student_with_no_misconception` |
| KF-03 | — | `test_engine_students.py`: `test_kf03_a_student_who_always_picks_a_is_often_diagnosed` |
| KF-04 | W3 ×4 | `test_engine_pack.py`: `test_trigger_groups_per_misconception`, `test_dropping_a_companion_without_its_items_is_refused_by_v5`; `test_engine_stopping.py`: `test_deterministic_students_spec_6_1` |
| KF-05 | `UNPLACED_ITEM` ×3 | `test_engine_pack.py`: `test_mapping_an_unplaced_label_needs_only_the_table` |
| KF-06 | W1 ×4 | `test_engine_pack.py`: `test_warning_lists`, `test_separating_items_count_matches_spec_examples`; `test_engine_stopping.py`: `test_d2_1514_refused_naming_both`, `test_deterministic_students_spec_6_1` |
| KF-07 | — | `test_engine_students.py`: `test_kf07_a_partial_2039_holder_is_diagnosed_as_1965` |
| KF-08 | W2 ×8 | `test_engine_pack.py`: `test_warning_lists` |
| KF-09 | W6 | `test_engine_pack.py`: `test_every_link_is_sound_without_a_grade_column`, `test_link_grade_column_is_read_when_present` |
| KF-10 | — | `test_engine_trace.py`: `test_header_names_content_engine_and_parameters`; `test_engine_no_ai.py` |
| KF-11 | — | `test_engine_stopping.py`: `test_sensitivity_of_deterministic_outcomes_spec_6_2` |
| KF-12 | — | `test_engine_students.py`: `test_kf12_one_slip_would_hide_a_misconception_without_the_three_answer_rule`; `test_engine_stopping.py`: `test_d1_none_blocked_by_support_then_1379_diagnosed` |
| KF-13 | W4 ×10 | `test_engine_pack.py`: `test_warning_lists` |
| KF-14 | — | `test_engine_session.py`: `test_answer_notes_quote_the_option_text` |
