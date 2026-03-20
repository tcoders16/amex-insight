"""
Fetch real AMEX 10-K sections from SEC EDGAR and save to data/docs/.

Usage:
    python scripts/fetch_edgar.py

Fetches:
  - EDGAR XBRL structured financial data (real numbers)
  - 10-K MD&A + Technology sections for 2020-2024
  - Saves page-split text files under data/docs/amex/{year}/

Then call:
    python scripts/ingest_docs.py
to index everything into the RAG database.
"""
from __future__ import annotations
import sys, re, time, json, urllib.request
from pathlib import Path

UA = "AmexInsight/1.0 (Portfolio Demo; contact: demo@amexinsight.io)"
DATA_DIR = Path("data/docs/amex")
CIK = "0000004962"

FILINGS = {
    "2024-10k": {"acc": "0000004962-25-000016", "doc": "axp-20241231.htm", "period": "2024-12-31"},
    "2023-10k": {"acc": "0000004962-24-000013", "doc": "axp-20231231.htm", "period": "2023-12-31"},
    "2022-10k": {"acc": "0000004962-23-000006", "doc": "axp-20221231.htm", "period": "2022-12-31"},
    "2021-10k": {"acc": "0000004962-22-000008", "doc": "axp-20211231.htm", "period": "2021-12-31"},
    "2020-10k": {"acc": "0000004962-21-000013", "doc": "axp-20201231.htm", "period": "2020-12-31"},
}

# Which XBRL facts we care about
XBRL_TAGS = [
    "Revenues",
    "RevenuesNetOfInterestExpense",
    "NetIncomeLoss",
    "EarningsPerShareDiluted",
    "CommonStockDividendsPerShareDeclared",
    "BilledBusiness",
    "CardMemberReceivables",
    "CardMemberLoans",
]


def fetch(url: str, max_bytes: int = 0) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            if max_bytes:
                return r.read(max_bytes)
            return r.read()
    except Exception as e:
        print(f"  WARN: {url} → {e}")
        return b""


def strip_html(html: str) -> str:
    """
    Remove iXBRL tags, HTML tags, and collapse whitespace.
    Handles AMEX's inline XBRL (iXBRL) 10-K format which embeds
    structured financial data inside custom XML namespaces.
    """
    # 1. Remove iXBRL / XBRL namespace blocks (ix:, xbrl:, etc.)
    html = re.sub(r"(?i)<ix:[^>]*>.*?</ix:[^>]+>", " ", html, flags=re.DOTALL)
    html = re.sub(r"(?i)</?ix:[^>]+>", " ", html)
    html = re.sub(r"(?i)</?xbrli?:[^>]+>", " ", html)

    # 2. Remove <script> and <style> blocks entirely
    html = re.sub(r"(?is)<script[^>]*>.*?</script>", "", html)
    html = re.sub(r"(?is)<style[^>]*>.*?</style>", "", html)

    # 3. Remove hidden elements and XBRL context/unit blocks
    html = re.sub(r"(?is)<[^>]+display\s*:\s*none[^>]*>.*?</[a-z]+>", "", html)
    html = re.sub(r"(?i)<xbrl[^>]*>.*?</xbrl>", " ", html, flags=re.DOTALL)

    # 4. Remove remaining HTML tags
    text = re.sub(r"<[^>]+>", " ", html)

    # 5. Decode HTML entities
    text = re.sub(r"&nbsp;", " ", text)
    text = re.sub(r"&amp;", "&", text)
    text = re.sub(r"&lt;", "<", text)
    text = re.sub(r"&gt;", ">", text)
    text = re.sub(r"&#\d+;", " ", text)
    text = re.sub(r"&[a-z]+;", " ", text)

    # 6. Remove lines that look like XBRL metadata (namespace URIs, technical IDs)
    lines = text.split("\n")
    clean_lines = []
    for line in lines:
        line = line.strip()
        # Skip lines that are mostly XBRL namespace references or EDGAR IDs
        if re.match(r"^(http://|https://|0000\d+|us-gaap:|axp:|iso4217:)", line):
            continue
        if re.match(r"^[A-Z0-9_:]+\s+(true|false|\d{4}-\d{2}-\d{2}|P\d+[YMD])", line):
            continue
        if len(line) > 0:
            clean_lines.append(line)

    text = " ".join(clean_lines)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def is_noise(text: str) -> bool:
    """Return True if the chunk is mostly XBRL metadata noise or raw table numbers."""
    words = text.split()
    if len(words) < 20:
        return True

    # Too many XBRL-style tokens (namespace:value)
    xbrl_tokens = re.findall(r"\b\w+:\w+\b", text)
    if len(xbrl_tokens) > len(words) * 0.15:
        return True

    # Too many URIs
    if len(re.findall(r"http[s]?://", text)) > 3:
        return True

    # Raw financial table: mostly numbers, very little alphabetic text
    alpha_ratio = sum(c.isalpha() for c in text) / max(len(text), 1)
    if alpha_ratio < 0.30:
        return True

    # Financial table dump: high ratio of standalone numbers to words
    number_tokens = [w for w in words if re.match(r"^[\d,\.\-\$%\(\)]+$", w)]
    if len(number_tokens) > len(words) * 0.55:
        return True

    # Table without prose: very few sentences (no periods) but lots of numbers
    sentences = text.count(".")
    if sentences < 2 and len(number_tokens) > 15:
        return True

    return False


