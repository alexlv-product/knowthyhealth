// Quick connectivity test for the Anthropic API. Run: npm run ping:anthropic
require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const client = new Anthropic();
async function ping() {
  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 64,
    messages: [{ role: 'user', content: 'Reply with: {"ok": true}' }],
  });
  const text = (msg.content.find((b) => b.type === 'text') || msg.content[0]).text;
  console.log(JSON.parse(text));
}
ping().catch(console.error);
