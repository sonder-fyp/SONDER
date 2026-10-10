# Sonder diagnostic engine: specification draft

**Scope:** the deterministic diagnostic core only (posterior, question selection, stopping/refusal, run loop, trace, engine API). No LLM, retrieval, verification loop, calibration job or generation.
**Status:** draft for team review. It replaces ENGINEERING.md §5.1–5.3 and §5.6 once agreed (section B is paste-ready).
**Persistence decision:** Neon PostgreSQL is selected for Mid-1 diagnostic sessions and evidence. The FastAPI service owns the Postgres storage adapter; the standalone `sonder_engine` package remains free of FastAPI, database, filesystem and network imports. This is a design decision, not a claim that deployment or integration is complete. See [ARCHITECTURE_PLAN.md](ARCHITECTURE_PLAN.md) and [DB_SCHEMA_PLAN.md](DB_SCHEMA_PLAN.md).
**Reference code:** [engine_ref/reference.py](engine_ref/reference.py), tests in [engine_ref/test_reference.py](engine_ref/test_reference.py). Every number in section D is asserted by those tests.
**Owners:** **[Ashher]** priors, likelihoods, posterior update · **[Harris]** EIG selection, Q-matrix content · **[Ahmed]** run loop, stopping/refusal, trace, API, pack loader.
**Honesty rule:** the dataset is synthetic and no real-student response exists. Every probability and threshold below is an **assumed** parameter. Nothing here is calibrated or learned, and simulated runs are not results with students.

---

## 0. Dataset findings (Maths_v2: `bank/items.csv`, `topics.csv`, `coverage.md`)

Verified with code (scratch scripts outside the repo, and `load_topic` in the reference code).

**Structure.** `items.csv` is in long format: 320 rows = 80 items × 4 options. Columns are as stated. All 320 rows have `status=approved`. Every item has exactly 4 options, exactly 1 correct option, unique option labels and unique option texts, and no link on a correct option. No misconception is linked to more than one option of the same item. There are no probabilities, response counts or any other student statistics, so all parameters must be assumed (your belief is correct).

**Topics in the bank** (`items.csv` labels):

| Label in items.csv | Items | k (linked misconceptions) | Wrong options: unlinked / two-link | Fits UI (k ≤ 4)? |
|---|---|---|---|---|
| T1 Rounding | 20 | 4: 1248, 1379, 1988, 2392 | 8 / 8 | yes |
| T2 Fractions, decimals and percentage conversion | 25 | 5: 61, 658, 1715, 1965, 2039 | 10 / 10 | no |
| T4 Choosing the operation | 10 | 5: 126, 228, 1416, 1514, 1773 | 0 / 10 | no |
| T5 Powers and roots | 10 | 4: 414, 734, 952, 1072 | 4 / 5 | yes |
| T5 cross-concept (operation version) | 6 | 7, **all from T4/T7** (126, 228, 1416, 1514, 1773, 2093, 2359) | 9 / 3 | no |
| T6 Time and unit conversion (seconds and hours) | 9 | 4: 161, 767, 1074, 1651 | 4 / 5 | yes |

T3 and T7 have no items in the bank. Your prompt omits T6, which also fits the 4-misconception limit, though it contains the 1074/1651 inseparable pair.

**How options map to misconceptions.** An option is linked to 0, 1 or 2 misconceptions. A two-link option (for example T1-001 A "3,900" → 1379|2392) means either misconception produces that answer. An unlinked wrong option means no catalogued misconception produces it. The `target` column is authoring metadata (the misconception the item was written for). The engine does not need it.

**Separability per pair.** I used the model in B.1, where a misconception with no link on an item predicts the correct answer. The table counts the items on which the two predicted option sets differ:

- **Inseparable (0 separating items):** MATH-1514/MATH-1773 (T4, all 10 items, and also the 3 cross-concept items where both appear) and MATH-1074/MATH-1651 (T6, all 9 items). Each pair gives the same answer on every item. No answer sequence can change the ratio of their posteriors.
- **Weakest separable pair:** T5 MATH-414/MATH-734 (3 items; they share an option on 5 items).
- **T1** (all pairs separable): 1248 vs any = 20; 1379–1988 = 20; 1379–2392 = 16; 1988–2392 = 16; 1379–NONE = 11; 1988–NONE = 9; 2392–NONE = 20. 1379 and 1988 are never linked on the same item. They are separable only because, when unlinked, each predicts the correct answer, so this semantics matters.
- **T4:** every pair except 1514/1773 is separated by 10 items. 126–NONE and 1416–NONE are separated by 5 each.

**Problems that would break or distort the engine.**
1. **Topic labels disagree between files.** `items.csv` has "T4 Choosing the operation" and "T6 Time and unit conversion (seconds and hours)", while `topics.csv` has "…(worded problems)" and "T6 Time and unit conversion". A join on the label silently drops T4 and T6, so the pack builder must map labels to topic IDs explicitly.
2. **"T5 cross-concept" is not a construct.** Its 6 items link only misconceptions from other topics (k=7), half their wrong options are unlinked, and they contain an inseparable pair. If merged into T5 by prefix, they would be items that trigger none of T5's misconceptions. **Exclude them from the Mid-1 pack.**
3. Two structurally inseparable pairs (above). They are handled by the no-separator rule (B.3). They are not data errors, but they are probably near-duplicate catalogue entries (see F2).
4. **Unlinked options that look catalogued.** 4 of T1's 8 unlinked options are "rounds too much" at a coarser degree: T1-001 D 4,000; T1-002 C 4,000; T1-003 D 10,000; T1-004 D 10,000. A 2392 student who picks one moves mass to UNMODELLED, not to 2392. This is a content review item for Harris, not an engine fault.
5. **Stale statements in `coverage.md` that `items.csv` contradicts:** "B05 (5 items) in review", although B05 is in the bank (T2 = 25 items); "B03 removed from bank pending re-approval", although B03 is in the bank; "952 in 6 items", although items.csv has 7; and the interim "bank = 55/71" counts (the bank has 80). `coverage.md` also contradicts itself on B03. `items.csv` is treated as authoritative.

**Engine treatment of unusual options** (formalised in B.1):
- **No link:** the option is predicted by no misconception. It receives only off-prediction mass from every catalogued hypothesis, and 1/4 from UNMODELLED, so choosing it is evidence for UNMODELLED. Two or three such answers (three under the default parameters) escalate as `escalated_unmodelled`.
- **Two links:** each linked misconception predicts the option in full. Evidence is shared, not split. The option cannot separate the two, so EIG naturally prefers other items to separate them.

---

## A. Decision table

