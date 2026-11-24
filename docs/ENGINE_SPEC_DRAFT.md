# Sonder diagnostic engine: specification v2 (corrected; measured on the Maths_v2 candidate)

**Scope:** the deterministic diagnostic core: posterior, question selection, stopping/refusal, run loop, trace, engine API. No LLM, retrieval, verification loop, calibration job or generation.
**Status:** draft for team review. It replaces the earlier draft. That draft was written against an older snapshot of the bank (80 items) and is superseded wherever the two disagree.
**Data this spec is measured on:** the Maths_v2 **candidate** of 20 November 2026 (Harris, PR #92): `bank/items.csv`, 133 items, 532 rows, all `status=approved`, batches B01–B08 and B10–B21, 27 misconceptions; LF SHA-256 `b168a664…ff73` (items) and `ebe0571b…20b0` (topics). It is **not externally reviewed** (I2-H07). Iteration 2 re-measured every section on it (24 November 2026, I2-A05/I2-D05); where the 117-item bank of the Mid-1 evaluation behaved differently, the section says so.
**Reference code:** the engine is `sonder_engine/`, the pack loader `sonder_pack/`, and every measurement is a test or a command in this repository (§9). The earlier reference scripts (`engine_reference/spec_v2_*.py`) were never committed; numbers that came only from them have been replaced by seeded, reproducible runs.
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
| 11 | (Amendment, November 2026, I2-A03.) R4 treated `p(ℓ)/p(C)` as a ceiling, which is true only for identical rows | R4 refuses only when the reachable share `ρ` over the answers left stays below θ (§3.5). Identical rows behave exactly as before |
| 12 | (Iteration 2, 24 November 2026.) Measurements came from uncommitted reference scripts on the 117-item bank | Every number is re-measured on the 133-item candidate by tests and seeded runs in the repository (§1, §5, §6, §9). The inseparable pairs, the 3-link items and the under-triggered companions of the 117-item bank are gone; the 1965/2039 subset, always-A labelling and random-answer labelling remain |

Two bugs found while building the reference (fixed, so you do not repeat them): the support function must map hypothesis *indices* to names before testing `NONE`/`UNMODELLED`; and the first reference run showed every NONE student as `escalated_exhausted` for exactly that reason.

---

## 1. Dataset findings (measured on the candidate)

### 1.1 Structure
- 133 items × 4 options = 532 rows; all approved. The 20 approved batch files equal the bank cell by cell (`python -m validation.content_recheck`).
- Every item has exactly 4 options, exactly 1 correct, unique option texts, and no link on a correct option (V1–V4; `python -m validation.math_dataset`: 0 structural errors, 0 P1 conflicts).
- Wrong options by number of linked misconceptions: **0 links: 103, 1 link: 258, 2 links: 37, 3 links: 1** (T7-003 A, `24` → 2271 | 1514 | 1773). 296 of 399 wrong options (74.2%) carry a link.
- Options linked to the same misconception, per item: 1 option on 325 (item, misconception) pairs, 2 options on 5, **3 options on none**. (117-item bank: 317, 5 and 3; the three were T6-011B, T6-014B, T6-016B, which now link MATH-1416 on one option each.)
- No item carries probabilities or response counts. Every parameter is assumed.

### 1.2 Labels, units and placement
`items.csv` uses 11 topic labels. They map to 7 diagnostic units (`sonder_pack/maths_v2_units.json`):

| Unit | `items.csv` labels included | Items (twin groups) | k | Unlinked wrong options |
|---|---|---|---|---|
| U1 Rounding | T1 Rounding | 20 (20) | 4 | 5 |
| U2 Conversion | T2 Fractions, decimals and percentage conversion | 25 (19) | 5 | 14 |
| U3 Percentage of an amount | T3 Percentage of an amount | 10 (10) | 4 | 5 |
| U4 Choosing the operation | T4 Choosing the operation; T5 cross-concept (operation version) | 21 (21) | 6 | 20 |
| U5 Powers and roots | T5 Powers and roots | 13 (13) | 3 | 7 |
| U6 Time and unit conversion | T6 (seconds and hours); T6 × multiplication/division; T6 × percentage / more / less than (time version) | 18 (14) after the D-2 skip | 5 | 19 |
| U7 Negatives, inverse operations, fraction bar | T7 | 20 (20) | 7 | 24 |
| Unplaced | T6 × percentage / more / less than (operation version): T6-019B, T6-020B, T6-021B | 3 | 8 | |

The hypothesis lists follow the links: U3 no longer has MATH-1651 (unlinked there on 20 November), U5 no longer has MATH-734 (removed from the catalogue), and U6 drops MATH-1416 under D-2 (§7). The 3 unplaced items link 8 misconceptions from three topics, so no unit with k ≤ 8 and enough items holds them (D-4). In U2 the seven conversion checks T2-005 to T2-010 and T2-019 share one stem and so form one twin group (25 items, 19 groups). Topic labels differ from `topics.csv`, so the pack builder maps labels to units explicitly, never by string join.

### 1.3 Cross-topic items
34 items link at least one misconception from outside their own topic (26 on the 117-item bank). Under units they are valid as long as every link lies inside the unit's hypothesis list (V5').

