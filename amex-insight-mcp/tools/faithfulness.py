"""
Faithfulness validation — Layer 4 of the anti-hallucination stack.
Uses cross-encoder as NLI proxy: (answer, context) → entailment score.
"""
from __future__ import annotations

import logging
from sentence_transformers import CrossEncoder
from schemas.models import FaithfulnessRequest, FaithfulnessResponse
from observability.tracer import trace_tool

logger = logging.getLogger(__name__)

_model = None

def get_model() -> CrossEncoder:
    global _model
    if _model is None:
        _model = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")
    return _model


@trace_tool("validate_faithfulness")
async def validate_faithfulness(req: FaithfulnessRequest) -> FaithfulnessResponse:
    """
    Check if every claim in `answer` is supported by `context`.
    Returns score 0–1. Threshold 0.75 = passed.
    """
    model   = get_model()
    context = " ".join(req.context[:5])  # use top-5 chunks

    # Score the full answer against concatenated context
    score = model.predict([(req.answer, context)])[0]

    # Normalise to 0–1 range (cross-encoder output is logit-like)
    import math
    normalised = float(1 / (1 + math.exp(-score / 4)))
    passed     = normalised >= 0.75

    # Flag sentences with low individual scores
    flagged: list[str] = []
    sentences = [s.strip() for s in req.answer.split(".") if len(s.strip()) > 20]
    if not passed and sentences:
        scores = model.predict([(s, context) for s in sentences[:10]])
        flagged = [
            sentences[i] for i, s in enumerate(scores)
            if float(1 / (1 + math.exp(-s / 4))) < 0.60
        ]

    logger.info(f"[faithfulness] score={normalised:.3f} passed={passed} flagged={len(flagged)}")

    return FaithfulnessResponse(
        score          = round(normalised, 4),
        passed         = passed,
        flagged_claims = flagged[:3],
    )
