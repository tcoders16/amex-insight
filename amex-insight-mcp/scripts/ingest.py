"""
Document ingestion script.
Run once to seed the index with AMEX public documents.

Usage:
    python scripts/ingest.py --doc data/amex-2024-10k.txt --doc-id 2024-10k

Downloads AMEX 10-K from SEC EDGAR public API:
    https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0000004977
"""
from __future__ import annotations

import sys
import os
import re
import argparse
import logging
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from schemas.models import Chunk
from rag.indexer import get_index

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)


def chunk_document(text: str, doc_id: str, chunk_size: int = 800, overlap: int = 150) -> list[Chunk]:
    """
    Page-aware chunking:
    1. Split by page markers if present
    2. Fall back to sliding window chunking
    3. Each chunk tagged with doc_id + page_num + section
    """
    chunks: list[Chunk] = []

    # Try to detect page breaks
    pages = re.split(r'(?:page\s+\d+|─{20,})', text, flags=re.I)
    if len(pages) < 3:
        # No page markers — sliding window
        words   = text.split()
        page_num = 1
        for i in range(0, len(words), chunk_size - overlap):
            chunk_words = words[i:i + chunk_size]
            if not chunk_words:
                break
            chunk_text = " ".join(chunk_words)
            # Detect section from first line
            first_line = chunk_text.split("\n")[0][:80]
            section    = first_line if len(first_line) > 10 else f"Section {page_num}"
            chunks.append(Chunk(
                id       = f"{doc_id}_p{page_num}",
                doc_id   = doc_id,
                page_num = page_num,
                section  = section,
                text     = chunk_text,
                context  = f"From {doc_id}, page {page_num}: {section}",
            ))
            page_num += 1
    else:
        for i, page_text in enumerate(pages):
            page_text = page_text.strip()
            if len(page_text) < 50:
                continue
            first_line = page_text.split("\n")[0][:80].strip()
            section    = first_line if len(first_line) > 10 else f"Page {i+1}"
            chunks.append(Chunk(
                id       = f"{doc_id}_p{i+1}",
                doc_id   = doc_id,
                page_num = i + 1,
                section  = section,
                text     = page_text[:2000],  # cap at 2000 chars per chunk
                context  = f"From {doc_id}, page {i+1}: {section}",
            ))

    return chunks


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--doc",    required=True, help="Path to document text file")
    parser.add_argument("--doc-id", required=True, help="Document ID (e.g. '2024-10k')")
    args = parser.parse_args()

    text_path = Path(args.doc)
    if not text_path.exists():
        logger.error(f"File not found: {text_path}")
        sys.exit(1)

    text = text_path.read_text(encoding="utf-8", errors="replace")
    logger.info(f"Loaded {len(text):,} chars from {text_path}")

    chunks = chunk_document(text, args.doc_id)
    logger.info(f"Created {len(chunks)} chunks")

    index = get_index()
    index.add_chunks(chunks)
    logger.info(f"Indexed {len(chunks)} chunks for {args.doc_id}")
    logger.info(f"Total index size: {index.total_chunks()} chunks")


if __name__ == "__main__":
    main()
