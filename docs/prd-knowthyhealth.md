# KnowThyHealth — Product Requirements Document

**Version 1.3** · MVP scope · BMAD Phase 1 (Analyst). Source of truth for SAD v1.0 and API Design v1.0. The v1.3 → v1.4 changelog at the end captures the product + design decisions locked during the design phase and reflected in the shipped app.

> ⚕️ **Medical disclaimer:** KnowThyHealth provides wellness information for educational purposes only. It is not a substitute for professional medical advice, diagnosis, or treatment. Always consult a qualified healthcare provider for any medical concerns.

## Changelog

| Version | Date | Author | Changes |
| --- | --- | --- | --- |
| 1.0 | May 2026 | BMAD Analyst | Initial draft. |
| 1.1 | May 2026 | BMAD Analyst | Persona refinements; health condition disclosure field added; two-call AI flow; doctor-review warning spec; open questions table introduced. |
| 1.2 | May 2026 | BMAD Analyst | Confidence grading system (A–F) resolved and specified; F-grade card behavior defined; Tavily source domain list finalized; response JSON schema aligned with SAD requirements. |
| 1.3 | May 2026 | BMAD Analyst | Competitive differentiation section added (Sec 11); demographic-aware evidence filtering elevated as core positioning; Section 10.3 citation integrity rule hardened to product requirement; all open questions resolved or formally deferred; SAD v1.0 and API Design v1.0 derivation confirmed. |

## 1. Executive Summary

KnowThyHealth is a full-stack web application that delivers personalized, evidence-backed wellness recommendations based on user-provided demographic and lifestyle inputs. The core differentiator is verifiable, live-sourced citations — every recommendation traces to a real, resolvable URL from authoritative health sources such as PubMed, NIH, and Mayo Clinic. Advice is calibrated to the user's gender and age range, addressing a documented gap in consumer health tools that have historically applied male-default, age-blind research findings as universal guidance.

The application presents advice in a tiered output model serving both quick-scan users and skeptical, detail-oriented users who demand research backing. The MVP is a single-session, stateless experience with no user accounts or saved history. All downstream planning assets (SAD v1.0, API Design v1.0, Build Handoff v1.0) are derived from this document.

## 2. Problem Statement

### 2.1 User Problem

People seeking wellness guidance online face two opposing failure modes:

- Generic advice that ignores personal context — particularly gender and age range, two inputs that materially affect what research evidence applies.
- Authoritative-sounding content with fabricated or unverifiable citations.

For users managing an existing health condition, the risk is compounded when generic wellness advice conflicts with a prescribed treatment plan and no warning is surfaced.

### 2.2 The Clinical Research Gap

The NIH did not require women to be included in clinical trial populations until 1993. The downstream effects of that exclusion remain largely unaddressed by consumer health tools: most foundational health studies were conducted on male subjects, with findings broadly applied to all demographics. Even research conducted on women frequently fails to differentiate across age ranges and hormonal life stages, despite meaningful physiological differences. KnowThyHealth uses gender and age range as active evidence-filtering inputs — not cosmetic intake fields — to directly address this gap.

### 2.3 Market Gap

Existing consumer health apps either lock personalized insights behind subscriptions with vague sourcing, or provide AI-generated summaries with no citation transparency. KnowThyHealth occupies the gap: personalized + verifiable + demographic-aware, accessible in a single session without registration.

## 3. Goals & Success Metrics

### 3.1 Product Goals

- Deliver personalized, demographic-aware wellness advice in under 10 seconds of processing time.
- Ensure 100% of citations resolve to live, authoritative URLs at time of generation.
- Present advice in a tiered format with confidence grading transparent to the user.
- Surface a prominent, condition-specific doctor-review warning whenever a user discloses a health condition.
- Launch a functional MVP with no auth, no persistence, and no paid tier.

### 3.2 Success Metrics (MVP)

| Metric | Target |
| --- | --- |
| End-to-end response time | < 10 seconds (P90) |
| Citation live-URL validity | 100% resolvable at generation time |
| Advice card render rate | > 1 card per submitted symptom/concern |
| Mobile usability | Fully responsive on 375px viewport |
| Disclaimer visibility | Present on every output view |
| Doctor-review warning trigger | Fires on 100% of sessions with a disclosed health condition |
| F-grade card render rate | 100% of F-grade cards show noEvidenceCaveat; zero citation links rendered |

## 4. Scope

### 4.1 In Scope — MVP

