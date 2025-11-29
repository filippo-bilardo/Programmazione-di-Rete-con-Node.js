/**
 * 01.02 - Time Server
 * 
 * Server TCP che invia l'ora corrente ai client connessi.
 * Dimostra l'invio di dati dal server al client e la gestione
 * di connessioni multiple.
 * 
 * Utilizzo:
 *   node 01.02-time-server.js
 * 
 * Test con netcat:
 *   nc localhost 3001
 */

const net = require('net');

// Configurazione
const PORT = 3001;
const HOST = '0.0.0.0';

// Contatore connessioni
let connectionId = 0;
const activeConnections = new Map();

// Funzione per formattare la data/ora
function getCurrentTime() {
    const now = new Date();
    return now.toLocaleString('it-IT', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

// Crea il server
const server = net.createServer((socket) => {
    const connId = ++connectionId;
    
    // Registra la connessione
    activeConnections.set(connId, {
        socket: socket,
        connectedAt: Date.now(),
        address: `${socket.remoteAddress}:${socket.remotePort}`
    });
    
    console.log(`📥 [${connId}] Nuova connessione da:`, 
        socket.remoteAddress + ':' + socket.remotePort);
    console.log(`📊 Connessioni attive: ${activeConnections.size}`);
    
    // Invia l'ora corrente al client
    socket.write('='.repeat(60) + '\n');
    socket.write('⏰  TIME SERVER\n');
    socket.write('='.repeat(60) + '\n\n');
    socket.write(`Ora corrente: ${getCurrentTime()}\n\n`);
    
    // Invia aggiornamenti ogni secondo
    const interval = setInterval(() => {
        if (!socket.destroyed) {
            socket.write(`🕐 ${getCurrentTime()}\n`);
        }
    }, 1000);
    
    // Gestione comandi
    socket.on('data', (data) => {
        const command = data.toString().trim().toLowerCase();
        
        console.log(`📨 [${connId}] Comando: "${command}"`);
        
        switch (command) {
            case 'quit':
            case 'exit':
                socket.write('\n👋 Arrivederci!\n');
                socket.end();
                break;
                
            case 'help':
                socket.write('\n📖 Comandi disponibili:\n');
                socket.write('  help  - Mostra questo messaggio\n');
                socket.write('  stats - Mostra statistiche server\n');
                socket.write('  quit  - Disconnetti\n\n');
                break;
                
            case 'stats':
                socket.write('\n📊 Statistiche Server:\n');
                socket.write(`  Connessioni attive: ${activeConnections.size}\n`);
                socket.write(`  Tempo di connessione: ${((Date.now() - activeConnections.get(connId).connectedAt) / 1000).toFixed(0)}s\n`);
                socket.write(`  ID connessione: ${connId}\n\n`);
                break;
                
            default:
                socket.write(`❓ Comando sconosciuto: "${command}"\n`);
                socket.write('Digita "help" per i comandi disponibili\n\n');
        }
    });
    
    // Gestione chiusura
    socket.on('close', () => {
        clearInterval(interval);
        activeConnections.delete(connId);
        
        console.log(`👋 [${connId}] Connessione chiusa`);
        console.log(`📊 Connessioni attive: ${activeConnections.size}`);
    });
    
    // Gestione errori
    socket.on('error', (err) => {
        console.error(`❌ [${connId}] Errore:`, err.message);
        clearInterval(interval);
    });
});

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
    console.log(`✅ Time Server avviato su ${HOST}:${PORT}`);
    console.log(`📝 Test con: nc localhost ${PORT}`);
    console.log('⏰ Invio aggiornamenti ogni secondo');
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\n🛑 Chiusura server...');
    
    // Notifica tutti i client
    for (const [id, conn] of activeConnections) {
        conn.socket.write('\n⚠️  Server in chiusura...\n');
        conn.socket.end();
    }
    
    server.close(() => {
        console.log('✅ Server chiuso');
        process.exit(0);
    });
});
