/**
 * citationFetcher.js — SAD §3.2.5, Tavily retrieval.
 *
 * Updated for PRD v1.4: queries are seeded by the intake RESEARCH TARGETS and
 * the demographic spine (gender + age), with submitted symptoms used as an
 * optional refinement rather than the primary seed (§1.2, §3.4). If Call 1
 * degraded (no research targets), it falls back to the demographic spine plus
 * symptoms / a generic longevity query.
 *
 * Runs up to 5 parallel queries with a 12s timeout each, merges and de-dupes by
 * URL, and returns a flat citation array — the SOLE source of truth for citation
 * URLs (citationValidator strips anything Claude later cites that isn't in it).
 *
 * Never throws. On any failure it returns [] and the controller sets
 * tavilyFailed = true.
 */

const TAVILY_URL = 'https://api.tavily.com/search';
const TIMEOUT_MS = 12_000; // Flag #8
const MAX_QUERIES = 5;
const INCLUDE_DOMAINS = [
  'pubmed.ncbi.nlm.nih.gov',
  'nih.gov',
  'mayoclinic.org',
  'health.harvard.edu',
  'cochranelibrary.com',
];

/**
 * Build the query strings (PRD v1.4 §3.4). Research-target seeded, demographic
 * spine on every query, symptoms as a refinement lens.
 * @param {object} profile { gender, ageRange, symptoms[], researchTargets[], conditionCategory|null }
 */
function buildQueries(profile) {
  const { gender, ageRange } = profile;
  const symptoms = Array.isArray(profile.symptoms) ? profile.symptoms : [];
  const researchTargets = Array.isArray(profile.researchTargets) ? profile.researchTargets : [];
  const demo = `${ageRange} ${gender}`;
  const queries = [];

  if (researchTargets.length) {
    for (const t of researchTargets.slice(0, 4)) {
      if (t && t.topic) queries.push(`${t.topic} ${demo} evidence`);
    }
    // Symptom lens: a single refinement query when symptoms were submitted.
    if (symptoms.length) {
      queries.push(`${symptoms.slice(0, 3).join(', ')} ${demo} evidence`);
    }
  } else {
    // Call 1 degraded — fall back to the demographic spine.
    const seed = symptoms.length ? symptoms.slice(0, 3).join(', ') : 'wellness longevity healthy aging';
    queries.push(`${seed} ${demo} evidence`);
    if (symptoms.length > 3) {
      queries.push(`${symptoms.slice(3, 6).join(', ')} ${demo} lifestyle recommendations NIH`);
    }
    if (profile.conditionCategory) {
      queries.push(`${profile.conditionCategory} ${demo} management PubMed`);
    }
  }

  return queries.slice(0, MAX_QUERIES);
}

function domainOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

async function runQuery(query, apiKey) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(TAVILY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: 'advanced',
        include_domains: INCLUDE_DOMAINS,
        max_results: 5,
      }),
      signal: controller.signal,
    });
    if (!res.ok) return []; // 4xx/5xx/429 → treat as empty for this query
    const data = await res.json();
    const results = Array.isArray(data.results) ? data.results : [];
    return results.map((r) => ({
      title: r.title || '',
      url: r.url || '',
      content: r.content || '',
      publishedDate: r.published_date || 'Unknown',
      domain: domainOf(r.url || ''),
    }));
  } catch {
    return []; // network error or abort (timeout)
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @param {object} profile { gender, ageRange, symptoms[], researchTargets[], conditionCategory|null }
 * @returns {Promise<{citations:Array, queryCount:number}>}
 */
async function fetchCitations(profile) {
  const apiKey = process.env.TAVILY_API_KEY;
  const queries = buildQueries(profile);
  if (!apiKey || queries.length === 0) return { citations: [], queryCount: queries.length };

  const batches = await Promise.all(queries.map((q) => runQuery(q, apiKey)));

  // Merge + dedupe by URL.
  const seen = new Set();
  const merged = [];
  for (const batch of batches) {
    for (const c of batch) {
      if (!c.url || seen.has(c.url)) continue;
      seen.add(c.url);
      merged.push(c);
    }
  }
  return { citations: merged, queryCount: queries.length };
}

module.exports = { fetchCitations, buildQueries };
