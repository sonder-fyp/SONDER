# T1 Rounding: independent item and demo-pack review

**Reviewer:** Ashher

**Bank revision:** `db447da4807f4367da8535bcc4297fa0bf6f104e` (latest commit touching `bank/items.csv` at this review)

**Candidate content:** all 20 T1 items in `data/Maths_v2/bank/items.csv`

**Decision:** candidate only; not a frozen or owner-approved live pack.

This review checks the arithmetic and the stated misconception interpretation of **every** T1 option. The CSV's `approved` status describes Harris's bank state; it does not record Ashher's acceptance of each mapping or permission to use it in a live demonstration. The earlier B01/B02 link audit is supporting evidence, not this review's substitute.

## Reading the table

The correct column gives the independently computed answer and its option letter. Wrong-option notes show what calculation or reading could produce that answer. Short IDs are the suffixes of `MATH-1248` (rounds too little), `MATH-1379` (rounds down instead of up), `MATH-1988` (rounds up instead of down), and `MATH-2392` (rounds too much). `?` means the current link or missing link needs Harris's content decision. An unchanged input is **no rounding**, which is only an indirect reading of 1248. `U` means the bank deliberately has no misconception link for that option; it should not silently acquire one.

| Item / target | Independent answer | Every wrong option and current link | Review result |
| --- | --- | --- | --- |
| T1-001 / 1379 | 3,908 to nearest 10 = **3,910 B** | A 3,900: down, or nearest 100 (1379 + 2392); C 3,908: unchanged (1248?); D 4,000: nearest 1,000 (U; 2392?). | Correct answer sound; C and D need decision. |
| T1-002 / 2392 | 4,192 to nearest 10 = **4,190 D** | A 4,192: unchanged (1248?); B 4,200: up, or nearest 100 (1988 + 2392); C 4,000: nearest 1,000 (U; 2392?). | Correct answer sound; A and C need decision. No true finer-place 1248 option. |
| T1-003 / 1988 | 5,942 to nearest 100 = **5,900 A** | B 5,940: nearest 10 (1248); C 6,000: up, or nearest 1,000 (1988 + 2392); D 10,000: nearest 10,000 (U; 2392?). | Correct answer sound; D needs decision. |
| T1-004 / 1379 | 7,068 to nearest 100 = **7,100 C** | A 7,000: down, or nearest 1,000 (1379 + 2392); B 7,070: nearest 10 (1248); D 10,000: nearest 10,000 (U; 2392?). | Correct answer sound; D needs decision. |
| T1-005 / 2392 | 48,630 to nearest 1,000 = **49,000 D** | A 48,000: down (1379); B 48,600: nearest 100 (1248); C 50,000: nearest 10,000 (2392). | Arithmetic and links plausible. |
| T1-006 / 1988 | 23,240 to nearest 1,000 = **23,000 B** | A 20,000: nearest 10,000 (2392); C 23,200: nearest 100 (1248); D 24,000: up (1988). | Arithmetic and links plausible. |
| T1-007 / 1248 | 8,374 to nearest 100 = **8,400 C** | A 8,000: nearest 1,000 (2392); B 8,300: down (1379); D 8,370: nearest 10 (1248). | Arithmetic and links plausible. |
| T1-008 / 1248 | 6,243 to nearest 10 = **6,240 A** | B 6,200: nearest 100 (2392); C 6,243: unchanged (1248?); D 6,250: up (1988). | Correct answer sound; C needs decision. |
| T1-009 / 1379 | 15,720 to nearest 1,000 = **16,000 B** | A 15,000: down (1379); C 15,700: nearest 100 (1248); D 20,000: nearest 10,000 (2392). | Arithmetic and links plausible. |
| T1-010 / 2392 | 7.346 to 2 decimal places = **7.35 D** | A 7.30: one decimal place, written with a trailing zero (2392); B 7.34: down (1379); C 7.346: unchanged (1248?). | Correct answer sound; C needs decision. |
| T1-011 / 1988 | 2,694 to nearest 10 = **2,690 C** | A 2,694: unchanged (1248?); B 2,700: up, or nearest 100 (1988 + 2392); D 2,680: an extra step down (U). | Correct answer sound; A needs decision; D remains unmodelled. |
| T1-012 / 1988 | 8,943 to nearest 100 = **8,900 A** | B 8,940: nearest 10 (1248); C 9,000: up, or nearest 1,000 (1988 + 2392); D 8,800: an extra step down (U). | Arithmetic and linked interpretations plausible; D remains unmodelled. |
| T1-013 / 1988 | 12.43 to 1 decimal place = **12.4 D** | A 12.0: nearest whole number, written with a trailing zero (2392); B 12.43: unchanged (1248?); C 12.5: up (1988). | Correct answer sound; B needs decision. |
| T1-014 / 2392 | 5,408 to nearest 10 = **5,410 B** | A 5,400: down, or nearest 100 (1379 + 2392); C 5,408: unchanged (1248?); D 5,420: an extra step up (U). | Correct answer sound; C needs decision; D remains unmodelled. No true finer-place 1248 option. |
| T1-015 / 2392 | 3.76 to 1 decimal place = **3.8 C** | A 3.7: down (1379); B 3.76: unchanged (1248?); D 4.0: nearest whole number, written with a trailing zero (2392). | Correct answer sound; B needs decision. |
| T1-016 / 1379 | 4,062 to nearest 100 = **4,100 D** | A 4,000: down, or nearest 1,000 (1379 + 2392); B 4,060: nearest 10 (1248); C 4,200: an extra step up (U). | Arithmetic and linked interpretations plausible; C remains unmodelled. |
| T1-017 / 1379 | 5.678 to 2 decimal places = **5.68 B** | A 5.67: down (1379); C 5.678: unchanged (1248?); D 5.70: one decimal place, written with a trailing zero (2392). | Correct answer sound; C needs decision. |
| T1-018 / 1248 | 47.6 to nearest whole number = **48 A** | B 47: down (1379); C 47.6: unchanged (1248?); D 50: nearest 10 (2392). | Correct answer sound; C needs decision. |
| T1-019 / 1248 | 12,468 to nearest 1,000 = **12,000 C** | A 10,000: nearest 10,000 (2392); B 12,500: nearest 100 (1248); D 13,000: up (1988). | Arithmetic and links plausible. |
| T1-020 / 1248 | 9.64 to 1 decimal place = **9.6 B** | A 9.64: unchanged (1248?); C 9.7: up (1988); D 10.0: nearest whole number, written with a trailing zero (2392). | Correct answer sound; A needs decision. |