- User input form: gender, age range, symptoms (multi-select + free text, max 6), diet, activity level, sleep quality, optional health condition disclosure (free text, max 300 chars)
- AI-powered advice generation via Claude API (claude-sonnet-4-6) with structured JSON output
- Conditional AI pre-processing: health condition context extraction (Call 1) when condition is disclosed
- Live web research via Tavily API, source-biased toward authoritative health publishers
- Three-tier output: Advice Cards with confidence grades (A–F), Summary Paragraph, Structured Evidence with verified citations
- Confidence badge (A–F) on each advice card with grade rationale tooltip
- F-grade card behavior: rendered with noEvidenceCaveat, never suppressed
- Condition-specific doctor-review warning banner (non-dismissible) when health condition is disclosed
- Medical disclaimer — persistent and prominent on all output views
- Mobile-responsive React frontend
- Stateless architecture — no session persistence beyond a single page load

### 4.2 Explicitly Out of Scope — MVP

- User authentication or accounts
- Saved history or session persistence
- Bilingual support (English/Spanish) — post-MVP
- Streaming response (SSE) — post-MVP
- Structured health condition taxonomy (dropdown + ICD-10 mapping) — post-MVP
- Push notifications or follow-up scheduling
- Integration with wearables or EHR systems
- Paid tiers or subscription management

## 5. User Personas

| Persona | Age Range | Description | Primary Need |
| --- | --- | --- | --- |
| Health Enthusiast | 22 – 55 | Actively invests in their wellness. May follow health trends, use supplements, or track biometrics. Wants guidance grounded in science, not marketing. | Credible, evidence-backed advice that aligns with their active health lifestyle. |
| Health-Literate Skeptic | 30 – 55 | Has a science, medical, or research background. Distrusts AI-generated health content. Will verify sources independently. | Full citations and live source URLs they can audit. Transparency over convenience. |
| Proactive Optimizer | 22 – 50 | Performance-focused. Tracks biometrics, sleep, and nutrition. Wants fine-grained, context-aware recommendations tied to their specific lifestyle inputs. | Specific, input-aware recommendations that reflect their actual profile, not population averages. |

## 6. User Flows

### 6.1 Primary Flow — Input to Output

- User lands on the KnowThyHealth homepage.
- User completes the wellness input form. Health condition field is optional but clearly labeled.
- If a health condition is entered: a contextual inline notice appears immediately beneath the field.
- User submits the form — loading state communicates active processing.
- If a health condition was disclosed: a prominent doctor-review warning banner renders at the top of the output panel, before any advice content.
- Output panel renders: Advice Cards (Tier 1) → Summary Paragraph (Tier 2). Each card shows a confidence grade badge (A–F).
- User can hover/tap a confidence badge to see the grade rationale tooltip.
- User clicks 'View Evidence' to expand the Structured Evidence panel (Tier 3) with citations and source links.
- User may click 'Start Over' to reset and run a new session.

### 6.2 Error States

- Tavily API failure: all cards rendered as grade F with noEvidenceCaveat; evidence panel shows 'Live citations temporarily unavailable' notice.
- Claude Call 1 failure (condition extraction): degrades gracefully — condition context unavailable, conditionWarning notes this.
- Claude Call 2 failure: 503 returned; frontend shows retry prompt.
- Empty input: Submit disabled; inline validation message shown.

## 7. Functional Requirements

### 7.1 Input Form

| Field | Type | Notes / Constraints |
| --- | --- | --- |
| Gender | Single-select | Options: Male, Female, Non-binary, Prefer not to say |
| Age Range | Single-select | Buckets: 18–24, 25–34, 35–44, 45–54, 55–64, 65+ |
| Symptoms / Concerns | Multi-select + free text | Presets: fatigue, sleep issues, joint pain, digestive issues, anxiety, headaches, weight management, skin concerns. Free text fallback. Max 6 items total. Each item max 100 chars. |
| Diet Pattern | Single-select | Options: Omnivore, Mediterranean, Vegetarian, Vegan, Keto/Low-carb, Other/Unknown |
| Activity Level | Single-select | Options: Sedentary, Lightly active, Moderately active, Very active |
| Sleep Quality | Single-select | Options: Poor, Fair, Good, Excellent |
| Health Condition (optional) | Free text | Max 300 chars. Triggers inline warning and output banner. AI context extraction on backend. Raw text never sent to Tavily. See Section 7.4. |

### 7.2 Output — Tier Definitions

#### Tier 1 — Advice Cards

- One card generated per submitted symptom/concern (up to 6 cards per session).
- Each card displays: headline recommendation, 1–2 sentence rationale, confidence grade badge (A–F), and citations.
- Confidence badge is interactive: on hover (desktop) / tap (mobile), shows gradeRationale text in a tooltip.
- Cards are rendered in the order symptoms were submitted.
- F-grade cards: display noEvidenceCaveat text in place of citation links. No citation anchor tags rendered for grade F cards.
- Cards are condition-sensitive when a health condition was disclosed (modulated by Call 1 context).

#### Tier 2 — Summary Paragraph

- A single narrative paragraph synthesizing cross-card themes in context of the user's full profile.
- Ends with the standard medical disclaimer. If a health condition was disclosed, also ends with a doctor-review reminder.

#### Tier 3 — Structured Evidence

