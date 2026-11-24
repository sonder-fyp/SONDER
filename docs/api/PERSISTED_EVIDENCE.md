# Persisted evidence interface

Rows are the evidence; replay checks them. This read-only interface serves Ashher's evidence and evaluation consumers and Harris's content parity check.

| Field | Source |
| --- | --- |
| `session_id`, `question_budget`, timestamps, outcome status | `diagnostic_session` |
| `unit_id` | `diagnostic_unit.unit_code` |
| `release`, `content_version` | `response_model.model_code`, `content_version.version_code` |
| `params_sha256`, `engine_release` | `engine_params.params_sha256`, `engine_release.release_code` |
| `hypotheses` | `session_hypothesis`, `hypothesis`, `misconception_revision`, `misconception` |
| `questions`, candidates | `session_question`, `question_candidate`, `item` |
| `steps`, answer and note | `session_step`, `item`, `item_option` |
| `posterior` | `step_posterior`, ordered by `session_hypothesis.slot` |
| `support` | `step_support` view (calculated, not stored) |
| diagnosis and escalation | `diagnosis`, `diagnosis_candidate`, `escalation`, `escalation_candidate` |

Each session pins its `response_model_id`, which joins `response_model` to `content_version` and `engine_params`; `engine_release_id` joins its engine identity. The release combines the content version and model codes. The parameters hash identifies the stored parameter set.

## D1 example

*24 November 2026. Runs recorded before PR #92 used the 117-item bank (D1 = D, B, B, A on T1-005, T1-006, T1-007, T1-009). On the 133-item candidate D1 is B, B, A, B on T1-001, T1-006, T1-005, T1-007; the harness scripts were updated in PR #92.*

Captured from the local development candidate release after answers D, B, B, A:

