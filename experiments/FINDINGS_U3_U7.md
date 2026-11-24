# Remaining units U3–U7: tuning run on the Maths_v2 candidate (I2-A10)

**Owner:** Syed Ashher Majid · **Date:** 24 November 2026 · **Split:** tuning only.
**Run:** `experiments/results/u3u7-tuning/`: configuration `configs/u3u7-tuning.json` (committed before the run), clean commit `daf45ae`, tuning seeds 1000–1299, default parameters (θ 0.80, `min_support` 2), 82,510 runs, Python 3.14.0 / NumPy 2.4.4.
**Content:** the Maths_v2 candidate of 20 November 2026 (`items.csv` `b168a664…`), **not externally reviewed**. Under [REMAINING_UNITS_PLAN.md](REMAINING_UNITS_PLAN.md) §2 this is the "U3–U7 tuning" run on the corrected content. The U3–U7 held-out run (`configs/u3u7-heldout.json`, committed) waits for the expert-accepted version.

Results are read by the rules the plan fixed in advance (§4): per unit, never pooled; known-cause refusals reported as such; correct coverage given twice; small-unit caution for U3 and U5. All students are synthetic under assumed parameters (KF-10). Every number below is from `metrics.csv` or `runs.csv`.

## 1. Misconception holders (careful-answer slip 0.08)

Correct coverage, adaptive / fixed / random selection, with the adaptive denominator. Wrong-label rate = wrong labels ÷ labelled. Mean questions per method.

| Unit | Apply 0.5 | Apply 0.7 | Apply 0.9 | Wrong-label rate at 0.5, A / F / R | Mean questions at 0.7, A / F / R |
| --- | --- | --- | --- | --- | --- |
| U3 (k 4) | 56.9 / 54.2 / 54.7% (n 1,200) | 83.3 / 82.0 / 79.8% | 96.5 / 96.6 / 95.5% | 0.3 / 0.2 / 1.2% | 3.46 / 3.75 / 4.15 |
| U4 (k 6) | 45.6 / **29.1** / 30.3% (n 1,800) | 71.3 / **43.2** / 50.2% | 90.4 / **49.6** / 65.9% | **9.7** / 0.2 / 8.1% | 3.71 / 6.43 / 6.21 |
| U5 (k 3) | 70.0 / 71.3 / 64.9% (n 900) | 92.3 / 91.8 / 86.3% | 99.6 / 100.0 / 98.8% | 0.2 / 0.3 / 0.0% | 3.48 / 2.94 / 3.44 |
| U6 (k 5) | 48.6 / **27.1** / 34.5% (n 1,500) | 76.9 / **37.7** / 54.5% | 92.3 / **39.9** / 69.6% | **8.5** / 0.5 / 5.7% | 3.40 / 5.07 / 5.67 |
| U7 (k 7) | 41.4 / **26.0** / 23.0% (n 2,100) | 68.6 / **42.8** / 38.9% | 89.8 / **54.0** / 55.1% | **8.4** / 2.2 / 3.8% | 4.41 / 6.17 / 6.89 |

**Correct coverage twice (plan §4.3).** The plan sets aside students whose refusal has a known cause: KF-06 inseparable pairs and KF-04 companions with too few trigger groups. On the candidate neither exists (no W1, no W3; `KNOWN_FAULTS.md`), so the two figures are the same and the table above is both.

## 2. Students without a misconception, and adverse answering

| Unit | No misconception → none detected, A / F / R | → false label, A / F / R | Random answering labelled, A / F / R | Off-catalogue labelled, A / F / R | Always-A labelled, A / F |
| --- | --- | --- | --- | --- | --- |
| U3 | 288 / 285 / 281 of 300 | 1 / 4 / 4 | 39.7 / 49.0 / 41.7% | 0.0 / 61.7 / 11.3% | no / yes |
| U4 | 291 / **0** / 205 | 4 / 1 / 2 | 43.0 / 29.0 / 14.3% | 20.7 / 45.3 / 5.7% | yes / yes |
| U5 | 298 / 299 / 295 | 1 / 1 / 3 | 46.3 / 63.0 / 53.7% | 0.0 / 91.0 / 34.0% | yes / yes |
| U6 | 286 / **0** / 215 | 2 / 2 / 2 | 50.3 / 34.3 / 23.0% | 0.0 / 38.7 / 0.3% | yes / yes |
| U7 | 278 / **0** / 136 | 2 / 0 / 1 | 47.3 / 31.3 / 13.0% | 34.0 / 51.7 / 2.3% | yes / no |