### 1.4 Separability (model of §3.1, over each unit's items, twins collapsed)
- **No structurally inseparable pair** (no W1). On the 117-item bank 1074/1651 (U3, U6) and 1514/1773 (U4, U7) were inseparable. B19 (T4-011, T4-012) and B21 (T7-017 to T7-020) separate 1514/1773, B20 (T6-022, T6-023) separates 1074/1651 in U6, and MATH-1651 is no longer in U3. MATH-414/734 no longer exists as a pair.
- **Weakly separable (W2, 4 or fewer separating groups):** 1074/NONE 3 (U3); 1514/1773 2 and 2093/NONE 4 (U4); 1074/1651 2 and 2359/NONE 4 (U6); 1514/1773 2, 1773/NONE 3 and 1715/NONE 4 (U7). A session that uses up a pair's separating items can still end in R4 (§3.5, §5 D3).
- **MATH-1965 is still a subset of MATH-2039.** Every option linked to 1965 is also linked to 2039, so the two separate only through correct answers on the 2039-only items. Consequence: a 2039 holder who answers those items correctly is labelled 1965 (KF-07, §6.3). The new separators create the same structure for two more pairs: every 1773 option is also a 1514 option, and every 1651 option is also a 1074 option. In the U3–U7 tuning run noisy 1514 holders are labelled 1773 and noisy 1074 holders 1651 (KF-16, `experiments/FINDINGS_U3_U7.md`).
- Every answer sequence of every unit was enumerated (`python -m experiments.enumerate_sequences`): R4 refusals occur in U2, U3, U4, U6 and U7 (1,285 sequences), none in U1 or U5, and every one is an exact-row refusal.

### 1.5 Trigger groups per misconception, per unit (twins collapsed)
The number of question groups in a unit that can give evidence for the misconception. A session uses 2–5 of them, so a low number limits both diagnosis and the later verification loop. Fewest per unit: U1 1988 (9), U2 1715 (5), U3 1074 (3), U4 2093 (4), U5 952 (10), U6 2359 (4), U7 1773 (3). No hypothesis has fewer than 3 (no W3; on the 117-item bank 2093 in U4, 2359 in U6 and 1514/1773 in U7 had 1–2). Bank-wide counts per misconception are in `data/Maths_v2/coverage.md`.

---

## 2. Concepts

### 2.1 Diagnostic unit (replaces "topic" as the session scope)
A **unit** declares: an ordered hypothesis list `m_1 … m_k` (`1 ≤ k ≤ K_MAX = 8`) and the item IDs (or `items.csv` labels) that belong to it. Hypotheses are `ℋ = (m_1, …, m_k, NONE, UNMODELLED)`. The default is one unit per curriculum topic. A unit may add **companion misconceptions** from other topics so that crossing items stay usable (on the candidate: U3 adds 1074 and 2359; U4 adds 2093; U6 adds 2359; U7 adds 1514, 1773 and 1715).

