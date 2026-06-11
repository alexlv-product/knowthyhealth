# KnowThyHealth — documentation

Evidence-graded wellness, re-narrowed to who the research actually studied. Live at **[knowthyhealth.app](https://knowthyhealth.app)**.

- **[Product Requirements (KnowThyHealth)](prd-knowthyhealth.md)** — the product: demographic-aware, citation-verified wellness readouts (PRD v1.3 + v1.4 changelog).
- **[Product Requirements (Recovery Agent)](prd-recovery-agent.md)** — an LLM agent that diagnoses runtime failures and chooses a constrained recovery, with an audit trail.
- **[Competitive Analysis](competitive-analysis.md)** — the market gap: competitors give answers; KnowThyHealth shows its work.
- **[Ship Report (Recovery Agent)](ship-report-recovery-agent.md)** — what shipped, the decisions behind it, and how it was verified in production.

---

## What KnowThyHealth is

Studies are designed around a defined population — that's good science — but those findings get extrapolated downstream to people who resemble nothing of the study subjects. KnowThyHealth surfaces the research done on people like you (your gender, your age), grades each finding by the strength of its evidence (A–F), and proves every citation against a live source set so nothing is fabricated.

Two architectures ship side by side, on purpose:

- a **deterministic** core — orchestrated retrieval with verified citations and zero model-invented sources, because verifiability outranks flexibility for health info;
- a **constrained, audited agent** for runtime error handling — where ambiguity is real and model judgment earns its place.

## Deeper references

- **[Recovery-agent engineering design](recovery-agent-design.md)** — the implementation design note (control flow, safety rails, V1/V2 status) behind the ship report.
