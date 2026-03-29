"""
Amex Intelligent Dispute Resolution Agent — LangGraph StateGraph
─────────────────────────────────────────────────────────────────
This is Layer 3 + Layer 4 of the 6-layer architecture presented in the interview.

WHY LANGGRAPH (not plain OpenAI function calling):
  - Built-in state checkpointing (conversations survive server restarts)
  - Conditional edges (routing logic separate from LLM)
  - interrupt_before (HITL — pause graph, wait for human, resume)
  - Built-in retry + streaming (astream_events)
  - LangSmith traces EVERY node automatically (zero config)
  - The standard at Amex for agent orchestration (directly in JD)

HOW THE GRAPH WORKS:
  classify_intent          ← Node 1: what kind of dispute is this?
       ↓
  retrieve_transaction     ← Node 2: look up transaction (would be gRPC in prod)
       ↓
  retrieve_policy_docs     ← Node 3: RAG — get relevant policy chunks
       ↓
  assess_risk              ← Node 4: GPT-4o fraud + risk scoring
       ↓
  should_escalate?         ← Conditional edge (routing function, NOT LLM)
    YES → escalate_human   ← Node 5b: HITL queue (graph pauses here)
    NO  → auto_resolve     ← Node 5a: issue provisional credit automatically
       ↓
  notify_customer          ← Node 6: SMS + email via Notification MCP server
       ↓
  END

STATE (DisputeState):
  The "memory" of the agent. TypedDict persisted by LangGraph checkpointer.
  Every node reads from state and returns a partial dict to update it.
  LangGraph merges the partial dict — nodes only touch what they own.

CHECKPOINTING:
  MemorySaver used here (in-memory, good for demo + testing).
  In production: PostgresSaver → disputes survive pod restarts on K8s.
  Config: {"configurable": {"thread_id": dispute_id}} — one thread per dispute.

HITL (Human-In-The-Loop):
  interrupt_before=["escalate_human"] tells LangGraph to PAUSE the graph
  before entering that node. The graph saves state to the checkpointer and returns.
  When a human analyst submits their decision, we resume:
    await graph.ainvoke(None, config={"configurable": {"thread_id": dispute_id}})
  The graph picks up exactly where it stopped — no state lost.

GRPC (production pattern):
  retrieve_transaction would call the Transaction API MCP server via gRPC:
    channel = grpc.aio.insecure_channel("transaction-svc:50051")
    stub = TransactionServiceStub(channel)
    tx = await stub.GetTransaction(GetTransactionRequest(id=tx_id))
  Why gRPC over REST: binary protocol (protobuf), ~10x smaller payload,
  strongly typed contracts, built-in streaming, service-to-service standard.

TEXT SPLITTING (how documents were chunked for the RAG index):
  from langchain_text_splitters import RecursiveCharacterTextSplitter
  splitter = RecursiveCharacterTextSplitter(
      chunk_size    = 800,   ← target tokens per chunk
      chunk_overlap = 100,   ← overlap so sentences aren't cut at boundaries
      separators    = ["\\n\\n", "\\n", ". ", " "],  ← try paragraph → line → sentence → word
  )
  chunks = splitter.split_text(raw_policy_document)
  → Each chunk indexed into SQLite FTS5 + BM25 with doc_id + page_num

LANGSMITH TRACING:
  Set LANGCHAIN_TRACING_V2=true + LANGCHAIN_API_KEY in .env.
  Every node invocation appears in smith.langchain.com → project "amex-insight".
  You see: which nodes ran, input/output, latency, token count, LLM cost.
  Custom tools decorated with @traceable appear as child spans.
"""
from __future__ import annotations

import os
import json
import logging
from typing import TypedDict, Literal, Optional, List

from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver

logger = logging.getLogger(__name__)

# Try importing langsmith traceable — gracefully skip if not installed yet
try:
    from langsmith import traceable
except ImportError:
    def traceable(name: str = "", run_type: str = "tool"):
        def decorator(fn): return fn
        return decorator


