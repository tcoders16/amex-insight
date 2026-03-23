"""
Email summary tool — Gmail SMTP.
No third-party service required.
Requires GMAIL_USER and GMAIL_APP_PASS env vars.
"""
from __future__ import annotations

import os
import smtplib
import logging
from datetime               import datetime
from email.mime.text        import MIMEText
from email.mime.multipart   import MIMEMultipart

from schemas.models         import EmailRequest, EmailResponse
from observability.tracer   import trace_tool

logger    = logging.getLogger(__name__)
SMTP_HOST = "smtp.gmail.com"
SMTP_PORT = 587


def _send_gmail(to: str, subject: str, html: str) -> None:
    user = os.getenv("GMAIL_USER", "")
    pwd  = os.getenv("GMAIL_APP_PASS", "")
    if not user or not pwd:
        raise ValueError("GMAIL_USER and GMAIL_APP_PASS env vars must be set")

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = f"AmexInsight <{user}>"
    msg["To"]      = to
    msg.attach(MIMEText(html, "html"))

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as smtp:
        smtp.ehlo()
        smtp.starttls()
        smtp.login(user, pwd)
        smtp.sendmail(user, [to], msg.as_string())


def _build_html(req: EmailRequest) -> str:
    conf_color = (
        "#22c55e" if req.confidence_score >= 0.75
        else "#f59e0b" if req.confidence_score >= 0.5
        else "#ef4444"
    )
    ts = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")

    citations_html = ""
    if req.citations:
        rows = "".join(
            f"""<tr>
                  <td style="padding:6px 12px;border-bottom:1px solid #f0f0f0">{c.get('doc','')}</td>
                  <td style="padding:6px 12px;border-bottom:1px solid #f0f0f0">p.{c.get('page','')}</td>
                  <td style="padding:6px 12px;border-bottom:1px solid #f0f0f0">{c.get('section','')}</td>
                  <td style="padding:6px 12px;border-bottom:1px solid #f0f0f0;color:#2563eb">{int(c.get('score',0)*100)}%</td>
               </tr>"""
            for c in req.citations
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

    <div style="padding:32px">
      <p style="color:#666;font-size:13px;margin:0 0 8px">Query</p>
      <p style="color:#1a1a2e;font-size:15px;font-style:italic;margin:0 0 24px;
                padding:12px 16px;background:#f8f9fa;border-left:3px solid #2563eb;border-radius:4px">
        "{req.query}"
      </p>

      <h3 style="color:#1a1a2e;margin:0 0 12px">Answer</h3>
      <p style="color:#374151;line-height:1.75;font-size:14px;margin:0 0 24px">{req.summary}</p>

      <span style="background:{conf_color};color:#fff;padding:5px 14px;
                   border-radius:20px;font-size:13px;font-weight:600">
        Confidence {int(req.confidence_score * 100)}%
      </span>

      {citations_html}
    </div>

    <div style="padding:16px 32px;background:#f8f9fa;border-top:1px solid #eee">
      <p style="color:#999;font-size:11px;margin:0;font-family:monospace">
        Sent by AmexInsight MCP · {ts} · Gmail SMTP · BM25 + FTS5 RAG · Faithfulness verified
      </p>
    </div>
  </div>
</body>
</html>"""


@trace_tool("send_email_summary")
async def send_email_summary(req: EmailRequest) -> EmailResponse:
    """Send a formatted financial insight summary via Gmail SMTP."""
    try:
        subject = req.subject or f"AmexInsight: {req.query[:60]}"
        _send_gmail(req.to, subject, _build_html(req))
        logger.info(f"[email] sent to={req.to}")
        return EmailResponse(success=True, message_id="gmail-smtp", error="")
    except Exception as e:
        logger.error(f"[email] error: {e}")
        return EmailResponse(success=False, message_id="", error=str(e))
