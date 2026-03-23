"""
email-mcp — standalone email MCP server for Claude Desktop
Uses Resend (free tier: 3,000 emails/month)

Tools:
  send_email            — send any email (to, subject, body)
  send_financial_brief  — send a formatted AMEX insight summary
  preview_email         — preview the HTML without sending (dry run)
"""

from __future__ import annotations

import os
import json
import httpx
from datetime import datetime
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("email-mcp")

RESEND_API_URL = "https://api.resend.com/emails"
FROM_ADDRESS   = "AmexInsight <onboarding@resend.dev>"


def _get_key() -> str:
    key = os.getenv("RESEND_API_KEY", "")
    if not key:
        raise ValueError("RESEND_API_KEY env var is not set. Get a free key at resend.com")
    return key


def _send(to: str, subject: str, html: str) -> dict:
    """Core Resend API call."""
    resp = httpx.post(
        RESEND_API_URL,
        json={"from": FROM_ADDRESS, "to": [to], "subject": subject, "html": html},
        headers={"Authorization": f"Bearer {_get_key()}"},
        timeout=15.0,
    )
    resp.raise_for_status()
    return resp.json()


def _financial_html(query: str, summary: str, confidence: float, citations: list[dict]) -> str:
    conf_color = "#22c55e" if confidence >= 0.75 else "#f59e0b" if confidence >= 0.5 else "#ef4444"
    ts = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")

    citations_html = ""
    if citations:
        rows = "".join(
            f"""<tr>
                  <td style="padding:6px 12px;border-bottom:1px solid #f0f0f0">{c.get('doc','')}</td>
                  <td style="padding:6px 12px;border-bottom:1px solid #f0f0f0">p.{c.get('page','')}</td>
                  <td style="padding:6px 12px;border-bottom:1px solid #f0f0f0">{c.get('section','')}</td>
                  <td style="padding:6px 12px;border-bottom:1px solid #f0f0f0;color:#2563eb">{int(c.get('score',0)*100)}%</td>
               </tr>"""
            for c in citations
        )
        citations_html = f"""
        <h3 style="color:#1a1a2e;margin-top:28px">Sources</h3>
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead>
            <tr style="background:#f8f9fa">
              <th style="padding:8px 12px;text-align:left;color:#666">Document</th>
              <th style="padding:8px 12px;text-align:left;color:#666">Page</th>
              <th style="padding:8px 12px;text-align:left;color:#666">Section</th>
              <th style="padding:8px 12px;text-align:left;color:#666">Score</th>
            </tr>
          </thead>
          <tbody>{rows}</tbody>
        </table>"""

    return f"""<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:640px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1d4ed8,#7c3aed);padding:28px 32px">
      <div style="display:flex;align-items:center;gap:12px">
        <div style="width:36px;height:36px;background:rgba(255,255,255,.2);border-radius:8px;
                    display:flex;align-items:center;justify-content:center;
                    font-family:monospace;font-weight:900;color:#fff;font-size:11px">AI</div>
        <div>
          <div style="color:#fff;font-weight:700;font-size:16px">AmexInsight</div>
          <div style="color:rgba(255,255,255,.7);font-size:12px">Agentic Financial Intelligence</div>
        </div>
      </div>
    </div>

    <!-- Body -->
    <div style="padding:32px">
      <p style="color:#666;font-size:13px;margin:0 0 8px">Query</p>
      <p style="color:#1a1a2e;font-size:15px;font-style:italic;margin:0 0 24px;
                padding:12px 16px;background:#f8f9fa;border-left:3px solid #2563eb;border-radius:4px">
        "{query}"
      </p>

      <h3 style="color:#1a1a2e;margin:0 0 12px">Answer</h3>
      <p style="color:#374151;line-height:1.75;font-size:14px;margin:0 0 24px">{summary}</p>

      <span style="background:{conf_color};color:#fff;padding:5px 14px;
                   border-radius:20px;font-size:13px;font-weight:600">
        Confidence {int(confidence * 100)}%
      </span>

      {citations_html}
    </div>

    <!-- Footer -->
    <div style="padding:16px 32px;background:#f8f9fa;border-top:1px solid #eee">
      <p style="color:#999;font-size:11px;margin:0;font-family:monospace">
        Sent by AmexInsight MCP · {ts} · BM25 + FTS5 + Cross-Encoder RAG · Faithfulness verified
      </p>
    </div>
  </div>
</body>
</html>"""


# ─── Tool 1: send_email ───────────────────────────────────────────────────────

@mcp.tool()
def send_email(to: str, subject: str, body: str) -> str:
    """
    Send a plain email via Resend.

    Args:
        to:      Recipient email address
        subject: Email subject line
        body:    Email body text (plain text — auto-wrapped in simple HTML)

    Returns:
        JSON string with {success, message_id, error}
    """
    html = f"""<div style="font-family:sans-serif;max-width:600px;margin:auto;padding:24px;line-height:1.7">
        {body.replace(chr(10), '<br>')}
        <hr style="border:none;border-top:1px solid #eee;margin-top:32px">
        <p style="font-size:11px;color:#999;font-family:monospace">Sent by AmexInsight email-mcp</p>
    </div>"""

    try:
        data = _send(to, subject, html)
        return json.dumps({"success": True, "message_id": data.get("id", ""), "error": ""})
    except Exception as e:
        return json.dumps({"success": False, "message_id": "", "error": str(e)})


# ─── Tool 2: send_financial_brief ────────────────────────────────────────────

@mcp.tool()
def send_financial_brief(
    to:         str,
    query:      str,
    summary:    str,
    confidence: float = 1.0,
    citations:  str   = "[]",
) -> str:
    """
    Send a beautifully formatted AmexInsight financial summary email.

    Args:
        to:         Recipient email address
        query:      The original question that was answered
        summary:    The grounded answer text
        confidence: Faithfulness score 0.0–1.0 (shown as a badge)
        citations:  JSON array of citation objects [{doc, page, section, score}]

    Returns:
        JSON string with {success, message_id, error}
    """
    try:
        cits = json.loads(citations) if isinstance(citations, str) else citations
    except Exception:
        cits = []

    subject = f"AmexInsight: {query[:55]}{'...' if len(query) > 55 else ''}"
    html    = _financial_html(query, summary, confidence, cits)

    try:
        data = _send(to, subject, html)
        return json.dumps({"success": True, "message_id": data.get("id", ""), "error": ""})
    except Exception as e:
        return json.dumps({"success": False, "message_id": "", "error": str(e)})


# ─── Tool 3: preview_email ────────────────────────────────────────────────────

@mcp.tool()
def preview_email(
    query:      str,
    summary:    str,
    confidence: float = 0.95,
    citations:  str   = "[]",
) -> str:
    """
    Dry-run: generate the HTML email without sending it.
    Useful to verify formatting before sending.

    Returns:
        The raw HTML string (first 800 chars as preview + char count)
    """
    try:
        cits = json.loads(citations) if isinstance(citations, str) else citations
    except Exception:
        cits = []

    html = _financial_html(query, summary, confidence, cits)
    preview = html[:800].replace("<", "&lt;").replace(">", "&gt;")
    return json.dumps({
        "html_length":   len(html),
        "preview":       preview,
        "would_send_to": "not sent — dry run",
    })


# ─── Entry point ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    mcp.run(transport="stdio")