Rule: an item may belong to a unit only if **every misconception linked on it is in that unit's hypothesis list** (V5'). An item may belong to more than one unit.

Unit definitions are in `sonder_pack/maths_v2_units.json`, built from the observed cross-links, not a catalogue change. The loader flags a companion with fewer than 3 trigger groups (W3): it adds prior mass but can never be diagnosed in that unit. On the 117-item bank that was 2093 in U4, 2359 in U6 and 1514/1773 in U7 (D-5, kept by decision); the candidate's new items give every companion at least 3 trigger groups (§1.5), so D-5 is resolved.

### 2.2 Twin groups
Items with identical stems are a **twin group** (20 groups on the candidate: 19 A/B pairs, among them T5-005/011 … T5-010/016, T5-017/020 … T5-019/022, T6-010/010B … T6-016/016B and T6-019A/019B … 021A/021B, and one group of seven T2 conversion checks that share the stem "Which of these conversions is correct?"). After one item of a group is asked, **all other items of the group are ineligible for that session**. Without this rule the same question can be asked twice in a row, and the second answer is not independent evidence. Twin groups are derived from stems at load time and checked for the A/B convention. Twins are also the natural inventory for verification: a diagnosed student can be re-checked with the twin.

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
- **3-option predicted sets:** with `guess = 0.30` each predicted option would get 0.233 and the one unpredicted (correct) option 0.300. Picking a predicted option is still evidence for the misconception (a likelihood ratio of 7 against NONE), but the model would no longer say a holder prefers their option over the correct one. This is the mathematical reason for a "≤ 2 options" rule and P1. The 117-item bank had three such items (T6-011B/014B/016B, decision D-2); the candidate has none.

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
| R4 | `escalated_no_separator` | `ℓ` = leader over misconceptions ∪ NONE; `R` = unused eligible items (not limited by the budget); `C` = hypotheses with `TV ≤ δ` to `ℓ` on every item of `R`; `a` = answers left (`budget − answered`, at least 0); `ρ` = the highest share `p(c)/p(C)` any `c ∈ C` could reach within `a` answers on `R` (below). Fires iff `R ≠ ∅`, `|C| ≥ 2`, `p(C) ≥ θ`, `ρ < θ` and `support(C) ≥ min_support` |
| R5 | `escalated_exhausted` | `answered ≥ budget`, or `R = ∅`, or the best EIG `< η` |
| — | `in_progress` | otherwise |

R4 has no "close to each other" test. **Reachable share (amended for I2-A03, November 2026).** One answer `o` to item `i` multiplies the odds of `c` over another member `d` of `C` by `P(o|c,i)/P(o|d,i)`. For each pair, the odds can therefore grow by at most `G(c,d)` = the product of the `a` largest per-item values `max_o P(o|c,i)/P(o|d,i)` above 1 over `R`, counting at most one item per twin group (asking an item removes its twins). Then `ρ(c) = p(c) / (p(c) + Σ_{d ∈ C, d ≠ c} p(d)/G(c,d))` bounds `p(c)/p(C)` after any `a` further answers, and `ρ = max_c ρ(c)`. Since `p(c) ≤ p(c)/p(C)`, `ρ < θ` means no member of `C` can reach θ in this session under the model, which is what the refusal claims. Bounding each pair separately makes `ρ` an upper bound that need not be attainable, so R4 errs towards continuing, never towards refusing a reachable decision.

When the rows of `C` are identical on every item of `R` (exact rows), every ratio is 1, the posterior ratios inside `C` are frozen, and `ρ = p(ℓ)/p(C)` exactly; the rule is then the original one. Every R4 refusal in the current Maths_v2 bank at default parameters is of this kind (no pair has `0 < TV ≤ δ`), so the amendment changes no current outcome. The earlier text called `p(ℓ)/p(C)` "the best `ℓ` can ever reach"; that is true only for exact rows. With near rows (`0 < TV ≤ δ`) small ratios accumulate, and the old rule could refuse a session that would have reached a diagnosis (`tests/test_engine_r4_rows.py`; `sonder_engine/KNOWN_FAULTS.md` KF-15). R4 still ignores the budget when forming `C`: a pair whose only separating item can no longer be asked ends in R5, not R4.

