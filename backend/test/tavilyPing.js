// Quick connectivity test for Tavily. Run: npm run ping:tavily
require('dotenv').config();
async function ping() {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY,
      query: 'fatigue sleep quality wellness NIH evidence',
      search_depth: 'advanced',
      include_domains: ['pubmed.ncbi.nlm.nih.gov', 'nih.gov', 'mayoclinic.org'],
      max_results: 3,
    }),
  });
  const data = await res.json();
  console.log('Results:', (data.results || []).length);
  console.log('First URL:', data.results && data.results[0] ? data.results[0].url : '(none)');
}
ping().catch(console.error);
