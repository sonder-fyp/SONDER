# I2-A04 findings: stricter stopping settings on the tuning split

**Author:** Syed Ashher Majid · **Date:** 18 November 2026 · **Protocol:** [PROTOCOL.md](PROTOCOL.md) §5 (tuning only; amendment of 18 November for `params`) · **Task:** I2-A04 (investigate false and missed diagnoses), following [FINDINGS_TUNING.md](FINDINGS_TUNING.md) §4 item 1

**Synthetic students under assumed parameters. Not accuracy on real students.**

## 1. What was run

Three runs identical to the frozen `u1u2-tuning` (U1 and U2; adaptive, fixed and random selection; seeds 1000–1299; the same truth cases), changing one stopping setting at a time:

| Run | Change from the defaults | Commit |
| --- | --- | --- |
| `results/u1u2-tuning` | none (θ 0.80, `min_support` 2) | `272cdfe` (frozen 10 Nov) |
| `results/u1u2-tuning-support3` | `min_support` = 3: a misconception needs 3 supporting answers before it can be diagnosed | `e0e55cd` |
| `results/u1u2-tuning-theta090` | θ = 0.90: the leading explanation needs 90% model confidence | `e0e55cd` |
| `results/u1u2-tuning-support3-theta090` | both | `e0e55cd` |

Each run has 30,606 sessions, a clean-tree manifest, `metrics.csv` computed from `runs.csv` alone, and figures. Reproduce the table below with:

    python -m experiments.compare experiments/results/u1u2-tuning experiments/results/u1u2-tuning-support3         experiments/results/u1u2-tuning-theta090 experiments/results/u1u2-tuning-support3-theta090

## 2. Results (adaptive selection; value and numerator/denominator)

With 1,200 (U1) or 1,500 (U2) holder runs, a 95% interval is about ±2.5–3 percentage points near 50%. With 300 runs it is about ±5.7.

Parameters per run: u1u2-tuning: theta 0.8, min_support 2; u1u2-tuning-support3: theta 0.8, min_support 3; u1u2-tuning-theta090: theta 0.9, min_support 2; u1u2-tuning-support3-theta090: theta 0.9, min_support 3

### U1 (adaptive selection)

| Measure | u1u2-tuning | u1u2-tuning-support3 | u1u2-tuning-theta090 | u1u2-tuning-support3-theta090 |
| --- | --- | --- | --- | --- |
| Holders, apply 0.5: correct coverage | 57.3% (688/1200) | 51.2% (615/1200) | 54.5% (654/1200) | 46.1% (553/1200) |
| Holders, apply 0.5: missed rate | 37.4% (449/1200) | 39.2% (471/1200) | 33.0% (396/1200) | 34.8% (417/1200) |
| Holders, apply 0.5: wrong diagnosis rate | 0.7% (5/693) | 0.2% (1/616) | 0.5% (3/657) | 0.0% (0/553) |
| Holders, apply 0.5: refusal rate | 4.8% (58/1200) | 9.4% (113/1200) | 12.2% (147/1200) | 19.2% (230/1200) |
| Holders, apply 0.5: questions mean | 4.00 | 4.96 | 4.41 | 5.40 |
| Holders, apply 0.7: correct coverage | 82.3% (988/1200) | 79.2% (951/1200) | 83.0% (996/1200) | 79.2% (951/1200) |
| Holders, apply 0.7: missed rate | 15.8% (189/1200) | 16.0% (192/1200) | 12.6% (151/1200) | 12.8% (154/1200) |
| Holders, apply 0.7: wrong diagnosis rate | 0.3% (3/991) | 0.1% (1/952) | 0.0% (0/996) | 0.0% (0/951) |
| Holders, apply 0.7: refusal rate | 1.7% (20/1200) | 4.7% (56/1200) | 4.4% (53/1200) | 7.9% (95/1200) |
| Holders, apply 0.7: questions mean | 3.52 | 4.69 | 3.76 | 4.93 |
| Holders, apply 0.9: correct coverage | 96.9% (1163/1200) | 95.1% (1141/1200) | 97.1% (1165/1200) | 95.2% (1143/1200) |
| Holders, apply 0.9: missed rate | 2.6% (31/1200) | 2.6% (31/1200) | 2.3% (28/1200) | 2.3% (28/1200) |
| Holders, apply 0.9: wrong diagnosis rate | 0.3% (3/1166) | 0.1% (1/1142) | 0.0% (0/1165) | 0.0% (0/1143) |
| Holders, apply 0.9: refusal rate | 0.2% (3/1200) | 2.2% (27/1200) | 0.6% (7/1200) | 2.4% (29/1200) |
| Holders, apply 0.9: questions mean | 2.90 | 4.35 | 2.96 | 4.38 |
| NONE students: false label | 1.7% (5/300) | 0.0% (0/300) | 1.7% (5/300) | 0.0% (0/300) |
| Adverse always-A: labelled | 100.0% (1/1) | 100.0% (1/1) | 100.0% (1/1) | 100.0% (1/1) |
| Adverse random-uniform: labelled | 51.3% (154/300) | 34.3% (103/300) | 36.0% (108/300) | 24.3% (73/300) |
| Adverse off-catalogue: labelled | 70.3% (211/300) | 61.0% (183/300) | 52.0% (156/300) | 48.3% (145/300) |

### U2 (adaptive selection)