- Hidden by default; revealed via 'View Evidence' toggle.
- Lists all citations used: source name, title, URL, and one-sentence relevance note.
- Also surfaces gradeRationale per card for audit visibility.
- All URLs are Tavily-sourced — zero hallucinated references (see Section 10.3).
- Source priority order: PubMed/NCBI → NIH → Mayo Clinic → Harvard Health → Cochrane Library → peer-reviewed journals → CDC.
- Empty state when Tavily failed: 'No live research citations are available for this session.'

### 7.3 Medical Disclaimer

| Requirement:  The disclaimer must appear: (1) above the output panel on first render, (2) at the bottom of every Tier 2 summary paragraph, and (3) in the page footer on every view. It must not be dismissible or collapsible. Copy: 'This information is provided for general wellness and educational purposes only. It does not constitute medical advice, diagnosis, or treatment. Always consult a qualified healthcare professional before making changes to your diet, exercise routine, or health management.' |
| --- |

### 7.4 Health Condition Disclosure — Behavior Specification

| Important: Review With Your Doctor  You have disclosed a health condition. The recommendations below are for general wellness education only and do not account for your specific diagnosis, medications, contraindications, or treatment plan. Please review any advice from this tool with a qualified healthcare provider before making changes to your health routine. |
| --- |

#### A. Inline Warning (on input)

- As soon as the user begins typing in the health condition field, an inline notice renders immediately below the field.
- Copy: 'If you have an existing health condition, please review all recommendations from this tool with your doctor before making any changes to your health routine.'
- The notice persists as long as the field contains text. Clearing the field removes it.

#### B. AI-Mediated Context Extraction (backend — Call 1)

- When the health condition field is non-empty, the backend makes a preliminary Claude API call before the main advice call.
- Call 1 extracts: conditionCategory (normalised clinical term), contraindications[], lifestyleFlags[].
- Raw healthCondition text is passed to Call 1 only. It is never sent to Tavily, never included in Tier 3 output, and never logged in full.
- Structured output from Call 1 is injected into the Call 2 prompt to modulate recommendations.
- If Call 1 fails: conditionContext = null; processing continues with a degraded flag; conditionWarning notes the limitation.

#### C. Output Warning Banner (on output)

- Non-dismissible red-bordered banner at the top of the output panel, above all Tier 1 cards.
- Copy: 'You have disclosed a health condition. These recommendations are for general wellness education only and do not account for your specific diagnosis, medications, or treatment plan. Please review all advice with a qualified healthcare provider.'
- If condition extraction degraded: appends 'Note: condition-specific context could not be fully processed. Please exercise additional caution.'

| Future Phase:  Structured condition taxonomy (dropdown + ICD-10 mapping) and condition-specific Tavily query bias are planned for a post-MVP phase. The free-text + AI extraction approach in MVP is intentionally designed to preserve the data model needed for that evolution. |
| --- |

## 8. Confidence Grading System

| Status:  Resolved in v1.2. Confidence grading uses an A–F letter system, AI-generated per card, with color coding and a user-visible rationale. This resolves Open Question #1 from v1.1. |
| --- |

### 8.1 Grade Definitions

| Grade | Criteria |
| --- | --- |
| A | Recommendation supported by ≥2 RCTs or systematic reviews found in the Tavily citation set. |
| B | Supported by cohort studies, strong observational data, or 1 RCT found in the citation set. |
| C | Limited evidence: case studies, small sample studies, or conflicting results in the citation set. |
| D | Based on expert consensus, clinical guidelines, or mechanistic reasoning; no direct RCTs found. |
| F | No usable citations found in the Tavily result set for this symptom/concern. noEvidenceCaveat is mandatory. Card is rendered — not suppressed. |

### 8.2 Grade Rendering Rules

- Color-coded badge on each Tier 1 advice card: A = green, B = blue, C = yellow, D = orange, F = red.
- Badge is interactive: on hover (desktop) / tap (mobile), shows gradeRationale text in a tooltip.
- gradeRationale is also listed in the Tier 3 Evidence Panel for full audit visibility.
- Grade is AI-generated by Claude Call 2 based on the Tavily citation set for that session.
- F-grade cards render noEvidenceCaveat text. No citation links are rendered on an F-grade card.
- If citationValidator strips all citations from a non-F card after generation, the card is automatically downgraded to F and noEvidenceCaveat is set.

## 9. Non-Functional Requirements

| Category | Requirement | Rationale |
| --- | --- | --- |
| Performance | P90 end-to-end response < 10 seconds | User tolerance for AI-mediated health tools |
| Responsiveness | Fully functional at 375px through 1440px | Majority of health searches are mobile |
| Accessibility | WCAG 2.1 AA compliance target | Health information has broad user demographics |
| Citation Integrity | Zero hallucinated URLs — all sources validated live via Tavily before response is sent | Core product trust differentiator; hard constraint |
| Privacy | No PII stored; inputs ephemeral per session; healthCondition text sanitized and not logged | MVP has no persistence; health inputs are sensitive |
| Browser Support | Chrome 110+, Safari 15+, Firefox 115+, Edge 110+ | Modern evergreen browsers |
| Uptime Target | 99% (MVP; no SLA contractually) | Best-effort for early users |

