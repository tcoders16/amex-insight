"""
Seed the index with comprehensive AMEX financial data (2020-2024).
Run this once after deployment to populate the index.

    python scripts/seed_demo.py

Covers: Revenue, Technology/AI, Card Spending, Risk Factors, Credit Metrics,
        International, Capital Return, Quarterly Performance, EPS, Strategy.
In production, replace with real AMEX 10-K text from SEC EDGAR.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from schemas.models import Chunk
from rag.indexer import get_index

DEMO_CHUNKS = [

    # ─── 2024 10-K ────────────────────────────────────────────────────────────

    Chunk(
        id="2024-10k_p1", doc_id="2024-10k", page_num=1,
        section="Business Overview",
        text="American Express Company is a globally integrated payments company, providing customers with access to products, insights and experiences that enrich lives and build business success. The company's principal products and services are credit and charge cards issued to consumer, small business, middle market and large corporate customers.",
        context="From AMEX 2024 Annual Report 10-K, page 1, Business Overview section."
    ),
    Chunk(
        id="2024-10k_p34", doc_id="2024-10k", page_num=34,
        section="Financial Results — Revenue",
        text="Total revenues net of interest expense were $65.9 billion for the full year 2024, an increase of 9 percent compared to $60.5 billion in 2023. This performance was driven by strong billed business growth and higher net interest income. Discount revenue rose 7 percent to $32.5 billion. Net interest income grew 18 percent to $14.2 billion reflecting higher card member loan balances.",
        context="From AMEX 2024 Annual Report 10-K, page 34, Financial Results section discussing annual revenue performance."
    ),
    Chunk(
        id="2024-10k_p35", doc_id="2024-10k", page_num=35,
        section="Financial Results — Network Volumes",
        text="Billed business on the American Express network totaled $1.67 trillion in 2024, up 7 percent versus 2023. Card member spending increased 6 percent to $412 billion, reflecting strong consumer and commercial card activity across all geographies. International card services billed business grew 10 percent on an FX-adjusted basis.",
        context="From AMEX 2024 Annual Report 10-K, page 35, Network Volumes section."
    ),
    Chunk(
        id="2024-10k_p42", doc_id="2024-10k", page_num=42,
        section="Q3 2024 Performance",
        text="Third quarter 2024 revenues net of interest expense were $16.6 billion, up 8 percent year-over-year. Q3 card member spending was $106 billion, an increase of 6 percent. New card acquisitions in Q3 were 3.2 million, in line with management expectations.",
        context="From AMEX 2024 Annual Report 10-K, page 42, Q3 2024 quarterly performance breakdown."
    ),
    Chunk(
        id="2024-10k_p43", doc_id="2024-10k", page_num=43,
        section="Q4 2024 Performance",
        text="Fourth quarter 2024 revenues net of interest expense reached $17.2 billion, an increase of 9 percent compared to Q4 2023. Full year net income was $10.1 billion, up 23 percent year-over-year. Diluted EPS for 2024 was $13.75, compared to $11.21 in 2023. The company returned $5.6 billion to shareholders through buybacks and dividends in 2024.",
        context="From AMEX 2024 Annual Report 10-K, page 43, Q4 2024 and full year results."
    ),
    Chunk(
        id="2024-10k_p58", doc_id="2024-10k", page_num=58,
        section="Technology and AI Strategy",
        text="American Express continued to accelerate its investment in artificial intelligence and machine learning capabilities in 2024. The company deployed AI-powered solutions across fraud detection, customer servicing, and credit underwriting. Generative AI pilots were expanded to 15 internal use cases, with agentic AI systems being evaluated for customer-facing applications. Total technology investment reached $5.1 billion, up from $4.7 billion in 2023. Large language models were integrated into the customer service platform, reducing average handle time by 22 percent.",
        context="From AMEX 2024 Annual Report 10-K, page 58, Technology and AI Strategy section."
    ),
    Chunk(
        id="2024-10k_p59", doc_id="2024-10k", page_num=59,
        section="Technology — Cloud and Data Platform",
        text="By end of 2024, approximately 85 percent of AMEX workloads had migrated to cloud infrastructure, enabling real-time decisioning at scale. The proprietary AmexNet data platform processes over 8 billion transactions annually, providing enriched merchant and spending insights. The data platform underpins both fraud prevention models and personalized card member offers.",
        context="From AMEX 2024 Annual Report 10-K, page 59, Cloud and Data Platform investments."
    ),
    Chunk(
        id="2024-10k_p60", doc_id="2024-10k", page_num=60,
        section="Technology — Fraud and Security",
        text="In 2024, American Express's AI-powered fraud models achieved their best-ever performance, with fraud losses as a percentage of volumes declining to 0.059 percent, the lowest in company history. Real-time ML models process every transaction in under 2 milliseconds, evaluating over 1,500 data points. Biometric authentication was deployed to 60 percent of US card members.",
        context="From AMEX 2024 Annual Report 10-K, page 60, Fraud and Security technology performance."
    ),
    Chunk(
        id="2024-10k_p72", doc_id="2024-10k", page_num=72,
        section="Risk Factors",
        text="The company faces risks including: (1) macroeconomic deterioration reducing consumer spending; (2) intense competition from Visa, Mastercard, PayPal, and emerging fintech players; (3) regulatory changes in payment processing fees and consumer credit; (4) cybersecurity threats and data breaches; (5) geopolitical disruptions affecting international operations.",
        context="From AMEX 2024 Annual Report 10-K, page 72, Risk Factors section listing principal business risks."
    ),
    Chunk(
        id="2024-10k_p80", doc_id="2024-10k", page_num=80,
        section="Credit Metrics and Loan Quality",
        text="The net write-off rate for card member loans was 2.1 percent in 2024, consistent with pre-pandemic levels. The 30-days-past-due rate was 1.3 percent as of December 2024. Card member loans outstanding totaled $128.1 billion at year end, up 14 percent from 2023. Loan loss reserves stood at $5.6 billion, reflecting a reserve rate of 4.4 percent.",
        context="From AMEX 2024 Annual Report 10-K, page 80, Credit metrics and loan portfolio quality."
    ),
    Chunk(
        id="2024-10k_p90", doc_id="2024-10k", page_num=90,
        section="Capital Return and Dividends",
        text="American Express returned $5.6 billion to shareholders in 2024 through a combination of share buybacks ($3.9 billion) and dividends ($1.7 billion). The quarterly dividend was increased 17 percent to $0.70 per share. The company repurchased 18.4 million shares at an average price of $212, reducing diluted share count by approximately 2 percent.",
        context="From AMEX 2024 Annual Report 10-K, page 90, Capital return program and dividends."
    ),
    Chunk(
        id="2024-10k_p45", doc_id="2024-10k", page_num=45,
        section="Premium Card Member Growth",
        text="In 2024, American Express acquired 13.2 million new card members globally, with approximately 70 percent choosing premium fee-based products. The Gold and Platinum card portfolios grew 11 percent in active card membership. Card member retention rates remained above 88 percent, reflecting the strength of the premium value proposition and Membership Rewards program.",
        context="From AMEX 2024 Annual Report 10-K, page 45, Card member acquisition and premium segment growth."
    ),

    # ─── 2023 10-K ────────────────────────────────────────────────────────────

    Chunk(
        id="2023-10k_p34", doc_id="2023-10k", page_num=34,
        section="Financial Results — Revenue",
        text="Total revenues net of interest expense were $60.5 billion for full year 2023, an increase of 16 percent compared to $52.3 billion in 2022. The strong growth reflected sustained post-pandemic recovery in travel and entertainment spending, record card member acquisition, and rapid expansion of net interest income as card loan balances grew. Discount revenue increased 8 percent to $30.4 billion.",
        context="From AMEX 2023 Annual Report 10-K, page 34, Financial Results section."
    ),
    Chunk(
        id="2023-10k_p35", doc_id="2023-10k", page_num=35,
        section="Financial Results — Network Volumes",
        text="Billed business totaled $1.56 trillion in 2023, up 9 percent from $1.43 trillion in 2022. Card member spending grew 7 percent to $385 billion. Travel and entertainment spending surpassed 2019 pre-pandemic levels by 23 percent. International billed business grew 14 percent on an FX-adjusted basis, driven by strong performance in Europe and Asia-Pacific.",
        context="From AMEX 2023 Annual Report 10-K, page 35, Network volumes and billed business breakdown."
    ),
    Chunk(
        id="2023-10k_p55", doc_id="2023-10k", page_num=55,
        section="Technology Strategy",
        text="In 2023, American Express invested $4.7 billion in technology, up from $4.2 billion in 2022, with a focus on cloud migration, data platform modernization, and AI/ML capabilities. Machine learning models were deployed for fraud detection and credit risk, achieving a 15 percent reduction in fraud losses. The company launched an internal generative AI program, piloting LLM-based tools for 5,000 engineers.",
        context="From AMEX 2023 Annual Report 10-K, page 55, Technology investment and strategy overview."
    ),
    Chunk(
        id="2023-10k_p56", doc_id="2023-10k", page_num=56,
        section="Technology — AI and Machine Learning",
        text="American Express deployed over 200 machine learning models in production in 2023, spanning fraud, credit underwriting, customer attrition prediction, and personalized marketing. The company's AI-driven fraud prevention system delivered best-in-class results with fraud losses at 0.062 percent of volumes. The technology organization expanded its AI/ML talent with 1,200 new hires in data science and engineering roles.",
        context="From AMEX 2023 Annual Report 10-K, page 56, AI and Machine Learning deployment details."
    ),
    Chunk(
        id="2023-10k_p43", doc_id="2023-10k", page_num=43,
        section="Earnings Per Share and Profitability",
        text="Full year 2023 net income was $8.2 billion, an increase of 14 percent from 2022. Diluted EPS was $11.21, up from $9.85 in 2022. Return on average equity was 31.2 percent in 2023. The company demonstrated resilient profitability despite elevated provisions for credit losses as card member loan balances grew.",
        context="From AMEX 2023 Annual Report 10-K, page 43, EPS and profitability metrics."
    ),
    Chunk(
        id="2023-10k_p72", doc_id="2023-10k", page_num=72,
        section="Credit and Risk",
        text="Card member loan net write-offs were 1.9 percent in 2023, rising modestly from 1.6 percent in 2022 as balances normalized post-pandemic. 30-days-past-due delinquency rate was 1.2 percent. The company maintained its high credit quality with over 80 percent of US card members having FICO scores above 700. Reserves for credit losses were increased by $1.1 billion during 2023 as a precautionary measure.",
        context="From AMEX 2023 Annual Report 10-K, page 72, Credit quality and risk metrics."
    ),

    # ─── 2022 10-K ────────────────────────────────────────────────────────────

    Chunk(
        id="2022-10k_p1", doc_id="2022-10k", page_num=1,
        section="Business Overview",
        text="American Express delivered record revenue and earnings in 2022, demonstrating the resilience and strength of the premium spend-centric model. The company served over 135 million card members worldwide and processed $1.43 trillion in network volumes. Full year revenues net of interest expense reached $52.3 billion, up 25 percent from $41.8 billion in 2021, representing the highest revenue in company history at the time.",
        context="From AMEX 2022 Annual Report 10-K, page 1, Business Overview and financial highlights."
    ),
    Chunk(
        id="2022-10k_p34", doc_id="2022-10k", page_num=34,
        section="Financial Results — Revenue",
        text="Total revenues net of interest expense were $52.3 billion in 2022, an increase of 25 percent from $41.8 billion in 2021. Discount revenue grew 20 percent to $28.1 billion, driven by record card member spending. Net interest income rose 29 percent to $8.4 billion as card loan balances recovered. Other fees and commissions increased 18 percent, reflecting a record 12.5 million new card acquisitions globally.",
        context="From AMEX 2022 Annual Report 10-K, page 34, Full year revenue breakdown and drivers."
    ),
    Chunk(
        id="2022-10k_p35", doc_id="2022-10k", page_num=35,
        section="Financial Results — Card Member Spending",
        text="Total billed business reached $1.43 trillion in 2022, up 21 percent from $1.18 trillion in 2021. Consumer card member spending grew 19 percent. Small and medium enterprise (SME) card spending increased 24 percent, driven by strong B2B payment adoption. Travel and entertainment spending recovered to 2019 pre-pandemic levels by mid-2022, a full recovery milestone. International billed business grew 23 percent on a currency-adjusted basis.",
        context="From AMEX 2022 Annual Report 10-K, page 35, Card member spending volumes and segment detail."
    ),
    Chunk(
        id="2022-10k_p58", doc_id="2022-10k", page_num=58,
        section="Technology and AI Strategy",
        text="American Express invested $4.2 billion in technology in 2022, compared to $3.6 billion in 2021, representing the largest technology budget in company history to date. Key investments included: (1) cloud migration — 65 percent of workloads migrated to cloud; (2) ML-driven fraud models achieving industry-leading fraud loss rates; (3) launch of the AmexNet real-time data platform for personalization; (4) API-first architecture enabling faster product development. The company had over 8,000 engineers and data scientists, up 18 percent year-over-year.",
        context="From AMEX 2022 Annual Report 10-K, page 58, Technology investment and digital strategy."
    ),
    Chunk(
        id="2022-10k_p59", doc_id="2022-10k", page_num=59,
        section="Technology — AI and Data",
        text="In 2022, American Express deployed 150 machine learning models in production, a 30 percent increase from 2021. Key AI applications included: real-time transaction fraud scoring processing 6 billion transactions annually, credit underwriting models reducing manual review by 40 percent, and personalized merchant offer recommendations delivering a 35 percent lift in offer redemption rates. The company filed 42 AI-related patents in 2022.",
        context="From AMEX 2022 Annual Report 10-K, page 59, AI and machine learning deployment milestones."
    ),
    Chunk(
        id="2022-10k_p60", doc_id="2022-10k", page_num=60,
        section="Technology — Digital Engagement",
        text="Digital channels accounted for 78 percent of AMEX customer service interactions in 2022, up from 68 percent in 2021. The AMEX mobile app had 42 million active users, a 25 percent increase year-over-year. The company launched a redesigned digital servicing platform with AI-powered chat capabilities, reducing call center volume by 18 percent. Digital card acquisitions grew to represent 60 percent of all new card applications.",
        context="From AMEX 2022 Annual Report 10-K, page 60, Digital engagement and mobile app metrics."
    ),
    Chunk(
        id="2022-10k_p43", doc_id="2022-10k", page_num=43,
        section="Earnings Per Share and Profitability",
        text="Full year 2022 net income was $7.1 billion, up 18 percent from $6.0 billion in 2021. Diluted earnings per share were $9.85, compared to $8.11 in 2021. Return on average equity reached 27.6 percent. The company provided 2023 guidance of revenue growth of 15 to 17 percent and EPS of $11.00 to $11.40, reflecting continued confidence in the business trajectory.",
        context="From AMEX 2022 Annual Report 10-K, page 43, EPS, net income, and profitability ratios."
    ),
    Chunk(
        id="2022-10k_p44", doc_id="2022-10k", page_num=44,
        section="Quarterly Performance 2022",
        text="Q4 2022 revenues net of interest expense were $14.2 billion, up 17 percent year-over-year. Q4 card member spending reached $90.8 billion. For the full year, AMEX acquired 12.5 million new cards, the highest in company history. Q4 net income was $1.6 billion. Provisions for credit losses of $1.1 billion in Q4 reflected prudent reserving as card loan balances grew.",
        context="From AMEX 2022 Annual Report 10-K, page 44, Q4 2022 quarterly financial results."
    ),
    Chunk(
        id="2022-10k_p70", doc_id="2022-10k", page_num=70,
        section="Risk Factors",
        text="Key risks in 2022 included: (1) macroeconomic uncertainty and potential recession reducing consumer and business spending; (2) rising interest rates increasing funding costs and credit loss risk; (3) competitive pressure from buy-now-pay-later providers eroding card market share; (4) regulatory scrutiny on swipe fees and data privacy laws in Europe and California; (5) Ukraine conflict impact on European card member spending and supplier payments.",
        context="From AMEX 2022 Annual Report 10-K, page 70, Principal risk factors."
    ),
    Chunk(
        id="2022-10k_p80", doc_id="2022-10k", page_num=80,
        section="Credit Metrics",
        text="Card member loan net write-offs were 1.6 percent in 2022, below the long-term target range. 30-days-past-due delinquency stood at 0.9 percent, near historic lows, reflecting the premium credit quality of the AMEX customer base. Total card member loans and receivables reached $94.4 billion at year end, up 28 percent from 2021. Strong employment and consumer balance sheets supported credit quality through 2022.",
        context="From AMEX 2022 Annual Report 10-K, page 80, Credit quality metrics and loan portfolio."
    ),
    Chunk(
        id="2022-10k_p90", doc_id="2022-10k", page_num=90,
        section="Capital Return",
        text="American Express returned $4.0 billion to shareholders in 2022: $2.8 billion in share repurchases and $1.2 billion in dividends. The quarterly dividend was raised 20 percent to $0.52 per share in Q1 2022. The company's common equity tier 1 (CET1) ratio was 10.3 percent as of December 2022, comfortably above regulatory requirements.",
        context="From AMEX 2022 Annual Report 10-K, page 90, Capital return, dividends, and CET1 ratio."
    ),
    Chunk(
        id="2022-10k_p100", doc_id="2022-10k", page_num=100,
        section="International Segment",
        text="International Card Services generated revenues of $7.4 billion in 2022, up 27 percent year-over-year. The segment benefited from strong cross-border travel recovery as pandemic restrictions lifted globally. AMEX expanded international merchant acceptance to over 50 million locations worldwide in 2022. Europe, Middle East and Africa (EMEA) billed business grew 28 percent; Asia Pacific grew 22 percent on an FX-adjusted basis.",
        context="From AMEX 2022 Annual Report 10-K, page 100, International Card Services segment performance."
    ),

    # ─── 2021 10-K ────────────────────────────────────────────────────────────

    Chunk(
        id="2021-10k_p34", doc_id="2021-10k", page_num=34,
        section="Financial Results — Revenue",
        text="Total revenues net of interest expense were $41.8 billion in 2021, an increase of 16 percent from $36.1 billion in 2020. The recovery was primarily driven by the rebound in goods and services spending and gradual recovery in travel and entertainment. Discount revenue grew 13 percent to $23.4 billion. The company returned to revenue growth in all segments for the first time since the pandemic began.",
        context="From AMEX 2021 Annual Report 10-K, page 34, Financial results and revenue recovery."
    ),
    Chunk(
        id="2021-10k_p35", doc_id="2021-10k", page_num=35,
        section="Card Member Spending Recovery",
        text="Total billed business in 2021 was $1.18 trillion, up 24 percent from 2020. Goods and services spending fully exceeded pre-pandemic 2019 levels by Q2 2021. Travel and entertainment spending, while still 18 percent below 2019 by year-end 2021, showed accelerating recovery through the second half. SME card spending grew 29 percent, reflecting strong small business activity in the post-reopening environment.",
        context="From AMEX 2021 Annual Report 10-K, page 35, Spending recovery and segment breakdown."
    ),
    Chunk(
        id="2021-10k_p58", doc_id="2021-10k", page_num=58,
        section="Technology and AI Investment",
        text="American Express invested $3.6 billion in technology in 2021, an increase of 12 percent from 2020. The company accelerated its cloud-first strategy, reaching 45 percent of workloads on cloud. AI investment focused on customer attrition models and personalization engines. The company launched an internal AI ethics framework and responsible AI governance program governing all ML model deployments.",
        context="From AMEX 2021 Annual Report 10-K, page 58, Technology investment and AI governance."
    ),
    Chunk(
        id="2021-10k_p43", doc_id="2021-10k", page_num=43,
        section="Profitability and EPS",
        text="Net income was $6.0 billion in 2021, a significant recovery from $3.1 billion in 2020. Diluted EPS was $8.11 in 2021, compared to $4.11 in 2020. Return on equity recovered to 22 percent. The improved profitability reflected revenue growth, stable credit quality, and significant reduction in credit loss provisions as economic conditions improved.",
        context="From AMEX 2021 Annual Report 10-K, page 43, Net income, EPS and return on equity."
    ),
    Chunk(
        id="2021-10k_p80", doc_id="2021-10k", page_num=80,
        section="Credit Quality",
        text="Card member loan net write-off rate improved to 1.8 percent in 2021, down from 2.4 percent in 2020, as government stimulus programs and strong employment supported cardmember finances. Total card member receivables were $73.8 billion at year-end 2021. The company released $2.0 billion in credit reserves in 2021 as the loss outlook improved materially from pandemic-era expectations.",
        context="From AMEX 2021 Annual Report 10-K, page 80, Credit quality and reserve releases."
    ),

    # ─── 2020 10-K ────────────────────────────────────────────────────────────

    Chunk(
        id="2020-10k_p34", doc_id="2020-10k", page_num=34,
        section="Financial Results — Revenue",
        text="Total revenues net of interest expense were $36.1 billion in 2020, a decline of 18 percent from $43.9 billion in 2019, driven by the sharp reduction in travel and entertainment spending due to COVID-19. Discount revenue fell 17 percent to $20.7 billion. Net interest income declined 14 percent as card loan balances contracted. The company took swift cost reduction actions saving $1.8 billion in expenses during 2020.",
        context="From AMEX 2020 Annual Report 10-K, page 34, COVID-19 impact on financial results."
    ),
    Chunk(
        id="2020-10k_p35", doc_id="2020-10k", page_num=35,
        section="Card Member Spending — COVID Impact",
        text="Total billed business declined to $950 billion in 2020, down 14 percent from $1.1 trillion in 2019. Travel and entertainment spending plunged 64 percent year-over-year during April-June 2020. Goods and services spending proved resilient, declining only 3 percent for the full year and recovering to prior-year levels by Q3 2020. The shift to online spending accelerated, with e-commerce card spend growing 25 percent.",
        context="From AMEX 2020 Annual Report 10-K, page 35, COVID-19 impact on spending volumes by category."
    ),
    Chunk(
        id="2020-10k_p58", doc_id="2020-10k", page_num=58,
        section="Technology Strategy — COVID Response",
        text="American Express invested $3.2 billion in technology in 2020 despite the pandemic. The rapid shift to remote work drove accelerated cloud adoption and digital transformation. AMEX transitioned 99 percent of its employees to remote work within two weeks of lockdowns. Technology investments in 2020 prioritized: contactless payment enablement, digital servicing scalability, and accelerated cloud migration to 35 percent of workloads.",
        context="From AMEX 2020 Annual Report 10-K, page 58, Technology response to COVID-19 and digital acceleration."
    ),
    Chunk(
        id="2020-10k_p43", doc_id="2020-10k", page_num=43,
        section="Net Income and EPS",
        text="Full year 2020 net income was $3.1 billion, down 47 percent from $5.9 billion in 2019, primarily due to elevated credit provisions and revenue decline from the pandemic. Diluted EPS was $4.11, compared to $7.99 in 2019. The company added $4.2 billion to credit loss reserves during 2020, reflecting an uncertain macroeconomic outlook. Despite the challenges, AMEX maintained a CET1 ratio of 13.5 percent.",
        context="From AMEX 2020 Annual Report 10-K, page 43, Net income, EPS, and pandemic financial impact."
    ),
    Chunk(
        id="2020-10k_p80", doc_id="2020-10k", page_num=80,
        section="Credit and Collections",
        text="Net write-offs increased to 2.4 percent in 2020, up from 1.5 percent in 2019, as some card members experienced financial stress from the pandemic. The company offered payment relief programs to approximately 7 percent of card members at peak in April 2020. AMEX built $4.2 billion of incremental credit reserves in 2020. The 30-day delinquency rate peaked at 1.6 percent in Q2 2020 before improving through the second half of the year.",
        context="From AMEX 2020 Annual Report 10-K, page 80, Credit metrics, reserves, and customer relief programs."
    ),

    # ─── Cross-Year Comparison Anchors ────────────────────────────────────────

    Chunk(
        id="multi-year_revenue", doc_id="multi-year", page_num=1,
        section="Revenue Trend 2020–2024",
        text="American Express revenue net of interest expense five-year trend: 2020: $36.1 billion (down 18% due to COVID); 2021: $41.8 billion (up 16%, recovery); 2022: $52.3 billion (up 25%, record growth); 2023: $60.5 billion (up 16%, continued expansion); 2024: $65.9 billion (up 9%, sustained growth). Compound annual growth rate (CAGR) from 2020 to 2024 was approximately 16 percent.",
        context="Cross-year revenue comparison for American Express 2020-2024 from 10-K filings."
    ),
    Chunk(
        id="multi-year_technology", doc_id="multi-year", page_num=2,
        section="Technology Investment Trend 2020–2024",
        text="American Express technology investment grew steadily from $3.2 billion in 2020 to $5.1 billion in 2024, a CAGR of 12 percent. AI and machine learning investment as a share of technology spending rose from an estimated 8 percent in 2020 to over 25 percent by 2024. The number of ML models in production expanded from approximately 100 in 2020 to over 200 in 2023 and accelerated further in 2024 with generative AI. Cloud workload migration progressed from 35 percent in 2020 to 85 percent in 2024.",
        context="Cross-year technology and AI investment comparison for American Express 2020-2024."
    ),
    Chunk(
        id="multi-year_eps", doc_id="multi-year", page_num=3,
        section="EPS Trend 2020–2024",
        text="American Express diluted EPS trend: 2019: $7.99; 2020: $4.11 (COVID impact); 2021: $8.11 (recovery); 2022: $9.85 (record); 2023: $11.21 (record); 2024: $13.75 (record). The company has consistently grown EPS at a strong pace, demonstrating the earnings power of the premium card model and disciplined capital management including share buybacks.",
        context="Diluted EPS trend for American Express 2019-2024 from annual reports."
    ),
    Chunk(
        id="multi-year_ai_strategy", doc_id="multi-year", page_num=4,
        section="AI Strategy Evolution 2020–2024",
        text="AMEX AI strategy evolved significantly from 2020 to 2024. In 2020, AI was primarily rule-based fraud detection and early ML credit scoring. By 2022, AMEX had 150+ ML models in production including advanced personalization and real-time decisioning. In 2023, the company began generative AI pilots with 5,000 engineers using LLM tools. By 2024, generative AI expanded to 15 use cases, agentic AI systems were being evaluated for customer applications, and total AI-related patents exceeded 200. Technology investment grew from $3.2B to $5.1B over this period.",
        context="Longitudinal summary of American Express AI and technology strategy evolution 2020-2024."
    ),
    Chunk(
        id="multi-year_spending", doc_id="multi-year", page_num=5,
        section="Billed Business Trend 2020–2024",
        text="American Express network billed business (in trillions): 2019: $1.10T; 2020: $0.95T (COVID); 2021: $1.18T; 2022: $1.43T; 2023: $1.56T; 2024: $1.67T. Travel and entertainment spending, which is disproportionately represented in AMEX's premium card base, fell 64 percent in 2020 but fully recovered to 2019 levels by mid-2022 and grew 23 percent above 2019 by end of 2023.",
        context="Multi-year billed business and card member spending trend comparison."
    ),

    # ─── Strategy and Outlook ─────────────────────────────────────────────────

    Chunk(
        id="2024-10k_p110", doc_id="2024-10k", page_num=110,
        section="Strategic Priorities — 2025 Outlook",
        text="For 2025, American Express provided guidance of revenue growth of 8 to 10 percent and EPS of $15.00 to $15.50. The company outlined three strategic priorities: (1) acquiring the next generation of card members through Millennial and Gen Z acquisition campaigns that already represent over 60 percent of new card acquisitions; (2) expanding international presence with targeted growth in India, Europe, and Southeast Asia; (3) deepening AI integration with a planned doubling of generative AI use cases to 30 by end of 2025.",
        context="From AMEX 2024 Annual Report 10-K, page 110, Strategic priorities and 2025 guidance."
    ),
    Chunk(
        id="2022-10k_p110", doc_id="2022-10k", page_num=110,
        section="Strategic Priorities — 2023 Outlook",
        text="For 2023, American Express provided EPS guidance of $11.00 to $11.40 and revenue growth of 15 to 17 percent. The company's strategic framework centered on: (1) rebuilding premium card acquisition momentum post-pandemic; (2) expanding cobrand partnerships with Delta Air Lines, Hilton, Marriott, and new fintech collaborations; (3) investing in data and technology to strengthen the competitive moat; (4) growing the Commercial Payments and B2B segment as a long-term diversification strategy.",
        context="From AMEX 2022 Annual Report 10-K, page 110, 2023 guidance and strategic priorities."
    ),
    Chunk(
        id="2023-10k_p90", doc_id="2023-10k", page_num=90,
        section="Cobrand and Partnership Strategy",
        text="American Express cobrand partnerships with Delta Air Lines, Hilton Honors, Marriott Bonvoy, and Amazon generated over $12 billion in billed business in 2023. The Delta cobrand is the largest credit card cobrand in the US by volume, with over 9 million active card members. New partnerships were announced with JPMorgan Chase for commercial payments and with Grab in Southeast Asia for digital wallets integration.",
        context="From AMEX 2023 Annual Report 10-K, page 90, Cobrand partnership metrics and new deals."
    ),
    Chunk(
        id="2024-10k_p95", doc_id="2024-10k", page_num=95,
        section="Millennial and Gen Z Strategy",
        text="In 2024, Millennial and Gen Z consumers represented 62 percent of new US consumer card acquisitions, up from 55 percent in 2022 and 33 percent in 2019. The Gold Card became the best-selling premium card among consumers under 35. The company attributed this demographic shift to investments in digital-first onboarding, relevant lifestyle benefits including dining and streaming credits, and a redesigned mobile app with spending insights powered by AI.",
        context="From AMEX 2024 Annual Report 10-K, page 95, Millennial and Gen Z acquisition strategy and metrics."
    ),

]

if __name__ == "__main__":
    import sqlite3
    from pathlib import Path
    import pickle

    # Clear existing data for a clean re-seed
    db_path = Path("data/index.db")
    bm25_path = Path("data/bm25.pkl")

    if db_path.exists():
        conn = sqlite3.connect(str(db_path))
        conn.execute("DELETE FROM chunks_fts")
        conn.execute("DELETE FROM chunks_meta")
        conn.commit()
        conn.close()
        print("Cleared existing index.")

    if bm25_path.exists():
        bm25_path.unlink()
        print("Cleared existing BM25 cache.")

    index = get_index()
    index.add_chunks(DEMO_CHUNKS)
    print(f"\n✓ Seeded {len(DEMO_CHUNKS)} chunks across 2020-2024.")
    print(f"  Total index size: {index.total_chunks()} chunks")
    print(f"\n  Coverage:")
    from collections import Counter
    doc_counts = Counter(c.doc_id for c in DEMO_CHUNKS)
    for doc_id, count in sorted(doc_counts.items()):
        print(f"    {doc_id}: {count} chunks")
