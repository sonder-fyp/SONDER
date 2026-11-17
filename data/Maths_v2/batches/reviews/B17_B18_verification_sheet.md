# B17 / B18 / B14-rework: verification sheet for Harris (DRAFTS, nothing is in the bank)

Prepared 2026-11-16. Drafts only: `bank/items.csv`, the unit table and all approved batches are **unchanged**. The drafts were written by Claude (LLM), the same generation route as B01-B16 (GenAI level L2). **They are not reviewed and not approved**; your review is the approval step, as for every earlier batch.

Files (all in `data/Maths_v2/batches/`):

| File | What it is | Items |
|---|---|---|
| `B17_T6_cross_B_seconds_hours_long.csv` | Operation versions (B) of approved B10 stems T6-012, T6-013, T6-018 (spec task T-2) | 3 |
| `B18_T5_fraction_bar_pairs_long.csv` | 3 new twin pairs (A in U5, B in U4): fraction with a power on top and a square root below | 6 |
| `B14_proposed_rework_long.csv` | Proposed replacement for the three approved items that break rule P1 (T6-011B, T6-014B, T6-016B): one link removed on each | 3 (rework) |

## Why these items (gap each closes, from the spec and the loader)

| Open fault | What this proposal does | Effect measured on a scratch copy |
|---|---|---|
| D-6/KF-04: MATH-2359 has only 2 trigger groups in U6 | T6-012B, T6-013B add two more | W3 for 2359 disappears (2 to 4 groups) |
| D-6/KF-04: MATH-2093 has only 1 trigger group in U4 | T5-020, 021, 022 add three more | W3 for 2093 disappears (1 to 4 groups) |
| D-5/KF-01/KF-02: three U6 items break rule P1 (MATH-1416 on 3 options) and MATH-1416 is dropped from U6 | B14 rework keeps 1416 on 2 options each; T6-018B adds a fourth 1416 trigger | P1 conflicts 3 to 0; the 3 SKIPPED_ITEM and the DROPPED_HYPOTHESIS go away once the unit table stops skipping them |
| Twin rule (2026-10-05) | Every new item has its twin written with the **identical stem** | the loader groups twins by stem |

**Not addressed, on purpose:** MATH-1514/1773 (1 trigger group each in U7). They are inseparable (KF-06), so more items that trigger them add the same evidence twice; the fix is the catalogue merge (spec D-1), not more items. Also not touched: the ~90 stretch links / `link_grade` (T-1), T1 unlinked options (M3), T5-003 wording (M5).

## Scratch-copy test (the project's own loader and validator, run 2026-11-16)

I copied `data/Maths_v2` to a scratch folder, applied the B14 link changes, appended B17 and B18 as approved, removed U6 `skip_items` and `drop_hypotheses` from a copy of the unit table, then ran the tools against that copy.

- `python -m validation.math_dataset`: **0 structural errors, 0 P1 conflicts**, 6 warnings (the existing topic-label ones). Baseline is 0 / 3 / 6.
- `python -m sonder_pack.maths_v2`: 7 units. U4 has 19 items, U5 13, U6 20 items in 12 groups with k = 6 (MATH-1416 is back). 44 warnings versus 40 before. **Removed:** 3 SKIPPED_ITEM, 1 DROPPED_HYPOTHESIS, 2 W3 (2093 in U4, 2359 in U6). **Added:** 5 W4 (each new B item has 2 unlinked options, which is within the rule that B versions may carry 2), 3 TWIN_CROSS_UNIT (T5-017..019 in U5, their twins T5-020..022 in U4, same pattern as T5-005..010), and one W2 (1416 vs NONE, 4 groups, in U6). 2093/NONE and 2359/NONE remain W2 but now at 4 groups each (were 1 and 2).
- **Not run:** the engine test suite and any simulated sessions on the changed pack. Existing tests assert the faulty behaviour on purpose (for example 3 skipped items), so they **will** fail on a changed unit table until Ahmed updates them.

## What you need to verify