Note that `R` here already excludes twin partners of asked items, which is how a hypothesis with a single trigger item becomes inseparable *in a particular session* (seen in U7 with 1514/1773, where `C` also contains NONE).

### 3.6 Parameters (all assumed)

| Parameter | Value | Note |
|---|---|---|
| `slip` | 0.10 | P(answer outside the predicted set \| the state predicts the correct option) |
| `guess` | 0.30 | same, for states that predict wrong options. 0.30 means a holder applies the misconception about 70% of the time |
| `π_N`, `π_U` | 0.25, 0.05 | priors |
| `θ`, `θ_U` | 0.80, 0.50 | `θ + θ_U > 1` |
| `min_support`, `min_support_none` | 2, 3 | 2 follows the project rule "≥ 2 answers behind a diagnosis". Measured alternatives in §6.4 (D-3) |
| `δ` | 0.05 | separation threshold |
| `η` | 0.01 bits | EIG floor |
| `budget` | 8 | questions per session |
| `K_MAX` | 8 | |
| `w_S`, `w_T` | 1.0, 0.5 | link weights (§3.3) |

**Validation at load.** P1: `0 < slip < 0.5` and `0 < guess`, and for every (hypothesis, item) with predicted-set size `s`: `(1 − guess)/s > guess/(4 − s)`, i.e. `guess < (4 − s)/4`. That is `< 0.75, < 0.5, < 0.25` for `s = 1, 2, 3`. With `guess = 0.30` no candidate item violates it (the three B14 items of the 117-item bank did). P2–P6 as in the earlier draft.

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

**Rules (hard, refuse to load):** V1 exactly 4 options · V2 exactly one correct · V3 unique `option_id` and `text` within an item · V4 the correct option has no links · **V5' every linked ID is in the unit's hypothesis list** · V6 unique item IDs, unique hypothesis IDs per unit · V7 `1 ≤ k ≤ 8` · V8 no duplicate ID within one option's links · V9 each unit has at least `budget` approved item groups (twins collapsed), otherwise refuse to load · V10 supported `pack_format` · **V11 a misconception may link at most 3 options of one item, and the predicted-set size must satisfy P1.**

**Warnings (reported by `/engine/health`, never fatal):** W1 structurally inseparable pairs over the unit's items (none on the candidate) · W2 weakly separable pairs (≤ 4 separating groups; the eight pairs of §1.4) · **W3 a hypothesis with fewer than 3 trigger groups** (none on the candidate) · W4 items with two or more unlinked wrong options (25 unit items on the candidate, most deliberate: an unlinked option is preferred to a stretch link; whether W4 stays a warning is an open team question, KF-13) · W5 a misconception linked to 3 options of one item (none) · W6 missing `link_grade`.

---

## 5. Worked examples (real runs on the current bank, default parameters)

### D1. U1 Rounding: MATH-1379 student who slips once → `diagnosed` in 4 answers
Hypotheses (1248, 1379, 1988, 2392, NONE, UNMODELLED); prior `(.175, .175, .175, .175, .25, .05)`, H = 2.4763 bits. The student slips (answers correctly) the first time an item triggers 1379, then picks the 1379 option when triggered.

| Step | Item, EIG (bits) | Answer | Posterior after (1248, 1379, 1988, 2392, NONE, UNM) |
|---|---|---|---|
| 0 | T1-001, 0.7887 | B `3,900` (correct; the slip) | .0391, .0391, .3520, .0391, .5028, .0279 |
| 1 | T1-006, 0.6472 | B `23,000` (correct) | .0073, .0655, .0655, .0073, .8416, .0130 |
| 2 | T1-005, 0.2232 | A `48,000` → 1379 | .0090, .5674, .0270, .0090, .3474, .0402 |
| 3 | T1-007, 0.5546 | B `8,300` → 1379 | .0021, **.9423**, .0021, .0021, .0275, .0238 |

