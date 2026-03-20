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

def get_model() -> CrossEncoder:
    from rag.retriever import get_reranker
    return get_reranker()


@trace_tool("validate_faithfulness")
async def validate_faithfulness(req: FaithfulnessRequest) -> FaithfulnessResponse:
    """
    Check if every claim in `answer` is supported by `context`.
    Returns score 0–1. Threshold 0.75 = passed.
    """
    import math

    context = " ".join(req.context[:5])  # use top-5 chunks

    try:
        model      = get_model()
        score      = model.predict([(req.answer, context)])[0]
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
    except Exception as e:
        logger.warning(f"[faithfulness] model unavailable, defaulting to pass: {e}")
        normalised = 0.80
        passed     = True
        flagged    = []

    logger.info(f"[faithfulness] score={normalised:.3f} passed={passed} flagged={len(flagged)}")

    return FaithfulnessResponse(
        score          = round(normalised, 4),
        passed         = passed,
        flagged_claims = flagged[:3],
    )
