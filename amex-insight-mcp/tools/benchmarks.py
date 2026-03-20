"""
Benchmark comparison tool.
Uses static seed data — in prod this would query an internal benchmark DB.
"""
from schemas.models import BenchmarkRequest, BenchmarkResponse
from observability.tracer import trace_tool

# Seed benchmark data (replace with real data / DB query in prod)
_BENCHMARKS: dict[str, dict] = {
    "travel": {
        "Q3 2024": {"avg": 12500, "p50": 9800,  "p75": 18200, "p90": 32000, "n": 2841},
        "Q2 2024": {"avg": 11200, "p50": 8900,  "p75": 16500, "p90": 29000, "n": 2710},
    },
    "restaurant": {
        "Q3 2024": {"avg": 4200,  "p50": 3100,  "p75": 6800,  "p90": 12000, "n": 3120},
    },
    "technology": {
        "Q3 2024": {"avg": 8900,  "p50": 6200,  "p75": 14500, "p90": 28000, "n": 1980},
    },
}


@trace_tool("compare_benchmarks")
async def compare_benchmarks(req: BenchmarkRequest) -> BenchmarkResponse:
    cat = req.category.lower().strip()
    qtl = req.quarter.strip()

    data = _BENCHMARKS.get(cat, {}).get(qtl)
    if not data:
        # Return nearest available
        cat_data = _BENCHMARKS.get(cat, _BENCHMARKS["travel"])
        key  = next(iter(cat_data))
        data = cat_data[key]
        qtl  = key

    return BenchmarkResponse(
        category      = cat,
        quarter       = qtl,
        avg_spend_usd = data["avg"],
        percentile_50 = data["p50"],
        percentile_75 = data["p75"],
        percentile_90 = data["p90"],
        sample_size   = data["n"],
        source        = "AmexInsight Benchmark Dataset v1.0",
    )