1. **Arithmetic and one correct answer.** Every option value in the tables below was computed by script from the reading it claims to model and asserted equal to the displayed text. Still check by hand that exactly one option is correct and no wrong option is accidentally right.
2. **Link judgement (the real review).** Would a student holding that misconception plausibly pick that option? My own rating, which you should overrule if you disagree:
   - **Sound, same pattern already approved:** MATH-2359 on `3,600 / seconds` (T6-012B B, T6-013B A; same as approved T6-010B and T6-015B). MATH-2093 on `top - bottom` of an explicit fraction (same as T5-014 A). MATH-1072 (`base x index`) and MATH-952 (`base + index`) on the power. MATH-414|MATH-734 sharing one option on the square root (both beliefs really give it).
   - **Weaker, your call:** T6-018B option B (150 seconds, MATH-1416) reads 60 x 60 as 60 + 60 = 120 seconds per hour, then adds 30. It is faithful to "adds instead of multiplies" but is a narrow reading. In the B14 rework, the links I kept (180 = 120 + 60 and 3,720 = (2 + 60) x 60, and the 1.5 h and 3 h equivalents) are the clearest 1416 readings I could find; the three options I **unlinked** (122, 121.5, 123 = hours + 120) were the weakest. Those three are text-identical to the approved options; only the link cell changes.
   - **Rounded value:** T6-012B option B is 0.33 hours (3,600 / 10,800 = 0.333..). A student who gets 1/3 would not see it. The stem cannot change because it is shared with the approved A item; decide if 0.33 is acceptable.
3. **Unlinked options (2 per B item, as allowed).** They are slips, not catalogued misconceptions: dividing by 60 once and stopping (180, 300 hours), dividing by 100 (108, 180), dropping the 30 seconds (3,600), reading the bar as add or multiply (T5-020..022). Tell me if you want any of them linked.
4. **Known limits of the drafts.** T6-013B inherits the weak stem "Which statement is correct?" from approved T6-013 (the twin rule needs identical stems). T5-017..019 use the shared 414|734 option, so they add no separation between those two (still W2, 3 separating groups; I deliberately did not add more stretch cube-root links). 2093 gets one option per item, so these items add trigger groups, not stronger evidence per item. The same LLM wrote options and links, so none of this is independent evidence; an independent human review (T-3) of the whole bank is still missing.

## Your decision record (fill in)

| Item | Approve / change / reject | Note |
|---|---|---|
| T6-012B | | |
| T6-013B | | |
| T6-018B | | |
| T5-017 / T5-020 | | |
| T5-018 / T5-021 | | |
| T5-019 / T5-022 | | |
| T6-011B rework | | |
| T6-014B rework | | |
| T6-016B rework | | |

## If you approve (what it takes; none of this has been done)

1. Append approved rows to `bank/items.csv` with `status = approved` and batch `B17` or `B18`. For the three reworks, edit only the `misconceptions` cell of one option per item in `bank/items.csv` **and** in `B14_T6_cross_operation_versions_long.csv`; keep a copy of the old bank in `batches/superseded/` as you did for the forced-link fix.
2. Unit table (`sonder_pack/maths_v2_units.json`, a team decision with Ahmed): remove the U6 `skip_items` (D-2) and `drop_hypotheses` (MATH-1416). The loader then rebuilds U6 with k = 6. The new T5 items use existing topic labels, so no label change is needed.
3. Ahmed updates the tests and docs that assert 117 items, 40 warnings, 3 skipped items and the dropped hypothesis. Update `MANIFEST.md` counts (126 items, batches B17 and B18, approval dates) and `coverage.md`.
4. Re-run the commands in section 9 of `HarrisDOcs/DATASET_GUIDE_Maths_v2_and_Known_Faults.md` on the changed pack. U4 gains 3 items, so recheck worked example D2 and the U4 selector numbers.

## Every option, with its derivation

Letters, texts and links are exactly what is in the CSVs.

### T6-012B (target MATH-2359, batch B17)
Stem: A marathon runner finishes in 10,800 seconds. How many hours is that?

