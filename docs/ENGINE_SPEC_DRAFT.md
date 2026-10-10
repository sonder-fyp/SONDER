# Sonder diagnostic engine: specification v2 (corrected, measured on the current Maths_v2 bank)

**Scope:** the deterministic diagnostic core: posterior, question selection, stopping/refusal, run loop, trace, engine API. No LLM, retrieval, verification loop, calibration job or generation.
**Status:** draft for team review. It replaces the earlier draft. That draft was written against an older snapshot of the bank (80 items) and is superseded wherever the two disagree.
**Data this spec was measured on:** `Maths_v2/bank/items.csv`, 117 items, 468 rows, all `status=approved` (batches B01–B08, B10–B16).
**Reference code:** `engine_reference/spec_v2_reference.py` (engine), `spec_v2_report.py` (every measurement below), `spec_v2_tuning.py` (threshold trade-off). Raw outputs are saved next to them as `spec_v2_report_output.txt` and `spec_v2_tuning_output.txt`.
**Owners (carried over from the draft):** **[Ashher]** priors, likelihoods, posterior update · **[Harris]** EIG selection, Q-matrix content · **[Ahmed]** run loop, stopping/refusal, trace, API, pack loader.
**Honesty rule:** the dataset is synthetic and no real-student response exists. Every probability and threshold is an **assumed** parameter. Simulated students test the machinery, not the truth about real students. Where I say "measured", it means measured on synthetic students.

---

## 0. What changed from the earlier draft

| # | Problem in the earlier draft | Correction in this spec |
|---|---|---|
| 1 | Described an 80-item bank with no T3/T7 and said no misconception links more than one option of an item | Measured on the real 117-item bank. T3 and T7 exist, and 3 items (T6-011B, T6-014B, T6-016B) link one misconception to 3 options (§1) |
| 2 | Sessions scoped to one topic; cross-topic items were excluded ("not a construct") | Sessions run on a **diagnostic unit**: a declared hypothesis set plus a declared item list. 114 of 117 items are placed. Crossing items are the point of the bank, not an exception (§2.1) |
| 3 | `K_MAX = 6` | A unit needs up to 7 hypotheses (T7). `K_MAX = 8` (§2.1) |
| 4 | No handling of A/B twin items (identical stems) | Twin groups: once one item of a group is asked, the others are ineligible for that session. 14 twin groups exist (§2.2) |
| 5 | Every link trusted fully; no way to express a stretch link | Optional per-link grade and weight (§3.3). `items.csv` has no such column yet, so this is a data task (§7) |
| 6 | Rule V11 "≤ 2 options per misconception per item" and P1 `guess < 0.5` | These conflict with the bank. With `guess = 0.30`, a 3-option predicted set makes each predicted option *less* likely than the unpredicted one (0.233 vs 0.300). P1 is generalised per predicted-set size (§3.1, §3.6) |
| 7 | Recommended keeping the inseparable catalogue pairs so the refusal demo works | Recommends merging them. Refusal is demonstrated with the pair as it exists today in §5, but a catalogue defect should not be the product demo (§7) |
| 8 | Stale dataset claims (item counts, B03 status, `952 in 6 items`) | Replaced by measured values (§1) |
| 9 | Hypotheses with too few trigger items were not flagged | New pack warning W3 and the measured list in §1.5 |
| 10 | Threshold trade-off not measured | §6.4 measures it. `min_support = 3` halves the random-clicker diagnosis rate |

Two bugs found while building the reference (fixed, so you do not repeat them): the support function must map hypothesis *indices* to names before testing `NONE`/`UNMODELLED`; and the first reference run showed every NONE student as `escalated_exhausted` for exactly that reason.

---

## 1. Dataset findings (measured on the current bank)

