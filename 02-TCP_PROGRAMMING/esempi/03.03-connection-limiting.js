/**
 * 03.03 - Server with Connection Limiting
 * 
 * Server TCP che limita il numero massimo di connessioni simultanee.
 * Dimostra gestione delle risorse e protezione da overload.
 * 
 * Utilizzo:
 *   node 03.03-connection-limiting.js
 * 
 * Test:
 *   Apri più terminali con nc localhost 3102 per testare il limite
 */

const net = require('net');

// Configurazione
const PORT = 3102;
const HOST = '0.0.0.0';
const MAX_CONNECTIONS = 3;
const RATE_LIMIT_WINDOW = 60000; // 1 minuto
const MAX_REQUESTS_PER_WINDOW = 100;

// Statistiche
let connectionId = 0;
const activeConnections = new Map();
const connectionHistory = [];
const rateLimitMap = new Map(); // IP -> [timestamps]

// Verifica limite connessioni
function canAcceptConnection() {
    return activeConnections.size < MAX_CONNECTIONS;
}

// Rate limiting per IP
function checkRateLimit(ip) {
    const now = Date.now();
    
    if (!rateLimitMap.has(ip)) {
        rateLimitMap.set(ip, []);
    }
    
    const timestamps = rateLimitMap.get(ip);
    
    // Rimuovi timestamp vecchi
    const recent = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW);
    rateLimitMap.set(ip, recent);
    
    // Verifica limite
    if (recent.length >= MAX_REQUESTS_PER_WINDOW) {
        return false;
    }
    
    // Aggiungi nuovo timestamp
    recent.push(now);
    return true;
}

// Server
const server = net.createServer((socket) => {
    const clientIP = socket.remoteAddress;
    const clientPort = socket.remotePort;
    const clientAddr = `${clientIP}:${clientPort}`;
    
    console.log(`\n📞 Tentativo connessione da ${clientAddr}`);
    
    // Verifica limite connessioni
    if (!canAcceptConnection()) {
        console.log(`❌ [REJECT] Limite connessioni raggiunto (${MAX_CONNECTIONS})`);
        
        socket.write('='.repeat(60) + '\n');
        socket.write('❌ SERVER OVERLOADED\n');
        socket.write('='.repeat(60) + '\n');
        socket.write(`Too many connections. Current: ${activeConnections.size}/${MAX_CONNECTIONS}\n`);
        socket.write('Please try again later.\n');
        socket.write('='.repeat(60) + '\n');
        socket.end();
        
        return;
    }
    
    // Verifica rate limit
    if (!checkRateLimit(clientIP)) {
        console.log(`❌ [RATE LIMIT] ${clientIP} ha superato il limite`);
        
        socket.write('='.repeat(60) + '\n');
        socket.write('⚠️  RATE LIMIT EXCEEDED\n');
        socket.write('='.repeat(60) + '\n');
        socket.write(`Too many requests from ${clientIP}\n`);
        socket.write(`Limit: ${MAX_REQUESTS_PER_WINDOW} requests per ${RATE_LIMIT_WINDOW / 1000}s\n`);
        socket.write('Please wait and try again.\n');
        socket.write('='.repeat(60) + '\n');
        socket.end();
        
        return;
    }
    
    // Accetta connessione
    const connId = ++connectionId;
    
    const connection = {
        id: connId,
        socket: socket,
        connectedAt: Date.now(),
        ip: clientIP,
        port: clientPort,
        requestCount: 0,
        lastActivity: Date.now()
    };
    
    activeConnections.set(connId, connection);
    connectionHistory.push({
        id: connId,
        ip: clientIP,
        connectedAt: connection.connectedAt,
        disconnectedAt: null
    });
    
    console.log(`✅ [${connId}] Connessione accettata`);
    console.log(`📊 Connessioni: ${activeConnections.size}/${MAX_CONNECTIONS}`);
    
    // Benvenuto
    socket.write('='.repeat(60) + '\n');
    socket.write('CONNECTION LIMITING DEMO SERVER\n');
    socket.write('='.repeat(60) + '\n');
    socket.write(`Connection ID: ${connId}\n`);
    socket.write(`Server capacity: ${activeConnections.size}/${MAX_CONNECTIONS}\n`);
    socket.write(`Rate limit: ${MAX_REQUESTS_PER_WINDOW} requests/${RATE_LIMIT_WINDOW / 1000}s\n`);
    socket.write('='.repeat(60) + '\n\n');
    socket.write('Commands:\n');
    socket.write('  /status  - Show server status\n');
    socket.write('  /info    - Show your connection info\n');
    socket.write('  /ping    - Ping server\n');
    socket.write('  /quit    - Disconnect\n\n');
    
    // Gestione dati
    socket.on('data', (data) => {
        const message = data.toString().trim();
        connection.requestCount++;
        connection.lastActivity = Date.now();
        
        console.log(`📨 [${connId}] Request #${connection.requestCount}: ${message}`);
        
        switch (message.toLowerCase()) {
            case '/status':
                socket.write('\n📊 SERVER STATUS\n');
                socket.write('─'.repeat(60) + '\n');
                socket.write(`Connections: ${activeConnections.size}/${MAX_CONNECTIONS}\n`);
                socket.write(`Available slots: ${MAX_CONNECTIONS - activeConnections.size}\n`);
                socket.write(`Total connections served: ${connectionId}\n`);
                socket.write(`Rate limit: ${MAX_REQUESTS_PER_WINDOW}/${RATE_LIMIT_WINDOW / 1000}s\n`);
                socket.write('─'.repeat(60) + '\n\n');
                break;
            
            case '/info':
                const duration = ((Date.now() - connection.connectedAt) / 1000).toFixed(1);
                const rateLimitInfo = rateLimitMap.get(clientIP) || [];
                
                socket.write('\n📋 YOUR CONNECTION INFO\n');
                socket.write('─'.repeat(60) + '\n');
                socket.write(`Connection ID: ${connId}\n`);
                socket.write(`Your IP: ${clientIP}\n`);
                socket.write(`Connected for: ${duration}s\n`);
                socket.write(`Total requests: ${connection.requestCount}\n`);
                socket.write(`Rate limit usage: ${rateLimitInfo.length}/${MAX_REQUESTS_PER_WINDOW}\n`);
                socket.write('─'.repeat(60) + '\n\n');
                break;
            
            case '/ping':
                socket.write('pong\n');
                break;
            
            case '/quit':
                socket.write('Goodbye!\n');
                socket.end();
                break;
            
            default:
                socket.write(`Echo: ${message}\n`);
        }
    });
    
    // Timeout inattività (5 minuti)
    socket.setTimeout(300000);
    
    socket.on('timeout', () => {
        console.log(`⏰ [${connId}] Timeout inattività`);
        socket.write('\n⏰ Timeout per inattività. Disconnessione...\n');
        socket.end();
    });
    
    // Chiusura
    socket.on('close', () => {
        const duration = ((Date.now() - connection.connectedAt) / 1000).toFixed(1);
        
        console.log(`👋 [${connId}] Disconnesso (durata: ${duration}s, requests: ${connection.requestCount})`);
        console.log(`📊 Connessioni: ${activeConnections.size - 1}/${MAX_CONNECTIONS}`);
        
        activeConnections.delete(connId);
        
        // Aggiorna history
        const historyEntry = connectionHistory.find(c => c.id === connId);
        if (historyEntry) {
            historyEntry.disconnectedAt = Date.now();
        }
    });
    
    // Errori
    socket.on('error', (err) => {
        console.error(`❌ [${connId}] Error:`, err.message);
    });
});

