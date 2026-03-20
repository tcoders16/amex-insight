"""
Email summary tool.
Sends a formatted financial insight summary via Resend.
Free tier: 3,000 emails/month — https://resend.com
"""
from __future__ import annotations

import os
import logging
import httpx

from schemas.models import EmailRequest, EmailResponse
from observability.tracer import trace_tool

logger = logging.getLogger(__name__)

RESEND_API_URL = "https://api.resend.com/emails"


def _build_html(req: EmailRequest) -> str:
    citations_html = ""
    if req.citations:
        items = "".join(
            f"<li><strong>{c.get('doc', '')}</strong> — page {c.get('page', '')} "
            f"(score: {c.get('score', 0):.2f})</li>"
            for c in req.citations
        )
        citations_html = f"<h3>Sources</h3><ul>{items}</ul>"

    confidence_color = (
        "#22c55e" if req.confidence_score >= 0.75
        else "#f59e0b" if req.confidence_score >= 0.5
        else "#ef4444"
    )

    return f"""
    <div style="font-family: sans-serif; max-width: 640px; margin: auto; padding: 24px;">
      <h2 style="color: #1a1a2e;">AmexInsight — Financial Summary</h2>
      <p style="font-size: 14px; color: #666;">Query: <em>{req.query}</em></p>
      <hr style="border: none; border-top: 1px solid #eee;" />

      <h3>Answer</h3>
      <p style="line-height: 1.7;">{req.summary}</p>

      <p style="margin-top: 16px;">
        <span style="background:{confidence_color}; color:#fff; padding:4px 10px;
               border-radius:12px; font-size:13px;">
          Confidence: {int(req.confidence_score * 100)}%
        </span>
      </p>

      {citations_html}

      <hr style="border: none; border-top: 1px solid #eee; margin-top: 32px;" />
      <p style="font-size: 11px; color: #999;">
        Sent by AmexInsight MCP · Powered by agentic RAG · Citations grounded to source pages
      </p>
    </div>
    """


@trace_tool("send_email_summary")
async def send_email_summary(req: EmailRequest) -> EmailResponse:
    """
    Send a formatted financial insight summary to an email address.
    Uses Resend API. Requires RESEND_API_KEY env var.
    """
    api_key = os.getenv("RESEND_API_KEY", "")
    if not api_key:
        logger.error("[email] RESEND_API_KEY not set")
        return EmailResponse(success=False, message_id="", error="RESEND_API_KEY not configured")

    payload = {
        "from":    "AmexInsight <onboarding@resend.dev>",
        "to":      [req.to],
        "subject": req.subject or f"AmexInsight: {req.query[:60]}",
        "html":    _build_html(req),
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                RESEND_API_URL,
                json=payload,
                headers={"Authorization": f"Bearer {api_key}"},
            )
            resp.raise_for_status()
            data = resp.json()
            logger.info(f"[email] sent to={req.to} id={data.get('id')}")
            return EmailResponse(success=True, message_id=data.get("id", ""), error="")

    except httpx.HTTPStatusError as e:
        logger.error(f"[email] HTTP error: {e.response.text}")
        return EmailResponse(success=False, message_id="", error=str(e.response.text))
    except Exception as e:
        logger.error(f"[email] unexpected error: {e}")
        return EmailResponse(success=False, message_id="", error=str(e))