| Opt | Text | Correct | Links | Derivation (computed by script) |
|---|---|---|---|---|
| A | 180 hours |  | unlinked | divided by 60 once (minutes) and stopped; unlinked slip |
| B | 0.33 hours |  | MATH-2359 | 3,600 / 10,800 = 0.333.. (division reversed), shown to 2 d.p. |
| C | 3 hours | YES | unlinked | 10,800 / 3,600 |
| D | 108 hours |  | unlinked | divided by 100; unlinked slip |

### T6-013B (target MATH-2359, batch B17)
Stem: Which statement is correct?

| Opt | Text | Correct | Links | Derivation (computed by script) |
|---|---|---|---|---|
| A | 18,000 seconds = 0.2 hours |  | MATH-2359 | 3,600 / 18,000 = 0.2 (division reversed) |
| B | 18,000 seconds = 300 hours |  | unlinked | divided by 60 once and stopped; unlinked slip |
| C | 18,000 seconds = 180 hours |  | unlinked | divided by 100; unlinked slip |
| D | 18,000 seconds = 5 hours | YES | unlinked | 18,000 / 3,600 |

### T6-018B (target MATH-1416, batch B17)
Stem: Which of these is the same as 1 hour and 30 seconds?

| Opt | Text | Correct | Links | Derivation (computed by script) |
|---|---|---|---|---|
| A | 3,630 seconds | YES | unlinked | 1 h = 60 x 60 = 3,600 s, plus 30 |
| B | 150 seconds |  | MATH-1416 | 60 x 60 read as 60 + 60 = 120 s per hour (adds instead of multiplies), plus 30 |
| C | 3,600 seconds |  | unlinked | converts the hour, forgets the 30 s; unlinked slip |
| D | 90 seconds |  | unlinked | 60 + 30, treating the hour as 60 seconds; unlinked slip |

### T5-017 (target MATH-1072, batch B18)
Stem: A fraction has 10² on the top and √25 on the bottom. What is the value of the fraction?

| Opt | Text | Correct | Links | Derivation (computed by script) |
|---|---|---|---|---|
| A | 8 |  | MATH-414, MATH-734 | sqrt(25) read as 25 / 2 = 12.5 (divides by order of root / halves); 100 / 12.5 |
| B | 20 | YES | unlinked | 100 / 5 |
| C | 4 |  | MATH-1072 | 10^2 read as 10 x 2 = 20; 20 / 5 |
| D | 2.4 |  | MATH-952 | 10^2 read as 10 + 2 = 12; 12 / 5 |

### T5-020 (target MATH-2093, batch B18)
Stem: A fraction has 10² on the top and √25 on the bottom. What is the value of the fraction?

| Opt | Text | Correct | Links | Derivation (computed by script) |
|---|---|---|---|---|
| A | 500 |  | unlinked | bar read as multiply: 100 x 5; unlinked slip |
| B | 95 |  | MATH-2093 | fraction bar read as subtract: 100 - 5 |
| C | 20 | YES | unlinked | 100 / 5 |
| D | 105 |  | unlinked | bar read as add: 100 + 5; unlinked slip |

### T5-018 (target MATH-952, batch B18)
Stem: A fraction has 6³ on the top and √16 on the bottom. What is the value of the fraction?

| Opt | Text | Correct | Links | Derivation (computed by script) |
|---|---|---|---|---|
| A | 27 |  | MATH-414, MATH-734 | sqrt(16) read as 16 / 2 = 8 (divides by order of root / halves); 216 / 8 |
| B | 4.5 |  | MATH-1072 | 6^3 read as 6 x 3 = 18; 18 / 4 |
| C | 2.25 |  | MATH-952 | 6^3 read as 6 + 3 = 9; 9 / 4 |
| D | 54 | YES | unlinked | 216 / 4 |

### T5-021 (target MATH-2093, batch B18)
Stem: A fraction has 6³ on the top and √16 on the bottom. What is the value of the fraction?

| Opt | Text | Correct | Links | Derivation (computed by script) |
|---|---|---|---|---|
| A | 54 | YES | unlinked | 216 / 4 |
| B | 864 |  | unlinked | bar read as multiply: 216 x 4; unlinked slip |
| C | 212 |  | MATH-2093 | fraction bar read as subtract: 216 - 4 |
| D | 220 |  | unlinked | bar read as add: 216 + 4; unlinked slip |

