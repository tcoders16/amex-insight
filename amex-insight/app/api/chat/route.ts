import OpenAI from "openai"
import { z } from "zod"
import {
  searchFinancialDocs,
  getDocumentPage,
  compareBenchmarks,
  validateFaithfulness,
  extractKpis,
  sendEmailSummary,
  generateDocument,
} from "@/lib/mcp-client"
import type { AgentStep, Citation, GeneratedDoc, SessionMemory } from "@/lib/types"

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
  {
    type: "function",
    function: {
      name:        "generate_document",
      description: "Generate a Word (.docx) or PowerPoint (.pptx) document from financial analysis. Use when the user asks to 'generate a report', 'make a deck', 'create a Word doc', 'build a PPT', or 'export'. Returns a download URL. Always call send_email_summary after so the user receives the link by email.",
      parameters: {
        type: "object",
        properties: {
          doc_type:  { type: "string", enum: ["word", "ppt"], description: "word = .docx, ppt = .pptx" },
          title:     { type: "string", description: "Document title" },
          subtitle:  { type: "string", description: "Optional subtitle or date line" },
          sections:  {
            type: "array",
            description: "Slides or sections — each with a heading and body text",
            items: {
              type: "object",
              properties: {
                heading: { type: "string" },
                body:    { type: "string" },
              },
              required: ["heading", "body"],
            },
          },
        },
        required: ["doc_type", "title", "sections"],
      },
    },
  },
  {
    type: "function",
    function: {
      name:        "send_email_summary",
      description: "Email a financial insight summary via Gmail. ALWAYS call this automatically after every final answer — summary, KPI report, comparison, risk assessment, or document. Never skip this step. Use the user-specified recipient if provided, otherwise default to emailtosolankiom@gmail.com.",
      parameters: {
        type: "object",
        properties: {
          to:               { type: "string", description: "Recipient email address. Default: emailtosolankiom@gmail.com" },
          from_name:        { type: "string", description: "Sender display name shown in the From field. Default: AmexInsight" },
          subject:          { type: "string", description: "Email subject line. Auto-generated from query if not provided." },
          query:            { type: "string", description: "The original user question" },
          summary:          { type: "string", description: "The full grounded answer to email" },
          confidence_score: { type: "number", description: "Faithfulness score 0-1" },
        },
        required: ["query", "summary"],
      },
    },
  },
]

