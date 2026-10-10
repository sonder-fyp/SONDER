# Link-soundness audit of all Maths batches (2026-10-09)

Six independent auditor agents rated every LINKED wrong option SOUND / STRETCH / FORCED. These are agent ratings, not the owner's decisions.
B11, B12, B14 were audited earlier (see mapping_audit_B11_B12_B14.txt). Per-batch reports: linkaudit_*.txt in this folder.

## FORCED links (5, all in approved batches)
| Batch | Item | Option | Misconception | Problem |
|---|---|---|---|---|
| B13 | T3-003 | A: 25 / 200 | 2359 | correct route is 200 / 4; '25 / 200' is not its reversal |
| B13 | T3-006 | A: 20 / 150 | 2359 | correct route is 150 / 5 |
| B13 | T3-009 | C: 0.25 | 2359 | 50 / 200 is not the reversal of the correct route (200 / 2) |
| B13 | T3-010 | C: 0.3125 | 2359 | 25 / 80 is not the reversal of the correct route (80 / 4) |
| B08 | T5-014 | C: 0.0625 | 2359 | top and bottom are stated explicitly; no reason to divide 4 by 64 |
Auditor fix for B13: use true reversals (4/200, 5/150, 2/200 = 0.01, 4/80 = 0.05), or keep 2359 only on the 10% items where 10/80 genuinely reverses 80/10.

## STRETCH links in approved batches (approximate counts)
- MATH-1248 'rounds too little' where the option is the ORIGINAL NUMBER unchanged = 'did not round' (B01/B02): 10 options.
- MATH-1715 read through a percentage step on every fraction->percentage item (B03-B05): ~15 options. No direct fraction->decimal evidence for 1715 exists in the bank.
- MATH-658 'doubles the numerator' on denominators 4, 5, 20, 25 (doubling is only right for /50) (B03-B05): ~15 options.
- MATH-2039 applied to bare fractions (3/4 -> 3%) (B03-B05): 8 options. 'x out of y' word items are sound.
- MATH-1416 on the five 'groups of ... then less than' items (B06): 5 options; plus 3 MATH-228 options equal a stem figure (T4-003 6, T4-006 4, T4-007 Rs 5).
- MATH-734 'halving' on cube roots (T5-003 C, T5-004 B, T5-010 D); 1514/1773 on T5-011 A; 2093 on T5-014 A: 5 options.
- MATH-161 / 767 through the two-step seconds chain (B10): 16 options; (B09 draft: 5 more for minutes/100).
- B13: T3-001 D 0.125, T3-005 C 1,250, T3-010 D 320: 3 options.
- Earlier audit: 1639 left-to-right partial readings (B11 x2, B12 x3), 1416 mixed-step (B14 x6): 11 options.
- B15, B16: all sound.

## Structural findings
1. **MATH-414 and MATH-734 are effectively an inseparable pair** (same wrong answer on every square-root item; separated only by the stretch cube-root links). Third inseparable pair after 1514/1773 and 1651/1074.
2. **B10: 6,000 and 600 seconds per hour also fit 'there are 100 or 10 seconds in a minute'**, a belief not in the catalogue. B10 has no item that separates the two.
3. **1651's catalogue name ('multiplies when converting to a larger unit') does not fit percentage questions**; the T3 use relies on the 'multiplies rather than divides' wording of 1074.
4. Absurd 'multiplied' values (25,920,000 hours, 64,800,000 hours) give the engine no evidence because nobody would choose them.
5. Stem-number coincidences (distractor equals a number in the question): T4-003, T4-006, T4-007, T5-009 C (16), T5-016 B, T5-005 B.
6. Wording: T4 'less seats' / 'less students'; T5-003 'multiplied by itself three times' can be read as four factors.

## Nothing has been changed
The bank (bank/items.csv, 117 items) is untouched. Fixing any of the above in approved items needs the owner's decision.
