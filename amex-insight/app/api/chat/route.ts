import OpenAI from "openai"
import { z } from "zod"
import {
  searchFinancialDocs,
  getDocumentPage,
  compareBenchmarks,
  validateFaithfulness,
  extractKpis,
} from "@/lib/mcp-client"
import type { AgentStep, Citation, SessionMemory } from "@/lib/types"

// ─── Memory extractor ─────────────────────────────────────────────────────────
// Pulls key financial facts from retrieved chunk text.
// No extra LLM call — regex over ground-truth retrieved text.

function extractMemoriesFromChunks(
  chunks: Array<{ doc_id: string; page_num: number; section: string; text: string }>,
  verified: boolean
): SessionMemory[] {
  const memories: SessionMemory[] = []
  const seen = new Set<string>()

  // Patterns that indicate a key financial fact
  const factPattern = /[A-Z][^.!?]*(?:\$[\d.,]+\s*(?:billion|trillion|million)|[\d.]+\s*percent|[\d.]+\s*%|\bEPS\b|\bCAGR\b)[^.!?]*[.!?]/g

  for (const chunk of chunks) {
    const source = `${chunk.doc_id} · p.${chunk.page_num}`
    const matches = chunk.text.match(factPattern) ?? []

    // If no regex match, fall back to first sentence of the chunk
    const candidates = matches.length > 0
      ? matches.slice(0, 2)
      : [chunk.text.split(/[.!?]/)[0]?.trim() + "."].filter(s => s.length > 20)

    for (const fact of candidates) {
      const key = fact.slice(0, 60)
      if (seen.has(key)) continue
      seen.add(key)
      memories.push({
        id:       `mem-${Date.now()}-${memories.length}`,
        fact:     fact.trim(),
        source,
        verified,
        ts:       Date.now(),
      })
      if (memories.length >= 8) return memories
    }
  }

  return memories
}

// ─── Request schema ──────────────────────────────────────────────────────────

const RequestSchema = z.object({
  messages: z.array(z.object({
    role:    z.enum(["user", "assistant"]),
    content: z.string(),
  })).min(1).max(20),
})

// ─── Tool definitions (OpenAI function-calling format) ───────────────────────

const TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name:        "search_financial_docs",
      description: "Search AMEX public financial documents using hybrid BM25 + FTS5 retrieval with cross-encoder reranking. Returns grounded chunks with page-level citations.",
      parameters: {
        type: "object",
        properties: {
          query:       { type: "string",  description: "Search query" },
          top_k:       { type: "number",  description: "Number of results (default 8)" },
          year_filter: { type: "number",  description: "Optional: filter by document year (e.g. 2024)" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name:        "get_document_page",
      description: "Retrieve the full text of a specific page from a financial document for deeper grounding.",
      parameters: {
        type: "object",
        properties: {
          doc_id:   { type: "string", description: "Document identifier (e.g. '2024-10k')" },
          page_num: { type: "number", description: "Page number to retrieve" },
        },
        required: ["doc_id", "page_num"],
      },
    },
  },
  {
    type: "function",
    function: {
      name:        "compare_benchmarks",
      description: "Retrieve industry benchmark data for expense category comparison.",
      parameters: {
        type: "object",
        properties: {
          category: { type: "string", description: "Expense category (e.g. 'travel', 'restaurant')" },
          quarter:  { type: "string", description: "Quarter (e.g. 'Q3 2024')" },
        },
        required: ["category", "quarter"],
      },
    },
  },
  {
    type: "function",
    function: {
      name:        "validate_faithfulness",
      description: "Check if a draft answer is fully supported by retrieved context chunks. Returns faithfulness score 0-1. Use before synthesizing a final response.",
      parameters: {
        type: "object",
        properties: {
          answer:  { type: "string", description: "Draft answer to validate" },
          context: { type: "array", items: { type: "string" }, description: "Retrieved context chunks" },
        },
        required: ["answer", "context"],
      },
    },
  },
  {
    type: "function",
    function: {
      name:        "extract_kpis",
      description: "Extract structured financial KPIs from a document as a validated schema object.",
      parameters: {
        type: "object",
        properties: {
          doc_id: { type: "string", description: "Document to extract KPIs from" },
        },
        required: ["doc_id"],
      },
    },
  },
]

