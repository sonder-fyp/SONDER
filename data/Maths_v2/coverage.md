# Maths_v2 coverage (current, 20 November 2026)

Computed from `bank/items.csv` (133 items, 532 option rows) and `topics.csv` (27 misconceptions). Status of the version: **candidate** (owner-approved only; no external expert review). The older dated log is kept unchanged under 'History' at the end of this file.

## How to read the counts
- **Targeting questions:** items whose `target` is this misconception (a label for the author; the engine ignores it).
- **Questions linking it:** items with at least one option linked to it.
- **Independent groups:** the same, with twins (identical stems) counted once. The loader asks at most one item of a twin group per session and warns below 3 trigger groups.
- **Option links:** options linked to it. Counted by link, not by target.

| Misconception | Home topic | Targeting questions | Questions linking it | Independent groups | Option links |
|---|---|---|---|---|---|
| Rounds to the wrong degree of accuracy (rounds too little) (MATH-1248) | T1 Rounding | 5 | 20 | 20 | 20 |
| Rounds down instead of up (MATH-1379) | T1 Rounding | 5 | 11 | 11 | 11 |
| Rounds up instead of down (MATH-1988) | T1 Rounding | 5 | 9 | 9 | 9 |
| Rounds to the wrong degree of accuracy (rounds too much) (MATH-2392) | T1 Rounding | 5 | 20 | 20 | 20 |
| Multiplies by 10 instead of 100 when converting decimal to percentage (MATH-61) | T2 Fractions, decimals and percentage conversion | 5 | 10 | 10 | 10 |
| Thinks they double the numerator to turn a fraction into a percentage (MATH-658) | T2 Fractions, decimals and percentage conversion | 6 | 15 | 15 | 15 |
| Converts a fraction to a decimal by using only the numerator after the decimal point (MATH-1715) | T2 Fractions, decimals and percentage conversion | 3 | 15 | 15 | 15 |
| Thinks you need to just add a % sign to a decimal to convert to a percentage (MATH-1965) | T2 Fractions, decimals and percentage conversion | 5 | 10 | 10 | 10 |
| Thinks you need to just add a % sign to a number to make it a percentage (MATH-2039) | T2 Fractions, decimals and percentage conversion | 6 | 25 | 25 | 25 |
| Does not understand a percentage can be applied to something not out of 100 (MATH-2138) | T3 Percentage of an amount | 4 | 8 | 8 | 8 |
| Added the values together instead of finding the percentage (MATH-2206) | T3 Percentage of an amount | 4 | 10 | 10 | 10 |
| Multiplies rather than adds when given the command word 'more' (MATH-126) | T4 Choosing the operation (worded problems) | 7 | 7 | 7 | 7 |
| Divides rather than subtracts when given the command 'less than' (MATH-228) | T4 Choosing the operation (worded problems) | 3 | 13 | 13 | 13 |
| Adds instead of multiplies (MATH-1416) | T4 Choosing the operation (worded problems) | 9 | 9 | 9 | 9 |
| Adds instead of subtracts (MATH-1514) | T4 Choosing the operation (worded problems) | 5 | 21 | 21 | 21 |
| Adds rather than subtracts when answering worded problems (MATH-1773) | T4 Choosing the operation (worded problems) | 2 | 17 | 17 | 17 |
| Divides by the order of the root (MATH-414) | T5 Powers and roots | 4 | 11 | 11 | 11 |
| Adds the index to the number (MATH-952) | T5 Powers and roots | 4 | 10 | 10 | 10 |
| Multiplies by the index (MATH-1072) | T5 Powers and roots | 5 | 11 | 11 | 11 |
| Answers as if there are 100 minutes in an hour when changing from hours to minutes (MATH-161) | T6 Time and unit conversion | 5 | 12 | 12 | 12 |
| Thinks there are 10 minutes in an hour (MATH-767) | T6 Time and unit conversion | 4 | 12 | 12 | 12 |
| Multiplies rather than divides (MATH-1074) | T6 Time and unit conversion | 4 | 11 | 11 | 11 |
| Multiplies when converting to a larger unit (MATH-1651) | T6 Time and unit conversion | 2 | 6 | 6 | 6 |
| Believes adding two negatives gives a positive answer (MATH-1639) | T7 Negatives, inverse operations, fraction bar | 5 | 5 | 5 | 10 |
| Thinks the fraction bar means subtract rather than divide (MATH-2093) | T7 Negatives, inverse operations, fraction bar | 10 | 10 | 10 | 10 |
| When solving a problem that requires an inverse operation (e.g. missing number problems), does the original operation (MATH-2271) | T7 Negatives, inverse operations, fraction bar | 5 | 5 | 5 | 5 |
| Believes division is commutative (MATH-2359) | T7 Negatives, inverse operations, fraction bar | 6 | 17 | 17 | 17 |