| # | Decision | Options considered | Chosen | Why | Main risk |
|---|---|---|---|---|---|
| 1 | Likelihood family | §5.1 as written; one global noise ε; predicted-set model with two noise rates | Predicted-set model: each hypothesis predicts a set of options; `slip` and `guess` set the off-prediction mass | Rows sum to 1 by construction; covers every case in problem 1; keeps the `slip_guess_param` columns | `guess` no longer means "answers correctly by chance" (it is renamed in meaning, documented) |
| 2 | Misconception with no link on an item | Predicts the correct answer; uniform/abstain | Predicts the correct answer (behaves like NONE on that item) | A misconception that the item does not trigger is not exercised. This is the only reading under which 1379 and 1988 are separable | Puts an obligation on authors: a missing link must mean "not triggered", not "its answer was not offered" |
| 3 | Two-link option | Split mass between misconceptions; full mass to each | Full `(1−guess)/|S|` to each linked misconception | Each misconception independently produces that answer | None material |
| 4 | UNMODELLED likelihood | Near-uniform; exactly uniform | Exactly `1/n` | Maximum entropy, parameter-free, and it explains anything weakly | Off-catalogue errors that land on linked options are invisible (T1 has few unlinked options) |
| 5 | Prior | Uniform over all; fixed NONE/UNMODELLED mass | NONE 0.25, UNMODELLED 0.05, rest uniform | A check is not started only for students already known to be wrong; UNMODELLED starts small | Assumed values (sensitivity-tested) |
| 6 | Confidence vs "answers behind" | Either one alone; both | Both: `p ≥ θ` **and** support ≥ 2 (≥ 3 correct for `none_detected`) | One answer can push p past θ; support stops a single slip from becoming a diagnosis. Concluding "no misconception" from absent evidence needs more | One extra question in some sessions |
| 7 | No-separator test | §5.3 "top two within ε and no EIG > δ" | Exact **ceiling test** on the leader's inseparable class (no ε) | Posterior ratios inside an inseparable class are frozen, so the leader's ceiling is known exactly. The ε rule fires on the wrong cases and asks useless questions | Relies on `δ` to call near-identical rows "inseparable" once params vary per misconception |
| 8 | `diagnosis.top2` | Keep; co-diagnosis; runner-up record | Drop. Record `runner_up` + its p on every diagnosis | Two hypotheses cannot both exceed θ > 0.5 in a single-fault model | Real co-occurring misconceptions show as alternating evidence (see F3) |
| 9 | Inseparable catalogue pairs | Merge into one hypothesis; keep separate and refuse | Keep separate; flag at pack load; refuse early with the tied set | Honest to the catalogue; produces the refusal demo; the gap is logged for content | Every holder of such a pair escalates (intended) |
| 10 | EIG mechanics | — | Bits; mutual-information form; candidates = unused approved items in the topic; EIG rounded to 1e-9; ties → pack order | Deterministic and auditable; fp noise cannot reorder ties | Same first item for every student (item exposure) |
| 11 | Topics with k > 4 | Reject; split; widen UI | **Widen** the UI contract to `K_MAX = 6` misconceptions (8 keys) | The UI renders from `hypothesisLabels` generically; only `types.ts` and `assertPosterior.ts` hard-code six keys. T2 and T4 then run unmodified | Bar layout with 7–8 rows is unverified visually |
| 12 | Outcome enum | Keep PoC `none`; keep 4.2 list | One enum everywhere, adding `none_detected` | One name across engine, DB and UI avoids mapping bugs | Small UI rename |
| 13 | Mid-1 persistence | Neon Postgres; local file-based session storage | **Neon PostgreSQL**, through the FastAPI service's `PostgresStore`; frozen content/params loaded into memory for calculation | User-selected shared persistence for diagnostic sessions, teacher dashboards and class flows; no model service on the diagnostic path | Database/network availability is required for durable online progress; storage/trace contract fidelity and integration still need verification |
| 14 | Duplicate/retried answers | Reject; idempotent | Idempotent on `(session_id, step_index)` | Browser retries must not double-update | None |
| 15 | Numerics | Log-space; float64 linear | float64 linear with renormalisation every step; hard error on zero evidence | Likelihoods are ≥ 0.033 and sessions ≤ budget steps, so underflow cannot occur | None at this scale |
| 16 | `mode=broad` | Implement; defer | Rejected (`422 mode_unsupported`) | Undefined math (k would exceed K_MAX); not needed for Mid-1 | — |

---

## B. Rewritten ENGINEERING.md §5.1–5.3 and §5.6 (paste-ready)

> Paste from here to the end of B.6 over ENGINEERING.md §5.1–5.3 and §5.6. §5.4–5.5 are unchanged.

### 5.0 Notation and invariants (all owners)

- A **session** runs on one topic `T` of one content pack version. `T` declares an ordered list of misconceptions `m_1 … m_k` (`1 ≤ k ≤ K_MAX = 6`).
- **Hypotheses**, in this fixed order: `ℋ = (m_1, …, m_k, NONE, UNMODELLED)`, `|ℋ| = k + 2`. Every probability vector `p` is a float64 array aligned with `ℋ`. Index `k` is NONE and index `k+1` is UNMODELLED. API slot keys are `M1 … Mk, NONE, UNMODELLED`, and the session's `hypotheses` list maps each slot to its `misconception_id`.
- **Item** `i` has options `o ∈ {0…n−1}` (`n = 4`, in `option_id` order), one correct option `c_i`, and links `S_m(i) = {o : m ∈ links(o)}`. Pack rules guarantee `c_i ∉ S_m(i)` and `|S_m(i)| ≤ 2`.
- **Eligible items** for a session are the topic's items with `review_status = "approved"` that the session has not yet administered. The engine never re-asks an item within a session.
- All engine functions are **pure** (no I/O, clock or randomness). Given the same pack, params and answer sequence, every posterior, selection and decision is identical, so the trace is reproducible by replay.

### 5.1 Posterior update (Feature 1) — **[Owner: Ashher]**

**Predicted set.** Each hypothesis predicts a set of options on item `i`:

```
P_h(i) = S_m(i)          if h = m and S_m(i) ≠ ∅        (misconception triggered)
       = {c_i}           if h = m and S_m(i) = ∅        (not triggered: answers like NONE)
       = {c_i}           if h = NONE
       = all n options   if h = UNMODELLED
```

**Likelihood.** For `h ≠ UNMODELLED`, with off-prediction rate `ε_h(i) = slip` if `P_h(i) = {c_i}`, else `guess`:

```
P(o | h, i) = (1 − ε_h(i)) / |P_h(i)|          if o ∈ P_h(i)
            =       ε_h(i) / (n − |P_h(i)|)    otherwise
P(o | UNMODELLED, i) = 1/n
```

Each row sums to 1 by construction: `|P|·(1−ε)/|P| + (n−|P|)·ε/(n−|P|) = 1`. Every entry is strictly positive when `0 < slip, guess < 1`. The cases this must handle:

| Case | Behaviour |
|---|---|
| Misconception predicts one wrong option | That option `1−guess` (0.70); other 3 options `guess/3` (0.10) each, including the correct one |
| Several hypotheses share one option (two-link option) | Each gets `1−guess` on it; the option cannot discriminate between them |
| One misconception linked to two options of an item | `(1−guess)/2` each; other two options `guess/2` |
| Predicted option = correct option | Forbidden by pack rule V4 (rejected at load). Untriggered misconceptions and NONE predict `{c_i}` by definition |
| Misconception makes no prediction on the item | Same row as NONE: correct `1−slip` (0.90), each wrong option `slip/3` (0.0333) |
| NONE, correct answer | `1 − slip` |
| **NONE, wrong answer** (problem 2) | `slip/(n−1)` for each wrong option |
| UNMODELLED | `1/n` on every option |
| Observed option that no hypothesis predicts (unlinked) | Every catalogued hypothesis gives only its off-prediction mass (0.0333 or 0.10) and UNMODELLED gives 0.25, so mass flows to UNMODELLED |

`slip` and `guess` are read from `slip_guess_param` (global row; a per-misconception row overrides `guess` for that `m`). Semantics: **`slip` = P(answer outside the predicted set | the state predicts the correct option)** and **`guess` = P(answer outside the predicted set | the state predicts wrong option(s))**. Keep the column names. Classic DINA "guess" (answering correctly by chance) is the part of `guess` that lands on `c_i`. A single global pair is used until real responses exist.

**Prior.**

```
p0(NONE) = π_N = 0.25,  p0(UNMODELLED) = π_U = 0.05,  p0(m_j) = (1 − π_N − π_U)/k
```

**Update** (Bayes; observed option `o` on item `i`):

```
z     = Σ_h p(h) · P(o | h, i)
p'(h) = p(h) · P(o | h, i) / z
```

```python
def update_posterior(p: NDArray[float64], L: NDArray[float64], observed: int) -> NDArray[float64]:
    # p: shape (H,), sums to 1.  L: shape (H, n), rows sum to 1 (likelihood_matrix).  observed: option index.
    if not 0 <= observed < L.shape[1]: raise ValueError("invalid_option")
    joint = p * L[:, observed]
    z = joint.sum()
    if not isfinite(z) or z < 1e-300: raise FloatingPointError("zero_evidence")  # impossible with valid params
    return joint / z                                                            # sums to 1 within 1e-12
```

**Numerical rules.** float64 throughout. Renormalise once per step and apply no other correction. With valid params every `L > 0`, so `z ≥ min(L) > 0`. Zero evidence can only arise from a code or parameter defect: it is a hard error (`500 engine_numeric_error`), and the session is never "reset". Posteriors are stored and sent **unrounded** (JSON float with 17 significant digits, which round-trips exactly). Rounding is for display only. If the API rounded to 4 dp, `assertPosterior`'s 1e-6 sum check would fail.

### 5.2 Discriminator selection (Feature 2) — **[Owner: Harris]**

**Entropy and EIG** in **bits** (`log2`, `0·log 0 = 0`). EIG is computed in its mutual-information form, which is algebraically equal to `H(p) − Σ_o P(o)·H(p|o)` and numerically better behaved:

```
P(o)  = Σ_h p(h) · P(o | h, i)
EIG(i) = Σ_h Σ_o p(h) · P(o | h, i) · log2( P(o | h, i) / P(o) )      (≥ 0, ≤ H(p))
```

If floating-point gives `EIG < 0`, then values in `[−1e-12, 0)` are clamped to 0 and anything more negative raises `negative_eig` (a defect).

**Selection.**

```python
def select_next(p, candidates: Sequence[Item], hyps: Sequence[str], params) -> Selection | None:
    if not candidates: return None                       # caller passes [] when the budget is spent
    scored = [(round(EIG(p, likelihood_matrix(it)), 9), pack_position(it), it) for it in candidates]
    best = min(scored, key=lambda t: (-t[0], t[1]))      # highest EIG; ties → earliest in pack order
    return Selection(item_id, eig_bits, ranking=all (item_id, eig) best-first, reason=template(...))
```

- **Eligibility:** eligible items (5.0) while `answered < budget`, otherwise none.
- **Ties:** EIG is rounded to 9 decimals before comparison, then the earliest item in pack order wins (the pack lists items in `item_id` order). This is deterministic and logged: `ranking` holds every candidate's EIG.
- **Zero gain:** an item with EIG 0 is still a valid candidate, but `check_stop` (R5) ends the session when the **best** EIG is below `η = 0.01` bits. A question that cannot move the posterior is never asked.
- **All items used:** `select_next` returns `None` and R5 ends the session as `escalated_exhausted`.

**`selection_reason`** (teacher-facing, generated only from the computation):

1. Rank the hypotheses excluding UNMODELLED by `p` (descending; ties by hypothesis order) and take the top 3.
2. Take the first pair, in order (1,2), (1,3), (2,3), whose rows on the chosen item differ by total variation `> δ`.
3. Emit
   `Chosen to separate {a} (p={pa:.3f}) from {b} (p={pb:.3f}): {a} predicts {X}; {b} predicts {Y}. Expected information gain {eig:.3f} bits, best of {N} candidate items; next best {id2} at {eig2:.3f} bits[ (tie broken by item order)].`
   Here `{X}` is the predicted set rendered as `B (48,600)`, with ` = correct` appended for the correct option.
4. If no pair qualifies, use `Chosen as the most informative remaining item.` followed by the same EIG sentence.

### 5.3 Stopping and refusal (Feature 3) — **[Owner: Ahmed]**

**Support ("answers behind").** The triggered sets are `T_m(i) = S_m(i)`, `T_NONE(i) = {c_i}` and `T_UNMODELLED(i)` = wrong options with no link. For a set of hypotheses `G`:

```
support(G) = number of answered steps t with o_t ∈ ∪_{h∈G} T_h(i_t)
```

So a diagnosis of `m` needs at least 2 answers on which the student chose an option linked to `m`. A correct answer on an item that does not trigger `m` is not support for `m`. Support and confidence are **both** required: confidence alone can be reached on a single answer, and support alone ignores contrary evidence.

**Separability.** `TV_i(a,b) = ½ Σ_o |P(o|a,i) − P(o|b,i)|`. Two hypotheses are separable by `i` iff `TV_i > δ`. With global parameters, TV between two rows is either 0 (identical predicted sets) or ≥ 0.2. The minimum of 0.2 occurs for two-option sets that overlap in one option, and in Maths_v2, where every predicted set is a single option, the minimum is 0.6. So `δ = 0.05` only matters once per-misconception parameters exist.

**Rules**, evaluated in this order after every update. The first that fires ends the session:

| | Outcome | Fires when |
|---|---|---|
| R1 | `diagnosed` | `m* = argmax_{m} p(m)` (ties → hypothesis order) has `p(m*) ≥ θ` and `support({m*}) ≥ 2` |
| R2 | `none_detected` | `p(NONE) ≥ θ` and `support({NONE}) ≥ 3` |
| R3 | `escalated_unmodelled` | `p(UNMODELLED) ≥ θ_U` and `support({UNMODELLED}) ≥ 2` |
| R4 | `escalated_no_separator` | Let `ℓ` = argmax of `p` over `M ∪ {NONE}`, `R` = eligible unused items (**not** limited by the budget), and `C = {h ∈ M ∪ {NONE} : TV_i(h, ℓ) ≤ δ for all i ∈ R}`. Fires iff `R ≠ ∅`, `|C| ≥ 2`, `p(C) ≥ θ`, `p(ℓ)/p(C) < θ` and `support(C) ≥ 2` |
| R5 | `escalated_exhausted` | `answered ≥ budget`, or `R = ∅`, or the best EIG among candidates is `< η` |
| — | `in_progress` | otherwise; ask the selected item |

**Why R4 has no ε.** If no remaining item separates the hypotheses in `C`, every future likelihood is identical across `C`, so the ratios inside `C` are frozen. The best `ℓ` can ever reach is `p(ℓ)/p(C)`, its **ceiling**. If the class already holds `θ` of the mass but the ceiling is below `θ`, then no further question can produce a diagnosis, and the honest outcome is a refusal naming the tied set.

The original "top two within ε" test was wrong in both directions. It refuses separable pairs that happen to be close (0.40 vs 0.39, separable by the next item), and it lets inseparable pairs that are not close (0.45 vs 0.30) run on until the budget is spent. The "no item with EIG > δ" clause also asks useless questions: in example D2 it would ask a third T4 item (EIG 0.047 bits) that cannot change the 1514:1773 ratio, and whether it stopped there at all would depend on δ.

**Mutual exclusivity.** With `θ > 0.5` and `θ + θ_U > 1` (both enforced at load), R1–R3 can never fire together. The fixed order is still applied.

**Decision records.**
- `diagnosed` writes `diagnosis(misconception_id = m*, confidence = p(m*), runner_up = second hypothesis by p (excluding UNMODELLED), runner_up_p)`.
- `escalated_no_separator` writes `escalation(reason, tied set = C, leader = ℓ, ceiling)` and a `coverage_gap(kind=separator)` for each pair in `C` that is structurally inseparable over the whole topic.
- `escalated_exhausted` writes the leader and, if `p(leader) < θ` with `support < 2`, a `thin_coverage` gap candidate.
- `none_detected` writes neither a diagnosis nor an escalation. The session still enters teacher review.

**Run loop** — **[Owner: Ahmed]**: service-layer orchestration, outside the pure `sonder_engine` package. The following is design pseudocode, not implemented application code. The store operations represent transactions defined by DB_SCHEMA_PLAN.md §3, not additional package functions or tables. Calculations run in memory; the service persists their result before acknowledging the request.

```python
def start(topic, params):
    validate(topic, params)                         # pack rules V1–V11, param rules P1–P6
    p = prior(hyps, params); history = []
    sel = select_next(p, eligible(topic, used=∅), hyps, params)  # never None: V9 guarantees ≥1 item
    # Service adapter: atomically persist run/version bindings, prior and first presentation.
    store.commit_start(session, pack_sha256, params, hyps, p, sel)
    return sel                                     # only after successful commit

def answer(step_index, item_id, option_id):
    # idempotency and validation, in this order (errors leave state unchanged):
    # Lock/read committed session and pending presentation in the Postgres transaction.
    # 404 session_not_found → replay/conflict check → 409 session_closed → 409 step_mismatch → 409 item_mismatch
    # → 422 invalid_option
    o = index_of(option_id, pending_item)
    H0 = entropy_bits(p)
    proposed_p = update_posterior(p, likelihood_matrix(pending_item, hyps, params), o)
    proposed_history = [*history, (pending_item, o)]
    unused = eligible(topic, used=proposed_history)
    nxt = select_next(proposed_p, unused if len(proposed_history) < budget else [], hyps, params)
    stop = check_stop(proposed_p, proposed_history, unused, nxt.eig if nxt else None, hyps, params)
    # Atomic commit: answer + posterior + next presentation OR terminal case/evidence.
    # The answered item's selection audit is sel; nxt belongs to the next presentation.
    store.commit_answer(step_index, pending_item, o, H0, sel, proposed_p, stop, nxt)
    # Publish cache state only after commit; discard/reload on persistence failure.
    p, history = proposed_p, proposed_history
    if stop.outcome != "in_progress": close()
    else: sel = nxt
    return response(...)
```

### 5.4 Function boundaries between owners

The three members' pure calculation functions live in one package (`sonder_engine`). API, pack-loading I/O, locks, database transactions and trace projection live in the thin FastAPI service and its adapters, outside that package. Arrays are `numpy.ndarray[float64]`. Probabilities are unitless in `[0,1]` and EIG and entropy are in bits. `hyps` is the ordered tuple from 5.0.

| Function | Owner | Signature | Returns | Raises |
|---|---|---|---|---|
| `prior` | Ashher | `(hyps: tuple[str,...], params: Params) -> ndarray (H,)` | prior vector, sums to 1 | — |
| `likelihood_matrix` | Ashher | `(item: Item, hyps, params) -> ndarray (H, n)` | rows sum to 1, all > 0 | — |
| `update_posterior` | Ashher | `(p: ndarray (H,), L: ndarray (H,n), observed: int) -> ndarray (H,)` | posterior, sums to 1 ± 1e-12 | `ValueError("invalid_option")`, `FloatingPointError("zero_evidence")` |
| `entropy_bits`, `eig_bits` | Harris | `(p) -> float`; `(p, L) -> float` | bits, `0 ≤ EIG ≤ H(p)` | `FloatingPointError("negative_eig")` |
| `select_next` | Harris | `(p, candidates: Sequence[Item], hyps, params) -> Selection \| None` | `Selection(item_id: str, eig: float, ranking: tuple[(str, float)], reason: str)` | — |
| `check_stop` | Ahmed | `(p, history: Sequence[tuple[Item,int]], unused: Sequence[Item], best_eig: float \| None, hyps, params) -> StopDecision` | `StopDecision(outcome: str, leader: str, tied: tuple[str,...], detail: str)` | — |
| Service `run loop`, pack loader, API, Postgres adapter, trace projection | Ahmed | see 5.3, 5.6; outside the pure package | — | — |

Harris calls `likelihood_matrix` and does not reimplement it. `check_stop` calls `likelihood_matrix` for the separability test. Harris owns the Q-matrix *content* (the links in the pack); Ahmed owns the loader that validates it.

