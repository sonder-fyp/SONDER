# Held-out comparison on the Maths_v2 candidate (I2-A10)

**Owner:** Syed Ashher Majid · **Date:** 24 November 2026 · **Run once**, as amended in `PROTOCOL.md` (change log, 24 November 2026).
**Run:** `experiments/results/u1u2-heldout/`: configuration `u1u2-heldout.json` (SHA-256 `833fcabe…`, recorded before the run), clean commit `faec814`, held-out seeds 2000–2299, default parameters, 21,600 runs, Python 3.14.0 / NumPy 2.4.4.
**Content:** Maths_v2 candidate of 20 November 2026 (`items.csv` `b168a664…`), **not externally reviewed**. A confirmation run on the accepted version is declared (seeds 2300–2599).

All students are synthetic under assumed parameters; this is not accuracy on real students. Proportions are shown with their counts and Wilson 95% intervals, all from `metrics.csv`.

## Misconception holders (apply rate 0.6 and 0.8, careful-answer slip 0.05)

| Unit, rate | Correct label: adaptive / fixed / random | Wrong ÷ labelled: adaptive / fixed / random | Mean questions A / F / R |
| --- | --- | --- | --- |
| U1, 0.6 | 70.4% (67.8–72.9) / 70.2% (67.6–72.8) / 67.1% (64.4–69.7) | 0.0% / 0.0% / 1.3% | 3.79 / 3.85 / 4.12 |
| U1, 0.8 | 91.8% / 91.8% / 89.7% | 0.0% / 0.0% / 0.6% | 3.15 / 3.28 / 3.45 |
| U2, 0.6 | 63.3% (60.9–65.7) / 65.1% (62.6–67.4) / 56.5% (53.9–59.0) | **7.3%** (5.9–9.1) / **1.3%** (0.8–2.2) / 3.9% | 3.52 / 5.03 / 4.74 |
| U2, 0.8 | 85.5% (83.6–87.2) / 86.9% (85.1–88.5) / 80.5% (78.4–82.4) | 3.6% (2.7–4.8) / 0.2% (0.1–0.7) / 2.0% | 3.03 / 4.45 / 4.28 |

Refusals, U2 at 0.6: adaptive 3.0%, fixed 9.9%, random 12.3%.

## Students without the labelled misconception

| | U1 adaptive / fixed / random | U2 adaptive / fixed / random |
| --- | --- | --- |
| No misconception → none detected | 99.7% / 99.3% / 98.7% | 99.3% / 98.7% / 96.3% |
| No misconception → false label | 0.0% / 0.0% / 0.0% | 0.7% / 0.7% / 0.0% |
| Random answering → labelled | 53.3% / 62.7% / 52.0% | 49.3% / 50.3% / 35.3% |
| Off-catalogue answering → labelled | 72.0% / 82.7% / 44.3% | 14.7% / 71.7% / 6.3% |

## What this shows

- **U1:** adaptive and fixed selection are equal in correct labels (overlapping intervals) with no wrong labels. Adaptive uses slightly fewer questions. Random item selection is a little worse.
- **U2:** adaptive and fixed selection reach the same correct coverage (intervals overlap). The fixed order makes **fewer wrong labels** (1.3% against 7.3% at rate 0.6; these are the KF-07 2039 → 1965 confusion) but needs **about 1.4–1.5 more questions** and refuses more. Random item selection is lowest in coverage.
- **This confirms the tuning finding on new students** (`FINDINGS_A05.md` §2). On this content, adaptive selection's advantage is shorter checks, not more correct diagnoses. Its extra wrong labels in U2 come from the 1965/2039 content problem.
- **Adverse answering is still often labelled:** random answering about half the time in both units. Fixed-order selection labels off-catalogue answering in U2 72% of the time, against 15% for adaptive.
- The proposal's targets (≤ 5% confident misdiagnosis with ≥ 70% coverage) are not evaluated: they need real student responses (protocol §8).

Independent reproduction by Harris is still outstanding (protocol §9, `REPRODUCTION.md`).