# ── State definition ──────────────────────────────────────────────────────────
# TypedDict = typed Python dict. LangGraph serialises this to the checkpointer.
# Every node returns a PARTIAL dict — only the keys it updates.
# LangGraph merges partial updates into the full state automatically.

class DisputeState(TypedDict):
    # ── Input (set when graph is first invoked) ───────────────────────────────
    dispute_id:          str
    card_member_id:      str
    transaction_id:      str
    transaction_amount:  float
    merchant_name:       str
    dispute_reason:      str

    # ── Filled progressively as graph runs ───────────────────────────────────
    intent:              str            # classify_intent → "fraud"|"billing_error"|...
    transaction_details: dict           # retrieve_transaction → {amount, location, ...}
    policy_context:      str            # retrieve_policy_docs → relevant policy text
    fraud_score:         float          # assess_risk → 0.0 - 1.0
    risk_level:          str            # assess_risk → "low"|"medium"|"high"
    requires_human:      bool           # assess_risk → routing flag
    resolution:          str            # auto_resolve OR escalate_human → outcome text
    notification_sent:   bool           # notify_customer → True when sent
    step_trace:          List[str]      # debug — list of nodes that ran (in order)


# ── LLM instances ─────────────────────────────────────────────────────────────
# Two models — cost routing (same pattern used in Layer 4 of the architecture).
# GPT-4o-mini for cheap routing decisions, GPT-4o for high-stakes analysis.

_llm_fast:     Optional[ChatOpenAI] = None
_llm_powerful: Optional[ChatOpenAI] = None

def get_llm_fast() -> ChatOpenAI:
    global _llm_fast
    if _llm_fast is None:
        _llm_fast = ChatOpenAI(
            model       = "gpt-4o-mini",
            temperature = 0,
            api_key     = os.environ.get("OPENAI_API_KEY", ""),
        )
    return _llm_fast

def get_llm_powerful() -> ChatOpenAI:
    global _llm_powerful
    if _llm_powerful is None:
        _llm_powerful = ChatOpenAI(
            model       = "gpt-4o",
            temperature = 0,
            api_key     = os.environ.get("OPENAI_API_KEY", ""),
        )
    return _llm_powerful


# ── Prompt templates ──────────────────────────────────────────────────────────
# LangChain ChatPromptTemplate = reusable, typed prompt with variables.
# {variable} is replaced at .ainvoke() time — clean separation of prompt and data.
# LangSmith shows the rendered prompt in traces — easy to debug prompt regressions.

CLASSIFY_PROMPT = ChatPromptTemplate.from_messages([
    ("system", """You are an Amex dispute classification specialist.
Classify the dispute into exactly one category: fraud | billing_error | service_dispute | unrecognized_charge | general

Return JSON only — no explanation:
{{"intent": "<category>", "confidence": <0.0-1.0>}}"""),
    ("human", "Dispute reason: {dispute_reason}\nAmount: ${transaction_amount}\nMerchant: {merchant_name}"),
])

RISK_ASSESSMENT_PROMPT = ChatPromptTemplate.from_messages([
    ("system", """You are an Amex fraud risk analyst.
Assess dispute risk. Return JSON only:
{{"fraud_score": <0.0-1.0>, "risk_level": "low|medium|high", "reasoning": "<1 sentence>"}}

Rules:
- fraud_score > 0.7 OR amount > $5000 → risk_level = "high" → requires human review
- Card not present + amount > $500 → fraud_score += 0.2
- Multiple disputes same card → risk_level = "high" regardless of amount"""),
    ("human", "Transaction: {transaction_details}\nPolicy: {policy_context}\nReason: {dispute_reason}"),
])


# ── Node 1: classify_intent ───────────────────────────────────────────────────

@traceable(name="classify_intent", run_type="tool")
async def classify_intent(state: DisputeState) -> dict:
    """
    What kind of dispute is this?
    Uses GPT-4o-mini — cheap, fast. This is just intent routing.
    LangChain chain = prompt | llm (LCEL — LangChain Expression Language).
    """
    chain    = CLASSIFY_PROMPT | get_llm_fast()
    response = await chain.ainvoke({
        "dispute_reason":      state["dispute_reason"],
        "transaction_amount":  state["transaction_amount"],
        "merchant_name":       state["merchant_name"],
    })

    try:
        result = json.loads(response.content)
        intent = result.get("intent", "general")
    except Exception:
        intent = "general"

    logger.info(f"[classify_intent] dispute={state['dispute_id']} intent={intent}")
    return {
        "intent":     intent,
        "step_trace": state.get("step_trace", []) + ["classify_intent"],
    }


