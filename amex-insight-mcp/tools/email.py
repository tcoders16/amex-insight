"""
Email summary tool — Gmail SMTP.
Auto-sends to emailtosolankiom@gmail.com after every agent response.
"""
from __future__ import annotations

import os
import smtplib
import logging
from datetime             import datetime
from email.mime.text      import MIMEText
from email.mime.multipart import MIMEMultipart

from schemas.models       import EmailRequest, EmailResponse
from observability.tracer import trace_tool

logger    = logging.getLogger(__name__)
SMTP_HOST = "smtp.gmail.com"
SMTP_PORT = 587
TO_EMAIL  = "emailtosolankiom@gmail.com"


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
    conf_pct   = int(req.confidence_score * 100)
    conf_color = "#22c55e" if req.confidence_score >= 0.75 else "#f59e0b" if req.confidence_score >= 0.5 else "#ef4444"
    conf_label = "High Confidence" if req.confidence_score >= 0.75 else "Medium Confidence" if req.confidence_score >= 0.5 else "Low Confidence"
    ts         = datetime.utcnow().strftime("%B %d, %Y · %H:%M UTC")

    # Format summary — convert newlines to <br> and **bold** to <strong>
    import re
    body = req.summary.replace("\n\n", "</p><p>").replace("\n", "<br>")
    body = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", body)
    body = re.sub(r"\*(.+?)\*",     r"<em>\1</em>",         body)

    # Citations table
    citations_html = ""
    if req.citations:
        rows = "".join(
            f"""<tr style="background:{'#fff' if i%2==0 else '#f9fafb'}">
                  <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;font-weight:500;color:#111">{c.get('doc','')}</td>
                  <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;color:#2563eb;font-weight:600">p.{c.get('page','')}</td>
                  <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;color:#6b7280">{c.get('section','—')}</td>
                  <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb">
                    <span style="background:#eff6ff;color:#2563eb;padding:2px 8px;border-radius:10px;font-size:12px;font-weight:600">{int(c.get('score',0)*100)}%</span>
                  </td>
               </tr>"""
            for i, c in enumerate(req.citations)
        )
        citations_html = f"""
        <div style="margin-top:32px">
          <h3 style="color:#111827;font-size:14px;font-weight:700;margin:0 0 12px;
                     text-transform:uppercase;letter-spacing:.05em;font-family:monospace">
            Source Documents
          </h3>
          <table style="width:100%;border-collapse:collapse;font-size:13px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
            <thead>
              <tr style="background:#f3f4f6">
                <th style="padding:10px 14px;text-align:left;color:#374151;font-weight:600;font-size:12px">Document</th>
                <th style="padding:10px 14px;text-align:left;color:#374151;font-weight:600;font-size:12px">Page</th>
                <th style="padding:10px 14px;text-align:left;color:#374151;font-weight:600;font-size:12px">Section</th>
                <th style="padding:10px 14px;text-align:left;color:#374151;font-weight:600;font-size:12px">Score</th>
              </tr>
            </thead>
            <tbody>{rows}</tbody>
          </table>
          <p style="font-size:11px;color:#9ca3af;margin:8px 0 0;font-family:monospace">
            Retrieved via BM25 + FTS5 + MS-MARCO cross-encoder reranking · SEC EDGAR CIK 0000004962
          </p>
        </div>"""

    return f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">

  <div style="max-width:660px;margin:40px auto 40px;background:#ffffff;border-radius:16px;
              overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.10)">

    <!-- ── Header ───────────────────────────────────────────────── -->
    <div style="background:linear-gradient(135deg,#1d4ed8 0%,#4f46e5 50%,#7c3aed 100%);
                padding:32px 36px">
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:20px">
        <div style="width:42px;height:42px;background:rgba(255,255,255,.18);border-radius:10px;
                    display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <span style="color:#fff;font-family:monospace;font-weight:900;font-size:13px">AI</span>
        </div>
        <div>
          <div style="color:#fff;font-weight:800;font-size:18px;letter-spacing:-.02em">AmexInsight</div>
          <div style="color:rgba(255,255,255,.65);font-size:12px;font-family:monospace">
            Agentic Financial Intelligence · MCP RAG
          </div>
        </div>
      </div>

      <!-- Query pill -->
      <div style="background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2);
                  border-radius:10px;padding:14px 18px">
        <div style="color:rgba(255,255,255,.6);font-size:11px;font-family:monospace;
                    text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px">Query</div>
        <div style="color:#fff;font-size:14px;font-style:italic;line-height:1.5">"{req.query}"</div>
      </div>
    </div>

    <!-- ── Confidence badge bar ──────────────────────────────────── -->
    <div style="background:#f8fafc;border-bottom:1px solid #e2e8f0;
                padding:14px 36px;display:flex;align-items:center;justify-content:space-between">
      <div style="display:flex;align-items:center;gap:10px">
        <span style="width:8px;height:8px;border-radius:50%;background:{conf_color};display:inline-block"></span>
        <span style="font-size:12px;font-family:monospace;color:#64748b;font-weight:600">
          {conf_label} · {conf_pct}%
        </span>
      </div>
      <div style="font-size:11px;font-family:monospace;color:#94a3b8">{ts}</div>
    </div>

    <!-- ── Body ─────────────────────────────────────────────────── -->
    <div style="padding:32px 36px">

      <h2 style="color:#0f172a;font-size:16px;font-weight:700;margin:0 0 16px;
                 text-transform:uppercase;letter-spacing:.05em;font-family:monospace">
        Summary
      </h2>

      <div style="color:#334155;font-size:14px;line-height:1.85;border-left:3px solid #2563eb;
                  padding-left:16px;margin-bottom:24px">
        <p style="margin:0">{body}</p>
      </div>

      <!-- Confidence meter -->
      <div style="background:#f1f5f9;border-radius:8px;padding:14px 18px;margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;margin-bottom:8px">
          <span style="font-size:12px;color:#64748b;font-family:monospace">Faithfulness score</span>
          <span style="font-size:12px;font-weight:700;color:{conf_color};font-family:monospace">{conf_pct}%</span>
        </div>
        <div style="background:#e2e8f0;border-radius:999px;height:6px;overflow:hidden">
          <div style="background:{conf_color};width:{conf_pct}%;height:100%;border-radius:999px"></div>
        </div>
        <p style="font-size:11px;color:#94a3b8;margin:8px 0 0;font-family:monospace">
          NLI cross-encoder faithfulness check · Threshold 75%
        </p>
      </div>

      {citations_html}
    </div>

    <!-- ── Footer ───────────────────────────────────────────────── -->
    <div style="background:#0f172a;padding:20px 36px;display:flex;
                align-items:center;justify-content:space-between">
      <div>
        <div style="color:#94a3b8;font-size:11px;font-family:monospace">AmexInsight MCP · Gmail SMTP</div>
        <div style="color:#475569;font-size:10px;font-family:monospace;margin-top:2px">
          BM25 + FTS5 + Cross-Encoder · Vectorless RAG · Zero hallucination policy
        </div>
      </div>
      <div style="background:rgba(37,99,235,.2);border:1px solid rgba(37,99,235,.3);
                  padding:4px 12px;border-radius:20px">
        <span style="color:#60a5fa;font-size:11px;font-family:monospace;font-weight:600">
          SEC EDGAR · AXP
        </span>
      </div>
    </div>

  </div>
</body>
</html>"""


@trace_tool("send_email_summary")
async def send_email_summary(req: EmailRequest) -> EmailResponse:
    """Auto-send formatted financial insight to emailtosolankiom@gmail.com via Gmail SMTP."""
    # Always override to the correct address
    req = req.model_copy(update={"to": TO_EMAIL})

    try:
        subject = req.subject or f"AmexInsight: {req.query[:60]}"
        _send_gmail(req.to, subject, _build_html(req))
        logger.info(f"[email] sent to={req.to} query={req.query[:40]}")
        return EmailResponse(success=True, message_id="gmail-smtp", error="")
    except Exception as e:
        logger.error(f"[email] error: {e}")
        return EmailResponse(success=False, message_id="", error=str(e))
