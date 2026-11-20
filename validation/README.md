# Math dataset validation

Run from the repository root with Python 3.10 or newer. The validator uses only
the Python standard library and never modifies the dataset.

```powershell
python -m validation.math_dataset
python -m unittest discover -s tests -v
```

The first command checks `data/Maths_v2/` by default. Pass `--root PATH` to check
a separate copy. Pass `--guess 0.24` to inspect a different assumed P1 setting.
Pass `--strict-contract` to make a P1 conflict fail the command.

- **ERROR** means a CSV is malformed, the approved bank is internally inconsistent,
  a link/target ID is undeclared, or approved content differs from its authored
  batch. The command exits with status 1.
- **CONTRACT** means the assumed `guess` violates spec v2's item-specific P1
  condition. At the default `0.30`, the three T6 items with MATH-1416 on three
  wrong answers are reported. V11 allows those links structurally; their use
  in a response model is the team's D-2 decision. `--strict-contract` exits
  with status 1 while any P1 conflict remains.
- **WARNING** means the importer needs an explicit topic-label mapping. This is
  not automatically a faulty question.

The validator does not build diagnostic units or check whether each item's
links belong to a unit. Ahmed's pack loader and the database freeze rules must
check that separately. The bank's `approved` status and a batch's `draft` status may differ: the bank
records the later approval, while the batch preserves the authored version.
Questions present only in a draft batch are allowed. No topic-label, question,
answer, or misconception mapping is silently corrected by this tool.

Structural checks do **not** prove that the correct answer is mathematically
correct, that a distractor truly follows from its linked misconception, or that
two misconceptions are distinguishable. Those require independent content review
with Harris and a recorded decision before the live pack is frozen.