After step 1, `p(NONE) = .8416 ≥ θ` but its support is 2 < 3, so R2 is blocked; with a support requirement of 2 the session would end at step 1 as `none_detected`, a false negative for a student who does hold 1379. After step 3, R1 fires (`p = .9423`, support 2).

*Change from the 117-item bank:* every EIG and posterior is identical; only the items differ (there: T1-005 D `49,000`, T1-006 B, T1-007 B, T1-009 A `15,000`). Harris's rewritten T1-001 has the same link pattern as T1-005 and comes first in pack order, so it wins the EIG tie. The earlier draft's D1 had the same numbers too, which is a useful cross-check that the T1 model is unchanged.

### D2. U4: MATH-1514 student → `diagnosed` in 2 answers (was `escalated_no_separator`)
U4 hypotheses (126, 228, 1416, 1514, 1773, 2093, NONE, UNM). The student always picks the option linked to 1514.

| Step | Item, EIG | Answer | Posterior (126, 228, 1416, 1514, 1773, 2093, NONE, UNM) |
|---|---|---|---|
| 0 | T4-001, 0.7517 | D `Rs 28` → 1514, 1773 | .0181, .0542, .0542, .3794, .3794, .0181, .0387, .0581 |
| 1 | T4-011, 0.5489 | C `59` → 1514 | .0020, .0060, .0060, **.8887**, .0423, .0020, .0043, .0486 |

The first answer is shared by 1514 and 1773, so they stay level. T4-011 ("What is 42 − 17?", B19) is a bare calculation: its "adds the two numbers" option is linked to 1514 alone, because a student who adds only in worded problems (1773) answers it correctly. R1 fires with `p = .8887` and support 2.

*Change from the 117-item bank:* there the second question was T5-011 A `39`, linked to both, and every remaining U4 item gave 1514 and 1773 identical rows, so the session was refused naming both (`p(C) = .9626`, `ρ = .5`). The same student is now diagnosed. A 1773 student is diagnosed too, after 3 answers (§6.1).

### D3. U6: a refusal that remains → `escalated_no_separator`
U6 hypotheses (1074, 161, 767, 1651, 2359, NONE, UNM); MATH-1416 is dropped under D-2. Scripted answers, not a deterministic student:

| Step | Item, EIG | Answer | Posterior (1074, 161, 767, 1651, 2359, NONE, UNM) |
|---|---|---|---|
| 0 | T6-010, 0.7799 | B `2 hours` (correct) | .0334, .0334, .0334, .0334, .3004, .5364, .0298 |
| 1 | T6-015B, 0.5046 | A `0.25 hours` → 2359 | .0046, .0046, .0046, .0046, .8759, .0745, .0310 |
| 2 | T6-012B, 0.2185 | C `3 hours` (correct) | .0233, .0233, .0233, .0233, .4892, .3744, .0433 |
| 3 | T6-013B, 0.5572 | B `300 minutes = 240 hours` (unlinked) | .0103, .0103, .0103, .0103, **.6493**, **.1656**, .1438 |

The items that separate 2359 from NONE, or their twins, have now been asked, so `C = {2359, NONE}` has identical rows on every remaining U6 item. `p(C) = .8150 ≥ .80`, `ρ = p(2359)/p(C) = .7967 < .80` and support 3 → refusal naming both. Enumerating every answer sequence of every unit on the candidate (24 November 2026) finds R4 refusals only of this kind: after the few separating items of a pair have been used (KF-08), never because a pair cannot be separated at all, and always with identical rows (`ρ` equals `p(ℓ)/p(C)`).

---

## 6. Measured behaviour (synthetic students, default parameters)

### 6.1 Deterministic students (always apply the misconception when triggered, never slip)

