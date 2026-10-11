# SONDER pure engine contract (Ashher's calculation slice)

This package implements the pure calculation and question-selection parts of `docs/ENGINE_SPEC_DRAFT.md` v2. These modules do not load or freeze a pack, serve HTTP, persist sessions, or decide when to stop; Ahmed's modules (below) load packs and apply the stopping rules, and his run loop will connect the pieces. The specification is still a team-review draft, and the current Maths bank has 117 items.

## Inputs

- `hyps` is an ordered tuple of 1–8 misconception IDs followed exactly by `NONE`, `UNMODELLED`. `Params.k_max` can set a lower limit for a particular model. Every output vector uses this order.
- `Item` contains four ordered option IDs, the correct option index, and linked misconception IDs per option. The correct answer has no links; one misconception may link to all three wrong answers. Optional `link_grades` has one `S` or `T` for each linked ID in the same order; missing grades mean `S`. Optional `twin_group` identifies questions with the same stem. The content adapter retains text, provenance, and pack version outside this numerical object.
- `Params` contains the assumed response rates, reserved priors, stopping thresholds, unit limit and link weights. Defaults include `slip=0.10`, `guess=0.30`, `prior_none=0.25`, `prior_unmodelled=0.05`, `w_sound=1.0`, and `w_stretch=0.5`. They are **not** estimates from real students. Ahmed's service must pin a versioned parameter file and content pack to each run.

Response rates and reserved prior masses must be at least `1e-12` so float64 division does not silently turn a positive likelihood into zero. `Params` validates the other thresholds. The default `min_support=2` remains an open team decision: spec v2 recommends considering 3 (D-3).

`prior(hyps, params)` returns a new NumPy `float64` vector: the last two entries get the reserved masses and all misconception entries share the remainder equally. For four misconceptions the default is `(0.175, 0.175, 0.175, 0.175, 0.25, 0.05)`. The package is importable with `python -m pip install -e .`; calculation and read-only candidate-data tests run with `python -m unittest discover -s tests -p 'test_bayes*.py' -v`.

`check_p1(items, hyps, params)` validates a unit before its response model is used. A linked set of size 1, 2 or 3 requires `guess < 0.75`, `< 0.50` or `< 0.25`, respectively. `likelihood_matrix(item, hyps, params)` applies the same check for a direct call, then returns a positive, normalized `float64` `(H, 4)` matrix. With one stretch link, its misconception row is `0.5 × linked row + 0.5 × NONE row` at the default weights; the lowest grade weight among that misconception's links on the item controls the whole row. A missing grade has weight 1 and reproduces the original calculation exactly. A shared wrong option is still predicted independently by every linked misconception.

`update_posterior(p, L, observed)` accepts normalized `float64` prior/posterior and likelihood arrays, multiplies by the observed option's likelihood column, and divides by the evidence. It returns a new unrounded vector. It rejects invalid shape, value, or option index; impossible evidence raises `FloatingPointError("zero_evidence")`. No session state, random choice, or persistence is hidden in the function. Tests use synthetic items until the team accepts an exact live Maths pack.

## Question selection (Harris's slice, spec v2 section 3.4)

`select_next(p, items, hyps, params)` in `sonder_engine/selection.py` picks the next question. It is pure: it loads nothing and keeps no session state. Its explanation uses `params.delta_sep` unless an explicit test override is passed.

