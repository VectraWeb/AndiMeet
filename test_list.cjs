const fetch = require('node-fetch');

async function run() {
  const authRes = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=AIzaSyB4KFNRpiqcQjqWoUupEwgviOwLXoxftNw', {
    method: 'POST',
    body: JSON.stringify({ returnSecureToken: true })
  });
  const authJson = await authRes.json();
  const token = authJson.idToken;

  const res = await fetch('https://firestore.googleapis.com/v1/projects/andimeet-93f62/databases/(default)/documents/reservations?orderBy=createdAt%20desc&pageSize=50',
  {
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  console.log(res.status);
  console.log(await res.text());
}
run();