// Report periodico
setInterval(() => {
    console.log('\n' + '='.repeat(60));
    console.log('📊 PERIODIC REPORT');
    console.log('='.repeat(60));
    console.log(`Active connections: ${activeConnections.size}/${MAX_CONNECTIONS}`);
    console.log(`Total connections served: ${connectionId}`);
    console.log(`Rate limit tracked IPs: ${rateLimitMap.size}`);
    
    if (activeConnections.size > 0) {
        console.log('\nActive connections:');
        for (const [id, conn] of activeConnections) {
            const duration = ((Date.now() - conn.connectedAt) / 1000).toFixed(0);
            const idle = ((Date.now() - conn.lastActivity) / 1000).toFixed(0);
            console.log(`  [${id}] ${conn.ip}:${conn.port} - ${duration}s (idle: ${idle}s, requests: ${conn.requestCount})`);
        }
    }
    
    console.log('='.repeat(60) + '\n');
}, 30000);

// Pulizia periodica rate limit
setInterval(() => {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [ip, timestamps] of rateLimitMap) {
        const recent = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW);
        
        if (recent.length === 0) {
            rateLimitMap.delete(ip);
            cleaned++;
        } else {
            rateLimitMap.set(ip, recent);
        }
    }
    
    if (cleaned > 0) {
        console.log(`🧹 Puliti ${cleaned} IP dal rate limit tracking`);
    }
}, RATE_LIMIT_WINDOW);

// Gestione errori server
server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`❌ Porta ${PORT} già in uso`);
    } else {
        console.error('❌ Errore server:', err.message);
    }
    process.exit(1);
});

// Avvio server
server.listen(PORT, HOST, () => {
    console.log('='.repeat(60));
    console.log('✅ CONNECTION LIMITING SERVER');
    console.log('='.repeat(60));
    console.log(`Address: ${HOST}:${PORT}`);
    console.log(`Max connections: ${MAX_CONNECTIONS}`);
    console.log(`Rate limit: ${MAX_REQUESTS_PER_WINDOW} requests/${RATE_LIMIT_WINDOW / 1000}s`);
    console.log(`Inactivity timeout: 300s`);
    console.log('='.repeat(60));
    console.log(`\n📝 Test: nc localhost ${PORT}`);
    console.log('💡 Apri più terminali per testare il limite\n');
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\n🛑 Shutting down...');
    
    // Notifica tutti i client
    for (const [id, conn] of activeConnections) {
        if (!conn.socket.destroyed) {
            conn.socket.write('\n⚠️  Server shutting down. Goodbye!\n');
            conn.socket.end();
        }
    }
    
    server.close(() => {
        console.log('✅ Server closed');
        console.log(`📊 Final stats: ${connectionId} total connections`);
        process.exit(0);
    });
});
