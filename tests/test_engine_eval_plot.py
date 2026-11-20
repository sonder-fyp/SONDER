"""Figures are generated from saved metrics only (I2-A10)."""

from __future__ import annotations

import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

from experiments.evaluate import evaluate

ROOT = Path(__file__).resolve().parents[1]
FIGURES = ("holder-outcomes", "holder-rates", "questions-used", "adverse-labelling")


@unittest.skipUnless(importlib.util.find_spec("matplotlib"), "install the eval extra: pip install -e '.[eval]'")
class PlotTests(unittest.TestCase):
    def test_every_figure_is_drawn_from_metrics_without_the_raw_runs(self):
        from experiments.plot import plot

        config = json.loads((ROOT / "experiments" / "configs" / "u1u2-tuning.json").read_text(encoding="utf-8"))
        config["name"], config["seeds"]["count"] = "plot-test", 3
        with tempfile.TemporaryDirectory() as tmp:
            path, out = Path(tmp) / "c.json", Path(tmp) / "out"
            path.write_text(json.dumps(config), encoding="utf-8")
            manifest = evaluate(path, out)
            (out / "runs.csv").unlink()  # the figures may use metrics.csv and manifest.json only
            captions = plot(out)
            for name in FIGURES:
                with self.subTest(figure=name):
                    self.assertGreater((out / "figures" / f"{name}.png").stat().st_size, 10_000)
                    self.assertTrue((out / "figures" / f"{name}.svg").exists())
            text = (out / "figures" / "figures.md").read_text(encoding="utf-8")
            self.assertEqual(len(captions), len(FIGURES))
            self.assertIn(manifest["git_commit"], text)
            self.assertIn(manifest["config_sha256"], text)
            self.assertIn("Not accuracy on real students", text)


if __name__ == "__main__":
    unittest.main()