| Measure | u1u2-tuning | u1u2-tuning-support3 | u1u2-tuning-theta090 | u1u2-tuning-support3-theta090 |
| --- | --- | --- | --- | --- |
| Holders, apply 0.5: correct coverage | 53.2% (798/1500) | 47.9% (718/1500) | 57.5% (863/1500) | 49.5% (742/1500) |
| Holders, apply 0.5: missed rate | 40.5% (608/1500) | 44.1% (661/1500) | 29.9% (449/1500) | 33.3% (500/1500) |
| Holders, apply 0.5: wrong diagnosis rate | 8.7% (76/874) | 4.3% (32/750) | 7.8% (73/936) | 5.8% (46/788) |
| Holders, apply 0.5: refusal rate | 1.2% (18/1500) | 5.9% (89/1500) | 7.7% (115/1500) | 14.1% (212/1500) |
| Holders, apply 0.5: questions mean | 3.62 | 4.94 | 4.67 | 5.80 |
| Holders, apply 0.7: correct coverage | 76.4% (1146/1500) | 77.2% (1158/1500) | 86.0% (1290/1500) | 83.2% (1248/1500) |
| Holders, apply 0.7: missed rate | 19.3% (289/1500) | 19.5% (292/1500) | 8.5% (128/1500) | 9.0% (135/1500) |
| Holders, apply 0.7: wrong diagnosis rate | 4.9% (59/1205) | 1.4% (17/1175) | 2.6% (34/1324) | 1.7% (21/1269) |
| Holders, apply 0.7: refusal rate | 0.4% (6/1500) | 2.2% (33/1500) | 3.2% (48/1500) | 6.4% (96/1500) |
| Holders, apply 0.7: questions mean | 3.19 | 4.75 | 3.98 | 5.30 |
| Holders, apply 0.9: correct coverage | 93.1% (1397/1500) | 93.9% (1409/1500) | 98.7% (1480/1500) | 97.9% (1468/1500) |
| Holders, apply 0.9: missed rate | 5.0% (75/1500) | 5.1% (76/1500) | 0.7% (10/1500) | 0.7% (10/1500) |
| Holders, apply 0.9: wrong diagnosis rate | 2.0% (28/1425) | 0.3% (4/1413) | 0.3% (5/1485) | 0.2% (3/1471) |
| Holders, apply 0.9: refusal rate | 0.0% (0/1500) | 0.7% (11/1500) | 0.3% (5/1500) | 1.3% (19/1500) |
| Holders, apply 0.9: questions mean | 2.71 | 4.39 | 3.11 | 4.54 |
| NONE students: false label | 0.3% (1/300) | 0.0% (0/300) | 0.3% (1/300) | 0.0% (0/300) |
| Adverse always-A: labelled | 100.0% (1/1) | 100.0% (1/1) | 100.0% (1/1) | 100.0% (1/1) |
| Adverse random-uniform: labelled | 55.0% (165/300) | 28.7% (86/300) | 40.3% (121/300) | 23.0% (69/300) |
| Adverse off-catalogue: labelled | 40.0% (120/300) | 13.0% (39/300) | 39.3% (118/300) | 12.3% (37/300) |

## 3. What the numbers say

**Cost.** Both settings ask more questions.
- `min_support` = 3 adds about 1.2–1.7 questions on average (U1 at apply 0.7: 3.52 → 4.69; U2: 3.19 → 4.75).
- θ = 0.90 adds about 0.1–1.0 (U1: 3.52 → 3.76; U2: 3.19 → 3.98).
- Both raise refusals. The largest is the combination at apply 0.5: U1 4.8% → 19.2%, U2 1.2% → 14.1%. These are mostly budget refusals.
- `min_support` = 3 lowers correct coverage for weak holders (apply 0.5: U1 57.3% → 51.2%, U2 53.2% → 47.9%).

**Gain.** Both settings cut adverse labelling, which was the problem these settings were tried for (KF-03).
- Random answering is labelled less often: U1 51.3% → 34.3% (`min_support` 3), 36.0% (θ 0.90), 24.3% (both); U2 55.0% → 28.7%, 40.3%, 23.0%.
- Off-catalogue answering in U2 drops from 40.0% to 13.0% with `min_support` 3.
- Wrong diagnoses for holders fall in every run (U2 at apply 0.7: 4.9% → 1.4%, 2.6% and 1.7%).
- False labels for careful NONE students fall to 0 of 300 with `min_support` 3.

**θ = 0.90 in U2 is better on both sides at apply 0.7 and 0.9.** Correct coverage rises (76.4% → 86.0% and 93.1% → 98.7%) and misses fall (19.3% → 8.5%). Asking a little longer stops the model from settling on "no misconception" too early. In U1 it is roughly neutral for holders.

**Always-A is still labelled under every setting**: a single deterministic session, 100% in all four runs. So is the partial MATH-2039 holder, which is labelled MATH-1965 every time under adaptive selection. No stopping setting fixes these, because each is a consistent answer pattern that matches a misconception's links on every question. Always-A matches the links that option A happens to carry in these units ([ADVERSE_CASES.md](ADVERSE_CASES.md)). The partial holder matches because MATH-1965 is a subset of MATH-2039 (KF-07, a content decision for Harris). Both need content changes, not stricter stopping.

## 4. Decision

- **No default changes.** This is the tuning split. Protocol §5 says a candidate is only proposed after the held-out run on accepted content.
- **Carry two candidates forward:** θ = 0.90 alone, and `min_support` = 3 with θ = 0.90. The first costs least (under one extra question at apply 0.7) and helps U2. The second gives the lowest adverse labelling, but uses about two more questions and refuses more weak holders.
- **For the team:** choosing between them is a trade-off between labelling random answering and asking students more questions. It should be agreed with Ahmed and Harris before the held-out run. The held-out file (`configs/u1u2-heldout.json`) stays on the defaults. A candidate would get its own held-out configuration, committed and hashed before it runs.
- **KF-11** ("values of θ other than 0.80 are untested") is now partly answered for U1/U2 on the tuning split. The known-faults entry stays open until a held-out result exists.