## 10. Technical Stack (Directional)

| Note:  Detailed architecture is specified in SAD v1.0 and API Design v1.0, both derived from this document. This section provides the high-level direction. |
| --- |

| Layer | Technology | Purpose |
| --- | --- | --- |
| Frontend | React (Vite) + Tailwind CSS | Single-page app; component-based UI; mobile-first responsive layout |
| Backend | Node.js / Express | API orchestration; prompt construction; Tavily + Claude coordination; citation validation |
| AI Layer | Anthropic Claude API (claude-sonnet-4-6) | Call 1: condition context extraction (conditional). Call 2: advice generation, structured JSON output. |
| Research Layer | Tavily API | Live web retrieval; source-biased toward authoritative health publishers |
| Deployment | TBD — Railway / Fly.io / Render (backend); Vercel / Netlify (frontend) | Separately deployable services; backend requires persistent Node.js process |

### 10.1 AI Call Architecture

#### Call 1 (conditional): Health Condition Context Extraction

- Fires only when healthCondition field is non-empty.
- Input: sanitised healthCondition text (max 300 chars).
- Output schema: { conditionCategory: string, contraindications: string[], lifestyleFlags: string[] }
- Raw text is never propagated beyond Call 1.
- On failure: conditionContext = null; degradedConditionContext flag set; processing continues.

#### Call 2 (always): Advice Generation

- Input: full user profile, Tavily citation snippets, Call 1 output (if available), tavilyFailed flag.
- Output schema: { cards[], summary, evidence[], disclaimer, conditionWarning }
- Each card includes: headline, recommendation, citations[], confidenceGrade (A–F), gradeRationale, noEvidenceCaveat.
- If tavilyFailed = true: all cards generated as grade F with noEvidenceCaveat.
- System prompt enforces JSON-only output; malformed response triggers ADVICE_GENERATION_ERROR (HTTP 503).

### 10.2 Tavily Source Bias Configuration

| Authoritative Source List:  include_domains: pubmed.ncbi.nlm.nih.gov, nih.gov, mayoclinic.org, health.harvard.edu, cochranelibrary.com. Search depth: advanced. Up to 3 parallel queries per session. |
| --- |

### 10.3 Citation Integrity — Hard Constraint

| Hard Product Requirement:  Claude must not generate citation URLs. All URLs in the evidence[] array must originate from Tavily API results for that session. The backend citationValidator module cross-references every URL in the Claude response against the Tavily result set before responding to the frontend. Any URL not present in the Tavily set is stripped. This constraint is non-negotiable and is enforced in code — it is not a prompt instruction alone. |
| --- |

## 11. Competitive Differentiation

The consumer health information market is crowded. Most products cluster into symptom triage tools and educational content platforms. KnowThyHealth's differentiation is both architectural and ethical:

| Differentiator | Description |
| --- | --- |
| Live, verifiable citations | All citation URLs sourced from Tavily at generation time. Zero hallucination tolerance enforced in code, not just prompt instruction. Competitors do not surface live source URLs. |
| Confidence grading (A–F) | Each recommendation carries an evidence grade with rationale visible to the user. No major competitor surfaces evidence strength in a user-accessible, graded format. |
| Demographic-aware filtering | Gender and age range are used as active evidence-filtering inputs in Tavily queries and Claude prompts — not cosmetic intake fields. Addresses the documented clinical research representation gap. |
| Three-tier output | Serves three user mindsets in one session: quick answer (Tier 1 cards), narrative context (Tier 2 summary), full evidence audit (Tier 3 citations). No registration required. |
| Zero-hallucination architecture | citationValidator module enforces URL provenance at the infrastructure level. Every citation in the response is auditable back to a Tavily query result. |

| Competitive Risk:  Incumbents could close part of this gap at the interface level relatively quickly. The defensible moat is execution quality, source freshness, and a reputation for honest uncertainty — not the feature checklist alone. The confidence grading system and the transparent grade rationale are particularly hard to imitate credibly without the underlying evidence pipeline. |
| --- |

## 12. Constraints & Assumptions

### 12.1 Constraints

- MVP only — no authentication, no user accounts, no saved history.
- All citation URLs must be live and sourced from Tavily — zero hallucination tolerance, enforced in code.
- Medical disclaimer is non-negotiable and non-dismissible.
- Doctor-review warning is mandatory and non-dismissible when a health condition is disclosed.
- Maximum 6 symptoms/concerns per session in MVP.
- Frontend and backend must be separately deployable services.
- No paid features, paywalls, or upsell flows in MVP.