### 1.1 Structure
- 117 items × 4 options = 468 rows; all approved.
- Every item has exactly 4 options, exactly 1 correct, unique option texts, and no link on a correct option (pack rules V1–V4 pass; checked in code).
- Wrong options by number of linked misconceptions: **0 links: 65, 1 link: 237, 2 links: 48, 3 links: 1.** The single 3-link option is T7-003 A (`24`) → 2271 | 1514 | 1773.
- Options linked to the same misconception, per item: 1 option on 317 (item, misconception) pairs, 2 options on 5, **3 options on 3** (T6-011B, T6-014B, T6-016B, all MATH-1416).
- No item carries probabilities or response counts. Every parameter is assumed.

### 1.2 Labels, units and placement
`items.csv` uses 11 distinct topic labels. They map to 7 diagnostic units (§2.1):

| Unit | `items.csv` labels included | Items | k | Unlinked wrong options |
|---|---|---|---|---|
| U1 Rounding | T1 Rounding | 20 | 4 | 8 |
| U2 Conversion | T2 Fractions, decimals and percentage conversion | 25 | 5 | 10 |
| U3 Percentage of an amount | T3 Percentage of an amount | 10 | 5 | 3 |
| U4 Choosing the operation | T4 Choosing the operation; T5 cross-concept (operation version) | 16 | 6 | 10 |
| U5 Powers and roots | T5 Powers and roots | 10 | 4 | 4 |
| U6 Time and unit conversion | T6 (seconds and hours); T6 × multiplication/division; T6 × percentage / more / less than (time version) | 17 (12 after twin collapse) | 6 | 11 |
| U7 Negatives, inverse operations, fraction bar | T7 | 16 | 7 | 16 |
| **Placed** | | **114** | | **62** |
| Unplaced | T6 × percentage / more / less than (operation version): T6-019B, T6-020B, T6-021B | 3 | 8 | 3 |

The 3 unplaced items are the B-versions of the B15 time items. Their links span 8 misconceptions (126, 228, 1514, 1773, 1074, 1651, 2138, 2206) from three topics, so no unit with k ≤ 8 and enough items contains them. They stay in the bank as twin partners (which blocks T6-019A/020A/021A from being asked alongside them) but are not used in Mid-1 sessions. **Open decision D-4.**

Topic labels in `items.csv` differ from `topics.csv` (for example "T4 Choosing the operation" vs "…(worded problems)"), so the pack builder must map labels to unit IDs explicitly, never by string join.

### 1.3 Cross-topic items
26 items link at least one misconception from outside their own topic. Linked-topic pattern by batch: B08 (T4 ×5, T7 ×1), B11 (T2+T7 ×3, T4+T7 ×1), B12 (T2+T7 ×1), B13 (T3+T6+T7 ×4, T3+T7 ×2, T3+T6 ×1), B14 (T4 ×3, T7 ×2), B16 (T4 ×2, T3+T6 ×1). Under the earlier draft's V5 (links must lie inside the item's own topic) these would be rejected or excluded. Under units they are valid as long as every link lies inside the unit's hypothesis set (V5').

### 1.4 Separability (model of §3.1, over each unit's items)
- **Structurally inseparable** (TV ≤ 0.05 on every item in the unit): **1074/1651** (U3 over 10 items, U6 over 17) and **1514/1773** (U4 over 16, U7 over 16).
- **Weak:** MATH-414 / MATH-734 are separable by only **3 of 10** items in U5 (they share the same option on 5 items).
- **MATH-1965 is a subset of MATH-2039.** All 10 options linked to 1965 are also linked to 2039. They separate on 15 of 25 items, but only through *correct* answers on the 15 items where 2039 is linked and 1965 is not. Consequence in §6.3: noisy 2039 students are mislabelled 1965.
- **MATH-1379 / MATH-1988** are fully separable (20 of 20), though they are never linked to the same option, because an untriggered misconception predicts the correct answer (§3.1).
- Near-weak pairs: 2093 vs NONE (1 separating item in U4), 2359 vs NONE (2 in U6), 1416 vs NONE (3 in U6), 1514 vs NONE and 1773 vs NONE (1 each in U7).

### 1.5 Trigger items per misconception (twins collapsed; items where the misconception has at least one linked option)
This is the number of questions that can give evidence for the misconception. A session uses 2–5 of them, so a low number limits both diagnosis and the later verification loop.

