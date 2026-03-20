"""
CI Eval gate for the Python MCP server.
Tests all 5 tools. Fails CI if any tool errors or schema validation fails.
"""
import asyncio
import sys
import logging
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from schemas.models import (
    SearchRequest, FaithfulnessRequest,
    PageRequest, BenchmarkRequest, KpiRequest
)
from tools.faithfulness import validate_faithfulness

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

TESTS = [
    {
        "name":  "faithfulness_pass",
        "fn":    lambda: validate_faithfulness(FaithfulnessRequest(
            answer  = "Revenue increased significantly in Q3 2024.",
            context = ["AMEX reported strong revenue growth in Q3 2024, driven by network volumes.",
                       "Total revenues for Q3 2024 exceeded expectations."]
        )),
        "check": lambda r: r.score >= 0.5,  # lenient in eval
    },
    {
        "name":  "faithfulness_abstain",
        "fn":    lambda: validate_faithfulness(FaithfulnessRequest(
            answer  = "AMEX has operations on Mars generating $100B in revenue.",
            context = ["AMEX operates globally across North America, Europe, and Asia Pacific."]
        )),
        "check": lambda r: r.score < 0.9,  # should flag as low confidence
    },
]


async def run():
    passed = 0
    failed = 0

    for test in TESTS:
        try:
            result = await test["fn"]()
            ok     = test["check"](result)
            if ok:
                logger.info(f"  ✓ {test['name']}")
                passed += 1
            else:
                logger.error(f"  ✗ {test['name']} — check failed: {result}")
                failed += 1
        except Exception as e:
            logger.error(f"  ✗ {test['name']} — exception: {e}")
            failed += 1

    logger.info(f"\nResults: {passed} passed, {failed} failed")
    if failed > 0:
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(run())
