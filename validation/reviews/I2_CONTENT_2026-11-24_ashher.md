# Review: Maths_v2 candidate content and links (Harris, I2-H01–H08)

**Reviewer:** Syed Ashher Majid · **Author:** Muhammad Harris · **Date:** 24 November 2026
**Content reviewed:** PR #92, branch `harris/dataset-improvement`, data as of Harris's commit `37d1bb3` (unchanged by the test and documentation commits added on top). `bank/items.csv` LF SHA-256 `b168a664…ff73`, `topics.csv` `ebe0571b…20b0`: 133 items, 532 option rows, 27 misconceptions, status **Candidate**.
**Compared with:** `dev` at `7ff9978` (the 117-item bank of the Mid-1 evaluation).
**Review duty:** work division §7, first row. I independently solve selected changed items, check every disputed-link disposition in the release, recompute the unit, trigger and separator counts, and compare the accepted inventory to the expert's decisions. **This technical review does not replace the external Maths-expert acceptance (I2-H07).**

Everything below was computed from the files, not taken from the manifest. All students are synthetic and every engine parameter is assumed (KF-10).

## 1. Checks I ran

| Check | How | Result |
| --- | --- | --- |
| Inventory against `dev` | Per item and option, I compared stem, options, links, the correct mark, target and topic | **16 items added, 0 removed, 75 changed** (§2) |
| Correct answers | I worked out every one of the 91 added or changed items myself | **91 of 91 correct** |
| Linked options | For each linked option of those 91 items I applied the misconception's rule to the stem (for example T5-010 B: 144 − 27 ÷ 3 = 135 for MATH-414; T6-011B C: 2 + 60 = 62 for MATH-1416) | Every link matches its misconception's rule; three presentation notes (§5, issue 9) |
| Disputed links | Each FORCED link, STRETCH group and structural finding of `LINK_AUDIT_SUMMARY.md`, checked against the candidate data | All 5 FORCED links fixed; every STRETCH group resolved or recorded as a known limitation (§3) |
| Unit, trigger and separator counts | Recomputed from the engine's likelihoods (twins collapsed, TV > δ), independently of the loader's warning code | Matches the loader exactly: no inseparable pair (W1), no hypothesis under 3 trigger groups (W3), 8 weakly separable pairs (W2) (§4) |
| Batch files against the bank | The 20 approved batch files (B01–B08, B10–B21) compared with `bank/items.csv` cell by cell, excluding `status` and `batch` | 532 rows on each side, 4,256 cells, **0 differences** |
| Validator | `python -m validation.math_dataset`; `tests/test_math_dataset.py` | 0 structural errors, 0 P1 conflicts, 6 topic-label warnings; 14 tests pass |
| Engine load | `python -m sonder_pack.maths_v2` with `dev`'s unit table | Loads: 7 units, 50 warnings |
| Harris's claim that every simulated student is diagnosed correctly | Every deterministic student of every unit through the real run loop | **True for noise-free students:** 41 of 41 end correctly (34 diagnosed, 7 none detected). Not true for noisy or adverse students (§5, issue 4) |
| Adverse cases | Frozen rerun `experiments/results/adverse-baseline-candidate-2026-11-20/` (5,549 runs) | Always-A and the partial 2039 holder are unchanged; random answering is labelled more often, 44.7% against 37.9% (§5, issue 4) |
| Every answer sequence | `python -m experiments.enumerate_sequences`, all 7 units | 1,285 R4 refusals in U2, U3, U4, U6 and U7, all exact-row; none in U1 or U5 |
| Expert decisions | Looked for item-level external decisions in the PR, the manifest and the batches | **None exist.** The inventory cannot be compared with expert decisions yet (§6) |

## 2. Inventory against `dev`

