"""
Page-level RAG indexer.
Vectorless: SQLite FTS5 full-text + BM25 in-memory.
Cross-encoder is the semantic layer at rerank time.
"""
from __future__ import annotations

import sqlite3
import json
import pickle
import logging
import time
from pathlib import Path
from typing import Optional

from rank_bm25 import BM25Okapi
from schemas.models import Chunk

logger = logging.getLogger(__name__)

DB_PATH   = Path("data/index.db")
BM25_PATH = Path("data/bm25.pkl")

# ── GitHub production data bootstrap ─────────────────────────────────────────
# If data files are missing (fresh Railway deploy), download from GitHub repo.
# These URLs point to the committed production index in the main branch.
_GITHUB_RAW = "https://raw.githubusercontent.com/ressoom/amex-insight/main/amex-insight-mcp/data"
_REMOTE_FILES = {
    DB_PATH:   f"{_GITHUB_RAW}/index.db",
    BM25_PATH: f"{_GITHUB_RAW}/bm25.pkl",
}

def _bootstrap_data() -> None:
    """Download production data files from GitHub if not present locally."""
    import urllib.request
    missing = [p for p in _REMOTE_FILES if not p.exists()]
    if not missing:
        return
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    for path in missing:
        url = _REMOTE_FILES[path]
        logger.info(f"[bootstrap] Downloading {path.name} from GitHub …")
        try:
            urllib.request.urlretrieve(url, str(path))
            logger.info(f"[bootstrap] {path.name} ready ({path.stat().st_size:,} bytes)")
        except Exception as e:
            logger.error(f"[bootstrap] Failed to download {path.name}: {e}")

_bootstrap_data()