### 12.2 Assumptions

- Tavily API will return at least 3 usable results per symptom query under normal conditions.
- Claude API latency (claude-sonnet-4-6) will not exceed 8 seconds P90 including the optional two-call condition extraction flow.
- No HIPAA obligations anticipated for MVP (no PII stored; no clinical records accessed); legal review required pre-launch.
- English is the only supported language at launch; bilingual support (English/Spanish) is a named post-MVP feature.

## 13. Risks & Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Tavily returns low-quality sources | Weak citation credibility | Source domain allowlist; search depth 'advanced'; relevance scoring |
| Claude latency spikes under load | User abandonment; P90 budget exceeded | 30s backend timeout; graceful degradation on failure; streaming deferred to post-MVP |
| Users mistake app for medical advice | Legal and ethical liability | Prominent non-dismissible disclaimer; condition warning; legal review pre-launch (see Sec 14) |
| Health condition misinterpreted by AI extraction | Incorrect context modulates advice | Call 1 output schema-validated; fallback to no-condition mode on low-confidence output |
| Citation URL link rot post-generation | Broken evidence links | Accepted risk for MVP; URL health check is a post-MVP feature |
| Prompt injection via free-text fields | Unexpected AI behavior | Input sanitisation; injection pattern rejection; system prompt hardening; schema validation on output |
| Demographic-aware filtering overstates precision | Trust erosion if filtering quality is poor | Grade rationale is always shown; F-grade is rendered honestly; product never claims clinical-grade accuracy |

## 14. Open Questions & Decisions

| # | Question | Status | Decision / Notes |
| --- | --- | --- | --- |
| 1 | Confidence grading: AI-generated or rule-based? | DECIDED — A–F letter grades, AI-generated per card by Claude Call 2 based on the Tavily citation set. Color-coded badge with tooltip. Specified in Section 8. | Resolved in v1.2. |
| 2 | Maximum symptoms per session? | DECIDED — 6 symptoms maximum for MVP. | Balances API cost, response quality, and UX complexity. |
| 3 | Streaming response (SSE)? | DEFERRED — Post-MVP. Single-payload response for MVP. | MVP uses a loading state. SSE is a meaningful UX upgrade for future phases. |
| 4 | Legal review process pre-launch? | OPEN — Requires dedicated pre-launch checklist. | Needed: disclaimer language sign-off, ToU, privacy policy, HIPAA applicability assessment, legal counsel review. Condition disclosure feature adds urgency. |

## 15. Document Status & Next Steps

| Status:  FINAL v1.3 — Authoritative source of truth for SAD v1.0 and API Design v1.0. All decisions that can be made at PRD stage are resolved. Open Question #4 (legal review) remains open by design — it is a pre-launch process requirement, not a product design decision. |
| --- |

### 15.1 Derived Documents

| Document | Version | Status |
| --- | --- | --- |
| PRD (this document) | v1.3 | Final — source of truth |
| User Stories | v1.1 | Complete — derived from PRD v1.1; to be reviewed against v1.3 deltas |
| System Architecture Document (SAD) | v1.0 | Complete — derived from PRD v1.3 |
| API Design & Data Flow | v1.0 | Complete — derived from PRD v1.3 + SAD v1.0 |
| Build Handoff | v1.0 | Complete — derived from all above |

### 15.2 Post-MVP Feature Queue

- Confidence scoring system refinement — Phase 2
- Streaming response (SSE) for improved perceived latency — Phase 2
- Structured health condition taxonomy (dropdown + ICD-10 mapping) — Phase 2
- Bilingual support (English/Spanish) — Phase 3
- Citation URL health-check / link rot detection — Phase 2
- User accounts, saved history, session persistence — Phase 3+

---

**Changelog — v1.3 → v1.4** *(product + design decisions locked during the design phase, June 2026, and reflected in the shipped product)*

### How to use this document

This changelog captures every product-level decision made during the design phase that changes, clarifies, or extends what's specified in PRD v1.3. Each entry has three parts: what v1.3 says (or what was ambiguous), what's now locked, and a brief rationale.

To produce a true v1.4, work through each section in order, find the corresponding part of your PRD, and apply the change. Some changes are additions to sections that didn't exist in v1.3 — those are flagged as NEW.

Sections are ordered by impact: the most consequential changes (product model, card architecture) come first. Smaller refinements appear later.

## 1. Product model

#### 1.1 Card model — symptom-keyed vs domain-grouped

| v1.3 spec / status | New decision (v1.4) | Why |
| --- | --- | --- |
| PRD v1.3 implies cards are keyed to user-entered symptoms (e.g., one card per concern). The card count was loosely 'around 6.' | Cards are grouped by DOMAIN (Sleep, Nutrition, Movement, Supplementation, Screening, etc.), not by symptom. Card count is variable per response, decided by the system based on what evidence exists for the demographic. | Tying cards to symptoms forces a misalignment when the user submits without symptoms (most cases). Domain grouping reflects what the literature actually surfaces: clusters of recommendations within a coherent area of wellness/longevity. |

