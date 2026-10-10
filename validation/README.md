# Math dataset validation

Run from the repository root with Python 3.10 or newer. The validator uses only
the Python standard library and never modifies the dataset.

```powershell
python -m validation.math_dataset
python -m unittest discover -s tests -v
```

The first command checks `data/Maths_v2/` by default. Pass `--root PATH` to check
a separate copy. Pass `--strict-contract` when deciding whether the **current
draft** engine pack rule V11 can accept every bank item.

- **ERROR** means a CSV is malformed, the approved bank is internally inconsistent,
  a link/target ID is undeclared, or approved content differs from its authored
  batch. The command exits with status 1.
- **CONTRACT** means an approved item conflicts with a rule in
  `docs/ENGINE_SPEC_DRAFT.md`. The draft is awaiting team agreement; these findings
  make `--strict-contract` exit with status 1.
- **WARNING** means the importer needs an explicit topic-label mapping. This is
  not automatically a faulty question.

The bank's `approved` status and a batch's `draft` status may differ: the bank
records the later approval, while the batch preserves the authored version.
Questions present only in a draft batch are allowed. No topic-label, question,
answer, or misconception mapping is silently corrected by this tool.

Structural checks do **not** prove that the correct answer is mathematically
correct, that a distractor truly follows from its linked misconception, or that
two misconceptions are distinguishable. Those require independent content review
with Harris and a recorded decision before the live pack is frozen.
