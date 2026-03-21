"""
Saved Chats MCP Tools
─────────────────────
4 agentic tools for persisting important conversations to SQLite.

  • save_chat          — persist a chat session with title + tags
  • list_saved_chats   — list all saved chats (with metadata)
  • get_saved_chat     — retrieve full messages of a saved chat
  • delete_saved_chat  — remove a saved chat by ID
"""
from __future__ import annotations

import sqlite3
import json
import time
import os
from schemas.models import (
    SaveChatRequest, SaveChatResponse,
    ListSavedChatsRequest, ListSavedChatsResponse, SavedChatMeta,
    GetSavedChatRequest, GetSavedChatResponse,
    DeleteSavedChatRequest, DeleteSavedChatResponse,
)

DB_PATH = os.path.join(os.path.dirname(__file__), "../data/index.db")


def _get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("""
        CREATE TABLE IF NOT EXISTS saved_chats (
            id          TEXT PRIMARY KEY,
            title       TEXT NOT NULL,
            summary     TEXT DEFAULT '',
            tags        TEXT DEFAULT '[]',
            messages    TEXT NOT NULL,
            created_at  INTEGER NOT NULL,
            message_count INTEGER NOT NULL DEFAULT 0
        )
    """)
    conn.commit()
    return conn


async def save_chat(req: SaveChatRequest) -> SaveChatResponse:
    """
    Save an important chat conversation to persistent storage.
    Stores full message history with title, summary, and tags for later retrieval.
    Call this when the user says /save or asks to save the conversation.
    """
    conn = _get_conn()
    chat_id = f"chat-{int(time.time() * 1000)}"
    tags_json = json.dumps(req.tags)
    messages_json = json.dumps(req.messages)

    conn.execute(
        """INSERT OR REPLACE INTO saved_chats
           (id, title, summary, tags, messages, created_at, message_count)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (chat_id, req.title, req.summary, tags_json, messages_json,
         int(time.time()), len(req.messages))
    )
    conn.commit()
    conn.close()

    return SaveChatResponse(
        chat_id=chat_id,
        title=req.title,
        message_count=len(req.messages),
        saved_at=int(time.time()),
    )


async def list_saved_chats(req: ListSavedChatsRequest) -> ListSavedChatsResponse:
    """
    List all saved chat conversations with metadata (title, tags, date, message count).
    Use this to show the user their saved chats. Supports optional tag filtering.
    """
    conn = _get_conn()
    rows = conn.execute(
        "SELECT id, title, summary, tags, created_at, message_count FROM saved_chats ORDER BY created_at DESC LIMIT ?",
        (req.limit,)
    ).fetchall()
    conn.close()

    chats = []
    for row in rows:
        tags = json.loads(row["tags"] or "[]")
        if req.tag_filter and req.tag_filter not in tags:
            continue
        chats.append(SavedChatMeta(
            chat_id=row["id"],
            title=row["title"],
            summary=row["summary"] or "",
            tags=tags,
            created_at=row["created_at"],
            message_count=row["message_count"],
        ))

    return ListSavedChatsResponse(chats=chats, total=len(chats))


async def get_saved_chat(req: GetSavedChatRequest) -> GetSavedChatResponse:
    """
    Retrieve the full message history of a saved chat by its ID.
    Use this when the user wants to review or continue a previously saved conversation.
    """
    conn = _get_conn()
    row = conn.execute(
        "SELECT * FROM saved_chats WHERE id = ?", (req.chat_id,)
    ).fetchone()
    conn.close()

    if not row:
        return GetSavedChatResponse(
            chat_id=req.chat_id, title="", messages=[], tags=[], found=False
        )

    return GetSavedChatResponse(
        chat_id=row["id"],
        title=row["title"],
        summary=row["summary"] or "",
        messages=json.loads(row["messages"]),
        tags=json.loads(row["tags"] or "[]"),
        created_at=row["created_at"],
        found=True,
    )


async def delete_saved_chat(req: DeleteSavedChatRequest) -> DeleteSavedChatResponse:
    """
    Delete a saved chat by ID. Use this when the user explicitly asks to remove a saved conversation.
    """
    conn = _get_conn()
    cursor = conn.execute("DELETE FROM saved_chats WHERE id = ?", (req.chat_id,))
    deleted = cursor.rowcount > 0
    conn.commit()
    conn.close()

    return DeleteSavedChatResponse(chat_id=req.chat_id, deleted=deleted)