The earlier goal was 5 targeting questions per misconception. Below 5 now: Converts a fraction to a decimal by using only the numerator after the decimal point (MATH-1715) 3, Does not understand a percentage can be applied to something not out of 100 (MATH-2138) 4, Added the values together instead of finding the percentage (MATH-2206) 4, Divides rather than subtracts when given the command 'less than' (MATH-228) 3, Adds rather than subtracts when answering worded problems (MATH-1773) 2, Divides by the order of the root (MATH-414) 4, Adds the index to the number (MATH-952) 4, Thinks there are 10 minutes in an hour (MATH-767) 4, Multiplies rather than divides (MATH-1074) 4, Multiplies when converting to a larger unit (MATH-1651) 2. Across the whole bank every misconception is linked in at least 5 independent groups. **The engine does not count across the bank, it counts within a unit**, so see the per-unit table below for what one session can use.

## Per-unit trigger groups (what a session can use)
Independent groups (twins counted once) on which the misconception links at least one option, **within the unit** where it is a hypothesis. Computed on 24 November 2026 (after the T2 stem change, see the MANIFEST approval log) from `bank/items.csv` with `sonder_engine.pack.trigger_groups` and the current unit table (`sonder_pack/maths_v2_units.json`). The loader's minimum is 3. Counts of 3 or 4 are in bold.

| Unit | Items | Trigger groups per misconception |
|---|---|---|
| U1 Rounding | 20 | 1248: 20, 1379: 11, 1988: 9, 2392: 20 |
| U2 Conversion | 25 | 61: 10, 658: 15, 1715: 11, 1965: 10, 2039: 25 |
| U3 Percentage of an amount | 10 | 2138: 7, 2206: 9, 2359: 6, **1074: 3** |
| U4 Choosing the operation | 21 | 126: 6, 228: 12, 1416: 6, 1514: 15, 1773: 13, **2093: 4** |
| U5 Powers and roots | 13 | 414: 11, 952: 10, 1072: 11 |
| U6 Time and unit conversion | 18 | 1074: 7, 161: 12, 767: 12, 1651: 5, **2359: 4** (MATH-1416 is not a hypothesis in U6: the unit table drops it) |
| U7 Negatives, inverse operations, fraction bar | 20 | 2359: 7, 1639: 5, 2093: 6, 2271: 5, 1514: 5, **1715: 4**, **1773: 3** |

Five unit hypotheses have only 3 or 4 trigger groups: U3 MATH-1074 (3), U4 MATH-2093 (4), U6 MATH-2359 (4), U7 MATH-1715 (4) and U7 MATH-1773 (3). They pass the loader's minimum of 3 but have the least evidence for a session. When describing coverage, quote these per-unit counts rather than the bank-wide ones.