const SYSTEM = `You are AmexInsight, an agentic financial intelligence assistant.
You have access to AMEX 10-K filings indexed as structured documents.

INDEXED DOCUMENTS (use these exact doc_id values):
- 2020-10k  — AMEX 2020 Annual Report (10-K)
- 2021-10k  — AMEX 2021 Annual Report (10-K)
- 2022-10k  — AMEX 2022 Annual Report (10-K)
- 2023-10k  — AMEX 2023 Annual Report (10-K)
- 2024-10k  — AMEX 2024 Annual Report (10-K)
- multi-year — Cross-year comparative data

DELIVERY EMAIL: emailtosolankiom@gmail.com (default)
If the user says "send to X@example.com" or "email this to ...", use that address in the to field.
Otherwise always default to emailtosolankiom@gmail.com. Never ask the user for an email address.

RULES:
1. ALWAYS call search_financial_docs first before any other tool. Never answer from memory alone.
2. Only call extract_kpis AFTER you have already called search_financial_docs at least once.
3. When calling extract_kpis, always use the exact doc_id values listed above (e.g. "2024-10k" not "2024-annual-report").
4. For complex questions, decompose into sub-questions and call tools in sequence.
5. After retrieving, call validate_faithfulness before synthesizing your final answer.
6. If faithfulness score < 0.75, retrieve more context or abstain.
7. Always cite sources: document name and page number.
8. If you cannot find grounded information, say so clearly. Never fabricate.
9. For financial figures, be precise. Wrong numbers are worse than no numbers.
10. ALWAYS call send_email_summary after producing any final answer — summary, KPI report, comparison, risk assessment, or document generation. If the user specified a recipient email address, use that in the to field. Otherwise default to emailtosolankiom@gmail.com. Do this automatically without waiting for the user to ask.
11. CRITICAL — Word doc / PPT attachment rule: Whenever the user mentions "word doc", "docx", "Word document", "as a word doc", "generate a doc", "PPT", "PowerPoint", "deck", or "as an attachment" — you MUST follow this exact sequence:
    STEP 1: Call search_financial_docs to retrieve relevant content
    STEP 2: Call generate_document with sections built from the retrieved content. Wait for the result — it will return a filename and url.
    STEP 3: ONLY THEN call send_email_summary. The system will automatically attach the generated file to the email.
    NEVER call send_email_summary claiming a Word doc was sent unless you actually called generate_document first in this same conversation turn. Skipping generate_document and sending anyway is a hallucination.`

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
    const allGeneratedDocs: GeneratedDoc[] = []
    const allChunks: Array<{ doc_id: string; page_num: number; section: string; text: string }> = []
    // Last generated doc attachment — passed to the next send_email_summary call
    let pendingAttachment: { filename: string; content_b64: string } | null = null
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
                      allCitations.push({ doc: c.doc_id, page: c.page_num, section: c.section, score: c.score, text: c.text })
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
                case "generate_document":
                  mcpResult = await generateDocument(
                    args.doc_type as "word" | "ppt",
                    args.title as string,
                    args.sections as { heading: string; body: string }[],
                    args.subtitle as string | undefined,
                  )
                  if (mcpResult?.result) {
                    const r = mcpResult.result as { filename?: string; url?: string; content_b64?: string }
                    if (r.filename && r.url) {
                      allGeneratedDocs.push({
                        filename: r.filename,
                        url:      r.url,
                        docType:  args.doc_type as "word" | "ppt",
                      })
                      if (r.content_b64) {
                        pendingAttachment = { filename: r.filename, content_b64: r.content_b64 }
                      }
                    }
                  }
                  addStep({
                    id:     `doc-${Date.now()}`,
                    type:   "tool_call",
                    label:  `${args.doc_type === "ppt" ? "PowerPoint" : "Word doc"} generated → ${(mcpResult?.result as any)?.filename ?? ""}`,
                    status: mcpResult?.result ? "done" : "error",
                    durationMs: mcpResult?.durationMs,
                  })
                  break
                case "send_email_summary": {
                  const toAddr    = (args.to as string | undefined)        || "emailtosolankiom@gmail.com"
                  const fromName  = (args.from_name as string | undefined) || "AmexInsight"
                  const subject   = (args.subject as string | undefined)   || ""
                  const attach    = pendingAttachment
                  pendingAttachment = null   // consume it
                  mcpResult = await sendEmailSummary(
                    args.query,
                    args.summary,
                    args.confidence_score ?? finalConfidence ?? 1.0,
                    allCitations.slice(0, 5),
                    toAddr,
                    attach?.content_b64 ?? "",
                    attach?.filename ?? "",
                    fromName,
                    subject,
                  )
                  addStep({
                    id:     `email-${Date.now()}`,
                    type:   "tool_call",
                    label:  `Email sent → ${toAddr}`,
                    status: (mcpResult?.result as any)?.success ? "done" : "error",
                    durationMs: mcpResult?.durationMs,
                  })
                  break
                }
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

          // Dedupe citations — keep highest-score chunk per doc+page (preserves text)
          const seenMap = new Map<string, Citation>()
          for (const c of allCitations) {
            const key = `${c.doc}-${c.page}`
            const existing = seenMap.get(key)
            if (!existing || c.score > (existing.score ?? 0)) seenMap.set(key, c)
          }
          const dedup = Array.from(seenMap.values()).slice(0, 8)

          const memories = extractMemoriesFromChunks(
            allChunks,
            finalFaithfulness !== undefined ? finalFaithfulness >= 0.75 : false
          )

          write({
            type:          "done",
            citations:     dedup,
            generatedDocs: allGeneratedDocs,
            faithfulness:  finalFaithfulness,
            confidence:    finalConfidence,
            dlqEntries:    totalDlq,
            retries:       totalRetries,
            durationMs:    Date.now() - startedAt,
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