| Count | Misconception (unit) |
|---|---|
| 1 | 2093 (U4), 1514 (U7), 1773 (U7) |
| 2 | 2359 (U6) |
| 3 | 1416 (U6) |
| 4 | 1715 (U7) |
| 5 | 1074, 1651 (U3 and U6), 1639 (U7), 2271 (U7) |
| 6 | 126 (U4), 1416 (U4), 2093 (U7), 2359 (U3) |
| 7 | 2138, 2359 (U7), 952 (U5) |
| 8–9 | 414, 734, 1072 (U5), 2206 (U3), 1988 (U1) |
| 10 | 61, 1965 (U2) |
| 11–13 | 1379 (U1), 228 (U4), 161, 767 (U6), 1514, 1773 (U4) |
| 15 | 658, 1715 (U2) |
| 20–25 | 1248, 2392 (U1: 20), 2039 (U2: 25) |

(Exact counts per unit are in `spec_v2_report_output.txt`.) Targets are different from trigger items: the "5 questions per misconception" target counts items *written for* a misconception, while the engine uses every item that links it. Misconceptions with fewer than 5 are the ones where verification will run out first.

---

## 2. Concepts

### 2.1 Diagnostic unit (replaces "topic" as the session scope)
A **unit** declares: an ordered hypothesis list `m_1 … m_k` (`1 ≤ k ≤ K_MAX = 8`) and the item IDs (or `items.csv` labels) that belong to it. Hypotheses are `ℋ = (m_1, …, m_k, NONE, UNMODELLED)`. The default is one unit per curriculum topic. A unit may add **companion misconceptions** from other topics so that crossing items stay usable (U3 adds 1074, 1651, 2359; U4 adds 2093; U6 adds 1416, 2359; U7 adds 1514, 1773, 1715).

Rule: an item may belong to a unit only if **every misconception linked on it is in that unit's hypothesis list** (V5'). An item may belong to more than one unit.

Unit definitions for the current bank are in `UNITS` in `spec_v2_reference.py`. They are a proposal built from the observed cross-links, not a catalogue change. Units with a companion that has fewer than 3 trigger items (§1.5) are flagged: the companion adds prior mass but can never be diagnosed in that unit. **Recommendation:** drop 2093 from U4, 2359 from U6, and 1514/1773 from U7 together with the items that need them, or accept that those hypotheses only produce `escalated_exhausted`. See D-5.

### 2.2 Twin groups
Items with identical stems are a **twin group** (14 groups: T5-005/011 … T5-010/016, T6-010/010B, 011/011B, 014/014B, 015/015B, 016/016B, T6-019A/019B, 020A/020B, 021A/021B). After one item of a group is asked, **all other items of the group are ineligible for that session**. Without this rule the same question can be asked twice in a row, and the second answer is not independent evidence. Twin groups are derived from stems at load time and checked for the A/B convention. Twins are also the natural inventory for verification: a diagnosed student can be re-checked with the twin.

### 2.3 Invariants
- A session runs on one unit of one frozen pack. All engine functions are pure (no I/O, clock or randomness). Same pack, parameters and answers → identical posteriors, selections and decisions.
- Every probability vector is float64 aligned with `ℋ`. Index `k` is NONE, index `k+1` is UNMODELLED.
- Eligible items = the unit's approved items, minus items already asked, minus twin partners of asked items.

---

## 3. The model

### 3.1 Likelihood
Each hypothesis predicts a set `P_h(i)` of options on item `i`:

```
P_h(i) = S_h(i)       if h is a misconception and S_h(i) ≠ ∅     (triggered)
       = {c_i}        if h is a misconception and S_h(i) = ∅      (not triggered: answers like NONE)
       = {c_i}        if h = NONE
       = all options  if h = UNMODELLED
```

