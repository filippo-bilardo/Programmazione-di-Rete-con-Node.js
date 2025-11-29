/**
 * 03.02 - Server with Graceful Shutdown
 * 
 * Server TCP che implementa graceful shutdown con notifica ai client.
 * Dimostra la gestione corretta della chiusura del server.
 * 
 * Utilizzo:
 *   node 03.02-graceful-shutdown.js
 * 
 * Test:
 *   1. Connetti client: nc localhost 3101
 *   2. Premi Ctrl+C per shutdown
 *   3. Osserva la notifica e la chiusura ordinata
 */

const net = require('net');

// Configurazione
const PORT = 3101;
const HOST = '0.0.0.0';
const SHUTDOWN_TIMEOUT = 10000; // 10 secondi

// Stato del server
let isShuttingDown = false;
let connectionId = 0;
const activeConnections = new Map();

// Crea server
const server = net.createServer((socket) => {
    const connId = ++connectionId;
    
    // Non accettare nuove connessioni durante shutdown
    if (isShuttingDown) {
        socket.write('Server is shutting down. Please try again later.\n');
        socket.end();
        console.log(`❌ [${connId}] Connessione rifiutata (shutdown in corso)`);
        return;
    }
    
    const connection = {
        id: connId,
        socket: socket,
        connectedAt: Date.now(),
        address: `${socket.remoteAddress}:${socket.remotePort}`,
        pendingWork: false
    };
    
    activeConnections.set(connId, connection);
    
    console.log(`📥 [${connId}] Nuova connessione da ${connection.address}`);
    console.log(`📊 Connessioni attive: ${activeConnections.size}`);
    
    // Benvenuto
    socket.write('='.repeat(60) + '\n');
    socket.write('GRACEFUL SHUTDOWN DEMO SERVER\n');
    socket.write('='.repeat(60) + '\n\n');
    socket.write('Commands:\n');
    socket.write('  /work <seconds> - Simula lavoro lungo\n');
    socket.write('  /status         - Mostra stato\n');
    socket.write('  /quit           - Disconnetti\n\n');
    
    // Gestione dati
    socket.on('data', (data) => {
        const message = data.toString().trim();
        const [command, ...args] = message.split(' ');
        
        console.log(`📨 [${connId}] Command: ${command}`);
        
        switch (command.toLowerCase()) {
            case '/work': {
                const seconds = parseInt(args[0]) || 5;
                connection.pendingWork = true;
                
                socket.write(`⏳ Simulating work for ${seconds} seconds...\n`);
                
                setTimeout(() => {
                    connection.pendingWork = false;
                    if (!socket.destroyed) {
                        socket.write(`✅ Work completed!\n`);
                    }
                    console.log(`✅ [${connId}] Work completed`);
                }, seconds * 1000);
                
                break;
            }
            
            case '/status':
                socket.write(`\n📊 Status:\n`);
                socket.write(`  Connection ID: ${connId}\n`);
                socket.write(`  Connected for: ${((Date.now() - connection.connectedAt) / 1000).toFixed(0)}s\n`);
                socket.write(`  Pending work: ${connection.pendingWork ? 'Yes' : 'No'}\n`);
                socket.write(`  Server shutting down: ${isShuttingDown ? 'Yes' : 'No'}\n`);
                socket.write(`  Active connections: ${activeConnections.size}\n\n`);
                break;
            
            case '/quit':
                socket.write('Goodbye!\n');
                socket.end();
                break;
            
            default:
                socket.write(`Unknown command: ${command}\n`);
                socket.write('Type /help for commands\n\n');
        }
    });
    
    // Chiusura
    socket.on('close', () => {
        activeConnections.delete(connId);
        console.log(`👋 [${connId}] Disconnesso`);
        console.log(`📊 Connessioni attive: ${activeConnections.size}`);
        
        // Se in shutdown e nessuna connessione, chiudi il server
        if (isShuttingDown && activeConnections.size === 0) {
            console.log('✅ Tutte le connessioni chiuse');
            finalizeShutdown();
        }
    });
    
    // Errori
    socket.on('error', (err) => {
        console.error(`❌ [${connId}] Error:`, err.message);
    });
});

// Funzione per graceful shutdown
function gracefulShutdown(signal) {
    if (isShuttingDown) {
        console.log('⚠️  Shutdown già in corso...');
        return;
    }
    
    console.log(`\n📢 Ricevuto ${signal}, avvio graceful shutdown...`);
    isShuttingDown = true;
    
    // Stop accettare nuove connessioni
    server.close(() => {
        console.log('✅ Server non accetta più nuove connessioni');
    });
    
    // Notifica tutti i client connessi
    console.log(`📤 Notifica a ${activeConnections.size} client...`);
    
    for (const [id, conn] of activeConnections) {
        conn.socket.write('\n' + '='.repeat(60) + '\n');
        conn.socket.write('⚠️  SERVER SHUTTING DOWN\n');
        conn.socket.write('='.repeat(60) + '\n');
        
        if (conn.pendingWork) {
            conn.socket.write('💼 Hai lavoro in corso. Aspetterò che finisca.\n');
            conn.socket.write(`⏰ Tempo massimo: ${SHUTDOWN_TIMEOUT / 1000}s\n`);
        } else {
            conn.socket.write('📝 Puoi continuare a lavorare.\n');
            conn.socket.write(`⏰ Chiusura forzata tra ${SHUTDOWN_TIMEOUT / 1000}s\n`);
        }
        
        conn.socket.write('💡 Disconnetti quando pronto con /quit\n');
        conn.socket.write('='.repeat(60) + '\n\n');
    }
    
    // Timeout per chiusura forzata
    const shutdownTimer = setTimeout(() => {
        console.log('⏰ Timeout raggiunto, forzo chiusura...');
        forceClose();
    }, SHUTDOWN_TIMEOUT);
    
    // Controlla periodicamente se tutte le connessioni sono chiuse
    const checkInterval = setInterval(() => {
        console.log(`⏳ Connessioni attive: ${activeConnections.size}`);
        
        if (activeConnections.size === 0) {
            clearTimeout(shutdownTimer);
            clearInterval(checkInterval);
            console.log('✅ Tutte le connessioni chiuse naturalmente');
            finalizeShutdown();
        }
    }, 1000);
}

// Forza chiusura di tutte le connessioni
function forceClose() {
    console.log('🔨 Chiusura forzata di tutte le connessioni...');
    
    for (const [id, conn] of activeConnections) {
        if (!conn.socket.destroyed) {
            conn.socket.write('\n⏰ Timeout raggiunto. Disconnessione forzata.\n');
            conn.socket.destroy();
        }
    }
    
    finalizeShutdown();
}

// Finalizza lo shutdown
function finalizeShutdown() {
    console.log('\n📊 Statistiche finali:');
    console.log(`  Totale connessioni: ${connectionId}`);
    console.log(`  Connessioni attive: ${activeConnections.size}`);
    
    console.log('\n👋 Shutdown completato');
    process.exit(0);
}

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
    console.log(`✅ Server avviato su ${HOST}:${PORT}`);
    console.log(`📝 Test con: nc localhost ${PORT}`);
    console.log('🛑 Premi Ctrl+C per graceful shutdown');
});

// Gestione segnali
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