### 5.5 Parameters (engine config `params/<version>.json`; recorded by version and SHA-256 in every session)

All values are **assumed**: there is no response data to estimate them from. **Sensitivity test (S1):** multiply one float parameter at a time by 0.8 and by 1.2 (budget rounded), then rerun the 12 reference cases. The cases are T1: a deterministic student for each of the 4 misconceptions, NONE, and the slip-once MATH-1379 student; T4: the 5 misconceptions and NONE. Pass iff the outcome, the diagnosed misconception and the tied set are unchanged. Current result: **all 18 variants pass** (`test_sensitivity_no_flip`).

| Parameter | Value | Status | Rationale | Sensitivity |
|---|---|---|---|---|
| `slip` | 0.10 | assumed | A competent student errs on about 1 in 10 Grade-8 MCQs | S1 ±20%: pass |
| `guess` | 0.30 | assumed | A misconception is applied about 70% of the times it is triggered (misconceptions are applied inconsistently). 0.20 let an always-"A" clicker reach a diagnosis in 3 answers | S1 ±20%: pass |
| `π_N` (prior NONE) | 0.25 | assumed | Most students sent to a check hold a misconception, but many do not | S1 ±20%: pass |
| `π_U` (prior UNMODELLED) | 0.05 | assumed | The catalogue is curated; off-catalogue states should be rare a priori | S1 ±20%: pass |
| `θ` | 0.80 | assumed | Leader at least 4:1 against the rest. Stricter than the PoC's 0.75 because there is no calibration | S1 ±20% (0.64–0.96): pass |
| `θ_U` | 0.50 | assumed | UNMODELLED must be the single most likely explanation; `θ + θ_U > 1` | S1 ±20%: pass |
| `min_support` | 2 | design rule | Spec: "≥ 2 answers behind it"; one answer can be a slip | integer, not varied (1 would allow a single-answer diagnosis) |
| `min_support_none` | 3 | design rule | With 2, the slip-once 1379 student is declared `none_detected` at step 2 (shown in D1). Absence needs more evidence | integer; 2 flips that case (documented) |
| `δ` (separation TV) | 0.05 | assumed | Rows closer than 5 percentage points TV cannot separate within a budget of 8 | S1 ±20%: pass |
| `η` (EIG floor) | 0.01 bits | assumed | Less than 1/100 bit per question is not worth a student's time | S1 ±20%: pass |
| `budget` | 8 (≤ #eligible items) | assumed | Reference cases finish in 2–4 answers, leaving room for noise; the UI shows "of up to N" | S1 (6, 10): pass |
| `K_MAX` | 6 | design rule | UI readability: at most 8 posterior bars | — |
| tie rounding | 1e-9 | design rule | Far above fp noise (~1e-15), far below real EIG differences (≥ 1e-3 here) | — |

**Param validation (P1–P6, at load; refuse to start on failure):** P1 `0 < slip < 0.5`, `0 < guess < 0.5` (keeps predicted options more likely than non-predicted ones for `|P| ≤ 2`); P2 `π_N, π_U > 0`, `π_N + π_U < 1`; P3 `0.5 < θ < 1`, `θ + θ_U > 1`, `θ_U < 1`; P4 `1 ≤ min_support ≤ min_support_none`; P5 `0 ≤ δ < 0.5`, `η ≥ 0`; P6 `budget ≥ 1`.

### 5.6 Engine API (called by the Next.js BFF) — **[Owner: Ahmed]**

**Minimal pack input** (versioned JSON file; field names and types only; the engine does not dictate authoring):

```json
{
  "pack_format": "integer (1)",
  "content_version": "string",
  "subject": "string: mathematics | physics | chemistry",
  "topics": [
    {
      "topic_id": "string",
      "name": "string",
      "misconceptions": [ { "misconception_id": "string", "name": "string" } ],
      "items": [
        {
          "item_id": "string",
          "stem": "string",
          "target_misconception_id": "string",
          "review_status": "string: approved | in_review | draft | rejected",
          "options": [
            { "option_id": "string", "text": "string", "is_correct": "boolean", "misconception_ids": ["string"] }
          ]
        }
      ]
    }
  ]
}
```

`misconceptions` order defines the slot keys `M1…Mk`. The Q-matrix is `options[].misconception_ids`. From Maths_v2 this is a direct regrouping of `items.csv` (one item = 4 rows; `misconceptions` is split on `|`), with topic IDs mapped explicitly (finding 1).

**Pack rules (fail fast at load):** V1 exactly 4 options; V2 exactly one `is_correct`; V3 `option_id` and `text` unique within an item (the UI matches answers by text); V4 the correct option has no links; V5 every linked ID and `target_misconception_id` is declared in the item's topic; V6 `item_id` unique in the pack, `misconception_id` unique in the topic; V7 `1 ≤ k ≤ K_MAX`; V8 no duplicate ID within one option's list; V9 each topic has ≥ 1 approved item; V10 `pack_format` supported; V11 a misconception links ≤ 2 options of one item. **Warnings** (reported by `/engine/health`, never fatal): structurally inseparable pairs (over all approved items, including pairs with NONE, which covers a misconception that is never linked); items with ≥ 2 unlinked wrong options; non-approved items (excluded from eligibility).

**Endpoints**

| Method | Path | Request | Response |
|---|---|---|---|
| POST | `/engine/sessions` | `{student_ref: string, topic_id: string, content_version: string, mode: "topic", question_budget?: int}` | `201 {session_id, topic_id, content_version, pack_sha256, params_version, question_budget, hypotheses: [{key, misconception_id \| null, label}], prior: {key: float}, next_question: PendingQuestion}` |
| POST | `/engine/sessions/{id}/answers` | `{step_index: int, item_id: string, option_id: string}` | `200 {step: SessionStep, next_question: PendingQuestion \| null, outcome, decision: Decision \| null, replayed: bool}` |
| GET | `/engine/sessions/{id}/trace` | — | `200 {header, steps: SessionStep[], end: Decision \| null}` (teacher evidence panel) |
| GET | `/engine/health` | — | `200 {engine_version, content_version, pack_sha256, params_version, topics: [{topic_id, k, eligible_items, warnings[]}]}` |

```
PendingQuestion = { stepIndex: int, itemId: string, questionText: string, optionIds: string[4], optionsShown: string[4] }

SessionStep     = {                       // field names match Sonder-UI fixtures/scenarios/types.ts SessionStep
  stepIndex: int,
  itemId: string | null,                  // added
  questionText: string | null,            // null on the closing step
  optionsShown: string[] | null,
  answerGiven: string | null,             // option text, as in the PoC
  answerOptionId: string | null,          // added
  correctAnswer: string | null,
  posterior: { [slotKey]: float },        // AFTER this answer, unrounded, keys = session hypotheses
  explanation: string,                    // selection_reason + " " + answer_note
  outcome: "in_progress" | "diagnosed" | "none_detected" | "escalated_no_separator"
         | "escalated_exhausted" | "escalated_unmodelled",
  engine: { entropyBeforeBits: float, expectedIgBits: float, selectionReason: string, answerNote: string,
            ranking: [[itemId, eigBits]], support: { [slotKey]: int } }   // added, teacher view only
}

Decision        = { outcome, leader: slotKey, confidence: float, runnerUp: slotKey | null, runnerUpP: float | null,
                    tied: slotKey[] , detail: string }
```

`answer_note` template: `Answer {X} ({text}) {is correct | is linked to {ids} | is not linked to any catalogued misconception}. {leader} now {p:.3f}.` Answered steps carry `outcome = in_progress`, except the last answered step, which carries the terminal outcome. Like the PoC, a closing `SessionStep` follows it (`questionText = null`, final posterior, `explanation = decision.detail`, terminal outcome), so `useScenarioPlayer` needs no change. **The BFF strips `posterior`, `correctAnswer`, `explanation` and `engine` before sending a step to a student browser.** The engine has no notion of roles.

**Errors** (body `{error: code, message}`): validation/numeric errors leave committed session state unchanged. A rolled-back persistence transaction also leaves it unchanged. If the database connection fails during commit, the service must reconcile the request against persisted evidence on retry; it cannot assume the commit failed or apply the answer again.

| Status | Code | When |
|---|---|---|
| 404 | `session_not_found`, `topic_not_found` | unknown ID |
| 409 | `content_version_mismatch` | requested version ≠ loaded pack |
| 409 | `session_closed` | new answer after a terminal outcome; an exact committed retry is returned first |
| 409 | `step_mismatch` | `step_index` ≠ the pending step and not a replay |
| 409 | `item_mismatch` | `item_id` ≠ the pending item |
| 409 | `answer_conflict` | replay of an answered `step_index` with a different `option_id` |
| 422 | `invalid_option` | `option_id` not in the item |
| 422 | `invalid_request`, `mode_unsupported`, `invalid_budget` | schema error; `mode ≠ topic`; budget outside `1…#eligible` |
| 500 | `engine_numeric_error` | zero evidence / negative EIG (a defect) |
| 503 | `pack_not_loaded` | service started without a valid pack/params (it should refuse to start) |
| 503 | `persistence_unavailable` | Neon connection/transaction unavailable or commit result cannot be confirmed; retry with the same request identity and reconcile persisted state |

**Idempotency:** re-sending an answered `(step_index, item_id, option_id)` returns the response reconstructed from that committed step and its original next presentation or terminal decision, with `replayed: true`, including a retry of the final answer after closure. Check committed replay/conflict before rejecting a new answer to a closed session. Serialize writes with a database session-row lock and the schema's unique step/request constraints; an in-process lock is optional, not the persistence authority. The authenticated BFF supplies enrollment/caller context and a stable request key to the service adapter; body IDs alone do not prove access. Never return a later pending question as if it were the original replay response.

**Selected Mid-1 persistence: Neon PostgreSQL (no model service required).** The FastAPI service uses a `SessionStore` adapter implemented as `PostgresStore` against the shared database. DB_SCHEMA_PLAN.md is the storage source of truth: persist the run's enrollment/content/response-model/engine-release bindings, prior, pending presentations, append-only answers, hypothesis posteriors and terminal diagnosis/escalation evidence in its existing domains. Commit each start or answer transaction before sending success. The pure package receives in-memory items, parameters and state; it never opens a database connection.

**Content loading:** materialize an approved frozen content version from the content store into the §5.6 `ContentPack` shape, validate V/P rules and load it into memory. Versioned pack/params JSON files may remain reviewed import/export/configuration artefacts, but do not replace Neon session persistence. Pin the exact content/model/release and parameter/hash/ordering metadata needed to reproduce each run. The schema-to-contract mapping of complete configuration, ordering and trace ranking remains to be agreed with the schema owner; this amendment does not invent new columns or imply that they already exist.

**Trace and recovery:** after restart, load the committed prior, answers, posteriors and pending presentation from Neon; reconstruct or replay under the same pinned content/configuration before accepting another answer. An in-memory cache is disposable, never the authoritative session record. A missing or mismatched pinned artefact blocks resume and reports a recovery failure without overwriting evidence; this does not introduce an `unrecoverable` database status. Reconstruct the teacher's `SessionStep[]` and header/end projection from persisted evidence. A null-question closing display step is not a second stored answer. Do not write local `.jsonl` session traces or silently switch to local persistence when Neon is unavailable. Deterministic offline calculation/reference tests may still run without a database.

---

## C. Change list for other sections

1. **§4.2 `diagnostic_session.outcome` and `session_step.outcome`:** add `none_detected`. The final enum is `in_progress | diagnosed | none_detected | escalated_no_separator | escalated_exhausted | escalated_unmodelled`. (`abandoned`, if wanted, is a session-only value set by the BFF, never by the engine.)
2. **§4.2 `diagnostic_session`:** add `hypotheses` (ordered slot → misconception_id), `pack_sha256`, `params_version`, `engine_version`, `prior`. Reject `mode=broad` in the engine (document it as later work).
3. **§4.2 `session_step`:** posterior keys follow the session's hypotheses; values are stored unrounded. Add `answer_note`, `ranking` (EIG per candidate) and `support`. State the units: `entropy_before` and `expected_ig` are in bits.
4. **§4.2 `diagnosis.top2`:** replace with `runner_up` (hypothesis key) and `runner_up_p`. Define `confidence = p(m*)`.
5. **§4.2 `escalation.tied_pair`:** it becomes a tied *set* of size ≥ 2 (it may include `NONE`). Add `leader` and `ceiling`.
6. **§4.2 `slip_guess_param`:** redefine `slip` and `guess` as in 5.1. Add `source = 'assumed'`, since no row can be `calibrated` before real responses exist. Remove "calibrated from real response data" and "(calibrated — E5)" from §4.2 and §5.1. Version the whole parameter set (`params_version`).
7. **§4.1 `q_matrix_entry.predicted`:** drop it. A row means "this misconception predicts this option". A `predicted=false` row has no defined meaning in the math. Add a constraint that no entry may reference a correct option, plus "≤ 2 options per misconception per item". Add `item.target_misconception_id`, which is authoring metadata and not read by the engine.
8. **§5.3 last line:** change "thresholds … tuned in V1" to "assumed, sensitivity-tested (±20%), and explored in V1".
9. **§10 Calibration error:** not computable until real responses exist; mark it N/A for Mid-1. Add **Sensitivity** as a metric (S1 above).
10. **§10 Misdiagnosis rate (V1):** synthetic students must **also** be generated with parameters that differ from the engine's (for example `guess ∈ {0.2,0.3,0.4,0.5}`). Simulating from the engine's own likelihood is circular and optimistic.
11. **§10 Escalation precision/recall:** "genuinely undiagnosable" is computable as structural inseparability over the topic's approved items (the R4 class over all items).
12. **§9 Feature 18:** the trace includes `pack_sha256`, `params_version` and the full EIG `ranking`. Replay must reproduce every posterior to within 1e-12.
13. **§11.1:** the BFF strips teacher-only step fields (posterior, correctAnswer, explanation, engine) before responses go to a student.
14. **§12:** add D-11 "UI hypothesis cap K_MAX = 6", D-12 "min_support_none = 3", and D-13 "merge inseparable catalogue pairs?".
15. **§1.2 / §3:** the engine needs NumPy only. SciPy is not used.
16. **UI (Sonder-UI-master), not ENGINEERING.md:** in `types.ts`, `HypothesisId` becomes `` `M${number}` | "NONE" | "UNMODELLED" `` and `StepOutcome` replaces `"none"` with `"none_detected"`. `assertPosterior.ts` checks the keys against the session's hypothesis list instead of a fixed six. `EvidencePanel` `OUTCOME_STATUS` gains `none_detected`. `review/ReviewPanel.tsx` currently sets `isEscalated = outcome !== "diagnosed"`, which would show `none_detected` as an escalation, so it needs a third branch. Rendering already iterates over `hypothesisLabels` (`lib/hypotheses.ts`). The UI reads only the final step's `outcome`.

---

## D. Worked examples (Maths_v2, default parameters)

Hypothesis order (slots) for **T1**: M1 = MATH-1248, M2 = MATH-1379, M3 = MATH-1988, M4 = MATH-2392, then NONE, UNMODELLED. The prior is `(0.175, 0.175, 0.175, 0.175, 0.25, 0.05)` with H = 2.4763 bits.

### D1. T1 Rounding: a MATH-1379 student who slips once (4 questions → `diagnosed`)

Synthetic student (deterministic): holds MATH-1379 ("rounds down instead of up"), answers the **first** item that triggers 1379 correctly (a slip), then picks the 1379 option whenever an item triggers it and answers correctly otherwise. The answers below are the engine's own selections.

**Q-matrix rows used:**

| Item | Stem (abridged) | A | B | C | D |
|---|---|---|---|---|---|
| T1-005 | 48,630 to nearest 1,000 | 48,000 → 1379 | 48,600 → 1248 | 50,000 → 2392 | **49,000** ✓ |
| T1-006 | 23,240 to nearest 1,000 | 20,000 → 2392 | **23,000** ✓ | 23,200 → 1248 | 24,000 → 1988 |
| T1-007 | 8,374 to nearest 100 | 8,000 → 2392 | 8,300 → 1379 | **8,400** ✓ | 8,370 → 1248 |
| T1-009 | 15,720 to nearest 1,000 | 15,000 → 1379 | **16,000** ✓ | 15,700 → 1248 | 20,000 → 2392 |

Likelihood rows on T1-005 (A, B, C, D): 1248 (.1, .7, .1, .1); 1379 (.7, .1, .1, .1); **1988 (.0333, .0333, .0333, .9)**, because 1988 is not triggered here and so behaves as NONE; 2392 (.1, .1, .7, .1); NONE (.0333, .0333, .0333, .9); UNMODELLED (.25 ×4).

| Step | Item chosen, EIG | Candidate EIG groups (bits) | Answer | Posterior after (1248, 1379, 1988, 2392, NONE, UNM) | H after | Rule check |
|---|---|---|---|---|---|---|
| 0 | T1-005, **0.7887** | 0.7887: 12 items (T1-005…010, 013, 015, 017–020) · 0.6969: 8 items with a two-link or unlinked option (T1-001…004, 011, 012, 014, 016) | D (correct; the slip) | .0391, .0391, **.3520**, .0391, **.5028**, .0279 | 1.7218 | none fire |
| 1 | T1-006, **0.6472** | 0.6472: T1-006, 008, 013, 019, 020 · 0.6032: T1-002, 003, 011, 012 · 0.3300: T1-007, 009, 010, 015, 017, 018 · 0.3185: T1-001, 004, 014, 016 | B (correct) | .0073, .0655, .0655, .0073, **.8416**, .0130 | 0.9091 | NONE ≥ θ but support(NONE) = 2 < 3: **R2 blocked** |
| 2 | T1-007, **0.2232** | 0.2232: 10 items · 0.2192: 8 items | B (8,300 → 1379) | .0090, **.5674**, .0270, .0090, .3474, .0402 | 1.4434 | none fire |
| 3 | T1-009, **0.5546** | 0.5546: T1-009, 010, 015, 017, 018 · 0.5419: T1-001, 004, 014, 016 · 0.1799 / 0.1776: items that do not trigger 1379 | A (15,000 → 1379) | .0021, **.9423**, .0021, .0021, .0275, .0238 | 0.4087 | **R1: p(1379) = .9423 ≥ .80, support = 2 → diagnosed** |

Hand check of step 0. The observed column D gives L = (.1, .1, .9, .1, .9, .25). The joint is (.0175, .0175, .1575, .0175, .225, .0125), so z = .4475 and the posterior is (.0391, .0391, .3520, .0391, .5028, .0279). The predictive distributions P(o) for the chosen items were: T1-005 (.1842, .1842, .1842, .4475); T1-006 (.0915, .5377, .0915, .2792); T1-007 (.0458, .0808, .8276, .0458); T1-009 (.4215, .4055, .0865, .0865).

**Why each item was chosen** (the `selection_reason` emitted):
- **Step 0.** At the prior, every item that triggers all hypotheses with distinct options ties at 0.7887. Items with a shared (1379|2392) or unlinked option score lower (0.6969) because two hypotheses predict the same answer. The tie is broken by pack order, so T1-005 is chosen. Reason: "Chosen to separate NONE (p=0.250) from MATH-1248 (p=0.175): NONE predicts D (49,000) = correct; MATH-1248 predicts B (48,600). … next best T1-006 at 0.789 bits (tie broken by item order)."
- **Step 1.** The correct answer left NONE (.503) and 1988 (.352) in front, because 1988 was not triggered by T1-005 and rode along with NONE. The best items trigger 1988 (T1-006 D = 24,000). Items that do not trigger 1988 (0.3300 group) cannot split them. Reason: "Chosen to separate NONE (p=0.503) from MATH-1988 (p=0.352): NONE predicts B (23,000) = correct; MATH-1988 predicts D (24,000)."
- **Step 2.** NONE is at .842. With `min_support_none = 2` the session would have ended here as **`none_detected`, a false negative** for this student. Under the rule of 3, the engine asks again and picks an item that triggers 1379, the only remaining competitor that is not yet ruled out. Reason: "Chosen to separate NONE (p=0.842) from MATH-1379 (p=0.065): NONE predicts C (8,400) = correct; MATH-1379 predicts B (8,300)."
- **Step 3.** 1379 (.567) against NONE (.347). T1-009 triggers 1379 with a distinct option. Reason: "Chosen to separate MATH-1379 (p=0.567) from NONE (p=0.347): MATH-1379 predicts A (15,000); NONE predicts B (16,000) = correct."

**Stop.** After step 3, R1 fires: p(MATH-1379) = 0.9423 with two supporting answers (T1-007 B, T1-009 A). The diagnosis records the runner-up NONE at 0.0275. The early slip (step 0) is absorbed rather than blocking the diagnosis.

### D2. T4 Choosing the operation: MATH-1514 student → `escalated_no_separator` (refusal)

Slots: M1 = 126, M2 = 228, M3 = 1416, M4 = 1514, M5 = 1773 (k = 5, which needs `K_MAX ≥ 5`). The prior is `(.14 ×5, .25, .05)` with H = 2.7016 bits. Synthetic student: always picks the option linked to 1514. On every T4 item that option is the two-link option `1514|1773`.

| Item | A | B | C | D |
|---|---|---|---|---|
| T4-001 (4 notebooks at Rs 6; Sara pays Rs 3 less) | Rs 7 → 1416 | **Rs 21** ✓ | Rs 8 → 228 | Rs 27 → 1514, 1773 |
| T4-006 (8 stickers; +4; −3) | 29 → 126 | 4 → 228 | **9** ✓ | 15 → 1514, 1773 |

| Step | Item chosen, EIG | Candidate EIG groups | Answer | Posterior after (126, 228, 1416, 1514, 1773, NONE, UNM) | Rule check |
|---|---|---|---|---|---|
| 0 | T4-001, **0.7799** | all 10 items tie at 0.7799 → pack order | D (Rs 27) | .0187, .0561, .0561, **.3928, .3928**, .0334, .0501 | class {1514, 1773} mass .786 < θ: R4 not yet |
| 1 | T4-006, **0.3265** | 0.3265: T4-006…010 (trigger 126) · 0.3051: T4-002…005 | D (15) | .0033, .0098, .0033, **.4799, .4799**, .0019, .0219 | **R4 fires** |

Step-1 reason: "Chosen to separate MATH-1514 (p=0.393) from MATH-228 (p=0.056): MATH-1514 predicts D (15); MATH-228 predicts B (4)." The top pair 1514/1773 has TV = 0 on every item, so the reason template skips it and names the next separable pair.

**R4 evaluation after step 1.** The leader is ℓ = MATH-1514 (it ties with 1773 and wins by hypothesis order). Over the 8 unused items, its class is C = {1514, 1773}, because their likelihood rows are identical on every T4 item. Then p(C) = 0.9598 ≥ 0.80, the ceiling is p(ℓ)/p(C) = 0.500 < 0.80, and support(C) = 2. The outcome is **`escalated_no_separator`** with tied set {MATH-1514, MATH-1773}, and a `coverage_gap(kind=separator, {1514, 1773})` is logged. The teacher receives both candidates. Asking more questions would be pointless: their ratio is frozen at 1:1 forever. Under the old EIG-floor rule, the session would ask T4-002 next (EIG 0.047 bits), which cannot move that ratio.

---

## E. Reference implementation and tests

- `docs/engine_ref/reference.py` is 252 lines. The engine itself (prior, likelihood, update, EIG, selection with reason, stopping, run loop) is about 150 of them. The rest are the dataclasses, a CSV loader with pack rules V1–V6, and the synthetic-student policy used by the tests.
- `docs/engine_ref/test_reference.py` has 33 tests. They cover: D1 and D2 reproduced to 4 dp (items, answers, EIG, entropy, posteriors, outcomes, reason text); likelihood rows summing to 1 and > 0 for every item of all six bank topics; posterior sums and `0 ≤ EIG ≤ H` on 500 seeded random posteriors; EIG = 0 for identical rows; invalid option and zero evidence; UNMODELLED escalation on real T1 unlinked options (posterior 0.1579 → 0.3873 → 0.6413, escalating on the third); budget exhaustion; identical output when run twice; first-step tie-break; and the ±20% sensitivity grid (18 variants).
- Run: `SONDER_MATHS_V2_ITEMS=<path to bank/items.csv> python -m pytest docs/engine_ref -q`. Data-dependent tests are skipped if the file is absent, because the dataset is not in the repo.
- Result on 2026-10-10 (Python 3.14.0, NumPy 2.5.3, pytest installed in a temp directory outside the repo): **33 passed**.

---

## F. Decision register (remaining questions need a human decision)

1. **Widen the UI to K_MAX = 6, or restrict Mid-1 to T1/T5/T6?** *Recommend widening.* It is a two-file UI change (`types.ts`, `assertPosterior.ts`), it lets T2 and T4 run, and it is required for the D2 refusal demo on T4. The fallback is a 4-misconception T4 subset (T4-006…010 with {126, 228, 1514, 1773}), but that is a content decision and it hides 1416.
2. **Merge the inseparable pairs in the catalogue?** MATH-1514 "Adds instead of subtracts" and MATH-1773 "Adds rather than subtracts when answering worded problems" (and 1074/1651) give identical answers by definition. *Recommend:* keep both for Mid-1 (it demonstrates honest refusal), then merge each pair into one catalogue entry after Mid-1 unless Harris can write an item that separates them.
3. **Sign off the assumed parameters,** especially `guess = 0.30`, `θ = 0.80` and `min_support_none = 3`. *Recommend accepting them,* and report the known limitation: a student who answers at random on a topic with few unlinked options (T1, T4) can still collect two "consistent" answers and be diagnosed. In probes, an always-"A" student was diagnosed with 2392 in 5 answers on T1. Teacher review is the safeguard, and V1 should measure this rate.
4. **Resolved: use Neon PostgreSQL for Mid-1 sessions and evidence.** The user selected the Neon option. Implement the service's `PostgresStore` from the start, with commit-before-reply and database-backed recovery; local JSONL session storage is not selected. The model service remains unnecessary for deterministic diagnosis. Deployment/integration and the complete schema-to-trace mapping still require verification; this decision does not assert they are implemented.
5. **Content follow-ups for Harris:** (a) re-link or justify the 4 T1 unlinked "rounds too much" options; (b) exclude the 6 "T5 cross-concept" items from topic packs, or re-home them once T7 exists; (c) add separators for T5 414/734 (only 3 separating items). *Recommend* (b) now, and (a) and (c) before the content freeze.
