// ─── Core Domain Types ────────────────────────────────────────────────────────

export interface Citation {
  doc:     string
  page:    number
  section: string
  score:   number
}

export interface RetrievedChunk {
  id:       string
  docId:    string
  pageNum:  number
  section:  string
  text:     string
  context:  string
  score:    number
}

export interface SearchResponse {
  chunks:          RetrievedChunk[]
  query:           string
  retrievalMethod: string
  totalCandidates: number
  reranked:        boolean
  retrievalMs:     number
}

export interface FaithfulnessResponse {
  score:          number   // 0.0 – 1.0
  passed:         boolean  // score > 0.75
  flaggedClaims:  string[]
}

export interface KPIReport {
  revenueB:            number
  networkVolumesT:     number
  yoyGrowthPct:        number
  cardMemberSpend:     number
  newCardAcquisitions: number
  citations:           Citation[]
}

// ─── Agent / MCP Types ─────────────────────────────────────────────────────────

export type ToolName =
  | "search_financial_docs"
  | "get_document_page"
  | "compare_benchmarks"
  | "validate_faithfulness"
  | "extract_kpis"

export interface McpToolCall {
  id:        string
  tool:      ToolName
  args:      Record<string, unknown>
  startedAt: number
}

export interface McpToolResult {
  callId:   string
  tool:     ToolName
  result:   unknown
  error?:   string
  durationMs: number
  retries:  number
}

export type AgentStepType =
  | "plan"
  | "tool_call"
  | "tool_result"
  | "reasoning"
  | "faithfulness"
  | "synthesis"
  | "error"

export interface AgentStep {
  id:        string
  type:      AgentStepType
  label:     string
  detail?:   string
  durationMs?: number
  status:    "running" | "done" | "error"
  ts:        number
}

// ─── Chat Types ────────────────────────────────────────────────────────────────

export type MessageRole = "user" | "assistant"

export interface ChatMessage {
  id:          string
  role:        MessageRole
  content:     string
  steps?:      AgentStep[]
  citations?:  Citation[]
  confidence?: number
  faithfulness?: number
  dlqEntries?: number
  retries?:    number
  streaming?:  boolean
}

// ─── Session Memory ────────────────────────────────────────────────────────────

export interface SessionMemory {
  id:       string
  fact:     string     // extracted key fact/figure
  source:   string     // "2024-10k · p.34"
  verified: boolean    // faithfulness PASS for this response
  ts:       number
}

// ─── UI State ──────────────────────────────────────────────────────────────────

export interface SessionStats {
  toolCalls:   number
  retried:     number
  dlq:         number
  recovered:   number
  avgLatencyMs: number
}