The always-A results under adaptive selection agree with the adverse baseline (labelled in U4–U7, the U3 session exhausts). The fixed order labels always-A in U3 and not in U7, because the order of its first items differs.

## 3. What the units show

**U3 and U5 (small units, plan §4.4).** Adaptive, fixed and random selection give nearly the same coverage, and wrong labels stay at or below 1.2%. With 10 and 13 items and a budget of 8 the methods share most questions, so these small differences are not evidence for or against adaptive selection. U5, now without MATH-734, reaches 99.6% at apply 0.9.

**U4, U6 and U7: the fixed order fails for whole misconceptions.** Its first eight questions, ranked once by EIG at the prior, never test some hypotheses:

| Unit | Correct coverage at apply 0.7 under the fixed order, by misconception | Adaptive, same misconceptions |
| --- | --- | --- |
| U4 | MATH-1514 **0%**, MATH-1773 **0%**, MATH-2093 **0%** (MATH-228 92%) | 64%, 75%, 63% |
| U6 | MATH-1074 **0%**, MATH-1651 **0%**, MATH-2359 **0%** (MATH-161 95%) | 72%, 75%, 61% |
| U7 | MATH-1514 **0%**, MATH-1639 **0%**, MATH-1773 **0%** (MATH-2359 91%) | 47%, 63%, 61% |

The same blind spot means the fixed order recognises **no** student without a misconception in these units (0 of 300): in U4 and U7 their sessions run out of the budget (R5: 299 and 300 of 300); in U6, 297 of 300 are refused as tied with an untested misconception (R4). Random item selection is between the two. On these units adaptive selection is clearly better on correct coverage and uses fewer questions, the opposite of U2 on this content (`FINDINGS_A05.md` §2). Whether adaptive selection helps therefore depends on the unit's structure, which is the honest summary across U1–U7.

**U4, U6 and U7: adaptive selection's wrong labels come from two new subset pairs (KF-16).** Of adaptive selection's wrong labels at all apply rates, U4 has 160 MATH-1514 holders labelled MATH-1773 out of 214, U7 has 136 out of 184, and U6 has 121 MATH-1074 holders labelled MATH-1651 out of 156. The new separating items (B19–B21) link the "adds" option of bare calculations to MATH-1514 alone and the "multiplies" option of non-unit divisions to MATH-1074 alone. As a result every MATH-1773 option is also a MATH-1514 option (17 of 17), and every MATH-1651 option is also a MATH-1074 option (6 of 6). That is the structure of MATH-1965/2039 (KF-07): a MATH-1514 holder who answers a bare subtraction correctly looks like a MATH-1773 holder. The pairs are separable, which ended the old refusals (KF-06), but a noisy holder of the broader misconception is now sometimes labelled with the narrower one. The fixed order shows few of these errors only because it rarely labels these misconceptions at all.

**Refusals.** Adaptive selection's R4 refusals (U3 46, U4 101, U6 173, U7 205 over all holder runs) are the session-specific exact-row refusals of KF-08: the pair's two separating groups were asked and answered without the separating option.

**Adverse answering** stays high everywhere: random answering is labelled 40–50% of the time under adaptive selection. Off-catalogue answering is rarely labelled under adaptive selection except in U4 (21%) and U7 (34%).

## 4. What this does not show

- A tuning run only. It informs the content review and the team's decisions; nothing is chosen from it for the held-out run, which uses the configuration already committed.
- Simple synthetic students under assumed parameters; not accuracy on real students.
- Candidate content pending external review. Any merged content change, a catalogue decision on the subset pairs, or reviewed link grades means a rerun (plan §5).