With `slip` for sets equal to `{c_i}` and `guess` otherwise (`e`):
```
P(o | h, i) = (1 − e) / |P|            if o ∈ P
            = e / (4 − |P|)            otherwise
P(o | UNMODELLED, i) = 1/4
```
Rows sum to 1 and every entry is positive. Measured: this holds for every item of every unit (self-test).

Consequences already visible in the bank:
- A two-link option gives both misconceptions the same likelihood, so it cannot separate them. EIG naturally prefers other items.
- An unlinked wrong option gets only off-prediction mass from every catalogued hypothesis and 0.25 from UNMODELLED, so choosing it moves mass to UNMODELLED.
- **3-option predicted sets** (T6-011B/014B/016B): with `guess = 0.30` each predicted option gets 0.233 and the one unpredicted (correct) option gets 0.300. Picking a predicted option is still evidence for the misconception (a likelihood ratio of 7 against NONE) but the model no longer says a misconception holder prefers their option over the correct one. This is the mathematical reason for a "≤ 2 options" rule. Decision D-2.

### 3.2 Prior and update
`p0(NONE) = 0.25`, `p0(UNMODELLED) = 0.05`, the rest split equally. Bayes update with the observed option; renormalise each step; zero evidence is a hard error. Posteriors are stored unrounded.

### 3.3 Link grades (new)
Not every link is equally trustworthy. The link audit rated about 90 linked options as STRETCH (a mistake that is plausible but not clearly the misconception), and `items.csv` stores no grade, so the engine currently treats them as full evidence.

**Proposal:** add a column `link_grade` to `items.csv`, pipe-separated in the same order as `misconceptions`, with `S` (sound) or `T` (stretch). Missing means all `S`. The engine uses a weight `w` per (option, misconception): `w_S = 1.0`, `w_T = 0.5` (assumed). For a hypothesis whose predicted set has links with weights, its likelihood row is

```
row_h = w · row_with_link + (1 − w) · row_as_NONE,       w = min weight over its linked options on that item
```

Rows still sum to 1. `w = 1` reproduces §3.1 exactly, which is how all results in this spec were measured. **The effect of `w_T` on random-clicker diagnosis is untested**, because the audit's stretch ratings are prose, not data. Producing the column is task T-1 in §7, and only the owner can approve it.

### 3.4 Selection
EIG in bits, in mutual-information form, `EIG(i) = Σ_h Σ_o p(h) P(o|h,i) log2( P(o|h,i) / P(o) )`. Candidates are the eligible items (§2.3). Highest EIG wins; EIG is rounded to 9 decimals before comparison; ties go to the earliest item in pack order. An item with zero EIG is a valid candidate, but R5 ends the session when the best EIG is below η.

`selection_reason` is generated from the computation (the pair of leading hypotheses whose rows differ most on the chosen item, the options each predicts, the EIG, and the runner-up item), as in the earlier draft.

### 3.5 Stopping and refusal
**Support** of a hypothesis set `G` = number of answered steps whose chosen option is *triggered* by some member of `G`: for a misconception its linked options, for NONE the correct option, for UNMODELLED the wrong options with no link.

**Separability:** hypotheses `a, b` are separable by item `i` iff `TV_i(a,b) = ½ Σ_o |P(o|a,i) − P(o|b,i)| > δ`.

Rules, in order, evaluated after each update:

| | Outcome | Fires when |
|---|---|---|
| R1 | `diagnosed` | leader `m*` among misconceptions has `p ≥ θ` and `support({m*}) ≥ min_support` |
| R2 | `none_detected` | `p(NONE) ≥ θ` and `support({NONE}) ≥ min_support_none` |
| R3 | `escalated_unmodelled` | `p(UNMODELLED) ≥ θ_U` and its support ≥ `min_support` |
| R4 | `escalated_no_separator` | `ℓ` = leader over misconceptions ∪ NONE; `R` = unused eligible items (not limited by the budget); `C` = hypotheses with `TV ≤ δ` to `ℓ` on every item of `R`. Fires iff `R ≠ ∅`, `|C| ≥ 2`, `p(C) ≥ θ`, `p(ℓ)/p(C) < θ` and `support(C) ≥ min_support` |
| R5 | `escalated_exhausted` | `answered ≥ budget`, or `R = ∅`, or the best EIG `< η` |
| — | `in_progress` | otherwise |

