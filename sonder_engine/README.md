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