Measured on the candidate with the real run loop (`tests/test_engine_stopping.py`, `tests/test_engine_students.py`), U6 as decided under D-2. Across the 7 units there are 41 students (every unit hypothesis plus NONE): U3 no longer has MATH-1651 (unlinked there), U5 no longer has MATH-734 (removed from the catalogue) and U6 has no MATH-1416 (D-2).

| Result | Count | Which |
|---|---|---|
| Diagnosed correctly | 34 | every misconception in every unit |
| `none_detected` (NONE student) | 7 | every unit |
| `escalated_no_separator` | 0 | |
| `escalated_exhausted` | 0 | |
| Diagnosed as a different misconception | 0 | |

Decisions take 2–4 answers; no deterministic student needs more than 4 (U4 2093; U7 1639, 2271, 1514, 1773 and NONE).

*Change from the 117-item bank* (44 students in the spec, 43 after D-2): 26 diagnosed, 7 `none_detected`, 8 `escalated_no_separator` (1074 and 1651 in U3 and U6; 1514 and 1773 in U4 and U7) and 2 `escalated_exhausted` (2093 in U4 and 2359 in U6, too few trigger items), in 2–5 answers. The separating items of B19 (U4), B20 (U6) and B21 (U7), and the removal of MATH-1651 from U3, end the 8 refusals; the trigger items of B18 (U4, 2093) and B17 (U6, 2359) end the 2 exhaustions.

### 6.2 Sensitivity (each float parameter × 0.8 and × 1.2)
On the candidate, 16 variants × 41 students = 656 runs: **no outcome changes**. This says only that the deterministic students are robust to these variations; noisy and adverse students still depend on `θ` and `min_support` (I2-A04), so D-6 stands.

*Change from the 117-item bank:* 16 variants × 44 students = 704 runs gave **6 outcome changes**, all from `θ`: at θ = 0.64, 1416 in U6 moved from `diagnosed` to `none_detected`; at θ = 0.96, five students (NONE in U4, U6, U7; 2093 in U4; 2359 in U6) moved to `escalated_no_separator`. After D-2 the first of these no longer existed. No other parameter changed any outcome there either.

### 6.3 Noisy students (seeded and reproducible)
The earlier figures here came from uncommitted reference scripts. They are replaced by seeded runs in the repository, each generated at a clean commit with its manifest (`experiments/PROTOCOL.md`). A holder applies the misconception on a triggering item with probability 0.5, 0.7 or 0.9 and otherwise answers carefully (slip 0.08); generation parameters differ from the engine's.

Adaptive selection, candidate content, tuning split (`experiments/results/u1u2-tuning-candidate/`, 1,200 runs per cell in U1 and 1,500 in U2):

| Unit, apply rate | Correct label | Missed (`none_detected`) | Refused | Wrong label ÷ labelled |
|---|---|---|---|---|
| U1, 0.5 / 0.7 / 0.9 | 55.6% / 82.7% / 97.2% | 40.2% / 16.0% / 2.7% | 4.1% / 1.2% / 0.1% | 0.1% / 0.1% / 0.1% |
| U2, 0.5 / 0.7 / 0.9 | 50.5% / 76.0% / 92.3% | 39.9% / 18.3% / 5.6% | 4.3% / 1.5% / 0.1% | 9.6% / 5.2% / 2.1% |

- The missed share is expected: a holder who applies the misconception only part of the time looks like NONE on the items they answer correctly (KF-12). It is the price of the multi-answer evidence rule, not a bug.
- **U2's wrong labels are almost all MATH-2039 holders labelled MATH-1965** (165 of 172), the subset problem of §1.4.
- The selection comparison (adaptive, fixed, random with equal budgets) and the held-out result are in `experiments/FINDINGS_A05.md` and `experiments/FINDINGS_HELDOUT.md`. On this content the fixed order reaches the same correct coverage as adaptive selection in U2 with fewer wrong labels; adaptive selection asks 1.3–1.7 fewer questions.
- U3–U7 noisy holders are not yet measured with the protocol; the plan is `experiments/REMAINING_UNITS_PLAN.md`. The seven-unit adverse baseline (§6.4) covers them for adverse cases.