def extract_sections(html: str) -> list[dict]:
    """
    Extract named sections from 10-K HTML.
    Returns list of {title, text} dicts.
    """
    sections = []

    # AMEX 10-K uses <a name="..."> or id= anchors for Item sections
    # Split on Item headings
    item_pattern = re.compile(
        r'(?i)(ITEM\s+[0-9]+[A-Z]?\.\s*[A-Z][^\n<]{5,80})',
    )

    # Remove script/style blocks
    clean = re.sub(r"(?is)<script[^>]*>.*?</script>", "", html)
    clean = re.sub(r"(?is)<style[^>]*>.*?</style>", "", clean)

    text = strip_html(clean)

    # Split by Item headings
    parts = item_pattern.split(text)
    current_title = "Cover Page"
    current_text = ""

    for part in parts:
        if item_pattern.match(part.strip()):
            if current_text.strip() and len(current_text) > 200:
                sections.append({"title": current_title, "text": current_text.strip()})
            current_title = part.strip()
            current_text = ""
        else:
            current_text += " " + part

    if current_text.strip() and len(current_text) > 200:
        sections.append({"title": current_title, "text": current_text.strip()})

    return sections


def chunk_section(title: str, text: str, max_chars: int = 1500) -> list[str]:
    """Split a long section into page-sized chunks of ~1500 chars."""
    words = text.split()
    chunks = []
    current = []
    current_len = 0

    for word in words:
        current.append(word)
        current_len += len(word) + 1
        if current_len >= max_chars:
            chunks.append(" ".join(current))
            current = []
            current_len = 0

    if current:
        chunks.append(" ".join(current))

    return chunks


def fetch_xbrl_facts() -> dict:
    """Fetch structured financial facts from EDGAR XBRL API."""
    url = f"https://data.sec.gov/api/xbrl/companyfacts/{CIK}.json"
    print(f"  Fetching XBRL facts from {url}")
    raw = fetch(url)
    if not raw:
        return {}
    try:
        data = json.loads(raw)
        return data.get("facts", {}).get("us-gaap", {})
    except Exception as e:
        print(f"  XBRL parse error: {e}")
        return {}


def extract_annual_fact(facts: dict, tag: str, years: list[int]) -> dict[int, float]:
    """Extract annual (10-K) values for a given XBRL tag."""
    tag_data = facts.get(tag, {})
    units = tag_data.get("units", {})
    # Try USD, pure, shares
    for unit_type in ["USD", "pure", "shares", "USD/shares"]:
        if unit_type in units:
            result = {}
            for entry in units[unit_type]:
                if entry.get("form") == "10-K" and entry.get("fp") == "FY":
                    try:
                        yr = int(entry["end"][:4])
                        if yr in years:
                            result[yr] = entry["val"]
                    except Exception:
                        pass
            if result:
                return result
    return {}


def save_section_file(doc_id: str, page_num: int, section: str, text: str, context: str):
    """Save a section as a text file."""
    folder = DATA_DIR / doc_id
    folder.mkdir(parents=True, exist_ok=True)
    filename = f"p{page_num:04d}_{re.sub(r'[^a-z0-9]+', '_', section.lower())[:40]}.txt"
    path = folder / filename
    content = f"SECTION: {section}\nPAGE: {page_num}\nDOC: {doc_id}\n\n{text}\n\nSOURCE: {context}\n"
    path.write_text(content, encoding="utf-8")
    return str(path)


def main():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    total_files = 0

    # ─── 1. Fetch XBRL structured financial data ──────────────────────────────
    print("\n[1/2] Fetching EDGAR XBRL structured financial facts...")
    facts = fetch_xbrl_facts()
    years = [2020, 2021, 2022, 2023, 2024]

    xbrl_data = {}
    if facts:
        for tag in XBRL_TAGS:
            vals = extract_annual_fact(facts, tag, years)
            if vals:
                xbrl_data[tag] = vals
                print(f"  {tag}: {vals}")
        time.sleep(1)
    else:
        print("  XBRL unavailable — using embedded data only")

    # Save XBRL summary
    xbrl_path = DATA_DIR / "xbrl_facts.json"
    xbrl_path.write_text(json.dumps(xbrl_data, indent=2))
    print(f"  Saved XBRL facts → {xbrl_path}")

    # ─── 2. Fetch 10-K HTML sections ─────────────────────────────────────────
    print("\n[2/2] Fetching 10-K HTML sections from EDGAR...")

    for doc_id, filing in FILINGS.items():
        year = doc_id[:4]
        print(f"\n  [{doc_id}] Downloading...")
        acc_nodash = filing["acc"].replace("-", "")
        url = f"https://www.sec.gov/Archives/edgar/data/4962/{acc_nodash}/{filing['doc']}"

        # Download first 2MB (enough for MD&A + Technology sections)
        raw = fetch(url, max_bytes=2_000_000)
        if not raw:
            print(f"    SKIP: could not download")
            continue

        html = raw.decode("utf-8", errors="ignore")
        print(f"    Downloaded {len(html):,} chars")

        sections = extract_sections(html)
        print(f"    Found {len(sections)} sections")

        # Save each section as page-indexed files
        page_num = 1
        for sec in sections:
            title = sec["title"]
            full_text = sec["text"]

            # Split long sections into page chunks
            page_chunks = chunk_section(title, full_text, max_chars=1500)

            for chunk in page_chunks:
                if len(chunk) < 100:
                    continue
                # Skip noisy XBRL metadata chunks
                if is_noise(chunk):
                    continue
                context = f"From American Express {year} Annual Report 10-K (SEC EDGAR), {title} section, page {page_num}."
                path = save_section_file(doc_id, page_num, title, chunk, context)
                total_files += 1
                page_num += 1

        print(f"    Saved {page_num - 1} page files for {doc_id}")
        time.sleep(1.5)  # Rate limit: max 10 req/s per SEC policy

    print(f"\n✓ Done. Total files saved: {total_files}")
    print(f"  Run: python scripts/ingest_docs.py  to index all documents\n")


if __name__ == "__main__":
    main()