R4 has no "close to each other" test. If no remaining item separates the hypotheses in `C`, their ratios are frozen, `p(ℓ)/p(C)` is the best `ℓ` can ever reach, and when that is below θ the honest outcome is a refusal naming the tied set. Note that `R` here already excludes twin partners of asked items, which is how a hypothesis with a single trigger item becomes inseparable *in a particular session* (seen in U7 with 1514/1773, where `C` also contains NONE).

### 3.6 Parameters (all assumed)

| Parameter | Value | Note |
|---|---|---|
| `slip` | 0.10 | P(answer outside the predicted set \| the state predicts the correct option) |
| `guess` | 0.30 | same, for states that predict wrong options. 0.30 means a holder applies the misconception about 70% of the time |
| `π_N`, `π_U` | 0.25, 0.05 | priors |
| `θ`, `θ_U` | 0.80, 0.50 | `θ + θ_U > 1` |
| `min_support`, `min_support_none` | 2, 3 | 2 follows the project rule "≥ 2 answers behind a diagnosis". **Recommendation D-3: raise to 3** (§6.4) |
| `δ` | 0.05 | separation threshold |
| `η` | 0.01 bits | EIG floor |
| `budget` | 8 | questions per session |
| `K_MAX` | 8 | |
| `w_S`, `w_T` | 1.0, 0.5 | link weights (§3.3) |

**Validation at load.** P1: `0 < slip < 0.5` and `0 < guess`, and for every (hypothesis, item) with predicted-set size `s`: `(1 − guess)/s > guess/(4 − s)`, i.e. `guess < (4 − s)/4`. That is `< 0.75, < 0.5, < 0.25` for `s = 1, 2, 3`. With `guess = 0.30` the 3 B14 items violate it. P2–P6 as in the earlier draft.

---

## 4. Pack format and rules

```json
{ "pack_format": 2, "content_version": "string", "subject": "mathematics",
  "units": [ { "unit_id": "U1", "name": "string",
      "hypotheses": [ { "misconception_id": "MATH-1248", "name": "string" } ],
      "items": [ { "item_id": "T1-001", "stem": "string", "twin_group": "string",
          "target_misconception_id": "string", "review_status": "approved",
          "options": [ { "option_id": "A", "text": "string", "is_correct": false,
              "links": [ { "misconception_id": "MATH-1379", "grade": "S" } ] } ] } ] } ] }
```

Authoring source is `items.csv` (one row per option; `misconceptions` split on `|`; proposed `link_grade` split the same way).

**Rules (hard, refuse to load):** V1 exactly 4 options · V2 exactly one correct · V3 unique `option_id` and `text` within an item · V4 the correct option has no links · **V5' every linked ID is in the unit's hypothesis list** · V6 unique item IDs, unique hypothesis IDs per unit · V7 `1 ≤ k ≤ 8` · V8 no duplicate ID within one option's links · V9 each unit has at least `budget` approved item groups (twins collapsed), otherwise warn · V10 supported `pack_format` · **V11 a misconception may link at most 3 options of one item, and the predicted-set size must satisfy P1.**

**Warnings (reported by `/engine/health`, never fatal):** W1 structurally inseparable pairs over the unit's items (currently 1074/1651 in U3 and U6, 1514/1773 in U4 and U7) · W2 weakly separable pairs (≤ 4 separating items; currently 414/734, 1514 and 1773 vs NONE in U7, 2093 vs NONE in U4, 2359 and 1416 vs NONE in U6) · **W3 a hypothesis with fewer than 3 trigger groups** (currently 2093 in U4, 2359 in U6, 1514/1773 in U7) · W4 items with two or more unlinked wrong options · W5 a misconception linked to 3 options of one item (currently 3 items) · W6 missing `link_grade`.

---

## 5. Worked examples (real runs on the current bank, default parameters)