class DocumentIndex:
    """
    Single-class document index:
      - SQLite FTS5 for stemmed full-text search
      - BM25Okapi for ranked keyword retrieval
      - Both rebuilt/updated atomically on ingest
    """

    def __init__(self):
        DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        self.db    = sqlite3.connect(str(DB_PATH), check_same_thread=False)
        self.bm25: Optional[BM25Okapi] = None
        self._chunks: list[dict] = []
        self._init_db()
        self._load_bm25()

    def _init_db(self):
        self.db.executescript("""
            CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts
            USING fts5(
                id,
                doc_id,
                page_num UNINDEXED,
                section  UNINDEXED,
                text,
                context  UNINDEXED,
                tokenize = 'porter ascii'
            );

            CREATE TABLE IF NOT EXISTS chunks_meta (
                id       TEXT PRIMARY KEY,
                doc_id   TEXT NOT NULL,
                page_num INTEGER NOT NULL,
                section  TEXT DEFAULT '',
                text     TEXT NOT NULL,
                context  TEXT DEFAULT '',
                created_at REAL DEFAULT (unixepoch())
            );

            CREATE INDEX IF NOT EXISTS idx_meta_doc ON chunks_meta(doc_id);
            CREATE INDEX IF NOT EXISTS idx_meta_page ON chunks_meta(doc_id, page_num);
        """)
        self.db.commit()

    def _load_bm25(self):
        if BM25_PATH.exists():
            try:
                with open(BM25_PATH, "rb") as f:
                    data = pickle.load(f)
                self.bm25    = data["bm25"]
                self._chunks = data["chunks"]
                logger.info(f"[index] Loaded BM25 with {len(self._chunks)} chunks")
            except Exception as e:
                logger.warning(f"[index] BM25 load failed, rebuilding: {e}")
                self._rebuild_bm25()
        else:
            self._rebuild_bm25()

    def _rebuild_bm25(self):
        rows = self.db.execute(
            "SELECT id, doc_id, page_num, section, text, context FROM chunks_meta"
        ).fetchall()
        self._chunks = [
            {"id": r[0], "doc_id": r[1], "page_num": r[2],
             "section": r[3], "text": r[4], "context": r[5]}
            for r in rows
        ]
        if self._chunks:
            tokenized = [c["text"].lower().split() for c in self._chunks]
            self.bm25 = BM25Okapi(tokenized)
        else:
            self.bm25 = None

        with open(BM25_PATH, "wb") as f:
            pickle.dump({"bm25": self.bm25, "chunks": self._chunks}, f)
        logger.info(f"[index] BM25 rebuilt with {len(self._chunks)} chunks")

    def add_chunks(self, chunks: list[Chunk]):
        """Add chunks to both SQLite FTS5 and BM25 index."""
        for c in chunks:
            # Upsert into FTS5
            self.db.execute(
                "DELETE FROM chunks_fts WHERE id = ?", (c.id,)
            )
            self.db.execute(
                "INSERT INTO chunks_fts(id, doc_id, page_num, section, text, context) "
                "VALUES (?,?,?,?,?,?)",
                (c.id, c.doc_id, c.page_num, c.section, c.text, c.context)
            )
            # Upsert into meta
            self.db.execute("""
                INSERT OR REPLACE INTO chunks_meta
                (id, doc_id, page_num, section, text, context)
                VALUES (?,?,?,?,?,?)
            """, (c.id, c.doc_id, c.page_num, c.section, c.text, c.context))

        self.db.commit()
        self._rebuild_bm25()
        logger.info(f"[index] Added {len(chunks)} chunks, index size: {len(self._chunks)}")

    def fts_search(self, query: str, limit: int = 20) -> list[str]:
        """SQLite FTS5 full-text search — handles stemming + phrase matching."""
        # Escape special FTS5 characters
        safe = query.replace('"', '""')
        try:
            rows = self.db.execute(
                'SELECT id FROM chunks_fts WHERE chunks_fts MATCH ? ORDER BY rank LIMIT ?',
                (safe, limit)
            ).fetchall()
            return [r[0] for r in rows]
        except sqlite3.OperationalError:
            # Fallback: try unquoted query
            try:
                rows = self.db.execute(
                    'SELECT id FROM chunks_fts WHERE text LIKE ? LIMIT ?',
                    (f"%{query}%", limit)
                ).fetchall()
                return [r[0] for r in rows]
            except Exception:
                return []

    def bm25_search(self, query: str, limit: int = 20) -> list[str]:
        """BM25 ranked retrieval."""
        if not self.bm25 or not self._chunks:
            return []
        tokens = query.lower().split()
        scores = self.bm25.get_scores(tokens)
        ranked = sorted(
            range(len(scores)), key=lambda i: scores[i], reverse=True
        )[:limit]
        return [self._chunks[i]["id"] for i in ranked if scores[i] > 0]

    def get_chunks_by_ids(self, ids: list[str]) -> list[dict]:
        """Fetch full chunk data by IDs."""
        if not ids:
            return []
        placeholders = ",".join("?" * len(ids))
        rows = self.db.execute(
            f"SELECT id, doc_id, page_num, section, text, context "
            f"FROM chunks_meta WHERE id IN ({placeholders})",
            ids
        ).fetchall()
        # Preserve order of input ids
        row_map = {r[0]: r for r in rows}
        return [
            {"id": r[0], "doc_id": r[1], "page_num": r[2],
             "section": r[3], "text": r[4], "context": r[5]}
            for iid in ids
            if (r := row_map.get(iid)) is not None
        ]

    def get_page(self, doc_id: str, page_num: int) -> Optional[dict]:
        row = self.db.execute(
            "SELECT id, doc_id, page_num, section, text, context "
            "FROM chunks_meta WHERE doc_id = ? AND page_num = ?",
            (doc_id, page_num)
        ).fetchone()
        if not row:
            return None
        return {"id": row[0], "doc_id": row[1], "page_num": row[2],
                "section": row[3], "text": row[4], "context": row[5]}

    def total_chunks(self) -> int:
        return self.db.execute("SELECT COUNT(*) FROM chunks_meta").fetchone()[0]


# Singleton
_index: Optional[DocumentIndex] = None

def get_index() -> DocumentIndex:
    global _index
    if _index is None:
        _index = DocumentIndex()
    return _index