### 6.4 Students with no misconception, random answering and always-A (seeded)
All seven units, adverse baseline on the candidate (`experiments/results/adverse-baseline-candidate-2026-11-20/`, 200 runs per unit; details in `experiments/ADVERSE_CASES.md`):

| Unit | No misconception (slip 0.08) → `none_detected` | → wrongly labelled | Random answering → labelled | Always-A |
|---|---|---|---|---|
| U1 | 200/200 | 0 | 49.5% | MATH-2392 after 6 |
| U2 | 198/200 | 1 | 49.0% | MATH-61 after 4 |
| U3 | 195/200 | 3 | 36.0% | exhausted |
| U4 | 195/200 | 1 | 39.0% | MATH-1416 after 4 |
| U5 | 199/200 | 1 | 48.0% | MATH-952 after 4 |
| U6 | 190/200 | 3 | 45.5% | MATH-161 after 2 |
| U7 | 178/200 | 3 | 46.0% | MATH-2271 after 4 |
| All | 96.8% | 0.9% | **44.7%** (37.9% on the 117-item bank) | labelled in 6 of 7 units |

Random answers often land on linked options (296 of 399 wrong options carry a link), and two such answers satisfy R1 at `min_support = 2`. The candidate's separating items remove refusals that used to stop such sessions, which is why random-answer labelling rose overall even though fewer options are linked.

Threshold trade-off (U1/U2, adaptive selection, tuning split, candidate content; `experiments/FINDINGS_A05.md` §3):

| Setting | Random answering labelled (U1, U2) | U2 holders correct at apply 0.5 / 0.7 / 0.9 | U2 wrong ÷ labelled at 0.5 | Mean questions, U2 holders at 0.7 |
|---|---|---|---|---|
| default (`min_support` 2, θ .80) | 51.0%, 46.3% | 50.5 / 76.0 / 92.3% | 9.6% | 3.39 |
| `min_support` 3 | 33.7%, 17.3% | 44.3 / 74.4 / 92.1% | 5.3% | 4.95 |
| θ 0.90 | 39.3%, 33.0% | 55.0 / 85.3 / 97.5% | 8.7% | 4.05 |
| both | 25.0%, 12.0% | 46.7 / 80.6 / 95.9% | 6.8% | 5.47 |

`min_support = 3` gives the largest cut in random-answer labelling at the cost of more questions and refusals; θ 0.90 costs under one question and finds more U2 misconceptions. No setting stops always-A in U2 or the 1965/2039 confusion. The choice is D-3/D-6 (§7); nothing is changed by default.

---

## 7. Decisions and tasks for the team