# ── Node 2: retrieve_transaction ─────────────────────────────────────────────

@traceable(name="retrieve_transaction", run_type="tool")
async def retrieve_transaction(state: DisputeState) -> dict:
    """
    Fetch transaction details from the Transaction API.

    Production pattern (gRPC):
      import grpc
      from proto.transaction_pb2_grpc import TransactionServiceStub
      from proto.transaction_pb2 import GetTransactionRequest

      channel = grpc.aio.insecure_channel("transaction-svc:50051")  # internal mTLS in prod
      stub    = TransactionServiceStub(channel)
      tx      = await stub.GetTransaction(
                    GetTransactionRequest(transaction_id=state["transaction_id"])
                )
      return {"transaction_details": MessageToDict(tx)}

    Why gRPC (not REST) for internal services:
      - Protobuf binary: ~10x smaller than JSON
      - Strongly typed contracts (proto file = single source of truth)
      - Built-in streaming (useful for real-time fraud scoring)
      - ~2x faster than REST for service-to-service calls
      - Istio handles mTLS automatically for gRPC channels

    Here we simulate the response for the demo.
    """
    logger.info(f"[retrieve_transaction] tx_id={state['transaction_id']}")

    # Simulated — replace with gRPC call to Transaction API MCP server
    details = {
        "transaction_id":  state["transaction_id"],
        "amount":          state["transaction_amount"],
        "merchant":        state["merchant_name"],
        "date":            "2026-03-29",
        "location":        "Toronto, ON, Canada",
        "card_present":    False,            # card-not-present = higher fraud risk
        "velocity_flag":   state["transaction_amount"] > 2000,
        "network":         "AMEX closed-loop",
    }

    return {
        "transaction_details": details,
        "step_trace": state.get("step_trace", []) + ["retrieve_transaction"],
    }


# ── Node 3: retrieve_policy_docs ─────────────────────────────────────────────

@traceable(name="retrieve_policy_docs", run_type="tool")
async def retrieve_policy_docs(state: DisputeState) -> dict:
    """
    RAG retrieval of relevant dispute policy.

    How documents were indexed (at build time):
      1. Raw policy PDF → extracted text
      2. LangChain RecursiveCharacterTextSplitter:
           splitter = RecursiveCharacterTextSplitter(
               chunk_size    = 800,    ← ~600 words per chunk
               chunk_overlap = 100,    ← 100-char overlap prevents sentence cuts
               separators    = ["\\n\\n", "\\n", ". ", " "],
           )
           chunks = splitter.split_text(raw_text)
      3. Each chunk stored in SQLite with doc_id + page_num
      4. BM25Okapi built over all chunk texts
      5. FTS5 virtual table indexed for stemmed search

    At query time (hybrid search):
      BM25 top-20 → FTS5 top-20 → merge + dedupe → cross-encoder rerank → top-k
      cross-encoder/ms-marco-MiniLM-L-6-v2 = the semantic layer (no vector DB needed)

    In production: call search_financial_docs MCP tool via HTTP.
    """
    intent = state["intent"]
    logger.info(f"[retrieve_policy_docs] intent={intent}")

    policy_map = {
        "fraud": (
            "AMEX Zero Liability Policy: Card members are not responsible for "
            "unauthorized charges when reported promptly. Dispute window: 120 days. "
            "Auto-resolve threshold: amounts under $500 with no prior fraud history. "
            "Provisional credit issued within 1 business day."
        ),
        "billing_error": (
            "Regulation E / CPA Rules: Billing errors must be acknowledged within "
            "10 business days. Provisional credit issued within 5 business days for "
            "amounts over $50. Investigation completed within 45 days."
        ),
        "service_dispute": (
            "AMEX Buyer Protection: Covers eligible purchases for 90 days from date "
            "of purchase. Requires documented merchant contact attempt. Auto-resolve "
            "if merchant unresponsive after 15 days. Max coverage: $1,000 per claim."
        ),
        "unrecognized_charge": (
            "AMEX Dispute Policy: Unrecognized charges investigated within 30 days. "
            "Card member receives provisional credit while under review. "
            "Merchant has 20 days to respond with transaction evidence."
        ),
        "general": (
            "Standard AMEX Dispute Resolution: All disputes reviewed within 30 days. "
            "Card members retain rights under applicable consumer protection laws "
            "(Regulation E, CPA, PIPEDA for Canadian accounts). "
            "All disputes logged in compliance audit trail (SOX, 7-year retention)."
        ),
    }

    return {
        "policy_context": policy_map.get(intent, policy_map["general"]),
        "step_trace": state.get("step_trace", []) + ["retrieve_policy_docs"],
    }