- `eligible_items(full_pack, asked_ids)` returns unasked items and excludes every twin partner of an asked item, preserving **pack order**. The full pack must include the asked items so their twin groups can be found. Ahmed's run loop must call it for selection and stopping checks.
- `select_next` receives those eligible items in pack order and returns `None` for an empty list. The run loop applies the budget and `params.eig_floor` and decides when to stop.
- `expected_information_gain(p, L)` is the mutual information between the hypothesis and the answer, in bits: `sum_h sum_o p(h) P(o|h) log2(P(o|h) / P(o))`, with `L` from `likelihood_matrix`. A result in `[-1e-12, 0)` is clamped to 0; anything more negative raises `negative_eig` as a defect. `entropy_bits(p)` is the Shannon entropy, with 0 log 0 = 0.
- **Deterministic ties.** Each EIG is rounded to nine decimals before comparison; the highest wins and an exact tie goes to the earliest item in `items`. Many real items tie exactly (for example T1-005, T1-006 and T1-007 all give 0.7887 bits at the start of U1).
- The returned `Selection` holds `item_id`, `eig` (stored as `session_question.expected_ig`), `entropy_before`, `ranking` (every candidate with its EIG, best first) and `reason` (stored as `selection_reason`). `runner_up_id` and `runner_up_eig` read from `ranking`.
- **`reason` is generated from the computation, never free text.** It compares the three most probable hypotheses (`UNMODELLED` excluded) and names the first pair whose answer distributions differ by total variation strictly greater than `params.delta_sep` (default 0.05). It states what each predicts, the EIG, the number of candidates and the next best item, noting a tie. With no qualifying pair it says `Chosen as the most informative remaining item.`

An unlinked item still has positive EIG while `UNMODELLED` has probability mass, because `UNMODELLED` answers uniformly and every other state predicts the correct answer. EIG reaches exactly zero only when the answer rows of every state that still has mass are identical.

**Known presentation limit.** `Item` holds option IDs but not text, so a reason currently says `B`, not `B (48,600)`. Adding text requires a pack/service adapter change.

**Evidence.** `tests/test_selection.py` also checks twin exclusion and that `params.delta_sep` controls the reason. Its exact tie-order test was already present before the v2 alignment:

- hand-derived entropy and EIG values, and an independent route through `update_posterior`;
- exact-fraction checks of EIG for all 81 items of units U1 to U5 at the prior and after each possible first answer (405 values, 60-digit decimal logarithms);
- 300 random posteriors where the whole ranking is compared with a brute-force reference that shares no code with the module;
- bounds on EIG, shuffled pack order, and scripted sessions for every misconception in U1 to U5 (deterministic, no repeated item, valid trace);
- a replay of the spec's worked examples D1 (T1 Rounding) and D2 (operation unit), where every item choice, EIG and posterior matches the spec tables to four decimals.

Seven deliberate code mutations (wrong log base, no rounding, reversed tie rule, worst item chosen, `UNMODELLED` as a leader, `>=` for `>`, wrong guess parameter) were each caught by at least one test. These checks confirm the arithmetic against the spec; they say nothing about real students.

Run with `python -m unittest discover -s tests -p 'test_selection.py' -v`.

**Known limits.** The three B14 T6 items load structurally, but `check_p1` rejects them at the default `guess=0.30`. Spec decision D-2 (11 October 2026): the pack loader skips these three items for U6 at load time, with a warning, and keeps `guess=0.30`; the dataset itself is not changed. The Maths CSV still lacks reviewed link grades, so its links all use weight 1. The session run loop is not built yet.

## Pack loader and stopping rules (Ahmed's slice)

- `sonder_engine/pack.py` builds diagnostic units U1–U7 from rows already read (no file I/O), applies hard rules V1–V11 and reports W1–W6 and every configured exclusion on each load. `sonder_pack/maths_v2.py` is the only code that reads files; `python -m sonder_pack.maths_v2` prints the units, source hashes and warnings. The unit table, including the D-2 skips, the MATH-1416 drop for U6 and the D-4 unplaced label, is `sonder_pack/maths_v2_units.json`.
- `sonder_engine/stopping.py` applies rules R1–R5 (spec 3.5) in order and returns a `StopDecision` with one of six outcomes. Every threshold comes from `Params`.
- Known limitations are listed in `sonder_engine/KNOWN_FAULTS.md`, each with the warning or test that backs it.