### D1. U1 Rounding: MATH-1379 student who slips once → `diagnosed` in 4 answers
Hypotheses (1248, 1379, 1988, 2392, NONE, UNMODELLED); prior `(.175, .175, .175, .175, .25, .05)`, H = 2.4763 bits. The student slips (answers correctly) the first time an item triggers 1379, then picks the 1379 option when triggered.

| Step | Item, EIG (bits) | Answer | Posterior after (1248, 1379, 1988, 2392, NONE, UNM) |
|---|---|---|---|
| 0 | T1-005, 0.7887 | D `49,000` (correct; the slip) | .0391, .0391, .3520, .0391, .5028, .0279 |
| 1 | T1-006, 0.6472 | B `23,000` (correct) | .0073, .0655, .0655, .0073, .8416, .0130 |
| 2 | T1-007, 0.2232 | B `8,300` → 1379 | .0090, .5674, .0270, .0090, .3474, .0402 |
| 3 | T1-009, 0.5546 | A `15,000` → 1379 | .0021, **.9423**, .0021, .0021, .0275, .0238 |

After step 1, `p(NONE) = .8416 ≥ θ` but its support is 2 < 3, so R2 is blocked; with a support requirement of 2 the session would end at step 1 as `none_detected`, a false negative for a student who does hold 1379. After step 3, R1 fires (`p = .9423`, support 2). This table equals the earlier draft's D1 on the same items, which is a useful cross-check that the T1 model is unchanged.

### D2. U4: MATH-1514 student → `escalated_no_separator`
U4 hypotheses (126, 228, 1416, 1514, 1773, 2093, NONE, UNM). The student always picks the option linked to 1514, which is also linked to 1773.

| Step | Item, EIG | Answer | Posterior (126, 228, 1416, 1514, 1773, 2093, NONE, UNM) |
|---|---|---|---|
| 0 | T4-001, 0.7517 | D `Rs 27` | .0181, .0542, .0542, .3794, .3794, .0181, .0387, .0581 |
| 1 | T5-011, 0.3668 | A `39` | .0011, .0033, .0033, **.4813**, **.4813**, .0011, .0023, .0263 |

`C = {1514, 1773}` (identical rows on every remaining U4 item), `p(C) = .9626 ≥ .80`, ceiling `p(ℓ)/p(C) = .5 < .80`, support 2 → refusal naming both. The teacher gets both candidates. Note the same refusal occurs in U7, where `C` also contains NONE for 1514/1773 students because only one U7 item triggers them.

---

## 6. Measured behaviour (synthetic students, default parameters)

### 6.1 Deterministic students (always apply the misconception when triggered, never slip)
Across the 7 units there are 44 students (every unit hypothesis plus NONE).

| Result | Count | Which |
|---|---|---|
| Diagnosed correctly | 27 | all misconceptions in U1, U2, U5; 2138, 2206, 2359 in U3; 126, 228, 1416 in U4; 161, 767, 1416 in U6; 1639, 2093, 2271, 2359, 1715 in U7 |
| `none_detected` (NONE student) | 7 | every unit |
| `escalated_no_separator` | 8 | 1074 and 1651 in U3 and U6; 1514 and 1773 in U4 and U7 |
| `escalated_exhausted` | 2 | 2093 in U4 and 2359 in U6 (too few trigger items) |
| Diagnosed as a different misconception | 0 | |

Decisions take 2–5 answers; no deterministic student needs more than 5.

### 6.2 Sensitivity (each float parameter × 0.8 and × 1.2)
16 variants × 44 students = 704 runs. **6 outcome changes**, all from `θ`: at θ = 0.64, 1416 in U6 moves from `diagnosed` to `none_detected`; at θ = 0.96, five students (NONE in U4, U6, U7; 2093 in U4; 2359 in U6) move to `escalated_no_separator`. No other parameter changed any outcome. The earlier draft's claim of "all variants pass" does not hold on the full bank. This is a finding about `θ`'s range, not about the others.

