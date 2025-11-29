/**
 * 03.01 - Advanced Server with Statistics
 * 
 * Server TCP avanzato con sistema di statistiche in tempo reale.
 * Dimostra tracking delle connessioni, metriche e monitoring.
 * 
 * Utilizzo:
 *   node 03.01-advanced-server-stats.js
 * 
 * Features:
 *   - Statistiche in tempo reale
 *   - Tracking per connessione
 *   - Metriche aggregate
 *   - Dashboard web (porta 8080)
 */

const net = require('net');
const http = require('http');

// Configurazione
const TCP_PORT = 3100;
const HTTP_PORT = 8080;
const HOST = '0.0.0.0';

// Statistiche globali
const stats = {
    startTime: Date.now(),
    connections: {
        total: 0,
        current: 0,
        peak: 0
    },
    traffic: {
        bytesReceived: 0,
        bytesSent: 0,
        messagesReceived: 0,
        messagesSent: 0
    },
    errors: {
        total: 0,
        byType: {}
    }
};

// Connessioni attive
let connectionId = 0;
const activeConnections = new Map();

// Funzione per aggiornare statistiche
function recordConnection() {
    stats.connections.total++;
    stats.connections.current++;
    
    if (stats.connections.current > stats.connections.peak) {
        stats.connections.peak = stats.connections.current;
    }
}

function recordDisconnection() {
    stats.connections.current = Math.max(0, stats.connections.current - 1);
}

function recordTraffic(bytesReceived, bytesSent) {
    stats.traffic.bytesReceived += bytesReceived;
    stats.traffic.bytesSent += bytesSent;
}

function recordMessage(type) {
    if (type === 'received') {
        stats.traffic.messagesReceived++;
    } else {
        stats.traffic.messagesSent++;
    }
}

function recordError(errorType) {
    stats.errors.total++;
    stats.errors.byType[errorType] = (stats.errors.byType[errorType] || 0) + 1;
}

// Server TCP
const tcpServer = net.createServer((socket) => {
    const connId = ++connectionId;
    
    const connection = {
        id: connId,
        socket: socket,
        connectedAt: Date.now(),
        remoteAddress: socket.remoteAddress,
        remotePort: socket.remotePort,
        bytesReceived: 0,
        bytesSent: 0,
        messagesReceived: 0,
        messagesSent: 0,
        errors: 0
    };
    
    activeConnections.set(connId, connection);
    recordConnection();
    
    console.log(`📥 [${connId}] Nuova connessione da ${socket.remoteAddress}:${socket.remotePort}`);
    console.log(`📊 Connessioni: ${stats.connections.current} (peak: ${stats.connections.peak})`);
    
    // Benvenuto
    const welcome = `Welcome! Connection ID: ${connId}\n` +
                   `Commands: /stats /help /quit\n\n`;
    socket.write(welcome);
    connection.bytesSent += welcome.length;
    
    // Dati ricevuti
    socket.on('data', (data) => {
        const bytes = data.length;
        const message = data.toString().trim();
        
        connection.bytesReceived += bytes;
        connection.messagesReceived++;
        recordTraffic(bytes, 0);
        recordMessage('received');
        
        console.log(`📨 [${connId}] Received (${bytes} bytes): "${message}"`);
        
        // Comandi
        let response = '';
        
        switch (message.toLowerCase()) {
            case '/stats':
                response = generateStatsReport(connId);
                break;
                
            case '/help':
                response = 'Commands:\n' +
                          '  /stats - Show statistics\n' +
                          '  /help  - Show this help\n' +
                          '  /quit  - Disconnect\n\n';
                break;
                
            case '/quit':
                response = 'Goodbye!\n';
                socket.write(response);
                socket.end();
                return;
                
            default:
                response = `Echo: ${message}\n`;
        }
        
        socket.write(response);
        connection.bytesSent += response.length;
        connection.messagesSent++;
        recordTraffic(0, response.length);
        recordMessage('sent');
    });
    
    // Chiusura
    socket.on('close', () => {
        console.log(`👋 [${connId}] Disconnesso (durata: ${((Date.now() - connection.connectedAt) / 1000).toFixed(1)}s)`);
        console.log(`   Traffic: ${connection.bytesReceived} bytes RX, ${connection.bytesSent} bytes TX`);
        
        activeConnections.delete(connId);
        recordDisconnection();
    });
    
    // Errori
    socket.on('error', (err) => {
        console.error(`❌ [${connId}] Error:`, err.message);
        connection.errors++;
        recordError(err.code || 'UNKNOWN');
    });
});

