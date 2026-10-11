"""Pure diagnostic calculations; no storage, service, or UI dependencies."""

from ._version import __version__
from .bayes import check_p1, likelihood_matrix, prior, update_posterior
from .model import Item, Params, validate_hypotheses
from .pack import Pack, PackError, PackItem, Unit, build_pack
from .selection import Selection, eligible_items, entropy_bits, expected_information_gain, select_next
from .session import EngineError, SessionState, answer, next_question, replay, start
from .stopping import Outcome, StopDecision, check_stop
from .trace import Trace, trace_of, trace_to_dict

__all__ = [
    "EngineError",
    "Item",
    "Outcome",
    "Pack",
    "PackError",
    "PackItem",
    "Params",
    "Selection",
    "SessionState",
    "StopDecision",
    "Trace",
    "Unit",
    "__version__",
    "answer",
    "build_pack",
    "check_p1",
    "check_stop",
    "eligible_items",
    "entropy_bits",
    "expected_information_gain",
    "likelihood_matrix",
    "next_question",
    "prior",
    "replay",
    "select_next",
    "start",
    "trace_of",
    "trace_to_dict",
    "update_posterior",
    "validate_hypotheses",
]