const SYSTEM = `You are AmexInsight, an agentic financial intelligence assistant.
You have access to AMEX public financial documents (10-K filings, annual reports, earnings transcripts).

RULES:
1. ALWAYS retrieve before answering. Never answer from memory alone.
2. For complex questions, decompose into sub-questions and call tools in sequence.
3. After retrieving, call validate_faithfulness before synthesizing your final answer.
4. If faithfulness score < 0.75, retrieve more context or abstain.
5. Always cite sources: document name and page number.
6. If you cannot find grounded information, say so clearly. Never fabricate.
7. For financial figures, be precise. Wrong numbers are worse than no numbers.`

// ─── SSE helpers ─────────────────────────────────────────────────────────────

function sseEvent(data: object): string {
  return `data: ${JSON.stringify(data)}\n\n`
}

// ─── Route handler ────────────────────────────────────────────────────────────

export const runtime    = "nodejs"
export const maxDuration = 60

export async function POST(req: Request) {
  let body: unknown
  try { body = await req.json() } catch { return new Response("Bad JSON", { status: 400 }) }

  const parsed = RequestSchema.safeParse(body)
  if (!parsed.success) return new Response("Invalid request", { status: 400 })

  const { messages } = parsed.data
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

  const encoder = new TextEncoder()
  const stream  = new TransformStream()
  const writer  = stream.writable.getWriter()
  const write   = (data: object) => writer.write(encoder.encode(sseEvent(data)))

  // ─── Agent loop ─────────────────────────────────────────────────────────
  ;(async () => {
    const startedAt      = Date.now()
    const allCitations: Citation[]  = []
    const allChunks: Array<{ doc_id: string; page_num: number; section: string; text: string }> = []
    let   totalRetries   = 0
    let   totalDlq       = 0
    let   finalFaithfulness: number | undefined
    let   finalConfidence:   number | undefined

    const addStep = (step: Omit<AgentStep, "ts">): AgentStep => {
      const s: AgentStep = { ...step, ts: Date.now() }
      write({ type: "step", step: s })
      return s
    }
    const updateStep = (id: string, update: Partial<AgentStep>) => {
      write({ type: "step_update", stepId: id, update })
    }

    try {
      // Build message history for OpenAI
      type OAIMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam
      const apiMessages: OAIMessage[] = [
        { role: "system", content: SYSTEM },
        ...messages.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
      ]

      // Planning step
      const planStep = addStep({
        id:     `plan-${Date.now()}`,
        type:   "plan",
        label:  "Analysing query and planning retrieval strategy",
        status: "running",
      })

      // Agent loop — max 8 iterations
      for (let iter = 0; iter < 8; iter++) {
        const resp = await openai.chat.completions.create({
          model:       "gpt-4o",
          max_tokens:  4096,
          tools:       TOOLS,
          tool_choice: "auto",
          messages:    apiMessages,
        })

        if (iter === 0) {
          updateStep(planStep.id, { status: "done", durationMs: Date.now() - startedAt })
        }

        const choice  = resp.choices[0]
        const message = choice.message

        // ── Tool calls ───────────────────────────────────────────────────
        if (choice.finish_reason === "tool_calls" && message.tool_calls?.length) {
          // Push the assistant message (with tool_calls) into history
          apiMessages.push(message as OAIMessage)

          for (const tc of message.tool_calls) {
            const toolCallTs = Date.now()
            const args       = JSON.parse(tc.function.arguments)

            const callStep = addStep({
              id:     `tc-${tc.id}`,
              type:   "tool_call",
              label:  `${tc.function.name}(${tc.function.arguments.slice(0, 60)}…)`,
              status: "running",
            })

            // Log MCP request
            write({
              type: "mcp_log",
              log: {
                id:        `req-${tc.id}`,
                direction: "request",
                tool:      tc.function.name,
                payload:   { method: "tools/call", params: { name: tc.function.name, arguments: args } },
                ts:        Date.now(),
              },
            })

            // Call MCP tool
            let mcpResult: any
            try {
              switch (tc.function.name) {
                case "search_financial_docs": {
                  mcpResult = await searchFinancialDocs(args.query, args.top_k, args.year_filter)
                  if (mcpResult.result) {
                    const r = mcpResult.result as { chunks?: Array<{ doc_id: string; page_num: number; section: string; score: number; text: string }> }
                    r.chunks?.forEach(c => {
                      allCitations.push({ doc: c.doc_id, page: c.page_num, section: c.section, score: c.score })
                      allChunks.push({ doc_id: c.doc_id, page_num: c.page_num, section: c.section, text: c.text })
                    })
                  }
                  break
                }
                case "get_document_page":
                  mcpResult = await getDocumentPage(args.doc_id, args.page_num)
                  break
                case "compare_benchmarks":
                  mcpResult = await compareBenchmarks(args.category, args.quarter)
                  break
                case "validate_faithfulness": {
                  mcpResult = await validateFaithfulness(args.answer, args.context)
                  if (mcpResult.result) {
                    const r = mcpResult.result as { score: number; passed: boolean }
                    finalFaithfulness = r.score
                    finalConfidence   = r.score
                    addStep({
                      id:         `faith-${Date.now()}`,
                      type:       "faithfulness",
                      label:      `Faithfulness: ${(r.score * 100).toFixed(0)}% — ${r.passed ? "PASS" : "FAIL"}`,
                      status:     r.passed ? "done" : "error",
                      durationMs: mcpResult.durationMs,
                    })
                  }
                  break
                }
                case "extract_kpis":
                  mcpResult = await extractKpis(args.doc_id)
                  break
                default:
                  mcpResult = { result: null, error: "Unknown tool", durationMs: 0, retries: 0 }
              }
            } catch (err) {
              mcpResult = { result: null, error: String(err), durationMs: 0, retries: 0 }
            }

            totalRetries += mcpResult?.retries ?? 0
            if (mcpResult?.error) totalDlq += 1

            updateStep(callStep.id, {
              status:     mcpResult?.error ? "error" : "done",
              durationMs: Date.now() - toolCallTs,
              detail:     JSON.stringify(mcpResult?.result ?? mcpResult?.error, null, 2).slice(0, 500),
            })

            // Log MCP response
            write({
              type: "mcp_log",
              log: {
                id:         `res-${tc.id}`,
                direction:  "response",
                tool:       tc.function.name,
                payload:    { result: mcpResult?.result ?? { error: mcpResult?.error } },
                durationMs: Date.now() - toolCallTs,
                ts:         Date.now(),
              },
            })

            // Push tool result back into history (OpenAI format)
            apiMessages.push({
              role:         "tool",
              tool_call_id: tc.id,
              content:      JSON.stringify(mcpResult?.result ?? { error: mcpResult?.error }),
            })
          }

          continue // next iteration
        }

        // ── Final text response ───────────────────────────────────────────
        if (choice.finish_reason === "stop") {
          const synthStep = addStep({
            id:     `synth-${Date.now()}`,
            type:   "synthesis",
            label:  "Synthesising grounded response with citations",
            status: "running",
          })

          const text = message.content ?? ""

          // Stream word by word
          const words = text.split(" ")
          for (let wi = 0; wi < words.length; wi++) {
            write({ type: "text", delta: (wi === 0 ? "" : " ") + words[wi] })
            if (wi % 8 === 0) await new Promise(r => setTimeout(r, 12))
          }

          updateStep(synthStep.id, { status: "done", durationMs: Date.now() - startedAt })

          // Dedupe citations
          const seen  = new Set<string>()
          const dedup = allCitations.filter(c => {
            const key = `${c.doc}-${c.page}`
            if (seen.has(key)) return false
            seen.add(key)
            return true
          }).slice(0, 8)

          const memories = extractMemoriesFromChunks(
            allChunks,
            finalFaithfulness !== undefined ? finalFaithfulness >= 0.75 : false
          )

          write({
            type:         "done",
            citations:    dedup,
            faithfulness: finalFaithfulness,
            confidence:   finalConfidence,
            dlqEntries:   totalDlq,
            retries:      totalRetries,
            durationMs:   Date.now() - startedAt,
            memories,
          })

          break
        }

        break
      }
    } catch (err) {
      console.error("[chat]", err)
      write({ type: "text", delta: "I encountered an error. Please try again." })
      write({ type: "done", citations: [], dlqEntries: 0, retries: 0, durationMs: Date.now() - startedAt })
    } finally {
      write({ type: "text", delta: "" })
      writer.close()
    }
  })()

  return new Response(stream.readable, {
    headers: {
      "Content-Type":      "text/event-stream",
      "Cache-Control":     "no-cache, no-transform",
      "Connection":        "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