## Misconception pairs
- **MATH-1514 / MATH-1773** and **MATH-1651 / MATH-1074** always gave the same wrong answer. They are separated by two separating questions in each unit where both appear (B19 T4-011, T4-012 in U4; B21 T7-017 to T7-020 in U7; B20 T6-022, T6-023 in U6); MATH-1651 was unlinked on the five T3 percentage options and is no longer used in U3. The loader still reports them as weakly separable (it warns at four or fewer separating questions).
- **MATH-1965** is only linked together with MATH-2039 (10 options) while MATH-2039 has 15 options of its own, so the pair is separable **structurally**. It is not reliably separable in practice (known fault KF-07, `sonder_engine/KNOWN_FAULTS.md`): the two are told apart only through correct answers on the 2039-only items, so a MATH-2039 holder who answers those items correctly is labelled MATH-1965. In the seeded adverse baseline on this content, 22, 16 and 4 of 100 intermittent 2039 holders were labelled MATH-1965 at apply rates 0.5, 0.7 and 0.9. Fix (redefine or merge, spec D-1) is open and needs team approval.
- **MATH-734** was removed on 20 November 2026 (it could not be separated from MATH-414); `topics.csv` has 27 misconceptions.

## Known limitations (do not present as solved)
- T4-001 to T4-005: the MATH-1416 option is a wrong first step followed by a correct second step (two-step design).
- T2-020, T2-023, T2-024, T2-025 and the T2 conversion items keep the MATH-658 (doubling) and MATH-2039 (% sign) links as approved; T2-015 to T2-018 still have the mixed decimal/percentage format questioned.
- Link grades (S/T) are not in this version (next iteration). 13 flagged options remain unresolved by decision: the eight T2 MATH-658/2039 links and the five T4 options.
- MATH-1965 / MATH-2039: a 2039 holder who answers the 2039-only items correctly can still be mislabelled 1965 (KF-07, see Misconception pairs above).
- Five unit hypotheses have only 3 or 4 trigger groups (see the per-unit table).
- No external expert review has been done.

## Batches in the bank
B01 10, B02 10, B03 10, B04 10, B05 5, B06 10, B07 10, B08 6, B10 9, B11 9, B12 7, B13 10, B14 5, B15 3, B16 3, B17 2, B18 6, B19 2, B20 2, B21 4 items (20 batches, 133 items). B09 is a draft kept for the record and is not in the bank.

---

# History (kept for the record, not current)

## Original log, from 5 October 2026 (statements below were true on their dates and are not updated)

## T1 Rounding: COMPLETE (B01 + B02 approved, 20 items in bank)
1248, 1379, 1988, 2392: 5 each.

## T2 Fractions, decimals and percentage conversion
| Misconception | Approved | In review | Target |
|---|---|---|---|
| MATH-61   | 4 (B03+B04) | 1 (B05) | 5 |
| MATH-658  | 4 (B03+B04) | 1 (B05) | 5 |
| MATH-1715 | 4 (B03+B04) | 1 (B05) | 5 |
| MATH-1965 | 4 (B03+B04) | 1 (B05) | 5 |
| MATH-2039 | 4 (B03+B04) | 1 (B05) | 5 |

MATH-1074 moved to T6 (read as unit conversion: multiplies instead of divides). T2 is now 5 misconceptions / 25 questions.

NOTE: B03/B04 rebuilt with zero unlinked options (old versions in batches/superseded/). B03 removed from bank pending re-approval.

B03+B04 approved into bank (40 items total). B05 (5 items) in review; approving it completes T2 (25 items).

MATH-2359 moved to T7 (division a/b vs b/a). T3 now = 2138, 2206 only; T7 = 1639, 2093, 2271, 2359.

## T4 Choosing the operation: COMPLETE (B06 approved, 10 items; bank = 55)
Two-step word problems; each wrong option is a different step error.
| Misconception | Appears as linked option in | Target |
|---|---|---|
| MATH-126  | 5 items (T4-006..010) | 5 |
| MATH-1416 | 5 items (T4-001..005) | 5 |
| MATH-228  | 10 items | 5 |
| MATH-1514 | 10 items (identical answer to 1773) | 5 |
| MATH-1773 | 10 items (identical answer to 1514) | 5 |
OPEN ISSUE: 1514 and 1773 give the same wrong answer on every possible question, so no question can separate them.

