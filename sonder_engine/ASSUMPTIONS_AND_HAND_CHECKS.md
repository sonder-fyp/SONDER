# Bayes calculation evidence and assumptions

This note documents Ashher's calculation slice. All examples are **synthetic**. They are not student results, calibration, or acceptance of the current Maths bank. The equations follow `docs/ENGINE_SPEC_DRAFT.md` sections 5.0–5.1; this executable package and its tests are the reproducible evidence for these functions.

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

Every row sums to one. Three options linked to a single misconception are rejected under draft pack rule V11: with `guess=0.30`, each predicted answer would get `0.70/3 ≈ 0.233`, while the remaining unpredicted answer would get `0.30`. Three approved T6 items currently need a content/model decision before live use; this function does not silently repair them.

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
