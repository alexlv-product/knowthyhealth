/**
 * citationValidator.js — SAD §3.2.7. Enforces the zero-hallucination guarantee.
 *
 * Every citation/evidence URL in the Claude response is checked against the
 * exact set of URLs Tavily returned. Anything not in that set is stripped and
 * logged (never thrown). This runs on every response.
 *
 * v1.4 notes:
 *   - Citation `type` pills (Meta/RCT/Cohort/Review) are normalised here so the
 *     UI always has a valid value; an unknown/missing type defaults to "Review".
 *   - Grade F now carries two meanings (§3.3): "contradicted" (the model may keep
 *     the citations that contradict a claim) and "no evidence found" (citations
 *     empty). This module only ever produces the "no evidence found" kind: when
 *     stripping empties a non-F card's citations it downgrades to F with the
 *     no-verified-sources caveat. A model-authored F caveat is left untouched.
 */

const VALID_CITE_TYPES = ['Meta', 'RCT', 'Cohort', 'Review'];

const NO_EVIDENCE_CAVEAT =
  'No independently verified sources were found for this recommendation for ' +
  'people like you. Treat this guidance with caution.';

function normaliseType(t) {
  return VALID_CITE_TYPES.includes(t) ? t : 'Review';
}

/**
 * @param {object} adviceResponse parsed, schema-valid Claude response
 * @param {Array<{url:string}>} tavilyCitations original Tavily results
 * @returns {{ response: object, strippedCount: number }}
 */
function validateCitations(adviceResponse, tavilyCitations) {
  const valid = new Set(
    (tavilyCitations || []).map((c) => c && c.url).filter(Boolean)
  );
  let stripped = 0;

  const cards = (adviceResponse.cards || []).map((card) => {
    const kept = (card.citations || [])
      .filter((c) => {
        const ok = c && valid.has(c.url);
        if (!ok) {
          stripped += 1;
          console.warn('[citationValidator] stripped card citation not in Tavily set');
        }
        return ok;
      })
      .map((c) => ({ ...c, type: normaliseType(c.type) }));

    let { confidenceGrade, noEvidenceCaveat } = card;
    // Auto-downgrade only the "no evidence found" case: citations emptied by
    // stripping on a card the model did not already mark F.
    if (kept.length === 0 && confidenceGrade !== 'F') {
      confidenceGrade = 'F';
      noEvidenceCaveat = NO_EVIDENCE_CAVEAT;
    }
    return { ...card, citations: kept, confidenceGrade, noEvidenceCaveat };
  });

  const evidence = (adviceResponse.evidence || [])
    .filter((e) => {
      const ok = e && valid.has(e.url);
      if (!ok) {
        stripped += 1;
        console.warn('[citationValidator] stripped evidence source not in Tavily set');
      }
      return ok;
    })
    .map((e) => ({ ...e, type: normaliseType(e.type) }));

  return { response: { ...adviceResponse, cards, evidence }, strippedCount: stripped };
}

module.exports = { validateCitations };
