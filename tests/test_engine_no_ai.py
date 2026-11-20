"""Generative AI stays outside the diagnostic calculation (T06.07).

The checks read the source code itself: every engine module may import only the
standard-library pieces a pure calculation needs plus NumPy, and calls nothing
that reads files, the network, the clock or a random source. The pack reader may
read files but imports no network or model client. Determinism is checked by
rebuilding the same session from scratch.
"""

from __future__ import annotations

import ast
import tomllib
import unittest
from pathlib import Path

from sonder_engine import Params, replay, trace_of, trace_to_dict
from sonder_pack.maths_v2 import load_maths_v2

ROOT = Path(__file__).resolve().parents[1]
ENGINE_ALLOWED = {"__future__", "collections.abc", "dataclasses", "enum", "itertools", "math", "typing",
                  "numpy", "numpy.typing"}
PACK_ALLOWED = {"__future__", "argparse", "csv", "hashlib", "io", "json", "pathlib", "sys"}
FORBIDDEN_CALLS = {"open", "eval", "exec", "compile", "__import__", "input", "breakpoint"}


def imports(path: Path) -> set[str]:
    """Absolute module names imported by a file (relative imports are the package itself)."""
    found = set()
    for node in ast.walk(ast.parse(path.read_text(encoding="utf-8"))):
        if isinstance(node, ast.Import):
            found |= {alias.name for alias in node.names}
        elif isinstance(node, ast.ImportFrom) and node.level == 0:
            found.add(node.module)
    return found


def calls(path: Path) -> set[str]:
    return {node.func.id for node in ast.walk(ast.parse(path.read_text(encoding="utf-8")))
            if isinstance(node, ast.Call) and isinstance(node.func, ast.Name)}


class NoAiTests(unittest.TestCase):
    def test_engine_modules_import_only_pure_calculation_libraries(self):
        modules = sorted((ROOT / "sonder_engine").glob("*.py"))
        self.assertGreaterEqual(len(modules), 9)  # including Ashher's and Harris's modules
        for path in modules:
            with self.subTest(module=path.name):
                self.assertLessEqual(imports(path), ENGINE_ALLOWED)
                self.assertFalse(calls(path) & FORBIDDEN_CALLS)

    def test_pack_reader_imports_no_network_or_model_client(self):
        for path in sorted((ROOT / "sonder_pack").glob("*.py")):
            with self.subTest(module=path.name):
                own = {m for m in imports(path) if m.split(".")[0] in ("sonder_engine", "sonder_pack")}
                self.assertLessEqual(imports(path) - own, PACK_ALLOWED)
                self.assertFalse(calls(path) & (FORBIDDEN_CALLS - {"open"}))

    def test_the_package_depends_only_on_numpy(self):
        project = tomllib.loads((ROOT / "pyproject.toml").read_text(encoding="utf-8"))["project"]
        self.assertEqual([d.split(">")[0].split("=")[0].strip() for d in project["dependencies"]], ["numpy"])

    def test_the_same_answers_give_the_same_trace_from_a_fresh_load(self):
        first = trace_to_dict(trace_of(replay(load_maths_v2().unit("U3"), Params(), ["A", "B", "C"])))
        second = trace_to_dict(trace_of(replay(load_maths_v2().unit("U3"), Params(), ["A", "B", "C"])))
        self.assertEqual(first, second)

    def test_the_session_accepts_only_option_ids(self):
        from sonder_engine import EngineError, next_question, answer, start
        state = next_question(start(load_maths_v2().unit("U1"), Params()))
        for text in ("The student probably means B", "", "b", " B"):
            with self.subTest(answer=text):
                with self.assertRaises(EngineError) as caught:
                    answer(state, state.pending.item_id, text)
                self.assertEqual(caught.exception.code, "invalid_option")


if __name__ == "__main__":
    unittest.main()
