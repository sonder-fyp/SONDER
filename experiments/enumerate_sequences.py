"""Every possible answer sequence of a unit, through the real engine (I2-A05).

The engine chooses each question; this walks every option of every question it
asks until the session ends, so each leaf is one distinct answer sequence the
engine can produce under the given parameters. It counts the outcomes and checks
every R4 refusal: whether its reachable share equals its leader share (an
exact-row refusal, KF-15) and how many answers it took.

    python -m experiments.enumerate_sequences            # all units, default parameters
    python -m experiments.enumerate_sequences U4 U6      # selected units

The counts are numbers of sequences, not rates: no student model weights them, so
they say which outcomes are reachable, not how often a student reaches them. A
full run of the Maths_v2 candidate takes about a minute per unit.
"""

from __future__ import annotations

import argparse
import sys
from collections import Counter
from dataclasses import dataclass, field

from sonder_engine import Params, SessionState, Unit, answer, next_question, start
from sonder_pack.maths_v2 import load_maths_v2


@dataclass
class UnitEnumeration:
    unit_id: str
    outcomes: Counter = field(default_factory=Counter)
    r4_refusals: int = 0
    r4_not_exact: int = 0
    r4_shortest: int | None = None
    r4_shortest_example: tuple[tuple[str, str], ...] = ()

    @property
    def sequences(self) -> int:
        return sum(self.outcomes.values())


def enumerate_unit(unit: Unit, params: Params | None = None) -> UnitEnumeration:
    params = params or Params()
    result = UnitEnumeration(unit.unit_id)
    items = {item.item_id: item for item in unit.engine_items}

    def walk(state: SessionState, path: tuple[tuple[str, str], ...]) -> None:
        if state.finished:
            decision = state.decision
            result.outcomes[decision.outcome.value] += 1
            if decision.rule == "R4":
                result.r4_refusals += 1
                if decision.reachable_share != decision.leader_share:
                    result.r4_not_exact += 1
                if result.r4_shortest is None or len(path) < result.r4_shortest:
                    result.r4_shortest, result.r4_shortest_example = len(path), path
            return
        asked = next_question(state)
        item = items[asked.pending.item_id]
        for option in item.option_ids:
            walk(answer(asked, item.item_id, option), path + ((item.item_id, option),))

    walk(start(unit, params), ())
    return result


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Enumerate every answer sequence of a unit (I2-A05).")
    parser.add_argument("units", nargs="*", help="unit IDs; default: every unit")
    args = parser.parse_args(argv)
    pack = load_maths_v2()
    unit_ids = args.units or [unit.unit_id for unit in pack.units]
    print("unit,sequences,outcomes,r4_refusals,r4_not_exact,r4_shortest,r4_shortest_example")
    for unit_id in unit_ids:
        result = enumerate_unit(pack.unit(unit_id))
        outcomes = ";".join(f"{name}={count}" for name, count in sorted(result.outcomes.items()))
        example = " ".join(f"{item}:{option}" for item, option in result.r4_shortest_example)
        print(f"{unit_id},{result.sequences},{outcomes},{result.r4_refusals},{result.r4_not_exact},"
              f"{'' if result.r4_shortest is None else result.r4_shortest},{example}", flush=True)


if __name__ == "__main__":
    main(sys.argv[1:])