## T5 Powers and roots: COMPLETE (B07 + B08 approved, bank = 71 items; earlier versions in batches/superseded/)
RULE (user, 2026-10-05): any question that crosses concepts is written twice with the same stem. Version A options test the topic misconceptions
(operation done correctly). Version B options test the combining operation's misconceptions (topic steps done correctly).
- B07 (10 items): 4 single-idea items + 6 version-A items. Unlinked options: 4.
- B08 (6 items): the version-B twins of T5-005..010 (T5-011..016). Unlinked options: 9. APPROVED by user: operation-version (B) items may carry up to 2 unlinked options each.
B08 adds coverage to other topics: 1514/1773 (T5-011, 013, 016), 1416 (012), 228 (013, 016), 2359 and 2093 (014), 126 (015).
Misconceptions in B07: 952 in 6 items, 1072 in 8, 414 and 734 in 8 each.

## Drafted while the owner was away (2026-10-06). NOTHING below is in the bank; all awaiting explicit owner approval.
Each batch was reviewed by an independent reviewer agent acting as the owner (3 rounds, reports in batches/reviews/). Reviewer verdicts are NOT the owner's approval.
| Batch | Topic | Items | Unlinked | Final reviewer verdict (round 3) |
|---|---|---|---|---|
| B09 | T6 Time and unit conversion | 9 | 4 | approve with changes (fixes applied) |
| B11 | T7 Negatives / inverse / fraction bar | 9 | 4 | approve with changes (fixes applied) |
| B12 | T7 (second batch) | 6 | 3 | approve with changes (fixes applied) |
| B13 | T3 Percentage of an amount | 10 | 3 | approve with changes (fixes applied) |
(There is no B10: T6 needed only one batch.)
Misconception coverage if all four are approved: 161, 767, 1651, 1074 (T6); 1639 x5, 2271 x5, 2093 x5, 2359 (T7); 2138 x7, 2206 x10, 2359 x6, 1651/1074 x5 (T3). Every Tier-1 Maths misconception then has >= 5 items.
OPEN ISSUES FOR THE OWNER: see the final message of this session (1651/1074 and 1514/1773 are inseparable pairs; B06 not split into A/B pairs; MATH-161 applied in both directions; the 1639 stepwise-reading trade-off; 'a over b' wording; reading of 'multiplies rather than divides' in T3).

## B10 T6 seconds <-> hours (9 items, 4 unlinked, DRAFT, not in bank)
Added at the owner's request (2026-10-06) to extend T6 beyond minutes<->hours. Single-concept items only; crossing questions (seconds<->hours overlapping multiplication/division misconceptions, written as A/B pairs) are deferred until B09 + B10 are approved.
Note: the 6,000 / 600 options (161 / 767 through the minutes-then-seconds chain) could also arise from believing there are 100 or 10 seconds in a minute; the two readings cannot be told apart.

B10 APPROVED by owner 2026-10-06 and added to the bank. B09, B11, B12, B13 remain DRAFTS (no explicit approval yet).

## Cross batches (T6 time conversion x multiplication/division/percentage), DRAFT, not in bank
B14: operation versions (B) of the approved B10 stems T6-010/011/014/015/016 (5 items, 4 unlinked): 1416 (stepwise 'adds instead of multiplies') and 2359 ('3,600 / seconds').
B15: new stems, time-misconception versions (A): 10% of 2 hours; 'less than'; 'more than' (3 items, 3 unlinked).
B16: their operation/percentage twins (B): 2206/2138/1651|1074; 228/1514|1773; 126 (3 items, 3 unlinked).
Reviewer (simulated owner) verdicts: approve with changes, fixes applied. Awaiting owner approval. NOT yet crossed: B09 minutes<->hours items, T4 (B06) pairing, and the earlier topics other than time.

## B11/B12 revision 4 (owner asked for more multi-misconception options)
B11: 8 items, 9 shared options (was 1), unlinked 4. B12: 8 items (T7-016 multiply item and T7-017 plain fraction item moved/added), unlinked 4.
Coverage if approved: 1639 x6, 2271 x5, 2093 x5; 2359 and 1514/1773, 1715, 1416 appear throughout. Still drafts.

