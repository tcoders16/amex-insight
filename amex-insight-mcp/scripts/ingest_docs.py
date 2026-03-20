"""
Ingest all documents from data/docs/ into the RAG index.

Usage:
    python scripts/ingest_docs.py [--clear]

Reads all .txt files from data/docs/amex/{year}/ folders.
Each file represents one page-indexed chunk.
Parses SECTION, PAGE, DOC, text, SOURCE fields.
Upserts into FTS5 + BM25 index.

Options:
    --clear   Wipe existing index before ingesting (full re-index)
"""
from __future__ import annotations
import sys, re, sqlite3
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from schemas.models import Chunk
from rag.indexer import get_index

DOCS_DIR = Path("data/docs/amex")


def parse_doc_file(path: Path) -> Chunk | None:
    """Parse a page text file into a Chunk object."""
    try:
        content = path.read_text(encoding="utf-8")
    except Exception as e:
        print(f"  WARN: cannot read {path}: {e}")
        return None

    lines = content.split("\n")
    meta = {}
    text_lines = []
    in_text = False

    for line in lines:
        if line.startswith("SECTION: "):
            meta["section"] = line[9:].strip()
        elif line.startswith("PAGE: "):
            meta["page"] = int(line[6:].strip())
        elif line.startswith("DOC: "):
            meta["doc"] = line[5:].strip()
        elif line.startswith("SOURCE: "):
            meta["source"] = line[8:].strip()
        elif line.strip() == "" and "doc" in meta and not in_text:
            in_text = True
        elif in_text and not line.startswith("SOURCE: "):
            text_lines.append(line)

    text = " ".join(text_lines).strip()
    if not text or len(text) < 50:
        return None

    doc_id = meta.get("doc", path.parent.name)
    page_num = meta.get("page", 1)
    section = meta.get("section", "General")
    context = meta.get("source", f"From {doc_id}, page {page_num}.")

    # Build stable chunk ID from doc + page + path stem
    chunk_id = f"{doc_id}_p{page_num}_{path.stem[:20]}"

    return Chunk(
        id=chunk_id,
        doc_id=doc_id,
        page_num=page_num,
        section=section,
        text=text,
        context=context,
    )


def main():
    clear_first = "--clear" in sys.argv

    if not DOCS_DIR.exists():
        print(f"ERROR: {DOCS_DIR} not found. Run scripts/fetch_edgar.py first.")
        sys.exit(1)

    # ─── Optional: clear existing index ──────────────────────────────────────
    if clear_first:
        import pickle
        db_path = Path("data/index.db")
        bm25_path = Path("data/bm25.pkl")
        if db_path.exists():
            conn = sqlite3.connect(str(db_path))
            conn.execute("DELETE FROM chunks_fts")
            conn.execute("DELETE FROM chunks_meta")
            conn.commit()
            conn.close()
            print("Cleared FTS5 index.")
        if bm25_path.exists():
            bm25_path.unlink()
            print("Cleared BM25 cache.")

    # ─── Collect all .txt doc files ───────────────────────────────────────────
    all_files = sorted(DOCS_DIR.rglob("*.txt"))
    print(f"\nFound {len(all_files)} document files in {DOCS_DIR}")

    if not all_files:
        print("No files found. Did you run fetch_edgar.py?")
        sys.exit(1)

    # ─── Parse and batch ingest ───────────────────────────────────────────────
    chunks: list[Chunk] = []
    skipped = 0

    for path in all_files:
        if path.name == "xbrl_facts.json":
            continue
        chunk = parse_doc_file(path)
        if chunk:
            chunks.append(chunk)
        else:
            skipped += 1

    print(f"Parsed {len(chunks)} valid chunks ({skipped} skipped as too short)")

    if not chunks:
        print("Nothing to ingest.")
        sys.exit(1)

    # ─── Ingest in batches of 50 ──────────────────────────────────────────────
    index = get_index()
    BATCH = 50
    for i in range(0, len(chunks), BATCH):
        batch = chunks[i:i+BATCH]
        index.add_chunks(batch)
        print(f"  Ingested {min(i+BATCH, len(chunks))}/{len(chunks)} chunks...")

    print(f"\n✓ Index now contains {index.total_chunks()} total chunks")

    # ─── Coverage report ─────────────────────────────────────────────────────
    from collections import Counter
    doc_counts = Counter(c.doc_id for c in chunks)
    print("\n  Document coverage:")
    for doc_id, count in sorted(doc_counts.items()):
        print(f"    {doc_id}: {count} chunks")


if __name__ == "__main__":
    main()
