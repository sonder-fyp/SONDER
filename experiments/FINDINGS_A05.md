# Tuning rerun on the Maths_v2 candidate (I2-A05, I2-A04 rerun)

**Owner:** Syed Ashher Majid · **Date:** 24 November 2026 · **Split:** tuning only (protocol §5); nothing here is a held-out result.
**Content:** the Maths_v2 candidate of 20 November 2026 (PR #92; `items.csv` `b168a664…ff73`, `topics.csv` `ebe0571b…20b0`, unit table unchanged), not externally reviewed.
**Runs** (all at clean commit `d387be3`, Python 3.14.0, NumPy 2.4.4, 30,606 runs each, tuning seeds 1000–1299, the same students as the first-content runs):

| Run | Parameters | First-content counterpart |
| --- | --- | --- |
| `results/u1u2-tuning-candidate/` | defaults (min_support 2, θ 0.80) | `results/u1u2-tuning/` |
| `results/u1u2-tuning-candidate-support3/` | min_support 3 | `results/u1u2-tuning-support3/` |
| `results/u1u2-tuning-candidate-theta090/` | θ 0.90 | `results/u1u2-tuning-theta090/` |
| `results/u1u2-tuning-candidate-support3-theta090/` | both | `results/u1u2-tuning-support3-theta090/` |

The first-content runs are kept unchanged. Every number below is read from a run's `metrics.csv`; `python -m experiments.compare <runs>` prints the adaptive-selection tables. All students are synthetic and every engine parameter is assumed (KF-10).

## 0. Final content (24 November 2026): reruns `*-1124`

After this write-up, Harris gave the seven U2 conversion checks distinct stems (content `1124496b…`). All four runs were repeated at clean commit `9c20b62` under names ending `-1124` (same seeds and cases); the sections below describe the 20 November content and stay as its record.

| Unit, apply rate | Correct label: adaptive / fixed / random | Wrong ÷ labelled: A / F / R | Mean questions A / F / R |
| --- | --- | --- | --- |
| U1, 0.5 / 0.7 / 0.9 | unchanged from §2 (U1 items did not change) | | |
| U2, 0.5 | 51.4% / 40.4% / 41.3% | 9.0% / 0.3% / 7.5% | 3.83 / 6.09 / 5.04 |
| U2, 0.7 | **75.7% / 54.9%** / 70.2% | 4.9% / 0.2% / 3.3% | 3.36 / 5.15 / 4.70 |
| U2, 0.9 | **93.0% / 59.8%** / 89.1% | 2.0% / 0.2% / 1.3% | 2.78 / 4.57 / 4.11 |

- **With distinct stems the fixed order again never tests MATH-61 or MATH-1965**: its six top-ranked items are the conversion checks. It recognises 0 of 300 students without a misconception in U2. **Adaptive selection is clearly better in U2 on the final content**, as the held-out rerun confirms (`FINDINGS_HELDOUT.md`). §2's "fixed matches adaptive" held only while the seven checks were one twin group.
- **Threshold settings (adaptive, U2):** random answering labelled 49.3% (default), 19.7% (`min_support` 3), 36.7% (θ 0.90), 12.7% (both); correct coverage at apply 0.7 is 75.7%, 75.1%, **85.3%** and 80.6%; mean questions at 0.7 are 3.36, 4.95, 4.05 and 5.50. The conclusion of §3 is unchanged.
- **Team decision (24 November 2026):** θ 0.90 becomes the default with the next content release, together with that release's held-out confirmation run. Iteration 2 results are reported at θ 0.80.

## 1. What the new content changes (defaults, adaptive selection, paired students)

| Measure | First content | Candidate |
| --- | --- | --- |
| U1 holders, correct coverage at apply 0.5 / 0.7 / 0.9 | 57.3% / 82.3% / 96.9% | 55.6% / 82.7% / 97.2% |
| U2 holders, correct coverage at apply 0.5 / 0.7 / 0.9 | 53.2% / 76.4% / 93.1% | 50.5% / 76.0% / 92.3% |
| U2 wrong-diagnosis rate at apply 0.5 / 0.7 / 0.9 | 8.7% / 4.9% / 2.0% | 9.6% / 5.2% / 2.1% |
| U2 wrong labels that are a MATH-2039 holder labelled MATH-1965 | 154 of 163 | **165 of 172** |
| U1 random answering labelled | 51.3% (154/300) | 51.0% (153/300) |
| U2 random answering labelled | 55.0% (165/300) | **46.3% (139/300)** |
| U2 off-catalogue answering labelled | 40.0% (120/300) | **11.0% (33/300)** |
| Always-A (U1 and U2) | labelled | labelled |

- **U1 is effectively unchanged.** The rewritten T1 items keep the same link structure (worked example D1 has identical numbers on the new items).
- **U2 adverse labelling falls.** Removing MATH-1715 from the percentage options and turning the bare-fraction MATH-2039 options into "x marks out of y" statements leaves fewer linked options for a student who answers at random or always picks an unlinked wrong answer.
- **The KF-07 confusion is not fixed and is slightly larger.** Every MATH-1965 option is still also a MATH-2039 option.
- Across all seven units the adverse baseline shows random answering labelled *more* often (44.7% from 37.9%, `experiments/ADVERSE_CASES.md`). That rise comes from U3–U7, where the new separating items remove refusals; U1 and U2 are flat or lower.

## 2. Adaptive, fixed and random selection on the candidate (defaults)

Misconception holders, pooled over each unit's misconceptions (1,200 runs per cell in U1, 1,500 in U2). Correct coverage (95% Wilson interval) and mean questions:

| Unit, apply rate | Adaptive | Fixed order | Random item | Mean questions A / F / R |
| --- | --- | --- | --- | --- |
| U1, 0.5 | 55.6% | 56.2% | 53.7% | 4.02 / 4.06 / 4.62 |
| U1, 0.7 | 82.7% | 82.4% | 82.4% | 3.56 / 3.54 / 3.94 |
| U1, 0.9 | 97.2% | 96.8% | 95.8% | 2.86 / 2.98 / 3.19 |
| U2, 0.5 | 50.5% (47.9–53.0) | 53.0% (50.5–55.5) | 40.5% | 3.86 / 5.51 / 4.91 |
| U2, 0.7 | 76.0% | 78.5% | 70.6% | 3.39 / 4.73 / 4.63 |
| U2, 0.9 | 92.3% | 94.7% | 90.3% | 2.77 / 4.19 / 4.10 |

| U2, apply rate | Wrong-diagnosis rate: adaptive | fixed | random |
| --- | --- | --- | --- |
| 0.5 | **9.6%** (80/837; 7.7–11.7) | **2.9%** (24/819; 2.0–4.3) | 7.9% |
| 0.7 | 5.2% | 0.6% | 3.6% |
| 0.9 | 2.1% | 0.1% | 0.9% |

**This changes an earlier finding.** On the first content (`FINDINGS_TUNING.md` §1) adaptive selection was clearly ahead in U2 (76.4% against 54.9% at apply 0.7), and under the fixed order no U2 student without a misconception was recognised (0 of 300). That gap came from the content: the fixed order's first eight items never tested MATH-61 or MATH-1965. On the candidate:

- **Correct coverage:** the fixed order matches adaptive in U2 (the intervals overlap at every apply rate) and in U1. Random item selection is lowest in U2.
- **Questions:** adaptive asks about 1.3–1.7 fewer questions than the fixed order in U2, and about the same in U1. This is adaptive selection's measurable advantage on this content.
- **Wrong labels:** adaptive makes more wrong labels in U2, and they are the 2039 → 1965 confusion (165 of its 172; fixed 26 of 33). A likely reason is that the fixed order, asking more questions, more often reaches the 2039-only items that tell the two apart; this explanation is not tested separately.
- **Students with no misconception:** the fixed order now recognises 97.7% of them in U2 (293/300), against 0% on the first content. Adaptive 99.7%, random 96.0%.
- **Off-catalogue answering in U2:** labelled 72.0% under the fixed order against 11.0% under adaptive selection. The fixed order's early items have linked wrong options that an off-catalogue student still chooses.

So on this content, adaptive selection trades a few points of wrong-label rate in U2 for shorter checks. That trade-off belongs in the report together with the first-content result, not instead of it.

## 3. The I2-A04 candidates on the candidate content (adaptive selection)

| Measure | Defaults | min_support 3 | θ 0.90 | Both |
| --- | --- | --- | --- | --- |
| U1 random answering labelled | 51.0% | 33.7% | 39.3% | 25.0% |
| U2 random answering labelled | 46.3% | 17.3% | 33.0% | 12.0% |
| U1 off-catalogue labelled | 70.3% | 58.0% | 48.0% | 42.7% |
| U2 off-catalogue labelled | 11.0% | 0.0% | 11.0% | 0.0% |
| Always-A labelled (U1, U2) | yes, yes | yes, yes | **no**, yes | no, yes |
| U2 holders, correct coverage at 0.5 / 0.7 / 0.9 | 50.5 / 76.0 / 92.3% | 44.3 / 74.4 / 92.1% | 55.0 / **85.3** / **97.5%** | 46.7 / 80.6 / 95.9% |
| U2 wrong-diagnosis rate at 0.5 / 0.7 / 0.9 | 9.6 / 5.2 / 2.1% | 5.3 / 1.7 / 0.5% | 8.7 / 2.7 / 0.7% | 6.8 / 2.2 / 0.5% |
| U1 holders, correct coverage at 0.5 / 0.7 / 0.9 | 55.6 / 82.7 / 97.2% | 49.8 / 79.3 / 94.6% | 54.2 / 83.5 / 97.5% | 46.9 / 79.9 / 95.0% |
| Mean questions, U2 holders at 0.7 | 3.39 | 4.95 | 4.05 | 5.47 |
| Refusals, U2 holders at 0.5 | 4.3% | 11.5% | 10.5% | 18.5% |
| False label, students with no misconception (U1, U2) | 0.7%, 0.3% | 0%, 0% | 0.7%, 0.3% | 0%, 0% |

The pattern is the same as on the first content (`FINDINGS_A04.md`):

- **min_support 3** gives the largest cut in adverse labelling (U2 random answering 46% → 17%) and fewer wrong labels. It costs about 0.8–1.8 more questions and some correct coverage at low apply rates, and refusals more than double.
- **θ 0.90** costs less (at most about 0.9 more questions). In U2 it *finds more* real misconceptions at apply 0.7 and 0.9 (85% and 97.5%), because fewer holders end as missed. It is also the only setting that stops labelling always-A in U1.
- **Both together** give the fewest adverse labels at the highest cost.
- **No setting fixes** always-A in U2 or the 2039/1965 confusion. Those are content problems (KF-03, KF-07).

**Recommendation (Ashher), for the team decision:** on both contents θ 0.90 buys a clear reduction in adverse labels and better U2 coverage for less than one extra question, while min_support 3 is the stronger guard against random answering at a real cost in questions and refusals. I would adopt **θ 0.90** if one change is made, and keep min_support 3 as the option if random-answer labelling is judged the main risk. Either change needs a team decision (D-3/D-6) and then a held-out confirmation on new seeds (protocol change log, 24 November 2026). **No default is changed here.**

## 4. What this does not show

- Tuning split only; the held-out comparison is a separate, single run.
- Synthetic students that follow simple per-item rules under assumed parameters; not accuracy on real students.
- U1 and U2 only. U3–U7 follow `REMAINING_UNITS_PLAN.md`.
- The content is a candidate pending external review; results are rerun on the accepted version.