# ── Node 4: assess_risk ───────────────────────────────────────────────────────

@traceable(name="assess_risk", run_type="tool")
async def assess_risk(state: DisputeState) -> dict:
    """
    Fraud + risk scoring using GPT-4o (high-stakes → powerful model).
    LangSmith traces this LLM call: prompt, response, token count, latency.

    Hard rules applied after LLM (compliance requirements override model):
      - amount > $5,000 → always escalate (regulatory requirement)
      - card_not_present + velocity_flag → bump fraud_score

    In production: also runs ML Ensemble (XGBoost + isolation forest)
    trained on AMEX transaction history. LLM is for reasoning, ML is for scoring.
    """
    chain    = RISK_ASSESSMENT_PROMPT | get_llm_powerful()
    response = await chain.ainvoke({
        "transaction_details": json.dumps(state["transaction_details"], indent=2),
        "policy_context":      state["policy_context"],
        "dispute_reason":      state["dispute_reason"],
    })

    try:
        result     = json.loads(response.content)
        fraud_score = float(result.get("fraud_score", 0.5))
        risk_level  = result.get("risk_level", "medium")
    except Exception:
        fraud_score = 0.5
        risk_level  = "medium"

    # Hard compliance rules — override LLM assessment
    tx = state.get("transaction_details", {})
    if state["transaction_amount"] > 5000:
        fraud_score = max(fraud_score, 0.8)
        risk_level  = "high"
    if not tx.get("card_present") and tx.get("velocity_flag"):
        fraud_score = min(fraud_score + 0.2, 1.0)
        if fraud_score > 0.7:
            risk_level = "high"

    requires_human = (risk_level == "high" or fraud_score > 0.7)

    logger.info(
        f"[assess_risk] dispute={state['dispute_id']} "
        f"fraud_score={fraud_score:.2f} risk={risk_level} escalate={requires_human}"
    )
    return {
        "fraud_score":    fraud_score,
        "risk_level":     risk_level,
        "requires_human": requires_human,
        "step_trace":     state.get("step_trace", []) + ["assess_risk"],
    }


# ── Node 5a: auto_resolve ─────────────────────────────────────────────────────

@traceable(name="auto_resolve", run_type="tool")
async def auto_resolve(state: DisputeState) -> dict:
    """
    Low-risk path: automatically resolve and issue provisional credit.
    Target: 70% of disputes handled here, under 3 minutes, under $2.

    In production:
      - Calls Dispute Filing API MCP server → writes to dispute DB
      - Publishes DisputeResolved event to Kafka → downstream services consume
      - Issues provisional credit via Core Banking API
    """
    logger.info(f"[auto_resolve] dispute={state['dispute_id']} amount=${state['transaction_amount']:.2f}")

    resolution = (
        f"AUTO-RESOLVED | Dispute {state['dispute_id']} | "
        f"Provisional credit of ${state['transaction_amount']:.2f} issued. "
        f"Category: {state['intent']} | Risk: {state['risk_level']} "
        f"(fraud_score={state['fraud_score']:.2f}) | "
        f"Policy applied: AMEX Zero Liability + {state['policy_context'][:80]}..."
    )

    return {
        "resolution": resolution,
        "step_trace": state.get("step_trace", []) + ["auto_resolve"],
    }


