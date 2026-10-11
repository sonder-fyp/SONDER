# Bayes calculation evidence and assumptions

This note documents Ashher's calculation slice. The hand-design and sensitivity examples are **synthetic**; a later section checks the current Maths CSV as candidate content. None of these are student results, calibration, or acceptance of the current Maths bank. The equations follow `docs/ENGINE_SPEC_DRAFT.md` v2 sections 3.1–3.3; this package and its tests are reproducible evidence for these functions.

## Prior and hypothesis order

For four ordered misconceptions followed by `NONE, UNMODELLED`, the assumed masses are `0.25` for `NONE` and `0.05` for `UNMODELLED`. The remainder is `(1 - 0.25 - 0.05) / 4 = 0.175` per misconception. Thus the prior is `(0.175, 0.175, 0.175, 0.175, 0.25, 0.05)`. Changing either reserved mass changes the misconception masses; it is not a measured prevalence.

## Likelihood with a shared answer and two links for one hypothesis

Take a four-option item with correct option A. Option B links to `M1` and `M2`; C links to `M1`; D is unlinked. With assumed `guess=0.30` and `slip=0.10`:

| Hypothesis | A | B | C | D | Reason |
| --- | ---: | ---: | ---: | ---: | --- |
| M1 | 0.15 | 0.35 | 0.35 | 0.15 | B and C share its `0.70` predicted mass. |
| M2 | 0.10 | 0.70 | 0.10 | 0.10 | B alone gets its full predicted mass, despite M1 also linking B. |
| Untriggered M3 | 0.90 | 1/30 | 1/30 | 1/30 | Without a link, it predicts the correct answer. |
| NONE | 0.90 | 1/30 | 1/30 | 1/30 | Correct answer predicted. |
| UNMODELLED | 0.25 | 0.25 | 0.25 | 0.25 | Uniform over options. |

Every row sums to one. V11 now allows a misconception to link to three wrong options, but P1 checks whether the chosen `guess` supports that set size. At `guess=0.30`, each of three predicted answers would get `0.70/3 ≈ 0.233`, while the unpredicted correct answer would get `0.30`. Therefore `check_p1` and `likelihood_matrix` refuse the three affected T6 items with the default parameters. For a three-option set, `guess` must be **strictly below 0.25**. Choosing a different guess or changing the links is the team's D-2 decision; the code does not make it silently.

An optional link grade is `S` (sound) or `T` (stretch). Missing grades are `S`, so every current Maths item retains the original row. With the assumed default `w_stretch=0.5`, a stretch-linked misconception uses `0.5 × linked row + 0.5 × NONE row`. If it has several linked options on the item, the lowest of their weights applies to the whole row. This is a proposed evidence-strength rule, not a calibrated student response frequency. The CSV does not yet record human-approved grades.

## Independent posterior calculation

For a separate synthetic item, take prior `p=(.175,.175,.175,.175,.25,.05)` and observed option D with likelihood column `L_D=(.1,.1,.9,.1,.9,.25)`. Multiplying entry by entry gives the joint vector `(.0175,.0175,.1575,.0175,.225,.0125)`. Its evidence is `z=.4475`. Dividing the joint vector by `.4475` yields the posterior. `tests/test_bayes.py` checks these independently written values, repeats the call for identical output, and confirms that inputs are unchanged.

For an unlinked wrong answer, each catalogued hypothesis receives only its off-prediction mass while `UNMODELLED` gives it `0.25`. A synthetic test checks that this answer raises the posterior mass of `UNMODELLED`; it does not imply that every unlinked real answer is genuinely off-catalogue.

## Small parameter sensitivity check

For a synthetic two-misconception item, A is correct, B links only M1, C links only M2, and D is unlinked. Each row changes **one assumed parameter** while the others stay at their defaults. Values below are reproducible from `prior`, `likelihood_matrix`, and `update_posterior`; they describe model sensitivity, not diagnostic accuracy.