```json
{
  "session_id": "<session-id>",
  "unit_id": "U1",
  "question_budget": 8,
  "release": "Maths_v2-U1-dev/spec-v2-prior",
  "content_version": "Maths_v2-U1-dev",
  "params_sha256": "b0f1aa3c681f5e0db048d2bcc7fd388def7c176c0d70b21b3266dbee8d5b7e41",
  "engine_release": "0.1.0+fbe0204a623d",
  "started_at": "2026-11-16T15:12:01.609980+00:00",
  "ended_at": "2026-11-16T15:12:02.021579+00:00",
  "hypotheses": [
    {
      "slot": 0,
      "hypothesis_id": "MATH-1248",
      "kind": "misconception",
      "prior": 0.175
    },
    {
      "slot": 1,
      "hypothesis_id": "MATH-1379",
      "kind": "misconception",
      "prior": 0.175
    },
    {
      "slot": 2,
      "hypothesis_id": "MATH-1988",
      "kind": "misconception",
      "prior": 0.175
    },
    {
      "slot": 3,
      "hypothesis_id": "MATH-2392",
      "kind": "misconception",
      "prior": 0.175
    },
    {
      "slot": 4,
      "hypothesis_id": "NONE",
      "kind": "none",
      "prior": 0.25
    },
    {
      "slot": 5,
      "hypothesis_id": "UNMODELLED",
      "kind": "unmodelled",
      "prior": 0.05
    }
  ],
  "questions": [
    {
      "step_index": 0,
      "item_id": "T1-005",
      "selection_reason": "Chosen to separate NONE (p=0.250) from MATH-1248 (p=0.175): NONE predicts D = correct; MATH-1248 predicts B. Expected information gain 0.789 bits, best of 20 candidate items; next best T1-006 at 0.789 bits (tie broken by item order).",
      "entropy_before": 2.476297625725199,
      "expected_ig": 0.788730898,
      "candidates": [
        {
          "rank": 1,
          "item_id": "T1-005",
          "eig": 0.788730898
        },
        {
          "rank": 2,
          "item_id": "T1-006",
          "eig": 0.788730898
        },
        {
          "rank": 3,
          "item_id": "T1-007",
          "eig": 0.788730898
        },
        {
          "rank": 4,
          "item_id": "T1-008",
          "eig": 0.788730898
        },
        {
          "rank": 5,
          "item_id": "T1-009",
          "eig": 0.788730898
        },
        {
          "rank": 6,
          "item_id": "T1-010",
          "eig": 0.788730898
        },
        {
          "rank": 7,
          "item_id": "T1-013",
          "eig": 0.788730898
        },
        {
          "rank": 8,
          "item_id": "T1-015",
          "eig": 0.788730898
        },
        {
          "rank": 9,
          "item_id": "T1-017",
          "eig": 0.788730898
        },
        {
          "rank": 10,
          "item_id": "T1-018",
          "eig": 0.788730898
        },
        {
          "rank": 11,
          "item_id": "T1-019",
          "eig": 0.788730898
        },
        {
          "rank": 12,
          "item_id": "T1-020",
          "eig": 0.788730898
        },
        {
          "rank": 13,
          "item_id": "T1-001",
          "eig": 0.696944127
        },
        {
          "rank": 14,
          "item_id": "T1-002",
          "eig": 0.696944127
        },
        {
          "rank": 15,
          "item_id": "T1-003",
          "eig": 0.696944127
        },
        {
          "rank": 16,
          "item_id": "T1-004",
          "eig": 0.696944127
        },
        {
          "rank": 17,
          "item_id": "T1-011",
          "eig": 0.696944127
        },
        {
          "rank": 18,
          "item_id": "T1-012",
          "eig": 0.696944127
        },
        {
          "rank": 19,
          "item_id": "T1-014",
          "eig": 0.696944127
        },
        {
          "rank": 20,
          "item_id": "T1-016",
          "eig": 0.696944127
        }
      ]
    },
    {
      "step_index": 1,
      "item_id": "T1-006",
      "selection_reason": "Chosen to separate NONE (p=0.503) from MATH-1988 (p=0.352): NONE predicts B = correct; MATH-1988 predicts D. Expected information gain 0.647 bits, best of 19 candidate items; next best T1-008 at 0.647 bits (tie broken by item order).",
      "entropy_before": 1.721807354427318,
      "expected_ig": 0.64715037,
      "candidates": [
        {
          "rank": 1,
          "item_id": "T1-006",
          "eig": 0.64715037
        },
        {
          "rank": 2,
          "item_id": "T1-008",
          "eig": 0.64715037
        },
        {
          "rank": 3,
          "item_id": "T1-013",
          "eig": 0.64715037
        },
        {
          "rank": 4,
          "item_id": "T1-019",
          "eig": 0.64715037
        },
        {
          "rank": 5,
          "item_id": "T1-020",
          "eig": 0.64715037
        },
        {
          "rank": 6,
          "item_id": "T1-002",
          "eig": 0.603242077
        },
        {
          "rank": 7,
          "item_id": "T1-003",
          "eig": 0.603242077
        },
        {
          "rank": 8,
          "item_id": "T1-011",
          "eig": 0.603242077
        },
        {
          "rank": 9,
          "item_id": "T1-012",
          "eig": 0.603242077
        },
        {
          "rank": 10,
          "item_id": "T1-007",
          "eig": 0.329950272
        },
        {
          "rank": 11,
          "item_id": "T1-009",
          "eig": 0.329950272
        },
        {
          "rank": 12,
          "item_id": "T1-010",
          "eig": 0.329950272
        },
        {
          "rank": 13,
          "item_id": "T1-015",
          "eig": 0.329950272
        },
        {
          "rank": 14,
          "item_id": "T1-017",
          "eig": 0.329950272
        },
        {
          "rank": 15,
          "item_id": "T1-018",
          "eig": 0.329950272
        },
        {
          "rank": 16,
          "item_id": "T1-001",
          "eig": 0.318495052
        },
        {
          "rank": 17,
          "item_id": "T1-004",
          "eig": 0.318495052
        },
        {
          "rank": 18,
          "item_id": "T1-014",
          "eig": 0.318495052
        },
        {
          "rank": 19,
          "item_id": "T1-016",
          "eig": 0.318495052
        }
      ]
    },
    {
      "step_index": 2,
      "item_id": "T1-007",
      "selection_reason": "Chosen to separate NONE (p=0.842) from MATH-1379 (p=0.065): NONE predicts C = correct; MATH-1379 predicts B. Expected information gain 0.223 bits, best of 18 candidate items; next best T1-008 at 0.223 bits (tie broken by item order).",
      "entropy_before": 0.9090544698594551,
      "expected_ig": 0.223229353,
      "candidates": [
        {
          "rank": 1,
          "item_id": "T1-007",
          "eig": 0.223229353
        },
        {
          "rank": 2,
          "item_id": "T1-008",
          "eig": 0.223229353
        },
        {
          "rank": 3,
          "item_id": "T1-009",
          "eig": 0.223229353
        },
        {
          "rank": 4,
          "item_id": "T1-010",
          "eig": 0.223229353
        },
        {
          "rank": 5,
          "item_id": "T1-013",
          "eig": 0.223229353
        },
        {
          "rank": 6,
          "item_id": "T1-015",
          "eig": 0.223229353
        },
        {
          "rank": 7,
          "item_id": "T1-017",
          "eig": 0.223229353
        },
        {
          "rank": 8,
          "item_id": "T1-018",
          "eig": 0.223229353
        },
        {
          "rank": 9,
          "item_id": "T1-019",
          "eig": 0.223229353
        },
        {
          "rank": 10,
          "item_id": "T1-020",
          "eig": 0.223229353
        },
        {
          "rank": 11,
          "item_id": "T1-001",
          "eig": 0.219188507
        },
        {
          "rank": 12,
          "item_id": "T1-002",
          "eig": 0.219188507
        },
        {
          "rank": 13,
          "item_id": "T1-003",
          "eig": 0.219188507
        },
        {
          "rank": 14,
          "item_id": "T1-004",
          "eig": 0.219188507
        },
        {
          "rank": 15,
          "item_id": "T1-011",
          "eig": 0.219188507
        },
        {
          "rank": 16,
          "item_id": "T1-012",
          "eig": 0.219188507
        },
        {
          "rank": 17,
          "item_id": "T1-014",
          "eig": 0.219188507
        },
        {
          "rank": 18,
          "item_id": "T1-016",
          "eig": 0.219188507
        }
      ]
    },
    {
      "step_index": 3,
      "item_id": "T1-009",
      "selection_reason": "Chosen to separate MATH-1379 (p=0.567) from NONE (p=0.347): MATH-1379 predicts A; NONE predicts B = correct. Expected information gain 0.555 bits, best of 17 candidate items; next best T1-010 at 0.555 bits (tie broken by item order).",
      "entropy_before": 1.443358643023352,
      "expected_ig": 0.554587942,
      "candidates": [
        {
          "rank": 1,
          "item_id": "T1-009",
          "eig": 0.554587942
        },
        {
          "rank": 2,
          "item_id": "T1-010",
          "eig": 0.554587942
        },
        {
          "rank": 3,
          "item_id": "T1-015",
          "eig": 0.554587942
        },
        {
          "rank": 4,
          "item_id": "T1-017",
          "eig": 0.554587942
        },
        {
          "rank": 5,
          "item_id": "T1-018",
          "eig": 0.554587942
        },
        {
          "rank": 6,
          "item_id": "T1-001",
          "eig": 0.541940971
        },
        {
          "rank": 7,
          "item_id": "T1-004",
          "eig": 0.541940971
        },
        {
          "rank": 8,
          "item_id": "T1-014",
          "eig": 0.541940971
        },
        {
          "rank": 9,
          "item_id": "T1-016",
          "eig": 0.541940971
        },
        {
          "rank": 10,
          "item_id": "T1-008",
          "eig": 0.179929449
        },
        {
          "rank": 11,
          "item_id": "T1-013",
          "eig": 0.179929449
        },
        {
          "rank": 12,
          "item_id": "T1-019",
          "eig": 0.179929449
        },
        {
          "rank": 13,
          "item_id": "T1-020",
          "eig": 0.179929449
        },
        {
          "rank": 14,
          "item_id": "T1-002",
          "eig": 0.177648859
        },
        {
          "rank": 15,
          "item_id": "T1-003",
          "eig": 0.177648859
        },
        {
          "rank": 16,
          "item_id": "T1-011",
          "eig": 0.177648859
        },
        {
          "rank": 17,
          "item_id": "T1-012",
          "eig": 0.177648859
        }
      ]
    }
  ],
  "steps": [
    {
      "step_index": 0,
      "item_id": "T1-005",
      "option_id": "D",
      "answer_note": "Chose D (49,000), the correct option.",
      "posterior": [
        0.03910614525139664,
        0.03910614525139664,
        0.35195530726256985,
        0.03910614525139664,
        0.5027932960893855,
        0.02793296089385475
      ],
      "support": [
        0,
        0,
        0,
        0,
        1,
        0
      ]
    },
    {
      "step_index": 1,
      "item_id": "T1-006",
      "option_id": "B",
      "answer_note": "Chose B (23,000), the correct option.",
      "posterior": [
        0.007272727272727272,
        0.06545454545454545,
        0.06545454545454545,
        0.007272727272727272,
        0.8415584415584416,
        0.012987012987012988
      ],
      "support": [
        0,
        0,
        0,
        0,
        2,
        0
      ]
    },
    {
      "step_index": 2,
      "item_id": "T1-007",
      "option_id": "B",
      "answer_note": "Chose B (8,300), linked to MATH-1379.",
      "posterior": [
        0.009006111289803794,
        0.5673850112576391,
        0.027018333869411385,
        0.009006111289803794,
        0.3473785783210036,
        0.04020585397233838
      ],
      "support": [
        0,
        1,
        0,
        0,
        2,
        0
      ]
    },
    {
      "step_index": 3,
      "item_id": "T1-009",
      "option_id": "A",
      "answer_note": "Chose A (15,000), linked to MATH-1379.",
      "posterior": [
        0.002136670609332672,
        0.9422717387157084,
        0.0021366706093326722,
        0.002136670609332672,
        0.02747147926284865,
        0.023846770193445006
      ],
      "support": [
        0,
        2,
        0,
        0,
        2,
        0
      ]
    }
  ],
  "outcome": {
    "outcome": "diagnosed",
    "diagnosis_candidates": [
      [
        1,
        1
      ],
      [
        2,
        4
      ]
    ],
    "escalation_reason": null,
    "escalation_leader_slot": null,
    "escalation_candidates": []
  }
}
```

