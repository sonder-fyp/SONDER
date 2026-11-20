# Independent review of the Maths_v2 bank

**Historical review note:** this records the review against the earlier engine
draft. Spec v2 now allows three linked wrong options, uses diagnostic units
instead of topic-scoped sessions, and permits up to eight misconceptions. The
current validator reports the three T6 items as P1 conflicts at the default
`guess=0.30`, rather than as V11 structural errors. The content-quality
findings below still require human review.

**Reviewer:** Ashher
**Dataset revision inspected:** `4f80f6699ad2e0ae804df3c3dcb38eefe5f8fb32` (`dev`, after Harris's Math PR #5)
**Purpose:** identify what can safely feed the first diagnostic pack. This is review evidence, **not** approval of every question or a change to Harris's authored CSVs.

## What was checked

- Ran `python -m validation.math_dataset` on `data/Maths_v2/`. The validator checked all 117 bank items (468 option rows), all 28 declared misconception IDs, and the matching authored batches. It found **0 structural errors**, **31 draft-contract findings** (26 V5 topic-membership cases, 2 V7 hypothesis-limit cases, 3 V11 linked-option cases), and **6 bank topic labels requiring explicit mapping**.
- Ran `python -m validation.math_dataset --strict-contract`; it exits with status 1 while the pack decisions remain unresolved. This failure is intentional evidence, not a passing pack-acceptance result.
- Visually scanned the stems and marked correct options for all 117 bank items (T1: 20; T2: 25; T3: 10; T4: 10; T5: 16 including cross-concept; T6: 20 including operation variants; T7: 16). No clearly incorrect marked answer was found in this scan. This is **not** a full independent derivation of every distractor-to-misconception link.
- Compared bank and authored batch rows: their item/option content matches; the only expected difference is `status=approved` in the bank versus `status=draft` in batches. B09 has 9 draft items and is not in the bank.

## Findings requiring a decision or correction

| ID | Finding and evidence | Why it matters | Owner/next action |
| --- | --- | --- | --- |
| **M1 — pack blocker** | In approved items **T6-011B, T6-014B, T6-016B**, `MATH-1416` links to three options. `ENGINE_SPEC_DRAFT.md` rule V11 permits at most two. | A loader following V11 would reject these items. Under the draft `guess=0.30` model, each of three predicted options gets `0.70/3 ≈ 0.233`, while the remaining option gets `0.30`; the nominally predicted answers are individually less likely. | **Harris + Ahmed + Ashher:** choose defensible content links, change the model/rule with a test, or exclude these items from the first pack. Do not silently drop a link. |
| **M2 — importer/pack grouping** | Six bank topic labels do not exactly match any label in `topics.csv`: T4's shorter label, T6's seconds-and-hours label, T5 cross-concept, and three T6 cross-topic labels. **26 items** link to IDs outside their `T1`–`T7` grouping in `topics.csv`; this conflicts with draft V5 unless their eventual pack declares those IDs. The T7 label links **7** distinct IDs and the T6 percentage/operation label links **8**, above draft `K_MAX=6` if each becomes one pack. | Joining by text would omit questions or put them in the wrong topic. A pack using only the canonical topic IDs would reject cross-topic links; loading all linked IDs for some labels would exceed the draft's hypothesis limit. These are grouping decisions, not proof that the authored questions are wrong. | **Ahmed**, with **Harris** confirming intended topic ownership: define an explicit topic-ID mapping and first-pack inclusion list. **Ashher** checks that the selected questions and hypothesis order match the calculation. |
| **M3 — T1 content review** | **T1-001 D, T1-002 C, T1-003 D, T1-004 D** are unlinked but resemble coarse "rounds too much" responses; `MATH-2392` is the catalogue's "rounds too much" misconception. The [item-level T1 review](T1_ROUNDING_ITEM_REVIEW.md) also finds **11** unchanged-number options linked to `MATH-1248`; the B01/B02 audit counted ten and omitted T1-017 C. | An unlinked answer counts as unmodelled evidence. An unchanged answer is only a weak proxy for "rounds too little" and may represent failure to round or a misread instruction. Both choices affect the likelihood/posterior. | **Harris** decides the four absent links and the eleven weak links, then confirms the live subset. **Ashher** reruns validation and checks the T1 demo path after any accepted change. |
| **M4 — inseparable hypotheses** | In T4, `MATH-1514` and `MATH-1773` share the same linked option on every one of the ten T4 questions. The existing notes also flag `MATH-1651`/`MATH-1074` in T6 and weak separation of `MATH-414`/`MATH-734` in T5. | The engine cannot honestly select a unique misconception from an inseparable pair using that topic's questions. This may be a deliberate refusal demo, but it must not become a forced diagnosis. | **Harris** confirms the catalogue/content decision. **Ahmed** implements the no-separator outcome; **Ashher** checks the likelihood/posterior and test case. |
| **M5 — question wording** | **T5-003** says a number is "multiplied by itself three times" to make 27. This can be read as three factors or three multiplication operations. | Ambiguous wording may make a student's answer hard to interpret as a misconception. | **Harris** decides a clearer stem; **Ashher** verifies the answer and mappings after revision. |
| **M6 — stale evidence** | `ENGINE_SPEC_DRAFT.md` describes an **80-item** bank, says T3/T7 are absent, and references `docs/engine_ref/` files not in this repository. `coverage.md` contains old interim counts and later fixes; `LINK_AUDIT_SUMMARY.md` still says the 117-item bank is untouched. The five forced-link fixes described at the end of `coverage.md` are present in the current CSV. | Report, tests, and engine design must cite the current bank, not an earlier snapshot or tests unavailable from a clean checkout. | **Ahmed** updates the engine spec after the pack decision; **Harris** reconciles coverage/audit notes. **Ashher** verifies any numeric examples against the current pack. |

## Review boundary and next verification

- The CSV status `approved` reflects the committed bank; this review has **not** accepted every misconception mapping. The earlier agent link-audit grades are leads to investigate, not independent human approval. The audit lists many stretch links, including unchanged-number rounding answers and fraction-to-percentage interpretations.
- Item source, permission/licence, author/generator, reviewer, date, and content version are not recorded as columns in `items.csv`. Harris's authored batches and review notes provide some history, but the exact **demo subset** still needs an explicit provenance/review record before the evaluation freeze.
- For the first working slice, T1 is a practical candidate because it has 20 bank questions and four named misconceptions; **M3 must be resolved or explicitly accepted** before calling its live content reviewed. T4 can demonstrate refusal for M4 after the UI/engine supports its five misconceptions.
- After Harris and Ahmed decide M1–M5, rerun the validator, check the approved demo item IDs one by one, recalculate hand-checkable likelihood/posterior examples, and record the accepted pack version. Preserve defect input, decision, fix author, and rerun result.

No source CSV, topic list, batch, or engine specification was modified by this review.
