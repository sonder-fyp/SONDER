# Retained adverse cases (I2-A01)

**Task:** I2-A01, Iteration 2 package A1 (owner Ashher; logic reviewer Harris; session-integration check Ahmed).
**Why:** the 16 October 2026 supervisor action summary, item 2: the current rules confidently label always-A responses and mislabel a constructed partial-misconception pattern. These cases must be retained, reproducible and visible whenever behaviour changes.

Everything here is a **synthetic student under assumed parameters**. It records how the current engine behaves. It is not accuracy on real students, and it is not a comparison of question-selection methods (that is I2-A07). Policies without a named truth (always-A, random answering) produce adverse-response labels; those labels are never called correct or wrong diagnoses.

## Reproduce

```powershell
python -m pip install -e .
# current record, Maths_v2 candidate of 24 November 2026 (about 2.5 minutes; 5,549 runs)
python -m experiments.adverse_baseline --runs 200 --intermittent-runs 100 --out experiments/results/adverse-baseline-candidate-2026-11-24
python -m unittest discover -s tests -p "test_engine_adverse_cases.py" -v
```

Three frozen runs are kept, one per content version; none is overwritten:

| Folder | Content | Runs |
| --- | --- | --- |
| `experiments/results/adverse-baseline-candidate-2026-11-24/` | Maths_v2 candidate of 24 November 2026: as below, with distinct stems for the seven T2 conversion checks (Harris, PR #92). **Current record.** | 5,549 |
| `experiments/results/adverse-baseline-candidate-2026-11-20/` | Maths_v2 candidate of 20 November 2026, 133 items, 27 misconceptions. Kept for comparison. | 5,549 |
| `experiments/results/adverse-baseline/` | Maths_v2 as of 12 October 2026, 117 items, 28 misconceptions. First baseline, kept for comparison; it can only be regenerated from a checkout of that content. | 5,551 |

Each folder holds:

| File | Content |
| --- | --- |
| `runs.csv` | One row per run: unit, policy, target, apply rate, slip, truth, seed, questions used, every asked item and chosen option, outcome, rule, reported label, leader and its final probability, tied set, exhaustion reason |
| `summary.csv` | Run counts per (unit, policy, target, apply rate, slip, truth, outcome, label) |
| `manifest.json` | Generating commit, whether tracked files had changes, engine version, content hashes, every parameter, seed ranges, generation settings, Python and NumPy versions |

The same command produces byte-identical `runs.csv` and `summary.csv` (checked by `tests/test_engine_adverse_cases.py`). Each run is fixed by unit, parameters, policy and seed: a policy draws from a generator seeded per (seed, item), so a student answers an item the same way whenever it is asked.

## Versions of the frozen runs

| | Candidate, 24 Nov (current) | Candidate, 20 Nov | First baseline |
| --- | --- | --- | --- |
| Generating commit | `2e05db7` (Harris's commit; no tracked changes) | `03e9ef2016b600f6de7402651cccb34d4bf6b8ce` (no tracked changes). A second run produced byte-identical `runs.csv` and `summary.csv`. | `21265e658e677ea48e270b3ba5fd357ef265176d` (no tracked changes). The first generation at `1a16df0` produced byte-identical files. |
| Engine | `0.1.0` | `0.1.0` | `0.1.0` |
| Content | `items.csv` `1124496b…9858`, `topics.csv` `ebe0571b…20b0`, unit table `4e7102a3…ef21` | `items.csv` `b168a664…ff73`, `topics.csv` `ebe0571b…20b0`, unit table `4e7102a3…ef21` | `items.csv` `502895a9…9cd4`, `topics.csv` `f1a4dfe8…044d`, unit table `4e7102a3…ef21` |
| Parameters | defaults, the same in all three: slip 0.10, guess 0.30, prior NONE 0.25, prior UNMODELLED 0.05, θ 0.80, θ_U 0.50, min_support 2, min_support_none 3, δ 0.05, EIG floor 0.01, budget 8, link weights 1.0 / 0.5 | same | same |
| Python / NumPy | 3.14.0 / 2.4.4 | 3.14.0 / 2.4.4 | 3.14.0 / 2.4.4 |
| Seeds | 0–199 (slip and random students), 0–99 (intermittent), 0 (deterministic cases) | same | same |

Full hashes are in each `manifest.json`. Seeds 1000–1999 and 2000–2999 are reserved for the evaluation protocol's tuning and held-out runs, so neither baseline can leak into them. The only code change between the two runs is that the manifest's `command` now names a non-default `--out`.

**Line endings.** The pack loader hashes the bytes on disk. A Windows checkout with Git's `core.autocrlf` has CRLF line endings, so for the first baseline the loader reports `af0f7584…`, `7d882238…` and `61cfff38…` there, but the committed hashes above on Linux. The manifest's `source_sha256` converts CRLF to LF before hashing and therefore matches on every platform; `source_sha256_as_loaded` keeps what the loader saw on the generating machine. The hashes in the Mid-1 report's Appendix D are the Windows as-loaded values.

## The cases

| Case | How the student answers | Truth label | Units | Runs |
| --- | --- | --- | --- | --- |
| Deterministic holder (spec v2 6.1) | First option linked to the misconception when an item triggers it, otherwise correct; NONE always correct | the misconception, or NONE | all 7 | 41 (first baseline 43: MATH-1651 is no longer linked in U3 and MATH-734 left the catalogue) |
| Always-A | Option position A on every item | none named | all 7 | 7 |
| Partial MATH-2039 holder (KF-07) | Applies MATH-2039 only where MATH-1965 predicts the same option; otherwise correct | MATH-2039 | U2 | 1 |
| No misconception, slip 0.08 | Correct with probability 0.92; otherwise a uniformly chosen wrong option | NONE | all 7 | 1,400 |
| Random answering | Each of the four options with probability 1/4 | none named | all 7 | 1,400 |
| Intermittent holder (spec v2 6.3 generator) | On a triggering item, a uniformly chosen linked option with probability 0.5, 0.7 or 0.9; otherwise, and on every other item, the slip-0.08 student | the misconception | U1, U2 (every misconception) | 2,700 |

The generation slip (0.08) deliberately differs from the engine's assumed slip (0.10): the engine is not evaluated only on students built from its own assumptions.

## Change on 24 November 2026: distinct stems for the T2 conversion checks

Harris gave T2-005 to T2-010 and T2-019, which shared the stem "Which of these conversions is correct?", distinct stems. Options, links, targets and correct letters are unchanged. The seven items were one twin group, of which a session could ask only one; they are now seven independent items (U2: 25 groups instead of 19). Run by run against the 20 November record, with the same seeds:

- **Only U2 changed.** 1,010 of 5,549 runs asked different items, all in U2 (706 intermittent, 189 no-misconception, 113 random, 2 deterministic). 220 of them ended differently (151 intermittent, 67 random, 2 no-misconception). No run in U1 or U3–U7 changed.
- **No pooled figure changed:** random answering is labelled 626 / 1,400, no-misconception students are recognised 1,355 / 1,400 and wrongly labelled 12, always-A is labelled in the same six units after the same number of answers, and the partial MATH-2039 holder is still labelled MATH-1965 after T2-005 A, T2-001 C, T2-002 C. The two U2 deterministic students that took another path reach the same outcomes.
- **U2 intermittent holders** move within noise: correct labels 280 / 380 / 470 of 500 at apply rates 0.5 / 0.7 / 0.9 (272 / 387 / 472 before). MATH-2039 holders labelled MATH-1965: **21, 17 and 4** of 100 (22, 16 and 4 before). KF-07 is unchanged.

## Outcomes on the Maths_v2 candidate (current record)

Counts are from `adverse-baseline-candidate-2026-11-24/runs.csv`; where they differ from the 20 November run, it is only in U2, as listed above. With 200 runs per unit, a share near 50% has a 95% interval of roughly ±7 percentage points.

| Case | Candidate | First baseline | What changed |
| --- | --- | --- | --- |
| Deterministic students | 34 diagnosed, 7 none detected, 0 refused, 0 exhausted (41) | 26, 7, 8, 2 (43) | The new separating items (B19 in U4, B20 in U6, B21 in U7) and the removal of MATH-1651 from U3 and of MATH-734 from U5 end every pair that could never be separated; B17 and B18 give MATH-2359 (U6) and MATH-2093 (U4) enough trigger items. Every label names the student's own misconception. |
| Always-A | labelled in the same six units with the same labels; U1 after 6 answers, U7 after 4 | U1 after 5, U7 after 3 | **Not fixed.** The KF-03 problem is unchanged. |
| Partial MATH-2039 holder | MATH-1965 after T2-005 A, T2-001 C, T2-002 C | same | **Not fixed** (KF-07): every MATH-1965 option is still a MATH-2039 option. |
| Random answering, labelled | **626 / 1,400 (44.7%)** | 531 / 1,400 (37.9%) | **Worse.** See below. |
| No misconception, none detected | 1,355 / 1,400 (96.8%) | 1,315 (93.9%) | Fewer refusals and exhaustions (33, from 71). |
| No misconception, wrongly labelled | 12 (0.9%) | 14 (1.0%) | About the same. |
| Intermittent MATH-2039 holders labelled MATH-1965 | 21, 17, 4 of 100 at rates 0.5, 0.7, 0.9 | 22, 17, 4 | **Not fixed** (KF-07). |

**Why random answering is labelled more often.** The candidate has fewer linked wrong options (296 of 399, 74.2%, against 286 of 351, 81.5%), but its separating items remove the ties in which random sessions used to end: refusals with no separator fall from 123 to 19 of the 1,400 random sessions. A session that would have been refused now continues and, after more linked answers, is labelled. The new labels go to the hypotheses that the new items separate (U4: MATH-1514 25 and MATH-1773 14; U6: MATH-1074 29). The content change therefore makes the supervisor's adverse case (item 2) worse at the default `min_support = 2`. I2-A04 measured on the first content that `min_support = 3` roughly halves random-answer labels; the tuning rerun on this candidate (I2-A05) measures it again.

### Always-A (no named truth)

| Unit | Outcome | Label | Questions |
| --- | --- | --- | --- |
| U1 | diagnosed | MATH-2392 | 6 |
| U2 | diagnosed | MATH-61 | 4 |
| U3 | exhausted | — | 8 |
| U4 | diagnosed | MATH-1416 | 4 |
| U5 | diagnosed | MATH-952 | 4 |
| U6 | diagnosed | MATH-161 | 2 |
| U7 | diagnosed | MATH-2271 | 4 |

### Random answering (no named truth)

| Unit | Labelled with a misconception | None detected | Refused or exhausted | Most frequent labels |
| --- | --- | --- | --- | --- |
| U1 | 99 / 200 (49.5%) | 17 (8.5%) | 84 (42.0%) | MATH-1248 41, MATH-2392 35 |
| U2 | 98 / 200 (49.0%) | 4 (2.0%) | 98 (49.0%) | MATH-2039 32, MATH-658 24 |
| U3 | 72 / 200 (36.0%) | 18 (9.0%) | 110 (55.0%) | MATH-2206 37, MATH-2359 22 |
| U4 | 78 / 200 (39.0%) | 10 (5.0%) | 112 (56.0%) | MATH-1514 25, MATH-228 21 |
| U5 | 96 / 200 (48.0%) | 15 (7.5%) | 89 (44.5%) | MATH-1072 51, MATH-952 23 |
| U6 | 91 / 200 (45.5%) | 5 (2.5%) | 104 (52.0%) | MATH-767 30, MATH-1074 29 |
| U7 | 92 / 200 (46.0%) | 0 (0.0%) | 108 (54.0%) | MATH-2359 33, MATH-2093 22 |
| All | **626 / 1,400 (44.7%)** | 73 (5.2%) | 701 (50.1%) | |

### No misconception, slip 0.08

| Unit | None detected | Wrongly labelled with a misconception | Refused or exhausted |
| --- | --- | --- | --- |
| U1 | 200 / 200 | 0 | 0 |
| U2 | 198 / 200 | 1 | 1 |
| U3 | 195 / 200 | 3 | 2 |
| U4 | 195 / 200 | 1 | 4 |
| U5 | 199 / 200 | 1 | 0 |
| U6 | 190 / 200 | 3 | 7 |
| U7 | 178 / 200 | 3 | 19 |
| All | 1,355 / 1,400 (96.8%) | **12 (0.9%)** | 33 (2.4%) |

U7 is the exception: 16 of its 19 are exhaustions (4 before), so a U7 student with no misconception now more often runs out of the 8 questions before three correct answers and a high enough NONE probability back a decision.

### Intermittent holders (U1 and U2)

| Unit, apply rate | Correct label | Wrong label | Missed (none detected) | Refused or exhausted |
| --- | --- | --- | --- | --- |
| U1, 0.5 | 216 / 400 (54.0%) | 1 (0.2%) | 164 (41.0%) | 19 (4.8%) |
| U1, 0.7 | 339 / 400 (84.8%) | 0 | 56 (14.0%) | 5 (1.2%) |
| U1, 0.9 | 390 / 400 (97.5%) | 0 | 10 (2.5%) | 0 |
| U2, 0.5 | 280 / 500 (56.0%) | 21 (4.2%) | 187 (37.4%) | 12 (2.4%) |
| U2, 0.7 | 380 / 500 (76.0%) | 17 (3.4%) | 97 (19.4%) | 6 (1.2%) |
| U2, 0.9 | 470 / 500 (94.0%) | 4 (0.8%) | 24 (4.8%) | 2 (0.4%) |

Every U2 wrong label is a MATH-2039 holder labelled MATH-1965. U1 has one wrong label, a MATH-1379 holder at rate 0.5 labelled MATH-2392 (none before). At rate 0.5, 18–56% of holders end as none detected, depending on the misconception (KF-12).

## First baseline outcomes (117-item bank, kept for comparison)

Counts are from the frozen `adverse-baseline/runs.csv`. With 200 runs per unit, a share near 50% has a 95% interval of roughly ±7 percentage points; formal intervals and metric definitions come with I2-A09.

### Deterministic students (43)

26 diagnosed, 7 none detected, 8 refused with no separator (the inseparable pairs MATH-1514/1773 and MATH-1074/1651, KF-06), 2 exhausted (KF-04). No diagnosis names a misconception other than the student's. This reproduces the report's Table 7.2, whose raw file was not in the repository.

### Always-A (no named truth)

| Unit | Outcome | Label | Questions |
| --- | --- | --- | --- |
| U1 | diagnosed | MATH-2392 | 5 |
| U2 | diagnosed | MATH-61 | 4 |
| U3 | exhausted | — | 8 |
| U4 | diagnosed | MATH-1416 | 4 |
| U5 | diagnosed | MATH-952 | 4 |
| U6 | diagnosed | MATH-161 | 2 |
| U7 | diagnosed | MATH-2271 | 3 |

A response pattern with no misconception behind it receives a confident label in six of seven units (KF-03).

### Partial MATH-2039 holder

Diagnosed **MATH-1965** after three answers (T2-005 A, T2-001 C, T2-002 C). Every MATH-1965 option is also a MATH-2039 option, so a 2039 holder who answers the 2039-only items correctly looks like a 1965 holder (KF-07). The truth is not recovered.

### Random answering (no named truth)

| Unit | Labelled with a misconception | None detected | Refused or exhausted | Most frequent labels |
| --- | --- | --- | --- | --- |
| U1 | 93 / 200 (46.5%) | 20 (10.0%) | 87 (43.5%) | MATH-2392 40, MATH-1248 36 |
| U2 | 107 / 200 (53.5%) | 3 (1.5%) | 90 (45.0%) | MATH-2039 37, MATH-1715 27 |
| U3 | 45 / 200 (22.5%) | 10 (5.0%) | 145 (72.5%) | MATH-2206 19, MATH-2359 14 |
| U4 | 41 / 200 (20.5%) | 9 (4.5%) | 150 (75.0%) | MATH-228 23, MATH-126 12 |
| U5 | 97 / 200 (48.5%) | 11 (5.5%) | 92 (46.0%) | MATH-734 31, MATH-1072 28 |
| U6 | 59 / 200 (29.5%) | 5 (2.5%) | 136 (68.0%) | MATH-161 31, MATH-767 28 |
| U7 | 89 / 200 (44.5%) | 0 (0.0%) | 111 (55.5%) | MATH-2359 33, MATH-2093 22 |
| All | **531 / 1,400 (37.9%)** | 58 (4.1%) | 811 (57.9%) | |

Random answers often land on linked options (286 of the bank's 351 wrong options carry a link), and two such answers satisfy R1 at min_support 2. The spec's earlier figure (39.6% pooled) came from reference scripts that are not in the repository; these seeded counts replace it as the reproducible record.

### No misconception, slip 0.08

| Unit | None detected | Wrongly labelled with a misconception | Refused or exhausted |
| --- | --- | --- | --- |
| U1 | 198 / 200 | 2 | 0 |
| U2 | 198 / 200 | 2 | 0 |
| U3 | 191 / 200 | 5 | 4 |
| U4 | 178 / 200 | 0 | 22 |
| U5 | 200 / 200 | 0 | 0 |
| U6 | 175 / 200 | 2 | 23 |
| U7 | 175 / 200 | 3 | 22 |
| All | 1,315 / 1,400 (93.9%) | **14 (1.0%)** | 71 (5.1%) |

### Intermittent holders (U1 and U2)

Pooled over every misconception in the unit (100 runs per misconception and rate):

| Unit, apply rate | Correct label | Wrong label | Missed (none detected) | Refused or exhausted |
| --- | --- | --- | --- | --- |
| U1, 0.5 | 206 / 400 (51.5%) | 0 | 181 (45.2%) | 13 (3.2%) |
| U1, 0.7 | 339 / 400 (84.8%) | 0 | 57 (14.2%) | 4 (1.0%) |
| U1, 0.9 | 387 / 400 (96.8%) | 0 | 13 (3.2%) | 0 |
| U2, 0.5 | 274 / 500 (54.8%) | 25 (5.0%) | 192 (38.4%) | 9 (1.8%) |
| U2, 0.7 | 375 / 500 (75.0%) | 20 (4.0%) | 99 (19.8%) | 6 (1.2%) |
| U2, 0.9 | 469 / 500 (93.8%) | 7 (1.4%) | 24 (4.8%) | 0 |

- **MATH-2039 holders labelled MATH-1965:** 22, 17 and 4 of 100 runs at apply rates 0.5, 0.7 and 0.9. This is the KF-07 subset problem under noise, and it accounts for most of U2's wrong labels.
- **Missed diagnoses:** a holder who applies the misconception only part of the time answers correctly elsewhere, which is evidence for NONE (KF-12). At rate 0.5, 38–45% of holders end as none detected.

## What these cases do not establish

- No real student answered anything; every probability and threshold is assumed (KF-10).
- The question-selection comparison (adaptive, fixed, random with equal budgets), tuning/held-out separation and metric definitions are I2-A06 to I2-A09.
- No fix is claimed. Investigating causes and candidate content/model/policy changes, with their costs, is I2-A04.

## When content or parameters change

`tests/test_engine_adverse_cases.py` pins the content hashes, the default parameters, the always-A outcomes and the partial-holder label. A change to any of them fails with instructions. In the same pull request:

1. rerun `python -m experiments.adverse_baseline` with `--out` set to a new folder named after the content, so that the earlier frozen run is kept;
2. compare the new `summary.csv` with this record and explain every changed adverse outcome;
3. update this document and the pins.

Related known faults: KF-03, KF-04, KF-06, KF-07, KF-10 and KF-12 in `sonder_engine/KNOWN_FAULTS.md`.
