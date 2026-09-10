const fs = require('fs');
const uploadScript = fs.readFileSync('upload_n8n.cjs', 'utf-8');
const keyMatch = uploadScript.match(/const apiKey\s*=\s*'([^']+)'/);
if (!keyMatch) { console.error('No API KEY'); process.exit(1); }
const API_KEY = keyMatch[1];

const fetch = require('node-fetch');

async function run() {
  const res = await fetch('https://n8n-n8n.u2ucpt.easypanel.host/api/v1/credentials', {
    headers: {
      'X-N8N-API-KEY': API_KEY
    }
  });
  console.log(res.status);
  console.log(JSON.stringify(await res.json(), null, 2));
}
run();