| Change | Items |
| --- | --- |
| Added (16) | B17: T6-012B, T6-013B · B18: T5-017 to T5-022 · B19: T4-011, T4-012 · B20: T6-022, T6-023 · B21: T7-017 to T7-020 |
| Links only (7) | T2-023, T2-024, T3-003, T3-005, T3-008, T5-006, T5-007 |
| Links and target (5) | T2-020, T2-025, T3-006, T3-010, T5-004 |
| Options only (2) | T6-013, T7-012 |
| Stem only (10) | T1-010, T1-013, T1-015, T1-017, T1-018, T1-020, T4-009, T4-010, T6-017, T7-011 |
| Stem and links (1) | T5-003 |
| Stem and options (40) | T1-002, T1-008, T2-005 to T2-010, T2-015 to T2-019, T3-001, T4-001 to T4-007, T5-011, T5-014, T5-015, T5-016, T6-010, T6-010B, T6-011, T6-012, T6-014, T6-015, T6-015B, T6-016, T6-018, T7-001, T7-002, T7-006, T7-009, T7-010, T7-016 |
| Stem, options and links (9) | T1-001, T1-011, T1-014, T5-005, T5-008, T5-009, T6-011B, T6-014B, T6-016B |
| Stem, options, links and target (1) | T5-010 |

Link changes on kept items: 29 option cells. MATH-1715 was removed from 4 percentage options, MATH-1651 from 5 T3 options, MATH-734 from 8 options and from the catalogue, and MATH-1416 from two options of each of T6-011B, T6-014B and T6-016B. The extra MATH-2392 link moved from a shared option to its own option in T1-001, T1-011 and T1-014.

## 3. Disputed-link dispositions (`LINK_AUDIT_SUMMARY.md`, 9 October 2026)

| Audit finding | In the candidate | My view |
| --- | --- | --- |
| FORCED T3-003 A, T3-006 A, T3-009 C, T3-010 C (MATH-2359 not a true reversal) | Now the true reversals 4 ÷ 200, 5 ÷ 150, 0.01, 0.05 | Fixed |
| FORCED T5-014 C (MATH-2359) | T5-014 rebuilt as calculation recognition; C (√16 / 2⁶) unlinked | Fixed. Option C is the commutative reading, but U4 has no MATH-2359 hypothesis, so leaving it unlinked is correct |
| STRETCH: MATH-1248 on unchanged numbers (B01/B02) | No MATH-1248 option repeats a stem number | Resolved |
| STRETCH: MATH-1715 through a percentage step | No MATH-1715 option is a percentage. The 15 items that link it all use a direct fraction-to-decimal option | Resolved |
| STRETCH: MATH-658 doubling on denominators 4, 5, 20, 25 | Kept by decision | Sound under the catalogue's own definition ("doubles the numerator to turn a fraction into a percentage"); the expert should confirm |
| STRETCH: MATH-2039 on bare fractions | No MATH-2039 option is a bare fraction; the T2 conversion checks use the "x marks out of y" form | Resolved |
| STRETCH: MATH-1416 on T4-001 to T4-005 | Kept as a known limitation (two-step inference) | Agree it is recorded honestly; the expert should decide |
| STRETCH: MATH-228 options equal to a stem number (T4-003, T4-006, T4-007) | Values now 9, 5, 7 (36 ÷ 4, 15 ÷ 3, 14 ÷ 2), none in the stem | Resolved |
| STRETCH: MATH-734 halving on cube roots | Unlinked, then MATH-734 removed from the catalogue | Resolved. Nothing is lost, because every remaining MATH-734 option was shared with MATH-414 |
| STRETCH: MATH-1514/1773 on T5-011 A; MATH-2093 on T5-014 A | Kept: T5-011 A (36 + 4) in a worded comparison, T5-014 A (2⁶ − √16) in recognition form | I judge both sound now |
| STRETCH: MATH-161/767 through the two-step seconds chain (B10) | Rebuilt as minutes and hours (groups 1 and 2); no T6 item uses seconds | Resolved |
| STRETCH: T3-001 D, T3-005 C, T3-010 D | T3-001 rebuilt (D 1.25 = 10 ÷ 8 for MATH-2359); T3-005 C and T3-010 D unlinked | Resolved |
| STRETCH: MATH-1639 partial left-to-right readings (B11, B12) | Kept, items reworded; recorded as inferences | Recorded honestly; the expert should decide |
| STRETCH: MATH-1416 mixed steps (B14) | Rebuilt as single-step "hours + 60" options | Resolved in the data. The unit table still skips these items (§5, issue 7) |
| Structural 1: MATH-414/734 inseparable | MATH-734 removed | Resolved |
| Structural 2: B10 seconds options fit "100 or 10 seconds in a minute" | No T6 item converts seconds | Resolved. The manifest's known-limitations list still states it (issue 3) |
| Structural 3: MATH-1651 in percentage questions | Unlinked from all of T3 | Resolved |
| Structural 4: absurd multiplied values | Largest now 18,000 hours (from 64,800,000); the others kept by decision (Issue 2) | Acceptable |
| Structural 5: stem-number coincidences | T4 fixed; T5 items rebuilt; T7-002, T7-009 and T7-016 reworded (Issue 7) | Resolved, except the kept unlinked echoes Harris listed |
| Structural 6: wording ("less seats", T5-003) | "fewer" for countable nouns; T5-003 is now "n × n × n = 27" | Resolved |