#### 1.2 Symptoms — required vs optional

| v1.3 spec / status | New decision (v1.4) | Why |
| --- | --- | --- |
| v1.3 treats symptoms/concerns as a core part of the intake. | Symptoms are OPTIONAL refinements. The required spine is gender + age only. Symptoms, when entered, are used as a lens — they reweight which recommendations rise to the top, or annotate which cards address which concern, but they don't structure the response. | The product surfaces what current literature supports for a demographic, not answers to user-supplied questions. Gender and age are the two filters that change the literature most; everything else sharpens further. |

#### 1.3 Product framing — personalization vs research filter

| v1.3 spec / status | New decision (v1.4) | Why |
| --- | --- | --- |
| v1.3 framing positioned the product as personalized health advice. | Reframed as a 'demographically filtered research surface.' The product is not generating personalized advice — it is surfacing the research that was actually conducted on people of the user's demographic, and grading each finding by the strength of its evidence. | The personalization framing conflates the product with general wellness-AI tools. The research-filter framing is more accurate, more defensible, and better positions the product against the actual problem: research applicability erosion through downstream extrapolation. |

#### 1.4 Domain taxonomy — fixed vs variable

| v1.3 spec / status | New decision (v1.4) | Why |
| --- | --- | --- |
| v1.3 does not explicitly specify whether the domain set is fixed. | Domains are VARIABLE per response. The system surfaces whichever domains have evidence-backed recommendations for this profile. There is no fixed taxonomy that must always be present. | Forcing a fixed set produces empty sections for users whose profile has no surfaceable evidence in some domains. Variable domains keep the readout dense and avoid 'we found nothing on screening' as a section header. |

## 2. Card and tier architecture

#### 2.1 Tiers vs cards — distinct concepts

| v1.3 spec / status | New decision (v1.4) | Why |
| --- | --- | --- |
| v1.3 mentions tiers and cards but does not crisply separate them. | TIERS are depth levels within a single card. T1 (lite) → T2 (more) → T3 (comprehensive). CARDS are recommendation units, grouped by domain. A domain group may have 1–3 cards; each card has three tier states. | Conflating the two led to design confusion in the early stages. Locking the vocabulary makes the rest of the spec readable: 'a domain group of cards, each with three tier states' has a clear interpretation. |

#### 2.2 Tier depth model

| v1.3 spec / status | New decision (v1.4) | Why |
| --- | --- | --- |
| Not specified in v1.3. | Model A locked: three accordion depth states in place. T1 is the default state; user expands to T2, then to T3 in place on the same card. From T3, 'Collapse' returns directly to T1 (skipping T2 on the way back). | Two alternative models considered: modal/route (heavier interaction friction) and two-state expand (loses the middle 'show me reasoning without sources' level). Three-tier accordion works when paired with clear depth indicators. |

#### 2.3 Tier content specifications

Locked tier content (NEW spec — add to PRD):

