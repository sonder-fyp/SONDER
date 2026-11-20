# Evaluation plan for the remaining units U3–U7 (I2-A10)

**Owner:** Syed Ashher Majid · **Written:** 18 November 2026, before any U3–U7 comparison run · **Protocol:** [PROTOCOL.md](PROTOCOL.md) (version 1, including the 18 November amendment for tuning-only `params`)

The U1/U2 comparison (`results/u1u2-tuning`, [FINDINGS_TUNING.md](FINDINGS_TUNING.md)) is the bounded Iteration 2 evaluation. This plan fixes **in advance** how U3–U7 will be run and read, so their results cannot be shaped after seeing them. It changes no engine default and no content.

## 1. What each unit is, and what is already known about it

Counts come from the Maths_v2 loader (`sonder_pack.maths_v2.load_maths_v2`) on 18 November 2026. Faults are from `sonder_engine/KNOWN_FAULTS.md`.

| Unit | Topic | Items | Hypotheses (companions in *italics*) | Known limits that will show in results |
| --- | --- | --- | --- | --- |
| U3 | Percentage of an amount | 10 | MATH-2138, MATH-2206, *MATH-1074*, *MATH-1651*, *MATH-2359* | **KF-06:** 1074/1651 predict the same answers on every item, so they always end `escalated_no_separator` together. Only 10 items. |
| U4 | Choosing the operation | 16 | MATH-126, MATH-228, MATH-1416, MATH-1514, MATH-1773, *MATH-2093* | **KF-06:** 1514/1773 are inseparable. **KF-04:** 2093 has 1 trigger group (`escalated_exhausted`). **KF-08:** 2093/NONE separated by 1 item group. |
| U5 | Powers and roots | 10 | MATH-414, MATH-734, MATH-952, MATH-1072 | **KF-08:** 414/734 separated by only 3 item groups. Only 10 items. |
| U6 | Time and unit conversion | 14 | MATH-1074, MATH-161, MATH-767, MATH-1651, *MATH-2359* | **KF-06:** 1074/1651 are inseparable. **KF-04:** 2359 has 2 trigger groups. **KF-08:** 2359/NONE separated by 2. **KF-01/02:** three items skipped; MATH-1416 is not a U6 hypothesis. |
| U7 | Negatives, inverse operations, fraction bar | 16 | MATH-2359, MATH-1639, MATH-2093, MATH-2271, *MATH-1514*, *MATH-1715*, *MATH-1773* | **KF-04:** 1514 and 1773 have 1 trigger group each (`escalated_no_separator` with NONE). **KF-08:** 1514/NONE, 1773/NONE by 1; 2271/1514, 2271/1773, 1715/NONE by 4. |

The adverse baseline (`results/adverse-baseline`, [ADVERSE_CASES.md](ADVERSE_CASES.md)) already covers these units:
- **Always-A:** U3 exhausted; U4 diagnosed MATH-1416; U5 MATH-952; U6 MATH-161; U7 MATH-2271.
- **Random answering is labelled:** 22.5% (U3), 20.5% (U4), 48.5% (U5), 29.5% (U6) and 44.5% (U7) of 200 runs.

These numbers are the "before" picture that any content change has to improve on.

## 2. When the runs happen

| Run | When | Content | Why then |
| --- | --- | --- | --- |
| **U3–U7 tuning** (`configs/u3u7-tuning.json`) | After Harris's corrected questions are merged into `dev` (I2-H01–H06), before expert acceptance | The merged candidate content | To see the effect of the content corrections on every unit, and to pick nothing on the held-out seeds |
| **U3–U7 held-out** (`configs/u3u7-heldout.json`) | After expert acceptance (I2-H07–H08), with its file committed and hashed **before** the run | The accepted release | The reportable result, under protocol §5's freeze rule |
| **U1–U7 re-baseline of adverse cases** (`adverse_baseline.py`) | With each of the two runs above | Same as that run | Keeps the adverse picture next to the comparison |

If Harris's content does not reach `dev` before the FYP-I final deadline, the U3–U7 tuning run is made on the current content, labelled **"pre-correction content"**, and no held-out U3–U7 result is reported.

## 3. Configuration (the same as U1/U2, by design)

- **Methods:** adaptive, fixed, random. **Seeds:** tuning 1000–1299, held-out 2000–2299 (protocol §5). 300 runs per case.
- **Cases (tuning):**
  - intermittent holders at apply rates 0.5/0.7/0.9 with careful-answer slip 0.08
  - NONE with slip 0.08
  - always-A, random answering, off-catalogue
  - **Held-out:** apply rates 0.6/0.8, slip 0.05, random answering and off-catalogue (protocol §5).
- **Partial holder:** the MATH-2039/1965 pair is U2-only. No U3–U7 partial-holder case is planned unless the content review names a subset pair in these units.
- **Parameters:** defaults (θ 0.80, `min_support` 2). The I2-A04 variants are **not** applied to U3–U7 unless they are first accepted on held-out U1/U2 data with team agreement.
- **Outputs:** `results/u3u7-tuning/` and `results/u3u7-heldout/`, each with `runs.csv`, `manifest.json`, `metrics.csv` and figures from `plot.py`.

## 4. How the results will be read (decided now)

1. **Report per unit, never pooled across units.** Units differ in size and known faults; pooling would hide them.
2. **Known-cause refusals are reported as such, not as misses.**
   - A KF-06 student ending `escalated_no_separator` naming both members of the pair is the **correct refusal**. It is counted under refusals with cause R4 and marked "known inseparable pair".
   - A KF-04 companion ending `escalated_exhausted` is counted the same way, marked "known: too few trigger groups".
   - Neither is ever counted as a correct diagnosis.
3. **Correct coverage is reported twice.** Once over all truth cases, and once excluding the KF-04/KF-06 cases above. Both carry their denominators, so the effect of the known limits is visible rather than hidden.
4. **U3 and U5 have only 10 items.** With a budget of 8, adaptive and fixed selection share most items. Small differences between methods in these units are expected and are not evidence for or against adaptive selection.
5. **Adverse labelling** (always-A, random, off-catalogue) is reported per unit next to the baseline in §1. A content change "helps" only if it lowers adverse labelling without lowering correct coverage beyond the intervals.
6. **No claim of accuracy on real students.** These are synthetic students under assumed parameters (KF-10), as for U1/U2.

## 5. What would make me rerun

- Any merged change to `data/Maths_v2` (the content hash in the manifest changes). The tuning run is repeated; a held-out run already made stays reported with its own hash.
- A catalogue decision on KF-06 (merging 1514/1773 or 1074/1651, spec D-1). This changes the unit tables, so both configurations get a new name and a new run.
- Reviewed link grades (KF-09, I2-H04).
- Any engine change that alters behaviour (`verify_session` or the adverse tests would show it).

## 6. Deliverables

- `configs/u3u7-tuning.json` and `configs/u3u7-heldout.json`, committed before their runs (the held-out file also hashed).
- `results/u3u7-tuning/` and `results/u3u7-heldout/`.
- `FINDINGS_U3_U7.md`: per-unit tables following §4, with figures, and a short statement per unit of what the content corrections changed.
- `REPRODUCTION.md` (Harris): an independent rerun of one frozen run (protocol §9).
