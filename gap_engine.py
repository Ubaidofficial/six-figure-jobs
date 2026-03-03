from __future__ import annotations

from typing import List, Optional
import os
import json
import re

import pandas as pd
from openai import OpenAI

from retrieval import BM25Retriever
from schemas import GapResult

SYSTEM_PROMPT = """You are a food safety audit-prep assistant.
You MUST be conservative and evidence-based.
Rules:
- You can only mark "Pass" if you include at least 1 evidence quote with doc + location.
- If evidence is weak/indirect, use "Partial" or "Fail" and set needs_review=true.
- Keep quotes short (1-3 sentences) and exact from the provided evidence text.
- Output ONLY valid JSON matching the schema. No markdown, no extra keys.
"""

def build_clause_query(row: pd.Series) -> str:
    parts = [
        str(row.get("clause_id", "")),
        str(row.get("clause_title", "")),
        str(row.get("requirement_text", "")),
        "Expected evidence: " + str(row.get("expected_evidence", "")),
        "Doc type hint: " + str(row.get("doc_type_hint", "")),
    ]
    return " | ".join([p for p in parts if p and p != "nan"])

def _pick_quotes(evidence_blocks: List[str], max_quotes: int = 2):
    picks = []
    for blk in evidence_blocks:
        m = re.match(r'^\[(.*?)\s+(.*?)\]\s+(.*)$', blk, re.DOTALL)
        if not m:
            continue
        doc, loc, body = m.group(1).strip(), m.group(2).strip(), m.group(3).strip()
        quote = body[:240].strip()
        if len(quote) >= 20:
            picks.append({"doc": doc, "location": loc, "quote": quote})
        if len(picks) >= max_quotes:
            break
    return picks

def mock_gap_for_clause(row: pd.Series, evidence_blocks: List[str]) -> GapResult:
    clause_id = str(row["clause_id"])
    clause_title = str(row.get("clause_title", ""))

    expected = str(row.get("expected_evidence", "")).lower()
    joined = " ".join(evidence_blocks).lower()

    keywords = [k.strip() for k in re.split(r"[;,/]", expected) if k.strip()]
    hits = [k for k in keywords if k and k in joined]

    evidence = _pick_quotes(evidence_blocks, max_quotes=2)

    # Conservative scoring in MOCK mode
    if evidence and (len(hits) >= max(1, len(keywords)//3)):
        status = "Partial" if len(hits) < max(2, len(keywords)//2) else "Pass"
    else:
        status = "Fail" if not evidence else "Partial"

    data = {
        "clause_id": clause_id,
        "clause_title": clause_title,
        "status": status,
        "gap": (
            "MOCK mode: review required. "
            + ("No strong supporting evidence was retrieved for this clause."
               if status == "Fail"
               else "Some supporting text was retrieved, but it may be incomplete or indirect."
               if status == "Partial"
               else "Evidence appears present, but verify it meets the standard’s intent.")
        ),
        "recommendation": "MOCK mode: add/confirm documented procedure + records that match the clause’s expected evidence.",
        "evidence": evidence,
        "confidence": (0.55 if status == "Pass" else 0.35),
        "needs_review": True,
    }

    result = GapResult(**data)

    # Guardrail: cannot Pass without evidence
    if result.status == "Pass" and len(result.evidence) == 0:
        result.status = "Partial"
        result.needs_review = True

    return result

def _make_client_if_possible() -> Optional[OpenAI]:
    # Priority: DeepSeek envs if present, else OpenAI
    deepseek_key = os.getenv("DEEPSEEK_API_KEY")
    openai_key = os.getenv("OPENAI_API_KEY")
    if not (deepseek_key or openai_key):
        return None

    if deepseek_key:
        return OpenAI(
            api_key=deepseek_key,
            base_url=os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com"),
        )
    return OpenAI(api_key=openai_key)

def run_gap_for_clause(
    client: Optional[OpenAI],
    model: str,
    row: pd.Series,
    retriever: BM25Retriever,
    top_k: int = 8
) -> GapResult:
    clause_id = str(row["clause_id"])
    clause_title = str(row.get("clause_title", ""))

    query = build_clause_query(row)
    hits = retriever.top_k(query, k=top_k)

    evidence_blocks: List[str] = []
    for ch, _score in hits:
        evidence_blocks.append(f"[{ch.doc_name} {ch.location}] {ch.text}")

    # --- No-key / MOCK mode ---
    if (model or "").strip().upper() == "MOCK" or client is None:
        return mock_gap_for_clause(row, evidence_blocks[:top_k])

    user_prompt = {
        "task": "Assess the client's documentation against the clause.",
        "clause": {
            "clause_id": clause_id,
            "clause_title": clause_title,
            "requirement_text": str(row.get("requirement_text", "")),
            "expected_evidence": str(row.get("expected_evidence", "")),
            "severity": str(row.get("severity", "")),
        },
        "evidence_text": evidence_blocks[:top_k],
        "output_schema_note": "Return JSON for GapResult. Evidence quotes must be copied exactly from evidence_text."
    }

    resp = client.chat.completions.create(
        model=model,
        temperature=0.2,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": json.dumps(user_prompt)}
        ],
    )

    raw = (resp.choices[0].message.content or "").strip()
    data = json.loads(raw)
    result = GapResult(**data)

    # Guardrail: cannot Pass without evidence
    if result.status == "Pass" and len(result.evidence) == 0:
        result.status = "Partial"
        result.needs_review = True
        result.gap = (result.gap or "").strip() + " (Auto-adjusted: Pass requires evidence quotes.)"

    return result

def run_gap_assessment(
    rubric_df: pd.DataFrame,
    retriever: BM25Retriever,
    model: str
) -> pd.DataFrame:
    client = _make_client_if_possible()

    rows = []
    for _, r in rubric_df.iterrows():
        res = run_gap_for_clause(client, model, r, retriever)
        rows.append({
            "clause_id": res.clause_id,
            "clause_title": res.clause_title,
            "status": res.status,
            "confidence": res.confidence,
            "needs_review": res.needs_review,
            "gap": res.gap,
            "recommendation": res.recommendation,
            "evidence": "; ".join([f'{e.doc} {e.location}: "{e.quote}"' for e in res.evidence])
        })
    return pd.DataFrame(rows)