- T1 (lite): domain label, grade tile, recommendation headline (one sentence), one-line takeaway, 'More ↓' action.
- T2 (more): everything in T1, plus full recommendation prose with mechanism/dose/frequency, personalized reasoning ('Particularly relevant for you because of…'), symptom-relevance pills (if symptoms entered), 'Less ↑' + 'Evidence →' actions.
- T3 (comprehensive): everything in T2, plus full sources list with citation type pills (Meta, RCT, Cohort, Review), caveats block (what the evidence doesn't cover), mechanism note. Single 'Collapse ↑' action that returns directly to T1.

#### 2.4 Visual tier indication

Locked visual treatment (NEW spec — add to PRD):

- Tier 1: stone-200 hairline border.
- Tier 2: plum-200 (#D8B4DE) border.
- Tier 3: plum-500 (#6D3F73) border + soft plum ring (shadow-tier-3).
- Three-dot indicator at top of each card showing current tier depth (e.g., ●●○ = tier 2 of 3).
- Monospace meta label next to dots showing tier number (e.g., 'tier 2 / 3').

## 3. Grade system

#### 3.1 Grade tile colors

| v1.3 spec / status | New decision (v1.4) | Why |
| --- | --- | --- |
| v1.3 §8.2 specifies traffic-light colors: A=green, B=blue, C=yellow, D=orange, F=red. | Saturated brand-aligned ramp: A=plum (#6D3F73), B=sage (#4D6638), C=sand (#876B36), D=copper (#874425), F=deep red (#6E1E1E). Each grade is a distinct hue family, not a tonal scale. Letters are always paper-white (#FAFAF9). | Traffic-light colors are visually conventional but generic — they say 'this is a quality metric' without saying anything about THIS product. The saturated brand ramp does the same job and earns the brand color as part of the data display (A in plum). Each hue family ensures grades remain visually distinct even at small thumbnail sizes. |

#### 3.2 Grade definitions — verified language

Locked grade language (confirm/update PRD §8.2):

- A — Strong evidence. Multiple high-quality RCTs, meta-analyses, or systematic reviews with consistent findings.
- B — Moderate evidence. At least one well-designed RCT or strong observational data, with reasonable replication.
- C — Mixed evidence. Plausible mechanism with conflicting trials, small sample sizes, or unresolved effect-size variation.
- D — Weak evidence. Anecdotal reports, single low-powered studies, or claims supported primarily by expert opinion.
- F — Contradicted or unsupported. Claims the evidence base directly contradicts, or that have no credible mechanism or supporting research.

#### 3.3 F-card behavior

| v1.3 spec / status | New decision (v1.4) | Why |
| --- | --- | --- |
| v1.3 specifies a noEvidenceCaveat block for cards with no evidence but doesn't explicitly forbid suppressing them. | F cards are ALWAYS rendered when generated by the system — never suppressed. The noEvidenceCaveat block is part of the card itself (small deep-red-bordered block inside the card body). This explicitly distinguishes 'we found nothing' from 'we found contradicting evidence.' | Suppressing F-cards would undercut the brand position of transparency about the full evidence spectrum. The landing page makes a public commitment to showing the full ramp; the product must honor it. |

## 4. Voice and copy

#### 4.1 'Thy' usage rule

| v1.3 spec / status | New decision (v1.4) | Why |
| --- | --- | --- |
| v1.3 does not specify when/where 'thy' is used. | 'Thy' appears only in the brand name (KnowThyHealth) and the logo lockup baseline ('thy health'). All product copy uses modern English — 'your', 'you', 'yours'. This applies system-wide: landing page, form, results, error states, banners, footer. | Tried both ways during design. Sustaining 'thy' throughout the copy reads as costume rather than voice. The name carries the signature; the body copy needs to be invisible. |

#### 4.2 Hero thesis

Locked hero thesis (NEW spec — add to PRD §10 or copy-deck):

"Research is rigorous and specific. Knowing when it applies to you? That's powerful."

Notes: 'powerful' is italicized. Set in Source Serif 4, weight 400, size 44px on desktop, 26px on mobile. The italic earns the emphasis without requiring a capital letter on 'powerful.'

#### 4.3 Hero subhead

Locked hero subhead (NEW spec — add to PRD):

"Studies are designed around a defined population; that's how variables get controlled and findings get isolated. The breakdown is downstream — those findings get extrapolated by media, the wellness industry, and even medical professionals, to people who resemble nothing of the study subjects. KnowThyHealth surfaces the research done on people like you — your gender, your age — and grades each finding by the strength of its evidence, so you get the information you actually need."

#### 4.4 Locked CTAs

- Primary (hero + footer): 'Try it on yourself →'
- Secondary text link (hero): 'Not sure? Here's what you might expect'
- Footer headline: 'See what the research has to say about you.'
- Form submit: 'Get readout →'
- Error retry actions: 'Try again' (primary) + 'Edit intake' (secondary)

#### 4.5 Vocabulary

System uses 'readout' consistently for the results artifact (not 'recommendations,' 'report,' or 'analysis'). 'Re-narrow' is the verb for what the system does to research. 'Cohort' and 'demographic' are used in technical/methodology contexts; 'people like you' is the front-stage language.

## 5. Failure and error states

#### 5.1 Four distinct surfaces (NEW spec — add to PRD)

Four failure modes are now distinctly designed (v1.3 had only general 'error state' references):

- Hang state (45s+): same loading layout; headline shifts to 'This one's taking a minute'; active phase indicator and elapsed-time turn amber (#B45309); body copy explains why; hard 2-minute timeout commitment.
- Tavily degraded: hybrid — amber banner at top + cards still render as all-F with noEvidenceCaveat clarifying 'couldn't verify citations' vs 'no evidence in general.'
- Claude 503 (composition failed): centered full-page error; red circular icon; serif headline ('The composition step failed'); body identifies which pipeline stage failed; 'Try again' + 'Edit intake' actions.
- Network unreachable: centered full-page error; amber wifi-off icon; serif headline ('Can't reach the server'); preserved-intake reassurance; status-page reference.

#### 5.2 Diagnostic information — security position

| v1.3 spec / status | New decision (v1.4) | Why |
| --- | --- | --- |
| Initial design exposed stage names, request IDs, timestamps, and HTTP status codes in user-facing error pages. | REMOVED. Error pages now show only a short opaque support reference code (e.g., '8h2k3m') for users who want to report issues. Internal diagnostics (stage, request_id, timestamp) stay in server logs only. | Exposing internal request structure, pipeline stage names, and timestamps leaks architecture details useful to attackers (timing attacks, surface mapping, log correlation). User-facing transparency is achieved through clear human-readable copy, not raw diagnostic dumps. |

#### 5.3 Error state visual vocabulary

- Amber (#B45309) = warning, recoverable, 'still working' or 'degraded but functional.'
- Red (#991B1B) = hard failure, action required.
- Plum (#6D3F73) = success/in-progress; NEVER appears in error contexts.

## 6. Intake form architecture

#### 6.1 Required spine vs optional refinements

| v1.3 spec / status | New decision (v1.4) | Why |
| --- | --- | --- |
| v1.3 treats the form as a flat set of fields with mixed required/optional flags. | The form is split into two visual tiers: a heavier 'Required' card (gender + age, marked with plum asterisks, 1px border) and a set of 'Refine the readout' cards (baseline, concerns, health context — all optional, 0.5px hairline borders, under a section divider). Submit is enabled when required fields are filled, regardless of optional state. | Visually distinguishing required from optional reduces friction for users who want to submit minimum input, while still inviting refinement for users who want to share more. |

#### 6.2 Form persistence

| v1.3 spec / status | New decision (v1.4) | Why |
| --- | --- | --- |
| v1.3 does not specify form-state persistence behavior for retries. | Form state persists to sessionStorage. On a 503 retry or network failure, the user does NOT have to re-enter the form. URL params are explicitly NOT used (would expose intake data in the URL, undercutting 'no data stored' promise). | sessionStorage persists across hard reloads within a tab but doesn't survive tab close, which aligns with the privacy commitment. |

#### 6.3 Submit CTA enablement

Submit button disabled until gender and age are both filled. Visually distinct disabled state (stone-200 background, stone-500 text).

#### 6.4 Condition warning

When the user types in the 'Existing health condition' field, an inline amber-bordered warning appears immediately below the field: 'If you have an existing health condition, please review all recommendations from this tool with your doctor before making any changes to your health routine.' The warning is informational (not blocking); the user can still submit.

## 7. Loading state

#### 7.1 Four-phase progress card (NEW spec)

The loading state surfaces the system's actual work in four visible phases:

- Profile processed — Claude Call 1 (intake + research target identification)
- Pulling sources — Tavily search with live count of papers retrieved
- Grading evidence — first half of Claude Call 2 (scoring)
- Composing readout — second half of Claude Call 2 (writing the response)

Each phase has three states: done (plum filled circle with check), active (white circle with plum 2px border + pulsing 3px plum ring), pending (white circle with gray hairline and gray number).

#### 7.2 Motion vocabulary

- Breathing headline animation (3s opacity pulse) on the page title.
- Loading-dots animation (1.4s cycle) after the title and on the active phase title.
- Pulse ring (1.6s expand) on the active phase icon.
- Honest timing meta in monospace — actual elapsed seconds per phase, '—' for pending phases.

#### 7.3 Cancel affordance

A quiet 'Cancel and return to form' link at the bottom of the loading state. Form state is preserved if the user cancels.

## 8. Layout and visual system

#### 8.1 Layout widths

- max-w-page (640px) — landing, loading, narrow surfaces.
- max-w-form (720px) — intake form (wider for 2-column layouts on desktop).
- max-w-wide (880px) — results page (room for cards + intake recap chips).

#### 8.2 Mobile breakpoints

Single primary breakpoint at 640px viewport. Below 640px:

- Logo collapses to mark-only (no 'thy health' baseline).
- Card layouts switch from side-by-side (grade tile + content) to stacked (tile on top, content full-width).
- Buttons go full-width.
- Form fields stack to single column.
- Diet field switches from segmented control to select.

## 9. Pending decisions (not in this changelog)

These are open items that were flagged during design but not resolved. Add to PRD as known TBDs:

- Dark mode — tokens are mode-aware ready, but no dark-mode surfaces have been drawn. Decision needed on whether dark mode ships v1 or later.
- Symptom chip presets — current list is placeholder (Fatigue / Sleep issues / Joint pain / Digestive issues / Anxiety / Headaches / Weight management / Skin concerns). Real curation requires user research.
- 'Why this happens →' link in Tavily degraded banner — destination not specified (could be methodology anchor or small modal).
- Status page (status.knowthyhealth.app) — referenced in network failure state but doesn't exist yet.
- Authentication / accounts — not in scope for v1 per the 'no account' commitment. Revisit if/when a save-readouts feature is added.
- Internationalization — not in scope for v1. All copy is English-only.

## 10. Sources of truth for this version

After applying this changelog to produce v1.4:

- PRD v1.4 — product spec (you maintain)
- docs/design-tokens.md — visual system specification (in the frontend repo)
- docs/README.md — frontend architecture and conventions (in the frontend repo)
- src/components/ui/* — UI primitive components, the codified design system

If these ever disagree, the PRD wins for product behavior, design-tokens.md wins for visual specifications, and the code wins for implementation reality.

END OF CHANGELOG
