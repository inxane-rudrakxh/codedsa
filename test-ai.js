require('dotenv').config({ path: '.env.local' });
const { evaluateCodeWithAI } = require('./lib/ai.js'); // Wait, ai is typescript, I'll write a quick fetch script.
const apiKey = process.env.AZURE_OPENAI_API_KEY;
const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT;
const cleanEndpoint = endpoint.replace(/\/openai\/.*$/, '').replace(/\/+$/, '');
const url = `${cleanEndpoint}/openai/deployments/${deploymentName}/chat/completions?api-version=2024-02-15-preview`;
console.log('Testing URL:', url);
fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
  body: JSON.stringify({
    messages: [ { role: 'user', content: 'test' } ],
    max_tokens: 10
  })
}).then(r => r.json()).then(console.log).catch(console.error);