// Funzione per generare report statistiche
function generateStatsReport(connId) {
    const uptime = ((Date.now() - stats.startTime) / 1000).toFixed(0);
    const connection = activeConnections.get(connId);
    
    let report = '\n' + '='.repeat(60) + '\n';
    report += 'SERVER STATISTICS\n';
    report += '='.repeat(60) + '\n\n';
    
    report += 'Server:\n';
    report += `  Uptime: ${uptime}s\n`;
    report += `  Start Time: ${new Date(stats.startTime).toLocaleString()}\n\n`;
    
    report += 'Connections:\n';
    report += `  Total: ${stats.connections.total}\n`;
    report += `  Current: ${stats.connections.current}\n`;
    report += `  Peak: ${stats.connections.peak}\n\n`;
    
    report += 'Traffic:\n';
    report += `  Bytes RX: ${stats.traffic.bytesReceived} (${(stats.traffic.bytesReceived / 1024).toFixed(2)} KB)\n`;
    report += `  Bytes TX: ${stats.traffic.bytesSent} (${(stats.traffic.bytesSent / 1024).toFixed(2)} KB)\n`;
    report += `  Messages RX: ${stats.traffic.messagesReceived}\n`;
    report += `  Messages TX: ${stats.traffic.messagesSent}\n\n`;
    
    if (connection) {
        const duration = ((Date.now() - connection.connectedAt) / 1000).toFixed(0);
        report += 'Your Connection:\n';
        report += `  ID: ${connId}\n`;
        report += `  Duration: ${duration}s\n`;
        report += `  Bytes RX: ${connection.bytesReceived}\n`;
        report += `  Bytes TX: ${connection.bytesSent}\n`;
        report += `  Messages RX: ${connection.messagesReceived}\n`;
        report += `  Messages TX: ${connection.messagesSent}\n\n`;
    }
    
    report += '='.repeat(60) + '\n\n';
    
    return report;
}

// Server HTTP per dashboard
const httpServer = http.createServer((req, res) => {
    if (req.url === '/stats') {
        const uptime = ((Date.now() - stats.startTime) / 1000).toFixed(0);
        
        const data = {
            uptime: uptime,
            connections: stats.connections,
            traffic: stats.traffic,
            errors: stats.errors,
            activeConnections: Array.from(activeConnections.values()).map(c => ({
                id: c.id,
                address: `${c.remoteAddress}:${c.remotePort}`,
                duration: ((Date.now() - c.connectedAt) / 1000).toFixed(0),
                bytesReceived: c.bytesReceived,
                bytesSent: c.bytesSent
            }))
        };
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data, null, 2));
    } else {
        // Dashboard HTML
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>TCP Server Dashboard</title>
                <style>
                    body { font-family: monospace; margin: 20px; background: #1e1e1e; color: #d4d4d4; }
                    h1 { color: #4ec9b0; }
                    .stats { background: #252526; padding: 15px; margin: 10px 0; border-radius: 5px; }
                    .value { color: #569cd6; font-size: 1.2em; }
                    button { background: #0e639c; color: white; border: none; padding: 10px 20px; cursor: pointer; border-radius: 3px; }
                    button:hover { background: #1177bb; }
                </style>
            </head>
            <body>
                <h1>📊 TCP Server Dashboard</h1>
                <button onclick="location.reload()">🔄 Refresh</button>
                <button onclick="fetch('/stats').then(r=>r.json()).then(d=>document.getElementById('json').textContent=JSON.stringify(d,null,2))">📋 Show JSON</button>
                <div id="stats"></div>
                <pre id="json" style="background: #252526; padding: 15px; border-radius: 5px;"></pre>
                <script>
                    fetch('/stats')
                        .then(r => r.json())
                        .then(data => {
                            document.getElementById('stats').innerHTML = \`
                                <div class="stats">
                                    <h2>Server</h2>
                                    <p>Uptime: <span class="value">\${data.uptime}s</span></p>
                                </div>
                                <div class="stats">
                                    <h2>Connections</h2>
                                    <p>Total: <span class="value">\${data.connections.total}</span></p>
                                    <p>Current: <span class="value">\${data.connections.current}</span></p>
                                    <p>Peak: <span class="value">\${data.connections.peak}</span></p>
                                </div>
                                <div class="stats">
                                    <h2>Traffic</h2>
                                    <p>Bytes RX: <span class="value">\${(data.traffic.bytesReceived/1024).toFixed(2)} KB</span></p>
                                    <p>Bytes TX: <span class="value">\${(data.traffic.bytesSent/1024).toFixed(2)} KB</span></p>
                                    <p>Messages RX: <span class="value">\${data.traffic.messagesReceived}</span></p>
                                    <p>Messages TX: <span class="value">\${data.traffic.messagesSent}</span></p>
                                </div>
                            \`;
                        });
                    setInterval(() => location.reload(), 5000);
                </script>
            </body>
            </html>
        `);
    }
});

// Avvio server TCP
tcpServer.listen(TCP_PORT, HOST, () => {
    console.log(`✅ TCP Server avviato su ${HOST}:${TCP_PORT}`);
});

// Avvio server HTTP
httpServer.listen(HTTP_PORT, () => {
    console.log(`✅ Dashboard HTTP su http://localhost:${HTTP_PORT}`);
    console.log(`📊 Stats API: http://localhost:${HTTP_PORT}/stats`);
});

// Report periodico
setInterval(() => {
    const uptime = ((Date.now() - stats.startTime) / 1000).toFixed(0);
    console.log(`\n📊 [${uptime}s] Connections: ${stats.connections.current}, Messages: ${stats.traffic.messagesReceived}/${stats.traffic.messagesSent}`);
}, 30000);

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\n🛑 Shutting down...');
    
    tcpServer.close(() => {
        httpServer.close(() => {
            console.log('✅ Servers closed');
            process.exit(0);
        });
    });
});
