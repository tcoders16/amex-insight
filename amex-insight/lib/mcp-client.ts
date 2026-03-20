import { signRequest, scrub } from "./security"
import type {
  SearchResponse,
  FaithfulnessResponse,
  KPIReport,
  McpToolResult,
  ToolName,
} from "./types"

const MCP_URL = process.env.MCP_SERVER_URL ?? "http://localhost:8000"
const MAX_RETRIES = 3
const RETRY_BASE_MS = 100

// ─── Internal call with retry + DLQ logging ───────────────────────────────────

async function callTool<T>(
  tool: ToolName,
  args: Record<string, unknown>,
  attempt = 1
): Promise<McpToolResult> {
  const body = JSON.stringify({ tool, arguments: args })
  const headers = signRequest(body)
  const startedAt = Date.now()

  try {
    const res = await fetch(`${MCP_URL}/mcp/call`, {
      method:  "POST",
      headers,
      body,
      signal: AbortSignal.timeout(10_000),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`MCP ${res.status}: ${err}`)
    }

    const result = (await res.json()) as T
    return {
      callId:     `${tool}-${Date.now()}`,
      tool,
      result,
      durationMs: Date.now() - startedAt,
      retries:    attempt - 1,
    }
  } catch (err) {
    if (attempt < MAX_RETRIES) {
      // Exponential backoff with jitter
      const delay = RETRY_BASE_MS * 2 ** attempt + Math.random() * 50
      await new Promise(r => setTimeout(r, delay))
      return callTool<T>(tool, args, attempt + 1)
    }

    // Send to DLQ after max retries
    await sendToDlq(tool, args, String(err))

    return {
      callId:     `${tool}-dlq-${Date.now()}`,
      tool,
      result:     null,
      error:      scrub(String(err)),
      durationMs: Date.now() - startedAt,
      retries:    MAX_RETRIES,
    }
  }
}

async function sendToDlq(
  tool: string,
  args: Record<string, unknown>,
  error: string
) {
  try {
    await fetch(`${MCP_URL}/mcp/dlq`, {
      method:  "POST",
      headers: signRequest(JSON.stringify({ tool, args, error })),
      body:    JSON.stringify({ tool, args: scrub(JSON.stringify(args)), error }),
    })
  } catch {
    // DLQ failure is non-fatal — log only
    console.error("[DLQ] Failed to enqueue failed tool call:", tool)
  }
}

// ─── Public tool wrappers ─────────────────────────────────────────────────────

export async function searchFinancialDocs(
  query: string,
  topK = 8,
  yearFilter?: number
): Promise<McpToolResult> {
  return callTool<SearchResponse>("search_financial_docs", {
    query,
    top_k: topK,
    ...(yearFilter ? { year_filter: yearFilter } : {}),
  })
}

export async function getDocumentPage(
  docId: string,
  pageNum: number
): Promise<McpToolResult> {
  return callTool("get_document_page", { doc_id: docId, page_num: pageNum })
}

export async function compareBenchmarks(
  category: string,
  quarter: string
): Promise<McpToolResult> {
  return callTool("compare_benchmarks", { category, quarter })
}

export async function validateFaithfulness(
  answer: string,
  context: string[]
): Promise<McpToolResult> {
  return callTool<FaithfulnessResponse>("validate_faithfulness", {
    answer,
    context,
  })
}

export async function extractKpis(docId: string): Promise<McpToolResult> {
  return callTool<KPIReport>("extract_kpis", { doc_id: docId })
}

// ─── Saved Chats tools ────────────────────────────────────────────────────────

export async function saveChat(
  title: string,
  messages: { role: string; content: string }[],
  summary = "",
  tags: string[] = []
): Promise<McpToolResult> {
  return callTool("save_chat", { title, messages, summary, tags })
}

export async function listSavedChats(
  limit = 50,
  tagFilter?: string
): Promise<McpToolResult> {
  return callTool("list_saved_chats", {
    limit,
    ...(tagFilter ? { tag_filter: tagFilter } : {}),
  })
}

export async function getSavedChat(chatId: string): Promise<McpToolResult> {
  return callTool("get_saved_chat", { chat_id: chatId })
}

export async function deleteSavedChat(chatId: string): Promise<McpToolResult> {
  return callTool("delete_saved_chat", { chat_id: chatId })
}

export async function sendEmailSummary(
  query: string,
  summary: string,
  confidenceScore: number,
  citations: { doc: string; page: number; score: number }[] = [],
  to = "tosolankiom@gmail.com"
): Promise<McpToolResult> {
  return callTool("send_email_summary", {
    to,
    query,
    summary,
    confidence_score: confidenceScore,
    citations: citations.map(c => ({ doc: c.doc, page: c.page, score: c.score })),
  })
}

// ─── List available tools from MCP server ────────────────────────────────────

export async function listMcpTools(): Promise<
  { name: string; description: string; inputSchema: object }[]
> {
  try {
    const body = JSON.stringify({})
    const res = await fetch(`${MCP_URL}/mcp/tools`, {
      method:  "GET",
      headers: signRequest(body),
      signal:  AbortSignal.timeout(5_000),
    })
    if (!res.ok) return []
    return res.json()
  } catch {
    return []
  }
}

// ─── Health check ─────────────────────────────────────────────────────────────

export async function mcpHealth(): Promise<{
  status: string
  tools: number
  dlqDepth: number
  uptime: number
}> {
  try {
    const res = await fetch(`${MCP_URL}/health`, {
      signal: AbortSignal.timeout(3_000),
    })
    return res.ok
      ? res.json()
      : { status: "unreachable", tools: 0, dlqDepth: 0, uptime: 0 }
  } catch {
    return { status: "unreachable", tools: 0, dlqDepth: 0, uptime: 0 }
  }
}