### 6.3 Noisy students (apply the misconception 50%, 70% or 90% of the time when triggered, 8% slip elsewhere; generation parameters differ from the engine's)
Per-unit share of runs (720–1,260 runs each):

| Unit | Correct diagnosis | `none_detected` (missed) | Refusal naming the true misconception | Refusal not naming it | Exhausted | Wrong diagnosis |
|---|---|---|---|---|---|---|
| U1 | 79.3% | 18.6% | 0 | 0 | 2.1% | 0 |
| U2 | 74.3% | 21.6% | 0 | 0 | 0.4% | 3.7% |
| U3 | 44.0% | 20.3% | 34.7% | 0.1% | 0.9% | 0 |
| U4 | 34.7% | 23.6% | 26.9% | 1.5% | 13.0% | 0.4% |
| U5 | 81.5% | 17.1% | 0.3% | 0 | 1.1% | 0 |
| U6 | 37.2% | 16.8% | 30.0% | 2.3% | 13.2% | 0.5% |
| U7 | 48.7% | 21.7% | 22.0% | 4.8% | 1.9% | 1.0% |

- The 17–24% "missed" share is expected: a student who applies the misconception only half the time looks like NONE on the items where they answer correctly. It is the price of the multi-answer evidence rule, not a bug.
- **U2's 3.7% wrong diagnoses are almost all MATH-2039 students labelled MATH-1965** (29 of 33 wrong diagnoses). That is the subset problem in §1.4: when a 2039 student gets 2039-only items right, the evidence favours 1965.
- U3, U4 and U6 lose roughly 27–35% of these students to refusals because of 1074/1651 and 1514/1773.

### 6.4 Students with no misconception and random clickers
Share of 300–400 runs per unit; "random" picks uniformly among the four options on every item.

| Unit | NONE student → `none_detected` | NONE student → `diagnosed` (false) | Random clicker → `diagnosed` |
|---|---|---|---|
| U1 | 99.3% | 0.3% | 55.2% |
| U2 | 98.5% | 1.5% | 55.5% |
| U3 | 96.5% | 1.5% | 22.0% |
| U4 | 91.0% | 0.0% | 21.5% |
| U5 | 99.3% | 0.0% | 56.0% |
| U6 | 82.3% | 0.7% | 32.3% |
| U7 | 88.0% | 1.8% | 48.0% |

A student who always picks "A" is diagnosed in U1 (2392), U2 (61), U4 (1416), U5 (952), U6 (161) and U7 (2271) in 2–5 answers. This is the reviewer's "24–55% of random clickers get diagnosed" problem and it is real: random answers land on linked options often because 286 of the 351 wrong options (81.5%) carry at least one link. It is a property of the data plus the evidence rule, not a bug.

Threshold trade-off (pooled over all 7 units; 300 random clickers and 300 NONE students per unit; "deterministic" counts the 37 misconception students, without NONE):

| Setting | Random clicker diagnosed | NONE student wrongly diagnosed | Deterministic students correct | Noisy students correct | Noisy students wrong |
|---|---|---|---|---|---|
| default (`min_support` 2, θ .80) | 39.6% | 0.8% | 27 / 37 | 53.8% | 0.7% |
| `min_support` 3 | **18.3%** | 0.3% | 27 / 37 | 51.1% | 0.2% |
| θ 0.90 | 26.9% | 0.7% | 27 / 37 | 54.5% | 0.4% |
| `min_support` 3 + θ 0.90 | 13.7% | 0.2% | 27 / 37 | 52.3% | 0.3% |
| `min_support` 3 + θ 0.90 + budget 10 | 16.0% | 0.0% | 27 / 37 | 53.7% | 0.3% |

Raising `min_support` to 3 halves random-clicker diagnoses and costs about 2.7 percentage points of correct diagnoses on noisy students. Raising θ alone helps less. `min_support = 3` departs from the project's stated "≥ 2 answers" rule, so it needs a team decision (D-3). The `none_detected` share for NONE students falls when θ rises (88.4% at θ 0.90, from 94.5%).

---

## 7. Decisions and tasks for the team