| # | Item | Recommendation |
|---|---|---|
| D-1 | Inseparable catalogue pairs 1514/1773 and 1074/1651; 1965/2039; 414/734 | **Resolved by content for the pairs** (candidate, 20 November 2026): separating items B19–B21, MATH-1651 unlinked in U3, MATH-734 removed. **Open: 1965/2039** (KF-07): redefine 1965 so it has an option 2039 does not take, or merge. Catalogue owner Harris, with team approval. |
| D-2 | The 3 items with 3 options linked to MATH-1416 (T6-011B/014B/016B) | Decided 11 October 2026 (Ahmed): skip them for U6 and drop MATH-1416 there. **The content is now fixed** (each links MATH-1416 on one option and passes P1), so the skip and the drop can be removed; that is a unit-table change for Ahmed, after which U6 is re-measured (KF-01, KF-02). |
| D-3 | `min_support` 2 or 3 | Decided 11 October 2026 (Ahmed): keep 2. Measured on both contents (§6.4, `FINDINGS_A04.md`, `FINDINGS_A05.md`). Ashher's recommendation for the team: θ 0.90 if one change is made; `min_support` 3 if random-answer labelling is judged the main risk. A change needs a held-out confirmation on new seeds (protocol change log). |
| D-4 | The 3 unplaced items (T6-019B/020B/021B) | Decided (Ahmed): leave unplaced; documented as KF-05. Unchanged. |
| D-5 | Companions with fewer than 3 trigger items | **Resolved by content:** no hypothesis has fewer than 3 trigger groups on the candidate (§1.5). |
| D-6 | `θ` range | Keep θ at 0.80 until the team decides D-3; θ 0.90 is measured (§6.4). On the candidate no ×0.8/×1.2 parameter variation changes a deterministic student's outcome (§6.2). |
| T-1 | Add the `link_grade` column | Needs a pass over the roughly 90 stretch options listed in `Maths_v2/batches/reviews/LINK_AUDIT_SUMMARY.md` and the `linkaudit_*.txt` files. These are agent ratings, not the owner's, so the owner should confirm them. Until then the engine runs with all links at weight 1. |
| T-2 | More trigger items for misconceptions under 5 (§1.5) | **Done** in the candidate: B17 (T6-012B, T6-013B), B18 (T5-017 to T5-022), B19–B21 separators. |
| T-3 | Human review evidence | The batch review files are AI-agent reports, not approvals. Harris approved every item; Ashher's independent technical review of the candidate is `validation/reviews/I2_CONTENT_2026-11-24_ashher.md` (all 91 changed or new items solved). **External Maths-expert acceptance is still outstanding (I2-H07, gate G1).** |

---

## 8. API, persistence and trace (carried over from the earlier draft, with substitutions)

The earlier draft's section on endpoints, step schema, errors, idempotency, Neon persistence and trace recovery is unchanged **except**: `topic_id` becomes `unit_id` everywhere; `hypotheses` is the unit's list; `K_MAX` is 8; `pack_format` is 2; the pack rules are those of §4; and outcome enum values are `in_progress | diagnosed | none_detected | escalated_no_separator | escalated_exhausted | escalated_unmodelled`. I did not re-verify that section against the database schema documents (`ARCHITECTURE_PLAN.md`, `DB_SCHEMA_PLAN.md`), which I have not seen. Treat the persistence design as the draft's decision, not as something confirmed here.

Endpoints: `POST /engine/sessions`, `POST /engine/sessions/{id}/answers`, `GET /engine/sessions/{id}/trace`, `GET /engine/health`. Answers are idempotent on `(session_id, step_index)`. Secrets (the Neon connection string) belong in GitHub secrets or a local `.env`, never in Git.

---

## 9. How to reproduce

Every number in this spec comes from a test or a command in this repository (checked 24 November 2026):

| Section | Command |
|---|---|
| §1.1–§1.2, §1.4 W1–W3, §4 warnings | `python -m sonder_pack.maths_v2`; `python -m validation.math_dataset`; `python -m validation.content_recheck` |
| §1.4 R4 refusals | `python -m experiments.enumerate_sequences` |
| §3 likelihood, P1, exact arithmetic | `python -m unittest discover -s tests -p "test_bayes*.py"`, and `tests/test_selection.py` for EIG |
| §3.5 R4 reachable share | `tests/test_engine_r4_rows.py`, `tests/test_engine_stopping.py` |
| §5 D1, D2, D3 and §6.1–§6.2 | `tests/test_engine_stopping.py`, `tests/test_engine_students.py`, `tests/test_engine_r4_rows.py` |
| §6.3–§6.4 | `python -m experiments.adverse_baseline` (command and folder in `experiments/ADVERSE_CASES.md`); `python -m experiments.evaluate --config experiments/configs/<name>.json`; `python -m experiments.compare <runs>` |

The deterministic results (§5, §6.1, §6.2) do not depend on seeds. The seeded runs fix every seed in their configuration, record the generating commit, content hashes and parameters in `manifest.json`. A second run of the adverse baseline gave byte-identical files; the evaluation runner's reproducibility is tested in `tests/test_engine_eval*.py`.