# ── Node 5b: escalate_human ───────────────────────────────────────────────────

@traceable(name="escalate_human", run_type="tool")
async def escalate_human(state: DisputeState) -> dict:
    """
    High-risk path: route to Tier-2 human analyst queue.

    HITL (Human-In-The-Loop) with LangGraph:
      The graph is compiled with interrupt_before=["escalate_human"].
      This means LangGraph PAUSES the graph BEFORE entering this node.
      The checkpointer saves full state to storage (MemorySaver here, PostgreSQL in prod).

      When a human analyst reviews and submits their decision:
        await graph.ainvoke(
            None,                                                    ← None = resume, don't re-run classify
            config={"configurable": {"thread_id": dispute_id}},     ← identifies the paused thread
        )
      The graph resumes from escalate_human → notify_customer → END.

      This is exactly how Amex human review queues would work:
        Case management UI → analyst approves/denies → webhook → resume graph
    """
    logger.info(f"[escalate_human] dispute={state['dispute_id']} fraud_score={state['fraud_score']:.2f}")

    resolution = (
        f"ESCALATED TO HUMAN REVIEW | Dispute {state['dispute_id']} | "
        f"Fraud score: {state['fraud_score']:.2f} | Risk: {state['risk_level']} | "
        f"Amount: ${state['transaction_amount']:.2f} | Merchant: {state['merchant_name']} | "
        f"Assigned to Tier-2 analyst queue. SLA: 24 hours."
    )

    return {
        "resolution": resolution,
        "step_trace": state.get("step_trace", []) + ["escalate_human"],
    }


# ── Node 6: notify_customer ───────────────────────────────────────────────────

@traceable(name="notify_customer", run_type="tool")
async def notify_customer(state: DisputeState) -> dict:
    """
    Send SMS + email to card member with dispute outcome.

    In production: calls Notification Service MCP server via gRPC:
      stub.SendNotification(NotificationRequest(
          card_member_id = state["card_member_id"],
          channel        = ["sms", "email"],
          message        = state["resolution"],
          dispute_id     = state["dispute_id"],
      ))

    Notification Service publishes to Kafka topic "dispute.notifications"
    → consumed by SMS gateway (Twilio) and email service (SES/Resend).
    Kafka decouples the agent from the delivery mechanism — if Twilio is slow,
    the dispute agent doesn't wait for it.
    """
    logger.info(f"[notify_customer] sending for dispute={state['dispute_id']}")

    return {
        "notification_sent": True,
        "step_trace": state.get("step_trace", []) + ["notify_customer"],
    }


# ── Conditional edge function ─────────────────────────────────────────────────
# This is NOT an LLM call. It is a plain Python function.
# LangGraph calls it after assess_risk to decide which node to go to next.
# Returning a string that matches a key in the conditional_edges dict.

def should_escalate(state: DisputeState) -> Literal["auto_resolve", "escalate_human"]:
    """
    Routing decision: auto-resolve or escalate to human?
    Pure logic — deterministic, testable, no LLM involved.

    In the interview: "why not let the LLM decide routing?"
      Because routing decisions need to be:
      1. Deterministic — same input always same output (compliance)
      2. Auditable — we can log exactly why a case was escalated
      3. Fast — no LLM latency for a pure boolean check
      4. Compliant — regulatory rules must be code, not prompt
    """
    if state.get("requires_human", False):
        return "escalate_human"
    return "auto_resolve"


# ── Graph assembly ────────────────────────────────────────────────────────────

