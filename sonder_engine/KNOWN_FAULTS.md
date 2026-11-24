# Known faults of the diagnostic engine

The Maths_v2 dataset is synthetic, and no real student has answered it. Every probability and threshold in the engine is an assumed value (spec v2, honesty rule). This file lists the engine's known limitations so that they are stated rather than discovered. Each entry names the check that backs it: a loader warning printed by `python -m sonder_pack.maths_v2`, or a test in `tests/`. An entry cites only checks that exist in the repository.

Decision IDs (D-1 … D-6, T-1) refer to `docs/ENGINE_SPEC_DRAFT.md` §7. Item and misconception data are never changed to work around a fault; exclusions exist only in the unit table `sonder_pack/maths_v2_units.json`.

Each entry has these fields: what is wrong, what it affects, what the user sees, evidence, the fix and its owner, the decision, and what backs it.

**Content version.** The entries are stated for the Maths_v2 candidate of 20 November 2026 (133 items, 27 misconceptions, PR #92), measured on 24 November 2026. Where the 117-item bank of the Mid-1 evaluation behaved differently, the entry says so. KF-04 and KF-06 are resolved by that content; KF-01 and KF-02 can now be resolved by a unit-table change.

---

## KF-01. Three U6 items are skipped (D-2)

- **What was wrong:** on the 117-item bank, T6-011B, T6-014B and T6-016B each linked MATH-1416 to three options. At `guess = 0.30` each predicted option gets probability 0.233 and the correct option 0.300, so the model would say a holder prefers the correct answer (spec §3.1). Rule P1 refuses such an item at this `guess`.
- **Now:** Harris removed MATH-1416 from two of the three options of each item (18 and 20 November 2026), so each links it to one option and P1 passes at the default `guess` (`tests/test_bayes_math_candidate.py`). The unit table still skips the three items, and the `SKIPPED_ITEM` warning still gives the old reason, which is no longer true.
- **Affects:** U6. Its 21 items become 18 (14 twin groups).
- **What the user sees:** those three questions are never asked.
- **Evidence:** spec §1.1, §3.1, §3.6 (P1).
- **Fix and owner:** the content fix is done (Harris). What remains is to delete the three `skip_items` entries from `sonder_pack/maths_v2_units.json` and re-pin the U6 tests (Ahmed, owner of D-2 and the unit table).
- **Decision:** D-2. Excluded at load time with a warning; to be revisited now that the content has changed.
- **Backed by:** `SKIPPED_ITEM` warning (three, on every load). `tests/test_engine_pack.py`: unit counts; removing the skip now loads a 21-item U6 with MATH-1416 at the default `guess` and at 0.24.

## KF-02. MATH-1416 is not a U6 hypothesis (D-2 side effect)

- **What is wrong:** the three skipped items are the only U6 items with an option linked to MATH-1416. Once they are skipped, no U6 question can give evidence for it. Its trigger groups fall from 3 to 0.
- **Affects:** U6 only. MATH-1416 is a companion in U6; its home unit U4 keeps it.
- **What the user sees:** U6 has five misconception hypotheses instead of six. If 1416 were kept, it would predict the correct answer on every U6 item, exactly like NONE, so the two could never be told apart: a deterministic student with no misconception, and a MATH-1416 student, would both end `escalated_no_separator` naming {1416, 2359, NONE}.
- **Evidence:** the data (trigger counts); the inseparability is shown by the test below.
- **Now:** still true while the KF-01 skip stays. Kept in U6 with the skip, MATH-1416 still answers exactly like NONE, and a NONE student and a MATH-1416 student are both refused naming {1416, NONE}; MATH-2359 is no longer in that set because B17's T6-012B separates it. Without the skip the three B twins (single-step "hours + 60" options) are U6 trigger items for MATH-1416.
- **Fix and owner:** delete the `drop_hypotheses` entry together with the KF-01 skip (Ahmed), then recompute the U6 students.
- **Decision:** D-2 side effect, accepted by Ahmed.
- **Backed by:** `DROPPED_HYPOTHESIS` warning. `tests/test_engine_pack.py`: keeping 1416 produces W1 for MATH-1416/NONE and W3 for MATH-1416. `tests/test_engine_stopping.py` and `tests/test_engine_students.py`: the recomputed U6 deterministic students (six instead of the spec's seven; every remaining outcome unchanged). `tests/test_engine_students.py`: `test_kf02_keeping_1416_in_u6_refuses_a_student_with_no_misconception`.

## KF-03. Random answering is often diagnosed at `min_support = 2` (D-3)

- **What is wrong:** 296 of the candidate's 399 wrong options (74.2%; 81.5% on the 117-item bank) link at least one misconception, so random answers often land on linked options, and two such answers can satisfy rule R1.
- **Affects:** every unit.
- **What the user sees:** a student who always picks option A is diagnosed in six of seven units: MATH-2392 (U1), MATH-61 (U2), MATH-1416 (U4), MATH-952 (U5), MATH-161 (U6) and MATH-2271 (U7), after 2 to 6 answers; in U3 the session runs out. The seeded adverse baseline labels 44.7% of random answerers on the candidate, up from 37.9% on the 117-item bank, because the new separating items remove refusals that used to stop those sessions (`experiments/ADVERSE_CASES.md`). The spec measured 21.5–56.0% of random clickers diagnosed per unit (39.6% pooled), falling to 18.3% at `min_support = 3` at a cost of about 2.7 points of correct diagnoses for noisy students. Those percentages were measured on the spec's configuration, which includes the old U6, and depend on random seeds; they are cited, not re-run.
- **Evidence:** spec §6.4; the deterministic "always A" student; `experiments/results/adverse-baseline-candidate-2026-11-20/`; I2-A04 (`experiments/FINDINGS_A04.md`).
- **Fix and owner:** set `min_support = 3`, a one-line `Params` change; it departs from the project's "at least 2 answers" rule, so it is a team decision.
- **Decision:** D-3 (keep 2).
- **Backed by:** `tests/test_engine_students.py`: `test_kf03_a_student_who_always_picks_a_is_often_diagnosed` (at 2, and at 3, where U4 is no longer diagnosed).

## KF-04. Companions that cannot be diagnosed in their unit (D-5) — resolved by the candidate content

- **Resolved:** on the candidate no hypothesis has fewer than 3 trigger groups (no W3 warning). B18 adds MATH-2093 items to U4, B17 adds MATH-2359 items to U6 and B21 adds MATH-1514/1773 items to U7. Every deterministic companion student is now diagnosed: 2093 in U4 after 4 answers, 2359 in U6 after 3, 1514 and 1773 in U7 after 4. The rest of this entry describes the 117-item bank.
- **What was wrong:** four companion hypotheses had fewer than 3 trigger groups: MATH-2093 in U4 (1), MATH-2359 in U6 (2), MATH-1514 and MATH-1773 in U7 (1 each).
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

## KF-06. Inseparable pairs MATH-1514/1773 and MATH-1074/1651 (D-1) — resolved by the candidate content

- **Resolved:** the candidate has no structurally inseparable pair (no W1 warning). B19 (T4-011, T4-012) separates 1514/1773 in U4, B21 (T7-017, T7-018) in U7, and B20 (T6-022, T6-023) separates 1074/1651 in U6; MATH-1651 is no longer linked in U3. Worked example D2 is now diagnosed, and all 41 deterministic students end correctly. Each pair is still separated by only two item groups (KF-08), so a session that has answered those two items without the separating option is still refused naming the pair; every such refusal is exact-row (KF-15). The rest of this entry describes the 117-item bank.
- **What was wrong:** in each pair, both misconceptions predicted the same answers on every item of the units that contained them.
- **Affects:** 1074/1651 in U3 and U6; 1514/1773 in U4 and U7.
- **What the user sees:** students holding either one end as "cannot separate" (`escalated_no_separator`) naming both: 8 of the 43 deterministic students (spec §5 D2, §6.1).
- **Evidence:** spec §1.4, §5 D2, §6.1.
- **Fix and owner:** merge each pair in the catalogue (spec D-1), Harris, with team approval.
- **Decision:** D-1.
- **Backed by:** W1 warning (four). `tests/test_engine_pack.py`: W1 list, and zero separating items for 1514/1773 in U4. `tests/test_engine_stopping.py`: worked example D2 and the deterministic-student outcomes.

## KF-07. MATH-1965 is a subset of MATH-2039 (D-1)

- **What is wrong:** every option linked to MATH-1965 is also linked to MATH-2039. The two are told apart only through correct answers, on the items where 2039 is linked and 1965 is not.
- **Affects:** U2.
- **What the user sees:** a 2039 holder who answers the 2039-only items correctly is diagnosed MATH-1965, a wrong diagnosis. A deterministic student of this kind is diagnosed 1965 after 3 answers (T2-005 A, T2-001 C, T2-002 C), on the candidate as before. The spec measured 3.7% wrong diagnoses for noisy U2 students, 29 of 33 of them this case; the seeded adverse baseline on the candidate labels 22, 16 and 4 of 100 intermittent 2039 holders MATH-1965 at apply rates 0.5, 0.7 and 0.9 (22, 17 and 4 before). The candidate content does not change this fault.
- **Evidence:** spec §1.4, §6.3; the deterministic case above.
- **Fix and owner:** redefine MATH-1965 so it has an option that 2039 does not take, or merge the two (spec D-1), Harris, with team approval.
- **Decision:** D-1.
- **Backed by:** `tests/test_engine_students.py`: `test_kf07_a_partial_2039_holder_is_diagnosed_as_1965`. The test asserts the wrong diagnosis, so a catalogue fix will visibly change it.

## KF-08. Weakly separable pairs (W2)

- **What is wrong:** on the candidate, eight pairs are separated by 4 or fewer item groups: 1074/NONE by 3 in U3; 1514/1773 by 2 and 2093/NONE by 4 in U4; 1074/1651 by 2 and 2359/NONE by 4 in U6; 1514/1773 by 2, 1773/NONE by 3 and 1715/NONE by 4 in U7. The three 2-group pairs are the former inseparable pairs of KF-06. (On the 117-item bank: 414/734 by 3 in U5; 2093/NONE by 1 in U4; 2359/NONE by 2 in U6; 1514/NONE and 1773/NONE by 1 each, and 2271/1514, 2271/1773 and 1715/NONE by 4 each, in U7.)
- **Affects:** those units. A student who answers noisily can use up the few separating items.
- **What the user sees:** more refusals and exhausted sessions for students holding these misconceptions.
- **Evidence:** spec §1.4, §4 W2 (4 or fewer separating items); the loader's W2 list. All answer sequences of every unit were enumerated on 24 November 2026 (`python -m experiments.enumerate_sequences`): R4 refusals remain in U2, U3, U4, U6 and U7, in sessions where the pair's few separating items (or their twins) had already been asked without the separating answer, and none in U1 or U5.
- **Fix and owner:** write separating items (spec D-1, T-2), Harris.
- **Decision:** none.
- **Backed by:** W2 warning (eight on the candidate). `tests/test_engine_pack.py`: W2 list. `tests/test_engine_r4_rows.py`: `test_a_real_bank_refusal_is_an_exact_row_case` (U6, 2359/NONE once the items separating them have been asked).

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

- **What is wrong:** the outcomes depend on the confidence threshold θ. On the 117-item bank, with every float parameter varied by ×0.8 and ×1.2 (16 variants), only θ changed any deterministic student's outcome: at θ = 0.96, the NONE students in U4, U6 and U7, the 2093 student in U4 and the 2359 student in U6 ended `escalated_no_separator`. On the candidate none of the 16 variants changes any deterministic outcome. That only says the 41 deterministic students are robust; noisy and adverse students still depend on θ (I2-A04 measured θ = 0.90), so θ values other than 0.80 remain untested as a default.
- **Affects:** any change of θ, in every unit.
- **What the user sees:** nothing at θ = 0.80; different outcomes if θ is changed.
- **Evidence:** spec §6.2; recomputed on the current units for both banks; `experiments/FINDINGS_A04.md`.
- **Fix and owner:** keep θ at 0.80 and treat 0.64–0.96 as untested (spec D-6), team.
- **Decision:** D-6 (recommended by the spec, not yet decided).
- **Backed by:** `tests/test_engine_stopping.py`: `test_sensitivity_of_deterministic_outcomes_spec_6_2`.

## KF-12. Students who apply a misconception only sometimes often look like NONE

- **What is wrong:** a holder who applies the misconception only part of the time answers correctly on the other items, which is evidence for NONE.
- **Affects:** every unit. The spec measured about 17–24% of noisy holders ending `none_detected` (seed-dependent, cited, not re-run).
- **What the user sees:** missed diagnoses. Worked example D1 shows the mechanism: a MATH-1379 holder answers correctly twice (T1-001, T1-006 on the candidate); with `min_support_none = 2` the session would end there as `none_detected`. The default of 3 keeps it open, and it ends diagnosed.
- **Evidence:** spec §5 D1, §6.3.
- **Fix and owner:** inherent in the evidence rule; revisit with real data (team).
- **Decision:** none.
- **Backed by:** `tests/test_engine_students.py`: `test_kf12_one_slip_would_hide_a_misconception_without_the_three_answer_rule`; `tests/test_engine_stopping.py`: `test_d1_none_blocked_by_support_then_1379_diagnosed`.

## KF-13. Wrong options with no link push toward UNMODELLED (W4)

- **What is wrong:** 25 unit items on the candidate (10 on the 117-item bank) have two or more wrong options that link no misconception. Most are deliberate: Harris's rule is that an unlinked option is better than a stretch link.
- **Affects:** U4 (T4-011, 012, T5-011, 012, 014, 015, 020, 021, 022), U5 (T5-003, 004), U6 (T6-010B, 012B, 013B, 015B, 022, 023), U7 (T7-003, 008, 013, 014, 017, 018, 019, 020).
- **What the user sees:** choosing such an option moves probability to UNMODELLED (spec §3.1); repeated, it can end a session as `escalated_unmodelled`.
- **Evidence:** spec §3.1, §4 W4.
- **Fix and owner:** none planned: linking these options would add stretch links. The model effect is real whatever the warning says, so this entry stays while unlinked options push toward UNMODELLED. Harris has asked for W4 to be removed as noise (MANIFEST, 20 November 2026); that is a loader change (Ahmed) and a spec change (Ashher) still to be agreed.
- **Decision:** none.
- **Backed by:** W4 warning (25 on the candidate). `tests/test_engine_pack.py`: W4 list.

## KF-14. Selection reasons quote option letters, not text

- **What is wrong:** the engine's `Item` holds option IDs but not option text, so the selection reason from `select_next` says "B" rather than "B (48,600)".
- **Affects:** the teacher-facing trace, in every unit.
- **What the user sees:** a selection reason needs the item open beside it to be read. The answer note does quote the text (for example "Chose B (8,300), linked to MATH-1379."), because the pack keeps option texts.
- **Evidence:** `sonder_engine/README.md`, "Known presentation limit".
- **Fix and owner:** pass option text to the reason, an adapter change agreed between Harris (selection) and Ashher (`Item`).
- **Decision:** none.
- **Backed by:** `tests/test_engine_session.py`: `test_answer_notes_quote_the_option_text`.

## KF-15. R4's ceiling was exact only for identical tied rows (supervisor action 3) — corrected in I2-A03

- **What was wrong:** R4 groups into the tied set C every hypothesis whose answer distribution is within `delta_sep` (total variation) of the leader's on every remaining item. It used to refuse when p(leader)/p(C) < theta and state that "the most the leader can reach" is that ratio. The ratio is a true ceiling only when the rows are identical. With near rows (0 < TV ≤ 0.05) each answer multiplies the odds inside C by a likelihood ratio, so shares move: in the I2-A02 cases the stated value was exceeded after one answer, and with 40 items, budget 40 and EIG floor 0.001 R4 blocked a session in which R1 would have diagnosed at answer 29.
- **Correction (I2-A03):** R4 now refuses only when the highest share any member of C could reach within the answers left (`reachable_share`, spec §3.5) stays below theta. A member's probability is at most its share of C, so a refusal guarantees that no tied hypothesis can reach theta in the session under the model. Decisions and traces report `leader_share` (p(leader)/p(C)) and `reachable_share` instead of `ceiling`; the message no longer claims a ceiling. The bound treats each pair separately, so it is conservative: near-row sessions are refused less often and may end by R5 instead.
- **Affects:** no outcome on either bank. At default parameters every pair of rows in Maths_v2 is either identical or more than `delta_sep` apart, so every R4 refusal is an exact-row refusal, where `reachable_share` equals the old ratio bit for bit. On the 117-item bank the 43 deterministic students and all 5,551 adverse-baseline runs reproduced unchanged. On the candidate this still holds: every answer sequence of every unit was enumerated (24 November 2026, `python -m experiments.enumerate_sequences`), and in all 1,285 R4 refusals found (U2 80, U3 193, U4 235, U6 306, U7 471; none in U1 or U5) `reachable_share` equals `leader_share`.
- **What remains:** R4 still ignores the budget when forming C: a pair whose only separating item can no longer be asked ends in R5 (budget) with no tied set named. Near rows appear only if link grades or parameters bring a stretch row close to its sound row; a guard test reports when that happens.
- **Owner:** Ashher (I2-A03). Ahmed, owner of `stopping.py` and the named session-integration checker, reviews the change; Harris is the logic reviewer.
- **Backed by:** `tests/test_engine_r4_rows.py`: `EngineReachableShareTests`, `RealBankRowTests` (no near rows in the current bank; a real U6 refusal is exact), `ExactRowTests`, `NearRowTests` (w_stretch 0.95: no longer refused, ends by R5), `NearRowRefusalTests` (w_stretch 0.99: refused with reachable share 0.609; an exhaustive check of all 5,460 answer sequences stays within it), `NearRowLargerBudgetTests` (reaches the R1 diagnosis R4 used to block), `InteractionTests`; `tests/test_engine_stopping.py` (message and fields); `tests/test_engine_enumerate.py` (the enumeration counts every sequence once and reports a near-row refusal as not exact).

---

## What backs each entry

| Entry | Loader warning | Test |
|---|---|---|
| KF-01 | `SKIPPED_ITEM` ×3 | `test_engine_pack.py`: `RealBankUnitTests`, `DecisionReversalTests` |
| KF-02 | `DROPPED_HYPOTHESIS` | `test_engine_pack.py`: `test_keeping_1416_with_the_skip_makes_it_inseparable_from_none`; `test_engine_stopping.py`: `test_deterministic_students_spec_6_1`; `test_engine_students.py`: `test_kf02_keeping_1416_in_u6_refuses_a_student_with_no_misconception` |
| KF-03 | — | `test_engine_students.py`: `test_kf03_a_student_who_always_picks_a_is_often_diagnosed` |
| KF-04 (resolved) | W3 ×0 (×4 on the 117-item bank) | `test_engine_pack.py`: `test_trigger_groups_per_misconception`, `test_dropping_a_companion_without_its_items_is_refused_by_v5`; `test_engine_stopping.py`: `test_deterministic_students_spec_6_1` |
| KF-05 | `UNPLACED_ITEM` ×3 | `test_engine_pack.py`: `test_mapping_an_unplaced_label_needs_only_the_table` |
| KF-06 (resolved) | W1 ×0 (×4 on the 117-item bank) | `test_engine_pack.py`: `test_warning_lists`, `test_separating_items_count_matches_spec_examples`; `test_engine_stopping.py`: `test_d2_1514_separated_from_1773_and_diagnosed`, `test_deterministic_students_spec_6_1` |
| KF-07 | — | `test_engine_students.py`: `test_kf07_a_partial_2039_holder_is_diagnosed_as_1965` |
| KF-08 | W2 ×8 | `test_engine_pack.py`: `test_warning_lists`; `test_engine_r4_rows.py`: `test_a_real_bank_refusal_is_an_exact_row_case` |
| KF-09 | W6 | `test_engine_pack.py`: `test_every_link_is_sound_without_a_grade_column`, `test_link_grade_column_is_read_when_present` |
| KF-10 | — | `test_engine_trace.py`: `test_header_names_content_engine_and_parameters`; `test_engine_no_ai.py` |
| KF-11 | — | `test_engine_stopping.py`: `test_sensitivity_of_deterministic_outcomes_spec_6_2` |
| KF-12 | — | `test_engine_students.py`: `test_kf12_one_slip_would_hide_a_misconception_without_the_three_answer_rule`; `test_engine_stopping.py`: `test_d1_none_blocked_by_support_then_1379_diagnosed` |
| KF-13 | W4 ×25 | `test_engine_pack.py`: `test_warning_lists` |
| KF-14 | — | `test_engine_session.py`: `test_answer_notes_quote_the_option_text` |
| KF-15 | — | `test_engine_r4_rows.py`: `EngineReachableShareTests`, `RealBankRowTests`, `ExactRowTests`, `NearRowTests`, `NearRowRefusalTests`, `NearRowLargerBudgetTests`, `InteractionTests` |
