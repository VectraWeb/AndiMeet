const fs = require('fs');

async function upload() {
    const data = JSON.parse(fs.readFileSync('./NotiMan.json', 'utf8'));
    const workflowId = 'G6bairFn6FCXuln1'; // NotiMan ID

    const url = `https://n8n-n8n.u2ucpt.easypanel.host/api/v1/workflows/${workflowId}`;
    const apiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxNjhlNjUxMC05M2MyLTRjNzQtYWRhMS1lMzQwZTJlZWY2MGEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMDBhNzk0NDAtMWYzYy00OGY5LTljODAtY2Q5OTM1OTA4MTI3IiwiaWF0IjoxNzg4NTQ1MDIzLCJleHAiOjE3OTEwODY0MDB9.c_wHssxmEsOov3SaMGydB35BK_BZe9SzpLAtEvb7Bds';

    const response = await fetch(url, {
        method: 'PUT',
        headers: {
            'X-N8N-API-KEY': apiKey,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify({
            nodes: data.nodes,
            connections: data.connections,
            settings: { executionOrder: data.settings?.executionOrder || 'v1' },
            name: data.name
        })
    });

    if (response.ok) {
        console.log('Successfully updated NotiMan workflow in n8n!');
    } else {
        const errorText = await response.text();
        console.error('Failed to update workflow:', response.status, response.statusText, errorText);
    }
}

upload().catch(console.error);
