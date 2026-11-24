# Held-out comparison on the Maths_v2 candidate (I2-A10)

**Owner:** Syed Ashher Majid · **Date:** 24 November 2026.

Two held-out runs exist, one per content version, as the protocol's freeze rule requires (`PROTOCOL.md`, change log of 24 November 2026). **The current result is the first section**, on the content merged into `dev`. The earlier run stays reported for the content it was made on.

## Current: candidate of 24 November 2026 (distinct T2 stems)

**Run:** `experiments/results/u1u2-heldout-1124/`: configuration `u1u2-heldout-1124.json` (SHA-256 `c9bd9133…`, recorded in the change log before the run), clean commit `9c20b62`, **held-out seeds 2600–2899**, default parameters (θ 0.80, `min_support` 2), 21,600 runs, Python 3.14.0 / NumPy 2.4.4. Content `items.csv` `1124496b…`, not externally reviewed.

| Unit, rate | Correct label: adaptive / fixed / random (95% CI) | Wrong ÷ labelled: A / F / R | Refused: A / F / R | Mean questions A / F / R |
| --- | --- | --- | --- | --- |
| U1, 0.6 | 69.7% (67.0–72.2) / 67.6% (64.9–70.2) / 68.8% (66.1–71.3) | 0.1% / 0.1% / 1.1% | 2.3% / 2.7% / 7.0% | 3.74 / 3.87 / 4.15 |
| U1, 0.8 | 90.9% (89.2–92.4) / 89.4% (87.5–91.0) / 89.4% (87.5–91.0) | 0.1% / 0.1% / 0.3% | 0.3% / 0.4% / 2.8% | 3.25 / 3.36 / 3.52 |
| U2, 0.6 | **62.7%** (60.3–65.1) / **47.1%** (44.6–49.7) / 57.9% (55.4–60.4) | 7.3% / 0.0% / 4.2% | 2.1% / **52.9%** / 9.1% | 3.64 / 5.73 / 4.70 |
| U2, 0.8 | **85.7%** (83.9–87.4) / **58.7%** (56.2–61.1) / 80.7% (78.7–82.6) | 3.7% / 0.0% / 1.5% | 0.3% / **41.3%** / 5.5% | 3.03 / 4.80 / 4.34 |

| | U1 adaptive / fixed / random | U2 adaptive / fixed / random |
| --- | --- | --- |
| No misconception → none detected (of 300) | 299 / 298 / 296 | 299 / **0** / 288 |
| No misconception → false label (of 300) | 1 / 1 / 1 | 1 / 0 / 0 |
| Random answering → labelled | 53.0% / 57.0% / 50.3% | 48.7% / 47.7% / 39.3% |
| Off-catalogue answering → labelled | 70.3% / 76.3% / 41.7% | 13.3% / 78.7% / 12.3% |

**What this shows**

- **U1:** the three methods are equal in correct coverage within their intervals, with almost no wrong labels. Adaptive selection asks the fewest questions.
- **U2: adaptive selection is clearly better.** With distinct stems the six conversion checks T2-005 to T2-010 all rank highest by EIG at the prior, so the fixed order asks them first (T2-005, T2-006, T2-007, T2-008, T2-009, T2-010, …). Within the budget of 8 it never reaches an item that tests MATH-61 or MATH-1965. It labels those two misconceptions correctly 0% of the time, recognises **none** of the 300 students without a misconception (every one exhausts the budget, R5), and refuses 41–53% of holders. Its few labels are rarely wrong because it rarely labels at all.
- **Adaptive selection's U2 wrong labels** (7.3% and 3.7%) are the KF-07 confusion, MATH-2039 holders labelled MATH-1965.
- **Across U1–U7** this agrees with the U3–U7 tuning run (`FINDINGS_U3_U7.md`): a fixed order has blind spots whenever its top-ranked items cover only some hypotheses (U2, U4, U6, U7). Adaptive selection avoids them and is never clearly worse.
- The proposal's targets (≤ 5% confident misdiagnosis with ≥ 70% coverage) are not evaluated: they need real student responses (protocol §8).

Independent reproduction is protocol §9 (Harris), on this run.

## Earlier: candidate of 20 November 2026