## Checks and limits

- The 20 items have one marked correct answer each, four distinct options each, and five target items for each of the four T1 misconceptions. Independent arithmetic agrees with **all 20 marked answers**. Eight wrong options are unlinked: four coarse-rounding responses in T1-001 through T1-004, plus T1-011 D, T1-012 D, T1-014 D, and T1-016 C.
- **Eleven** options linked to 1248 are the unchanged original number: T1-001 C, 002 A, 008 C, 010 C, 011 A, 013 B, 014 C, 015 B, 017 C, 018 C, and 020 A. The existing B01/B02 audit lists ten and omitted **T1-017 C**. An unchanged number does not demonstrate an actual finer-place round. In T1-002 and T1-014 it is the only 1248-linked wrong answer. Thus five target IDs per misconception does not itself prove five strong diagnostic probes.
- The 1379 and 1988 links point in the wrong direction relative to the independently computed answer. Options with two links represent a genuine ambiguity: one selected answer cannot identify which of the two mistakes the student made. None of the four T1 hypotheses has the exact same linked-option pattern across all 20 questions, so the bank has a *structural opportunity* to distinguish them; this is not proof that actual students will respond as modelled.
- `python -m validation.math_dataset` on this branch: **0 structural errors; 31 draft-contract conflicts; 6 topic-label warnings** across the whole Maths bank. T1 has no listed draft-contract conflict. These results establish CSV consistency and a draft-rule comparison, not answer or link validity.
- Source URLs/publications, permission or licence, exact author/generator per item, reviewer/date, and an accepted demo-pack version are not fields in `items.csv`. Authored batches B01/B02 and their link audit give partial history. Harris must provide/confirm the missing provenance and the exact IDs approved for the live pack. Do not infer a licence or invent a human review date from a Git commit.

## Decision register before live use

| Decision | Required owner and evidence | Current state |
| --- | --- | --- |
| What does 1248 mean for an unchanged original number? | Harris decides whether each such link is retained as an explicitly weak proxy, removed, or replaced with a genuine finer-place distractor/item. Recheck target coverage and likelihoods after the decision. | Open. |
| Should T1-001 D, 002 C, 003 D, 004 D link to 2392? | Harris decides using the actual intended student computation. Record four option-level decisions; do not add links just to improve coverage. | Open. |
| Which T1 IDs are in the demo pack, and what is their content provenance? | Harris confirms exact IDs, source/permission, authorship and content review; Ahmed confirms pack grouping/import version. | Open. |
| Does the imported pack equal the reviewed bank version? | After Ahmed imports, Ashher compares item ID, stem, answer, options, links, and content hash from a clean checkout; save the test run. | Waiting for import. |

**Status:** Ashher's T1 arithmetic and option-level independent review is recorded here. A final reviewed demo subset is **not complete** while the content and pack decisions above are open. Bayes core can be developed against explicit synthetic items without describing this candidate as accepted live content.