## 4. Recounted units (engine likelihoods, twins collapsed)

| Unit | Items | Twin groups | k | Fewest trigger groups | Pairs with 4 or fewer separating groups |
| --- | --- | --- | --- | --- | --- |
| U1 | 20 | 20 | 4 | 1988: 9 | none |
| U2 | 25 | 19 | 5 | 1715: 5 | none |
| U3 | 10 | 10 | 4 | 1074: 3 | 1074/NONE 3 |
| U4 | 21 | 21 | 6 | 2093: 4 | 1514/1773 2, 2093/NONE 4 |
| U5 | 13 | 13 | 3 | 952: 10 | none |
| U6 | 18 | 14 | 5 | 2359: 4 | 1074/1651 2, 2359/NONE 4 |
| U7 | 20 | 20 | 7 | 1773: 3 | 1514/1773 2, 1715/NONE 4, 1773/NONE 3 |

Unplaced: T6-019B, T6-020B, T6-021B (D-4). U6 skips T6-011B, T6-014B and T6-016B and drops MATH-1416 (D-2).

## 5. Issues found

| # | Issue | Suggested action | Owner |
| --- | --- | --- | --- |
| 1 | The PR description says **53 items changed and 18 new**; the per-item comparison with `dev` gives **75 changed and 16 new**. The PR's numbers probably count review groups, or items later withdrawn (T6-018B; the trimmed B19 and B20 items). | State in the PR which count is meant; the release inventory should use the per-item comparison | Harris |
| 2 | The PR text cites **36 draft-contract findings**. That is the output of an older validator; the validator on this branch (since `a3eadcb`) reports 0 structural errors, 0 P1 conflicts and 6 warnings. | Correct the PR text | Harris |
| 3 | Stale lines in `MANIFEST.md` "Known limitations": the B10 seconds-per-hour line (no item converts seconds); "MATH-1773 is never the target of any item" (T7-019 and T7-020 now target it); "No engine import test has been run" (the loader and the engine tests now run on it); the PR #6 counts. The Issue 8 row's "75 unlinked wrong options" was true on that day; the bank now has **103**, as the counts line says. `LINK_AUDIT_SUMMARY.md` still says "the bank (117 items) is untouched". | Update the known limitations; mark the audit summary as historical | Harris |
| 4 | "Every simulated student in every unit is diagnosed correctly" holds only for **noise-free deterministic** students. On the same content, the always-A student is still labelled in 6 of 7 units (KF-03); the partial MATH-2039 holder is still labelled MATH-1965 (KF-07); and random answering is labelled **more** often than before (44.7% against 37.9%), because the new separating items remove refusals that used to stop those sessions. | Present the separation result only as "noise-free students"; the adverse results go beside it in the report | Harris (wording), Ashher (results) |
| 5 | Every misconception has at least 5 independent groups **across the bank**, but the engine counts within a unit, and five unit hypotheses have only 3–4: U3 1074 (3), U4 2093 (4), U6 2359 (4), U7 1715 (4), U7 1773 (3). They pass the loader's minimum of 3. | Quote per-unit counts when describing what a session can use | Harris |
| 6 | The seven T2 conversion-check items (T2-005 to T2-010, T2-019) share the stem "Which of these conversions is correct?", so the loader treats them as one twin group and asks at most one per session (U2: 25 items, 19 groups). Harris's Issue 1 asks for a loader change instead. | I recommend a content fix: give each stem a distinguishing phrase. The twin rule exists so that an identical question is never asked twice, and the loader cannot tell "same stem, different options" from a real twin without a new data column. If the team prefers a loader change, it needs an explicit `twin_group` column, not a looser stem rule | Harris (content) or Ahmed (loader), team decision |
| 7 | The unit table still skips T6-011B, T6-014B and T6-016B with the reason "links MATH-1416 to 3 options", which is no longer true; each now links it to one option and passes P1. | Remove the D-2 skip and the MATH-1416 drop in a follow-up PR, then recompute U6 | Ahmed (D-2 owner) |
| 8 | Harris asks for loader warning W4 (two or more unlinked wrong options) to be removed. The warning reports a real model effect: unlinked options move probability to UNMODELLED (KF-13), deliberately or not. | Keep W4, perhaps as information level, and keep KF-13; agree before changing loader and spec | Ahmed (loader), Ashher (spec), team |
| 9 | Presentation: T1-010 A `7.30`, T1-013 A `12.0` and T1-017 D `5.70` write a coarser rounding with a trailing zero, which may cue students; T6-012B B `0.33 hours` is a rounded 1/3; the T6 label "seconds and hours" now covers minutes and hours; B19's bare subtractions sit under "T4 Choosing the operation (worded problems)". | Expert to judge; labels need no engine change, because the unit table maps them | Harris |
| 10 | Six targets were chosen by Claude, not named by Harris (T2-020, T2-025, T3-006, T3-010, T5-004, T5-010; MANIFEST rows of 20 November). | Harris confirms them; the expert sees the provenance | Harris |
| 11 | `coverage.md` calls MATH-1965/2039 "separable". That is true structurally, but a holder of 2039 who answers the 2039-only items correctly is labelled 1965 (KF-07; 22, 16 and 4 of 100 intermittent holders at apply rates 0.5, 0.7 and 0.9). | Add the KF-07 limitation beside the pair | Harris |

None of these blocks merging the candidate as **candidate** content. Issues 1–3, 5, 10 and 11 are text fixes; issues 6–8 need team decisions; issue 9 goes to the expert.

## 6. What this review cannot establish

- **No external expert has reviewed any item.** There are no item-level expert decisions to compare the inventory with, so the comparison the work division asks for is outstanding, dated 24 November 2026. Gate G1 is **not met**.
- The items and their links were drafted by Claude in batches and approved by Harris (MANIFEST provenance). The link audit ratings are agent ratings. Neither is human expert evidence.
- I checked arithmetic, the link rules and engine behaviour. I did not judge pedagogical quality, reading level or cultural fit beyond the notes in issue 9.
- Link grades (T-1) are not in this version, so every link carries full weight.

## 7. Decision

**Accepted as candidate content** for the Iteration 2 evaluation, labelled "candidate, not externally reviewed" wherever results are reported. The arithmetic of every changed and new item is correct. The disputed links are fixed or honestly recorded. The batches match the bank, and the engine loads it with no inseparable pair. Merge once CI is green. Harris corrects issues 1–3 in the PR text and manifest, and the team decides issues 6–8. G1 remains open until the external Maths-expert acceptance (I2-H07) is recorded against this exact version.
