const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

function main() {
    const inputPath = path.join(__dirname, 'REcepcionista.json');
    const outputPath = path.join(__dirname, 'REcepcionista.patched.json');
    
    let rawData = fs.readFileSync(inputPath, 'utf8');
    let workflow = JSON.parse(rawData);
    
    const nodes = workflow.nodes;
    const connections = workflow.connections;
    
    // 1. Update AI Agent System Message
    const aiAgentNode = nodes.find(n => n.name === 'AI Agent');
    if (aiAgentNode) {
        let systemMsg = aiAgentNode.parameters.options.systemMessage;
        
        // Fix turno auto-detection from time
        const turnoRule = `
⏰ DETECCIÓN AUTOMÁTICA DE TURNO:\nSi el cliente indica una hora que está entre las 11:00 y 15:00 (inclusive), el turno es AUTOMÁTICAMENTE "mediodia". Si la hora es entre las 19:00 y 01:00 (o sea, 19, 20, 21, 22, 23, 0, 1 hs), el turno es AUTOMÁTICAMENTE "cena". NO preguntes el turno si la hora ya lo indica claramente. Por ejemplo: "a las 21" = cena, "a las 13" = mediodía. Solo preguntá el turno si la hora está fuera de estos rangos o no fue indicada.\n`;
        if (!systemMsg.includes('DETECCIÓN AUTOMÁTICA DE TURNO')) {
            systemMsg = systemMsg.replace(
                '📅 FLUJO 1: RESERVAS DE MESA',
                turnoRule + '\n📅 FLUJO 1: RESERVAS DE MESA'
            );
        }

        // Fix Identificación inicial
        systemMsg = systemMsg.replace(
            "Identificación inicial: Si el cliente solo saluda, pregúntale amablemente si desea reservar una mesa o realizar un pedido.",
            "Identificación inicial: Si el cliente solo saluda (ej. \"Hola\"), pregúntale si desea reservar una mesa o realizar un pedido. Si el cliente ya expresa su intención directa (ej. \"Quiero hacer un pedido\"), NO repitas la pregunta inicial; asume la intención y procede inmediatamente a pedirle los detalles necesarios."
        );
        
        // Fix Cancelación
        systemMsg = systemMsg.replace(
            "❌ CANCELACIÓN DE RESERVA: Si el cliente pide cancelar, anular o liberar una reserva que ya hizo, pedile los datos para identificarla (nombre, teléfono, fecha o turno) y fijá \"cancelar_reserva\" en true recién cuando puedas identificarla con seguridad. Mientras falten datos, mantené false y preguntá. Confirmale al cliente que la cancelación fue realizada (o que estamos buscando su reserva). No combines cancelar_reserva con crear_reserva ni crear_pedido.",
            "❌ CANCELACIÓN DE RESERVA O PEDIDO: Si el cliente pide cancelar, anular o liberar una reserva O un pedido que ya hizo, el sistema lo identificará automáticamente por su número de WhatsApp. Fijá \"cancelar_reserva\" en true (si es reserva) o \"cancelar_pedido\" en true (si es pedido) INMEDIATAMENTE. NO le pidas nombre ni teléfono. IMPORTANTE: NUNCA confirmes que la cancelación fue exitosa. En su lugar, generá ÚNICAMENTE un 'mensaje_1' diciendo que vas a buscar su reserva o pedido en el sistema para cancelarlo, y dejá 'mensaje_2' y 'mensaje_3' COMPLETAMENTE VACÍOS. No combines cancelar_reserva con cancelar_pedido ni con crear."
        );
        
        aiAgentNode.parameters.options.systemMessage = systemMsg;
        console.log("Updated AI Agent System Message.");
    }
    
    // 2. Update Structured Output Parser
    const parserNode = nodes.find(n => n.name === 'Structured Output Parser');
    if (parserNode) {
        let schemaStr = parserNode.parameters.inputSchema;
        if (schemaStr.startsWith('=')) {
            let schema = JSON.parse(schemaStr.substring(1));
            schema.properties["cancelar_pedido"] = { "type": "boolean" };
            if (!schema.required.includes("cancelar_pedido")) {
                schema.required.push("cancelar_pedido");
            }
            parserNode.parameters.inputSchema = "=" + JSON.stringify(schema, null, 2);
            console.log("Updated Structured Output Parser schema.");
        }
    }
    
    // 3. Update Switch2 Node
    const switchNode = nodes.find(n => n.name === 'Switch2');
    if (switchNode) {
        const rules = switchNode.parameters.rules.values;
        const hasCancelarPedido = rules.some(r => 
            r.conditions.conditions[0].leftValue === "={{ $('AI Agent').item.json.output.cancelar_pedido }}"
        );
        
        if (!hasCancelarPedido) {
            rules.push({
                "conditions": {
                    "options": {
                        "caseSensitive": true,
                        "leftValue": "",
                        "typeValidation": "loose",
                        "version": 3
                    },
                    "conditions": [
                        {
                            "leftValue": "={{ $('AI Agent').item.json.output.cancelar_pedido }}",
                            "rightValue": "true",
                            "operator": {
                                "type": "string",
                                "operation": "equals"
                            },
                            "id": randomUUID()
                        }
                    ],
                    "combinator": "and"
                }
            });
            console.log("Added rule for cancelar_pedido to Switch2.");
        }
    }

    // 4. Duplicate Cancel Nodes for Pedido
    function duplicateNode(originalName, newName, yOffset) {
        const original = nodes.find(n => n.name === originalName);
        if (!original) throw new Error(`Node ${originalName} not found`);
        const newNode = JSON.parse(JSON.stringify(original));
        newNode.id = randomUUID();
        newNode.name = newName;
        newNode.position[1] += yOffset;
        nodes.push(newNode);
        return newNode;
    }
    
    try {
        const parsePedido = duplicateNode("Parse Cancelación", "Parse Cancelar Pedido", 300);
        const getPedidos = duplicateNode("Get Reservas Para Cancelar", "Get Pedidos Para Cancelar", 300);
        const buscarPedido = duplicateNode("Buscar Reserva Cliente", "Buscar Pedido Cliente", 300);
        const cancelarPedidoCondition = duplicateNode("¿Canceló ok?", "¿Cancelado Pedido ok?", 300);
        
        parsePedido.parameters.assignments.assignments[0].value = "={{ $('AI Agent').item.json.output.datos_pedido.nombre || '' }}";
        getPedidos.parameters.url = "https://firestore.googleapis.com/v1/projects/andimeet-93f62/databases/(default)/documents:runQuery";
        getPedidos.parameters.jsonBody = "={ \"structuredQuery\": { \"from\": [ { \"collectionId\": \"pedidos\" } ], \"where\": { \"fieldFilter\": { \"field\": { \"fieldPath\": \"pedidoEstado\" }, \"op\": \"IN\", \"value\": { \"arrayValue\": { \"values\": [ { \"stringValue\": \"pendiente\" }, { \"stringValue\": \"preparacion\" }, { \"stringValue\": \"en_camino\" } ] } } } } } }";
        getPedidos.parameters.method = "POST";
        getPedidos.parameters.sendBody = true;
        getPedidos.parameters.authentication = "predefinedCredentialType";
        getPedidos.parameters.nodeCredentialType = "googleApi";
        getPedidos.credentials = { "googleApi": { "id": "kFgHEL7B3y3uwMYr", "name": "Firebase Service Account Auto" } };
        
        let getReservas = workflow.nodes.find(n => n.name === 'Get Reservas Para Cancelar');
        if (getReservas) {
            getReservas.credentials = { "googleApi": { "id": "kFgHEL7B3y3uwMYr", "name": "Firebase Service Account Auto" } };
        }

        let buscarJs = buscarPedido.parameters.jsCode;
        buscarJs = buscarJs.replace(/Parse Cancelación/g, 'Parse Cancelar Pedido');
        buscarJs = buscarJs.replace(/Get Reservas Para Cancelar/g, 'Get Pedidos Para Cancelar');
        buscarJs = buscarJs.replace(/reservation_id:/g, 'pedido_id:');
        // Fix: use .all() to get all runQuery results, not just first
        buscarJs = buscarJs.replace(
            `const raw = $('Get Pedidos Para Cancelar').item.json;`,
            `const allRaw = $('Get Pedidos Para Cancelar').all();
const raw = allRaw.map(i => i.json);`
        );
        buscarPedido.parameters.jsCode = buscarJs;

        // Fix Buscar Reserva Cliente to also use .all()
        const buscarReserva = workflow.nodes.find(n => n.name === 'Buscar Reserva Cliente');
        if (buscarReserva) {
            buscarReserva.parameters.jsCode = buscarReserva.parameters.jsCode.replace(
                `const raw = $('Get Reservas Para Cancelar').item.json;`,
                `const allRaw = $('Get Reservas Para Cancelar').all();
const raw = allRaw.map(i => i.json);`
            );
        }
        
        const pr = nodes.find(n => n.name === "Cancelar Reserva Firestore");
        if (pr) {
            const patchPedido = JSON.parse(JSON.stringify(pr));
            patchPedido.id = randomUUID();
            patchPedido.name = "Cancelar Pedido en Firestore";
            patchPedido.position[1] += 300;
            patchPedido.parameters.url = "=https://firestore.googleapis.com/v1/projects/andimeet-93f62/databases/(default)/documents/pedidos/{{ $('Buscar Pedido Cliente').item.json.pedido_id }}?updateMask.fieldPaths=pedidoEstado";
            patchPedido.parameters.jsonBody = "={{ JSON.stringify({ fields: { pedidoEstado: { stringValue: 'cancelado' } } }) }}";
            nodes.push(patchPedido);
        } else {
            console.log("Could not find Cancelar Reserva Firestore node by name.");
        }
        
        const buildMsg = duplicateNode("Build Cancel Message", "Build Cancel Pedido Message", 300);
        buildMsg.parameters.jsCode = `const found = $('Buscar Pedido Cliente').item.json.found;\nconst cancelName = $('Parse Cancelar Pedido').item.json.cancel_nombre || '';\nconst nameStr = cancelName ? \`, \${cancelName.charAt(0).toUpperCase() + cancelName.slice(1)}\` : '';\n\nif (found) {\n    const successMessages = [\n        \`¡Listo\${nameStr}! Ya cancelamos tu pedido. ¡Gracias por avisarnos con tiempo! 🙌\`,\n        \`Pedido cancelado exitosamente\${nameStr}. ¡Esperamos que vuelvas a elegirnos pronto! ✨\`,\n        \`¡Perfecto\${nameStr}! Acabo de dar de baja tu pedido. ¡Que tengas un excelente día! 🍷\`\n    ];\n    return [{ json: { mensaje: successMessages[Math.floor(Math.random() * successMessages.length)] } }];\n} else {\n    const failMessages = [\n        \`Revisé el sistema pero no encontré ningún pedido activo vinculado a tu número\${nameStr}. ¿Puede ser que hayas pedido con otro teléfono? 🤔\`,\n        \`No me figura ningún pedido activo en este momento. Si lo hiciste con otro celular, pasámelo y lo verifico. 👇\`,\n        \`Me fijé en el sistema pero no hay pedidos activos asociados a este número. Si usaste otro teléfono, decime cuál es así lo busco. 🧐\`\n    ];\n    return [{ json: { mensaje: failMessages[Math.floor(Math.random() * failMessages.length)] } }];\n}`;
        // Remove assignment parameter because the original was a Code node probably. Wait, "Build Cancel Message" is a code node:
        // "jsCode": "const found = $('Buscar Reserva Cliente').item.json.found;\nreturn [{ json: { mensaje: found ? '✅ Tu reserva fue cancelada... "
        // So I just override jsCode.
        
        const sendMsg = duplicateNode("Send Cancel WhatsApp", "Send Cancel Pedido WhatsApp", 300);
        // The original Send Cancel WhatsApp uses messageText = "={{ $('Build Cancel Message').item.json.mensaje }}"
        sendMsg.parameters.messageText = "={{ $('Build Cancel Pedido Message').item.json.mensaje }}";
        
        const sendError = duplicateNode("Send Cancel Error", "Send Cancel Pedido Error", 300);
        // Uses static text "Lo sentimos..."

        console.log("Created all new nodes for canceling pedido.");

        // 5. Connections for new nodes
        function connect(sourceNode, sourceIndex, targetNode, targetIndex = 0) {
            if (!connections[sourceNode]) connections[sourceNode] = { main: [] };
            while (connections[sourceNode].main.length <= sourceIndex) {
                connections[sourceNode].main.push([]);
            }
            connections[sourceNode].main[sourceIndex].push({
                node: targetNode,
                type: "main",
                index: targetIndex
            });
        }
        
        connect("Switch2", 4, "Parse Cancelar Pedido");
        connect("Parse Cancelar Pedido", 0, "Get Pedidos Para Cancelar");
        connect("Get Pedidos Para Cancelar", 0, "Buscar Pedido Cliente");
        connect("Buscar Pedido Cliente", 0, "Cancelar Pedido en Firestore"); // Wait, original goes to Cancelar Reserva Firestore.
        connect("Cancelar Pedido en Firestore", 0, "¿Cancelado Pedido ok?");
        connect("¿Cancelado Pedido ok?", 0, "Build Cancel Pedido Message");

        // Fix missing mesa_res_id error
        const tieneMesa = {
            "parameters": {
                "conditions": {
                    "options": {
                        "caseSensitive": true,
                        "leftValue": "",
                        "typeValidation": "strict",
                        "version": 2
                    },
                    "conditions": [
                        {
                            "id": "c-1",
                            "leftValue": "={{ $('Buscar Reserva Cliente').item.json.mesa_res_id }}",
                            "rightValue": "",
                            "operator": {
                                "type": "string",
                                "operation": "notEmpty",
                                "name": "filter.operator.notEmpty"
                            }
                        }
                    ],
                    "combinator": "and"
                },
                "options": {}
            },
            "id": "b321a654-e0b4-4b56-1111-fcae393fca1e",
            "name": "¿Tiene Mesa?",
            "type": "n8n-nodes-base.if",
            "typeVersion": 2.2,
            "position": [ 3100, 300 ]
        };
        workflow.nodes.push(tieneMesa);
        workflow.connections["¿Canceló ok?"] = {
            "main": [
                [ { "node": "¿Tiene Mesa?", "type": "main", "index": 0 } ],
                [ { "node": "Send Cancel Error", "type": "main", "index": 0 } ]
            ]
        };
        workflow.connections["¿Tiene Mesa?"] = {
            "main": [
                [ { "node": "Liberar Mesa de Reserva", "type": "main", "index": 0 } ],
                [ { "node": "Build Cancel Message", "type": "main", "index": 0 } ]
            ]
        };
 
        connect("¿Cancelado Pedido ok?", 1, "Send Cancel Pedido Error"); 
        connect("Build Cancel Pedido Message", 0, "Send Cancel Pedido WhatsApp");
        
        console.log("Wired connections for Cancelar Pedido branch.");

    } catch (e) {
        console.error("Error creating nodes: ", e);
    }
    
    fs.writeFileSync(outputPath, JSON.stringify(workflow, null, 2), 'utf8');
    console.log("Successfully wrote REcepcionista.patched.json");
}

main();