def build_dispute_graph():
    """
    Compile the LangGraph StateGraph.

    StateGraph vs older LangChain AgentExecutor:
      AgentExecutor: LLM decides every step (slow, unpredictable)
      StateGraph: YOU define the flow, LLM only runs specific nodes (fast, auditable)
      → For production financial systems, StateGraph is always preferred.

    Checkpointer options:
      MemorySaver   → in-memory (dev/demo, lost on restart)
      PostgresSaver → persists to PostgreSQL (production — survives K8s pod restarts)
      RedisSaver    → persists to Redis (fast, ephemeral — good for short sessions)
    """
    workflow = StateGraph(DisputeState)

    # ── Nodes ────────────────────────────────────────────────────────────────
    workflow.add_node("classify_intent",      classify_intent)
    workflow.add_node("retrieve_transaction", retrieve_transaction)
    workflow.add_node("retrieve_policy_docs", retrieve_policy_docs)
    workflow.add_node("assess_risk",          assess_risk)
    workflow.add_node("auto_resolve",         auto_resolve)
    workflow.add_node("escalate_human",       escalate_human)
    workflow.add_node("notify_customer",      notify_customer)

    # ── Edges (flow control) ──────────────────────────────────────────────────
    workflow.set_entry_point("classify_intent")
    workflow.add_edge("classify_intent",      "retrieve_transaction")
    workflow.add_edge("retrieve_transaction", "retrieve_policy_docs")
    workflow.add_edge("retrieve_policy_docs", "assess_risk")

    # Conditional: assess_risk → auto_resolve OR escalate_human
    # should_escalate() returns a string key that maps to the next node name
    workflow.add_conditional_edges(
        "assess_risk",
        should_escalate,
        {
            "auto_resolve":   "auto_resolve",
            "escalate_human": "escalate_human",
        },
    )

    # Both paths converge at notify_customer → END
    workflow.add_edge("auto_resolve",   "notify_customer")
    workflow.add_edge("escalate_human", "notify_customer")
    workflow.add_edge("notify_customer", END)

    # ── Compile ───────────────────────────────────────────────────────────────
    checkpointer = MemorySaver()   # swap to PostgresSaver in production

    app = workflow.compile(
        checkpointer     = checkpointer,
        interrupt_before = ["escalate_human"],  # ← HITL: pause before human node
    )

    logger.info("[dispute_agent] LangGraph StateGraph compiled — 7 nodes, 1 conditional edge")
    return app


# ── Singleton ─────────────────────────────────────────────────────────────────

_dispute_graph = None

def get_dispute_graph():
    global _dispute_graph
    if _dispute_graph is None:
        _dispute_graph = build_dispute_graph()
    return _dispute_graph


# ── Helper: run a dispute end-to-end ─────────────────────────────────────────

async def run_dispute(
    dispute_id:         str,
    card_member_id:     str,
    transaction_id:     str,
    transaction_amount: float,
    merchant_name:      str,
    dispute_reason:     str,
) -> dict:
    """
    Run the full dispute resolution graph for a new dispute.

    Each dispute gets its own thread_id (= dispute_id).
    LangGraph checkpoints state under that thread_id.
    If the graph pauses (HITL), state is preserved — resume later with same thread_id.
    """
    graph  = get_dispute_graph()
    config = {"configurable": {"thread_id": dispute_id}}

    initial_state: DisputeState = {
        "dispute_id":          dispute_id,
        "card_member_id":      card_member_id,
        "transaction_id":      transaction_id,
        "transaction_amount":  transaction_amount,
        "merchant_name":       merchant_name,
        "dispute_reason":      dispute_reason,
        # Agent fills these:
        "intent":              "",
        "transaction_details": {},
        "policy_context":      "",
        "fraud_score":         0.0,
        "risk_level":          "low",
        "requires_human":      False,
        "resolution":          "",
        "notification_sent":   False,
        "step_trace":          [],
    }

    final_state = await graph.ainvoke(initial_state, config=config)

    # If graph paused (HITL), final_state is the state AT the pause point
    paused = not final_state.get("notification_sent", False)

    return {
        "dispute_id":       dispute_id,
        "resolution":       final_state.get("resolution", ""),
        "risk_level":       final_state.get("risk_level", "low"),
        "fraud_score":      final_state.get("fraud_score", 0.0),
        "requires_human":   final_state.get("requires_human", False),
        "notification_sent": final_state.get("notification_sent", False),
        "paused_for_hitl":  paused,
        "steps_completed":  final_state.get("step_trace", []),
    }
