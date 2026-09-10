const fetch = require('node-fetch');
const key = require('./andimeet-93f62-cf91219c8f0f.json');

// Get OAuth2 token from service account
async function getToken() {
  const jwt = require('jsonwebtoken');
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: key.client_email,
    sub: key.client_email,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/datastore'
  };
  const assertion = jwt.sign(payload, key.private_key, { algorithm: 'RS256' });
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${assertion}`
  });
  const data = await res.json();
  return data.access_token;
}

async function run() {
  const token = await getToken();
  const res = await fetch('https://firestore.googleapis.com/v1/projects/andimeet-93f62/databases/(default)/documents/reservations?pageSize=2', {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  const data = await res.json();
  const doc = data.documents?.[0];
  if (doc) {
    console.log('Fields:', JSON.stringify(doc.fields, null, 2));
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}
run();
