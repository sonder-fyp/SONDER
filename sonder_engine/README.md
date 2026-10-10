# SONDER pure engine contract (Ashher's calculation slice)

This package is the deterministic calculation layer described in `docs/ENGINE_SPEC_DRAFT.md` sections 5.0–5.1 and 5.4. It does not load CSVs, serve HTTP, persist sessions, select questions, or decide when to stop. Those boundaries belong to the pack/service owner (Ahmed) and question selector (Harris). The specification remains a draft; its 80-item data count and missing reference-code links are stale against the current bank.

## Inputs

- `hyps` is an ordered tuple of 1–6 misconception IDs followed exactly by `NONE`, `UNMODELLED`. Every output vector uses this order.
- `Item` contains exactly four ordered option IDs, the correct option's zero-based index, and a tuple of linked misconception IDs per option. Correct options cannot have links; one misconception may link to at most two wrong options on the same item. The content adapter retains stem, option text, provenance, and pack version outside this numerical object.
- `Params` carries assumed `slip`, `guess`, `prior_none`, and `prior_unmodelled`. Defaults (`0.10`, `0.30`, `0.25`, `0.05`) are design assumptions, **not** measured student behavior. A versioned config and content binding will be Ahmed's service responsibility.

All four rates must be at least `1e-12`. Smaller positive float64 values can make an off-option likelihood round to zero; the numerical guard preserves the model's stated strictly positive rows and gives headroom for the draft eight-question budget. The default rates are unchanged. This is a deliberate precision guard in addition to the draft's mathematical `> 0` condition.

`prior(hyps, params)` returns a new NumPy `float64` vector: the last two entries get the reserved masses and all misconception entries share the remainder equally. For four misconceptions the default is `(0.175, 0.175, 0.175, 0.175, 0.25, 0.05)`. The package is importable with `python -m pip install -e .`; calculation and read-only candidate-data tests run with `python -m unittest discover -s tests -p 'test_bayes*.py' -v`.

`likelihood_matrix(item, hyps, params)` returns a `float64` array shaped `(H, 4)`. Every row is positive and sums to one. A triggered misconception predicts its linked wrong option(s); an untriggered misconception predicts the correct option like `NONE`; `UNMODELLED` is uniform. The off-prediction rates are the assumed `guess` and `slip`, respectively. A shared wrong option is predicted independently by each linked misconception. The input contract rejects three linked options for one misconception under draft V11.

`update_posterior(p, L, observed)` accepts normalized `float64` prior/posterior and likelihood arrays, multiplies by the observed option's likelihood column, and divides by the evidence. It returns a new unrounded vector. It rejects invalid shape, value, or option index; impossible evidence raises `FloatingPointError("zero_evidence")`. No session state, random choice, or persistence is hidden in the function. Tests use synthetic items until the team accepts an exact live Maths pack.

## Question selection (Harris's slice, spec section 3.4 and the earlier draft's 5.2)

`select_next(p, items, hyps, params)` in `sonder_engine/selection.py` picks the next question. It is pure: it loads nothing and keeps no session state.

- `items` must already be the **eligible** items in **pack order** (not yet asked, twin partners removed, and an empty list once the question budget is spent). It returns `None` for an empty list. Deciding eligibility, the budget, the EIG floor `eta` and when a session stops belongs to the run loop (Ahmed), not here.
- `expected_information_gain(p, L)` is the mutual information between the hypothesis and the answer, in bits: `sum_h sum_o p(h) P(o|h) log2(P(o|h) / P(o))`, with `L` from `likelihood_matrix`. A result in `[-1e-12, 0)` is clamped to 0; anything more negative raises `negative_eig` as a defect. `entropy_bits(p)` is the Shannon entropy, with 0 log 0 = 0.
- **Deterministic ties.** Each EIG is rounded to nine decimals before comparison; the highest wins and an exact tie goes to the earliest item in `items`. Many real items tie exactly (for example T1-005, T1-006 and T1-007 all give 0.7887 bits at the start of U1).
- The returned `Selection` holds `item_id`, `eig` (stored as `session_question.expected_ig`), `entropy_before`, `ranking` (every candidate with its EIG, best first) and `reason` (stored as `selection_reason`). `runner_up_id` and `runner_up_eig` read from `ranking`.
- **`reason` is generated from the computation, never free text**, following the earlier draft's template. It takes the three most probable hypotheses (`UNMODELLED` excluded; ties by hypothesis order), then the first pair in order (1,2), (1,3), (2,3) whose answer distributions differ by total variation **strictly greater than** `delta` (default 0.05). It states what each predicts (the linked options, or the correct option marked `= correct`), the EIG, the number of candidates and the next best item, noting a tie. With no qualifying pair it says `Chosen as the most informative remaining item.` Example: `Chosen to separate NONE (p=0.250) from MATH-1248 (p=0.175): NONE predicts D = correct; MATH-1248 predicts B. Expected information gain 0.789 bits, best of 20 candidate items; next best T1-006 at 0.789 bits (tie broken by item order).`

An unlinked item still has positive EIG while `UNMODELLED` has probability mass, because `UNMODELLED` answers uniformly and every other state predicts the correct answer. EIG reaches exactly zero only when the answer rows of every state that still has mass are identical.

**Deviation from the earlier draft.** It renders a predicted option as `B (48,600)` with the option text. `Item` holds option IDs only (text stays in the pack), so the reason shows IDs such as `B`. Adding the text needs the pack adapter to pass it in.

**Evidence.** `tests/test_selection.py` (37 tests):

- hand-derived entropy and EIG values, and an independent route through `update_posterior`;
- exact-fraction checks of EIG for all 81 items of units U1 to U5 at the prior and after each possible first answer (405 values, 60-digit decimal logarithms);
- 300 random posteriors where the whole ranking is compared with a brute-force reference that shares no code with the module;
- bounds on EIG, shuffled pack order, and scripted sessions for every misconception in U1 to U5 (deterministic, no repeated item, valid trace);
- a replay of the spec's worked examples D1 (T1 Rounding) and D2 (operation unit), where every item choice, EIG and posterior matches the spec tables to four decimals.

Seven deliberate code mutations (wrong log base, no rounding, reversed tie rule, worst item chosen, `UNMODELLED` as a leader, `>=` for `>`, wrong guess parameter) were each caught by at least one test. These checks confirm the arithmetic against the spec; they say nothing about real students.

Run with `python -m unittest discover -s tests -p 'test_selection.py' -v`.

**Known limits.** Units U6 and U7 cannot be loaded yet: `validate_hypotheses` allows at most six misconceptions (spec section 2.1 wants `K_MAX = 8`, and U7 has seven), and `Item` rejects the three T6 items that link one misconception to three options (spec D-2). Those are Ashher's and the team's to settle.