| Assumption | P(M1 after B) | P(UNMODELLED after D) |
| --- | ---: | ---: |
| Defaults: slip .10, guess .30, prior NONE .25, prior UNMODELLED .05 | .814404 | .137615 |
| slip .08 | .818942 | .140187 |
| slip .12 | .809917 | .135135 |
| guess .24 | .844891 | .162690 |
| guess .36 | .780941 | .119237 |
| prior NONE .20 | .822454 | .132743 |
| prior NONE .30 | .805310 | .142857 |
| prior UNMODELLED .04 | .821940 | .111940 |
| prior UNMODELLED .06 | .806793 | .162455 |

These are one-answer changes only. They do **not** establish robustness of an eventual session outcome; that needs Harris's selector, Ahmed's stop/run loop, an accepted content pack, and separate end-to-end checks. A future versioned parameter file and content hash must be pinned to each session by the service.

## Read-only current Maths bank exercise

`tests/test_bayes_math_candidate.py` reads the current `Maths_v2` CSVs into `Item` objects **only in the test**. At this review the Git blob IDs are `95ba1cd1ba34f73d6ccb83b1841aeb8928ea6a8d` for `bank/items.csv` and `ae0528f26c9be57d6a62e704a4b76aa7aea9c245` for `topics.csv`. It checks that all 20 T1 rounding items produce positive, normalized six-by-four likelihood matrices and that every one of their 80 possible one-answer posteriors is finite and normalized. An additional exact-`Fraction` reference independently calculates **all 480 likelihood entries and all 80 posteriors**; the largest observed absolute float64 difference in the exploratory posterior comparison was `1.11e-16`. The production package itself still reads no CSV.

For T1-005, the current stem asks for 48,630 rounded to the nearest 1,000. Option B is 48,600 and links to `MATH-1248`; D is the correct 49,000. Starting from the six-entry default prior, observing **B** gives posterior `(147, 21, 7, 21, 10, 15) / 221`, or about `(0.665158, 0.095023, 0.031674, 0.095023, 0.045249, 0.067873)`. Observing **D** instead gives `(0.039106, 0.039106, 0.351955, 0.039106, 0.502793, 0.027933)`. The large remaining mass on `MATH-1988` after D occurs because that misconception is not triggered on this item and therefore predicts the correct answer like `NONE`.

These results prove that the calculation functions can consume this **candidate** content and produce reproducible numbers. They do not show automatic question choice, a stopping decision, a diagnosis, a real-student accuracy result, or UI/service integration. They also do not settle the T1 link-quality issues recorded in `validation/T1_ROUNDING_ITEM_REVIEW.md`.

A second read-only test manually applies T1-005 answer B followed by T1-007 answer D to the same posterior. Both options link to `MATH-1248`; the resulting six masses are `(6174, 126, 14, 126, 20, 225) / 6685`, with `MATH-1248 ≈ 0.923560`. This demonstrates repeated Bayesian updates, while leaving item choice and diagnosis to their actual owners.

The automated read-only per-item calculation audit now loads **all 117 items** and compares all **468** one-answer paths with exact `Fraction` arithmetic. The three B14 items—**T6-011B, T6-014B and T6-016B**—correctly fail P1 at the default `guess=0.30`. To check their arithmetic without choosing a live model, that test separately uses `guess=0.24`; the other 114 use the default. The audit uses each item's own linked-ID set as its hypotheses, **not** an approved unit pack, so these posteriors are not live-session results. The content and pack decisions remain separate.

## Numeric edge audit

The first parameter validator allowed tiny positive float64 rates such as `5e-324`. Dividing such a `slip` or `guess` among three off-prediction options rounded the result to zero, violating the engine's strictly-positive likelihood contract. The validator now requires each rate and reserved prior mass to be at least `1e-12`. This keeps the default values and every example above unchanged. A regression test checks rejection below the floor and positive rows at the floor. A deterministic exploratory run of 200 parameter settings with eight T1 answers per setting produced only finite, normalized posteriors; this is a numerical stress check, not evidence about real students or model calibration.