The section below is the first held-out run (`results/u1u2-heldout/`, seeds 2000–2299, `items.csv` `b168a664…`). On that content the seven conversion checks shared one stem and formed one twin group, so the fixed order could ask only one of them and reached MATH-61 and MATH-1965. That is why fixed and adaptive selection looked equal in U2 there. It stands only for that content.

**Owner:** Syed Ashher Majid · **Date:** 24 November 2026 · **Run once**, as amended in `PROTOCOL.md` (change log, 24 November 2026).
**Run:** `experiments/results/u1u2-heldout/`: configuration `u1u2-heldout.json` (SHA-256 `833fcabe…`, recorded before the run), clean commit `faec814`, held-out seeds 2000–2299, default parameters, 21,600 runs, Python 3.14.0 / NumPy 2.4.4.
**Content:** Maths_v2 candidate of 20 November 2026 (`items.csv` `b168a664…`), **not externally reviewed**. A confirmation run on the accepted version is declared (seeds 2300–2599).

All students are synthetic under assumed parameters; this is not accuracy on real students. Proportions are shown with their counts and Wilson 95% intervals, all from `metrics.csv`.

### Misconception holders (apply rate 0.6 and 0.8, careful-answer slip 0.05)

| Unit, rate | Correct label: adaptive / fixed / random | Wrong ÷ labelled: adaptive / fixed / random | Mean questions A / F / R |
| --- | --- | --- | --- |
| U1, 0.6 | 70.4% (67.8–72.9) / 70.2% (67.6–72.8) / 67.1% (64.4–69.7) | 0.0% / 0.0% / 1.3% | 3.79 / 3.85 / 4.12 |
| U1, 0.8 | 91.8% / 91.8% / 89.7% | 0.0% / 0.0% / 0.6% | 3.15 / 3.28 / 3.45 |
| U2, 0.6 | 63.3% (60.9–65.7) / 65.1% (62.6–67.4) / 56.5% (53.9–59.0) | **7.3%** (5.9–9.1) / **1.3%** (0.8–2.2) / 3.9% | 3.52 / 5.03 / 4.74 |
| U2, 0.8 | 85.5% (83.6–87.2) / 86.9% (85.1–88.5) / 80.5% (78.4–82.4) | 3.6% (2.7–4.8) / 0.2% (0.1–0.7) / 2.0% | 3.03 / 4.45 / 4.28 |

Refusals, U2 at 0.6: adaptive 3.0%, fixed 9.9%, random 12.3%.

### Students without the labelled misconception

| | U1 adaptive / fixed / random | U2 adaptive / fixed / random |
| --- | --- | --- |
| No misconception → none detected | 99.7% / 99.3% / 98.7% | 99.3% / 98.7% / 96.3% |
| No misconception → false label | 0.0% / 0.0% / 0.0% | 0.7% / 0.7% / 0.0% |
| Random answering → labelled | 53.3% / 62.7% / 52.0% | 49.3% / 50.3% / 35.3% |
| Off-catalogue answering → labelled | 72.0% / 82.7% / 44.3% | 14.7% / 71.7% / 6.3% |

### What this shows

- **U1:** adaptive and fixed selection are equal in correct labels (overlapping intervals) with no wrong labels. Adaptive uses slightly fewer questions. Random item selection is a little worse.
- **U2:** adaptive and fixed selection reach the same correct coverage (intervals overlap). The fixed order makes **fewer wrong labels** (1.3% against 7.3% at rate 0.6; these are the KF-07 2039 → 1965 confusion) but needs **about 1.4–1.5 more questions** and refuses more. Random item selection is lowest in coverage.
- **This confirms the tuning finding on new students** (`FINDINGS_A05.md` §2). On this content, adaptive selection's advantage is shorter checks, not more correct diagnoses. Its extra wrong labels in U2 come from the 1965/2039 content problem.
- **Adverse answering is still often labelled:** random answering about half the time in both units. Fixed-order selection labels off-catalogue answering in U2 72% of the time, against 15% for adaptive.
- The proposal's targets (≤ 5% confident misdiagnosis with ≥ 70% coverage) are not evaluated: they need real student responses (protocol §8).

Independent reproduction (protocol §9) is made on the current run above.