| # | Item | Recommendation |
|---|---|---|
| D-1 | Merge the inseparable catalogue pairs 1514/1773 and 1074/1651; redefine or merge 1965/2039; add separating items for 414/734 | **Merge** 1514/1773 and 1074/1651 now. For 1965/2039, redefine 1965 so it has at least one option that 2039 does not also take, or merge. Do this in the catalogue, not the engine. Needs the owner's approval; I have not changed the catalogue or `items.csv`. |
| D-2 | The 3 items with 3 options linked to MATH-1416 (T6-011B/014B/016B) | Either rework each so one of the three options is unlinked or linked to a different sound misconception, or keep them and cap `guess` below 0.25 for them. The reworked sheets would be shown to you before anything enters the bank. |
| D-3 | `min_support` 2 or 3 | 3, from §6.4. It is a departure from the "≥ 2 answers" rule in the project docs, so it is the team's call. |
| D-4 | The 3 unplaced items (T6-019B/020B/021B) | Leave unplaced for Mid-1, or define a k = 8 unit with other items that fit. They currently block their A-twins only. |
| D-5 | Companions with fewer than 3 trigger items (2093 in U4, 2359 in U6, 1514/1773 in U7) | Drop them from those units, or write more items that trigger them. They cannot be diagnosed there. |
| D-6 | `θ` range | Fix `θ` at 0.80 and treat 0.64–0.96 as untested (§6.2). |
| T-1 | Add the `link_grade` column | Needs a pass over the roughly 90 stretch options listed in `Maths_v2/batches/reviews/LINK_AUDIT_SUMMARY.md` and the `linkaudit_*.txt` files. These are agent ratings, not the owner's, so the owner should confirm them. Until then the engine runs with all links at weight 1. |
| T-2 | More trigger items for misconceptions under 5 (§1.5) | Build B17 (T6-013B, T6-018B, possibly 012B), then a short batch for the 1-and-2-item misconceptions. Drafts first, nothing in the bank without approval. |
| T-3 | Human review evidence | The review files are AI-agent reports, explicitly labelled "not the owner's approval". For a Mid-1 "reviewed content" claim, a different human should review a sample and record name and date per batch. I cannot supply that. |

---

## 8. API, persistence and trace (carried over from the earlier draft, with substitutions)

The earlier draft's section on endpoints, step schema, errors, idempotency, Neon persistence and trace recovery is unchanged **except**: `topic_id` becomes `unit_id` everywhere; `hypotheses` is the unit's list; `K_MAX` is 8; `pack_format` is 2; the pack rules are those of §4; and outcome enum values are `in_progress | diagnosed | none_detected | escalated_no_separator | escalated_exhausted | escalated_unmodelled`. I did not re-verify that section against the database schema documents (`ARCHITECTURE_PLAN.md`, `DB_SCHEMA_PLAN.md`), which I have not seen. Treat the persistence design as the draft's decision, not as something confirmed here.

Endpoints: `POST /engine/sessions`, `POST /engine/sessions/{id}/answers`, `GET /engine/sessions/{id}/trace`, `GET /engine/health`. Answers are idempotent on `(session_id, step_index)`. Secrets (the Neon connection string) belong in GitHub secrets or a local `.env`, never in Git.

---

## 9. Reference code and how to reproduce

```
cd engine_reference
python spec_v2_reference.py ../Maths_v2/bank/items.csv          # self-test
python spec_v2_report.py     ../Maths_v2/bank/items.csv          # §1, §5, §6 numbers
python spec_v2_tuning.py     ../Maths_v2/bank/items.csv          # §6.4 trade-off table
```

The self-test checks that likelihood rows sum to 1 and are positive for every item of every unit, that V1–V4 hold, that V5' holds for all 7 units, that a NONE student is never diagnosed, and that no session asks two items of one twin group. There is **no pytest suite** yet. The synthetic-student numbers depend on random seeds and run counts, so expect small differences from the percentages above if you re-run with other seeds; the counts for the deterministic students and the worked examples do not depend on seeds.