## Python

```python
from sonder_api.stored_evidence import stored_evidence, verify_session

evidence = stored_evidence(connection, session_id)
differences = verify_session(connection, session_id)  # [] means the stored fields match replay
```

## SQL

This query lists each step and its highest posterior (run against the D1 scratch session; items T1-005, T1-006, T1-007, T1-009 were returned):

```sql
SELECT DISTINCT ON (st.step_index) st.step_index, i.external_id AS item_id,
       sh.slot, sp.probability
FROM sonder.session_step st
JOIN sonder.session_question q ON q.id = st.session_question_id
JOIN sonder.item i ON i.id = q.item_id
JOIN sonder.step_posterior sp ON sp.step_id = st.id
JOIN sonder.session_hypothesis sh ON sh.id = sp.session_hypothesis_id
WHERE st.session_id = :session_id
ORDER BY st.step_index, sp.probability DESC, sh.slot;
```

## Consumer rules

Read only. Each consumer enforces teacher/class scope in its own query: join `diagnostic_session.enrolment_id` to `enrolment.class_id` and `class_teacher`. Never expose this evidence to students. The service checks replayed question selections and outcome on requests; `verify_session` compares the full stored evidence, including posterior and support, and can detect changes that do not alter the selected questions.

Run `python -m sonder_api.stored_evidence --all` to verify all sessions, or `python -m sonder_api.stored_evidence --session ID` to print and verify one.
