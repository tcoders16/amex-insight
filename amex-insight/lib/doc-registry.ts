/**
 * Document Registry
 * Maps internal doc_id → human-readable title + SEC EDGAR source URL.
 * All documents are real AMEX 10-K filings publicly available on SEC EDGAR.
 */

export interface DocMeta {
  title:    string   // full human title
  badge:    string   // short chip label
  year:     number
  url:      string   // SEC EDGAR or AMEX IR direct link
  color:    "blue" | "slate"
}

/** CIK 0000004962 = American Express Company */
export const DOC_REGISTRY: Record<string, DocMeta> = {
  "2024-10k": {
    title: "American Express 2024 Annual Report",
    badge: "10-K · FY 2024",
    year:  2024,
    url:   "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0000004962&type=10-K&dateb=20250401&owner=include&count=1",
    color: "blue",
  },
  "2023-10k": {
    title: "American Express 2023 Annual Report",
    badge: "10-K · FY 2023",
    year:  2023,
    url:   "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0000004962&type=10-K&dateb=20240401&owner=include&count=1",
    color: "blue",
  },
  "2022-10k": {
    title: "American Express 2022 Annual Report",
    badge: "10-K · FY 2022",
    year:  2022,
    url:   "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0000004962&type=10-K&dateb=20230401&owner=include&count=1",
    color: "blue",
  },
  "2021-10k": {
    title: "American Express 2021 Annual Report",
    badge: "10-K · FY 2021",
    year:  2021,
    url:   "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0000004962&type=10-K&dateb=20220401&owner=include&count=1",
    color: "blue",
  },
  "2020-10k": {
    title: "American Express 2020 Annual Report",
    badge: "10-K · FY 2020",
    year:  2020,
    url:   "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0000004962&type=10-K&dateb=20210401&owner=include&count=1",
    color: "blue",
  },
  "multi-year": {
    title: "AMEX Multi-Year Financial Summary",
    badge: "Cross-Year · 2020–2024",
    year:  2024,
    url:   "https://ir.americanexpress.com/sec-filings/annual-reports",
    color: "slate",
  },
}

/** Fallback for unknown doc IDs */
export function getDocMeta(docId: string): DocMeta {
  return DOC_REGISTRY[docId] ?? {
    title: docId,
    badge: "10-K",
    year:  new Date().getFullYear(),
    url:   `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0000004962&type=10-K`,
    color: "slate",
  }
}