## Mapping-soundness pass (owner request 2026-10-06: 'is the mapping actually sensible or forced?')
B11/B12 rebuilt (revision 5) so every link is one a student holding that misconception would plausibly make. Sound links remain; unlinked options rose to 8 per T7 batch (cap 4 breached; owner to decide). Remaining weak links are marked [STRETCH LINK] in the sheets: 1639 left-to-right partial readings (B11 x2, B12 x3) and B14's six mixed-step 1416 readings. Old versions in batches/superseded/pre_soundness/.
Coverage if approved: 1639 x5, 2271 x5 (+1514/1773 shared once), 2093 x6, 2359 x8+. Collisions that remain are the sound ones only.
Not yet audited for forced links: B03-B08, B09, B10, B13, B15, B16.

B11 APPROVED by owner 2026-10-09 and added to the bank (9 items, the sound-mapping revision 5; 2 options carry [STRETCH LINK]). B12 (T7 second batch) remains a draft.

B12 APPROVED by owner 2026-10-09 and added to the bank (7 items). T7 is now fully in the bank (B11 + B12 = 16 items).

B13 APPROVED by owner 2026-10-09 and added to the bank (10 items, T3). Every Maths misconception now has >= 5 items in the bank. Drafts remaining: B09, B14, B15, B16.

B14 APPROVED by owner 2026-10-09 and added to the bank (5 items: operation versions of the B10 stems). 6 options carry [STRETCH LINK] (mixed-step 1416 readings). Drafts remaining: B09, B15, B16.

B15 + B16 APPROVED by owner 2026-10-09 and added to the bank (3 + 3 items: the time/percentage/'more'/'less than' pairs, A and B twins in the bank together). Only B09 (T6 minutes <-> hours, 9 items) remains a draft in Maths.

## Link audit of all Maths batches (2026-10-09)
See batches/reviews/LINK_AUDIT_SUMMARY.md. 5 FORCED links in approved items (B13 x4 MATH-2359, B08 T5-014 C), ~90 STRETCH. Bank untouched; owner decision pending.

## Forced-link fixes applied to the approved bank (owner chose 'fix only the 5 forced', 2026-10-10)
B13 MATH-2359 options made true reversals: T3-003 A '4 / 200', T3-006 A '5 / 150', T3-009 C 0.01, T3-010 C 0.05. B08 T5-014 C 0.0625 unlinked (target now MATH-2093). Items remain approved; the ~90 stretch links are untouched. Backup of the pre-fix bank: batches/superseded/items_bank_before_forced_fix.csv.

## B17, B18 and B14 rework proposed (2026-11-16), DRAFTS, NOT in bank, awaiting owner review
B17 (3 items): operation versions of B10 stems T6-012/013/018 (MATH-2359 x2, MATH-1416 x1). B18 (6 items): three twin pairs, fraction with a power over a square root (A in U5, B in U4; adds 3 trigger groups for MATH-2093 in U4). B14_proposed_rework_long.csv: removes one MATH-1416 link on each of T6-011B, T6-014B, T6-016B so none breaks rule P1. Scratch-copy test: validator 0 errors / 0 P1 conflicts; see batches/reviews/B17_B18_verification_sheet.md. Bank, unit table and approved batches untouched.

### 2026-11-18 decision on the 16 Nov drafts above
APPROVED by the owner and applied: B17 (3 items), B18 (6 items, now in calculation-recognition form instead of the numeric draft) and the B14 link removals on T6-011B, T6-014B, T6-016B. Bank 126 items. B14_proposed_rework_long.csv was moved to batches/superseded/. See MANIFEST.md approval log and HarrisDOcs/dataset_revisions/DRAFTS_B14r_B17_B18_application.json.

### 2026-11-18 later the same day: T6-018B removed
T6-018B (B17) was removed by the owner because it is the only item that makes dev's pack loader refuse the bank (MATH-1416 in U6, which dev's unit table drops). The bank is now 125 items; B17 has 2 items. The MATH-1416 trigger-group gap in U6 that B14-rework/B17 were meant to close is therefore still open until the unit table is changed. See MANIFEST.md.