### T5-019 (target MATH-414, batch B18)
Stem: A fraction has 8³ on the top and √16 on the bottom. What is the value of the fraction?

| Opt | Text | Correct | Links | Derivation (computed by script) |
|---|---|---|---|---|
| A | 128 | YES | unlinked | 512 / 4 |
| B | 6 |  | MATH-1072 | 8^3 read as 8 x 3 = 24; 24 / 4 |
| C | 64 |  | MATH-414, MATH-734 | sqrt(16) read as 16 / 2 = 8 (divides by order of root / halves); 512 / 8 |
| D | 2.75 |  | MATH-952 | 8^3 read as 8 + 3 = 11; 11 / 4 |

### T5-022 (target MATH-2093, batch B18)
Stem: A fraction has 8³ on the top and √16 on the bottom. What is the value of the fraction?

| Opt | Text | Correct | Links | Derivation (computed by script) |
|---|---|---|---|---|
| A | 2,048 |  | unlinked | bar read as multiply: 512 x 4; unlinked slip |
| B | 128 | YES | unlinked | 512 / 4 |
| C | 508 |  | MATH-2093 | fraction bar read as subtract: 512 - 4 |
| D | 516 |  | unlinked | bar read as add: 512 + 4; unlinked slip |

### T6-011B (target MATH-1416, batch B14r)
Stem: How many seconds are there in 2 hours?

| Opt | Text | Correct | Links | Derivation (computed by script) |
|---|---|---|---|---|
| A | 122 seconds |  | unlinked | approved text kept: 2 + 120. Link to MATH-1416 REMOVED here (weakest reading: it mixes hours with seconds), so MATH-1416 sits on 2 options, not 3 (rule P1) |
| B | 7,200 seconds | YES | unlinked | 2 x 60 x 60 |
| C | 180 seconds |  | MATH-1416 | hours to minutes correct (120); second step adds 60 instead of multiplying by 60 |
| D | 3,720 seconds |  | MATH-1416 | first step adds 60 instead of multiplying (2 + 60 = 62 min), second step correct |

### T6-014B (target MATH-1416, batch B14r)
Stem: Fill the gap: 1.5 hours = ___ seconds.

| Opt | Text | Correct | Links | Derivation (computed by script) |
|---|---|---|---|---|
| A | 5,400 seconds | YES | unlinked | 1.5 x 60 x 60 |
| B | 121.5 seconds |  | unlinked | approved text kept: 1.5 + 120. Link to MATH-1416 REMOVED here (weakest reading: it mixes hours with seconds), so MATH-1416 sits on 2 options, not 3 (rule P1) |
| C | 150 seconds |  | MATH-1416 | hours to minutes correct (90); second step adds 60 instead of multiplying by 60 |
| D | 3,690 seconds |  | MATH-1416 | first step adds 60 instead of multiplying (1.5 + 60 = 61.5 min), second step correct |

### T6-016B (target MATH-1416, batch B14r)
Stem: A film lasts 3 hours. How long is that in seconds?

| Opt | Text | Correct | Links | Derivation (computed by script) |
|---|---|---|---|---|
| A | 123 seconds |  | unlinked | approved text kept: 3 + 120. Link to MATH-1416 REMOVED here (weakest reading: it mixes hours with seconds), so MATH-1416 sits on 2 options, not 3 (rule P1) |
| B | 240 seconds |  | MATH-1416 | hours to minutes correct (180); second step adds 60 instead of multiplying by 60 |
| C | 10,800 seconds | YES | unlinked | 3 x 60 x 60 |
| D | 3,780 seconds |  | MATH-1416 | first step adds 60 instead of multiplying (3 + 60 = 63 min), second step correct |

---
**Note, 18 November 2026:** T6-012B and T6-013B were approved and applied; T6-018B was approved and applied, then removed the same day (it made dev's pack loader refuse the bank because dev's unit table drops MATH-1416 in U6). B18 was applied in calculation-recognition form, not the numeric form in this sheet. See `MANIFEST.md`.
