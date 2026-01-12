/**
 * Esempio 03 - Event-Driven Socket Demo
 * 
 * Dimostrazione di:
 * - Tutti gli eventi principali di un socket
 * - Event lifecycle
 * - Event emitter pattern
 * - Gestione eventi multipli
 * 
 * Uso:
 *   node 03-event-driven-demo.js
 * Test con netcat:
 *  nc localhost 3002
 *  Digita messaggi e osserva gli eventi
 * Test con 01-simple-client.js:
 *  node 01-simple-client.js
 * 
 * Se vuoi usare la stessa shell sia come client e server,
 *   node 03-event-driven-demo.js &
 *   nc localhost 3002
 * per chiudere il client, digita "quit" o premi Ctrl+D
 * per chiudere il server, digita fg per portarlo in foreground e poi Ctrl+C
 * 
 */

const net = require('net');

const PORT = 3002;
// Contatore per identificare univocamente ogni client connesso
let clientCounter = 0;

// ============================================
// SERVER
// ============================================
// Crea server TCP senza callback nel costruttore
// Gli eventi saranno registrati separatamente per scopo didattico
const server = net.createServer();

// Evento 'listening': emesso quando il server è pronto ad accettare connessioni
// Questo avviene dopo la chiamata a server.listen()
server.on('listening', () => {
    // address() restituisce informazioni sul binding del server
    const addr = server.address();
    console.log('🎧 SERVER LISTENING');
    console.log(`   Address: ${addr.address}`);
    console.log(`   Port: ${addr.port}`);
    console.log(`   Family: ${addr.family}\n`);
});

// Evento 'connection': emesso quando un client completa il three-way handshake
// Questo è il momento in cui la connessione TCP è stabilita
server.on('connection', (socket) => {
    const clientId = ++clientCounter;
    const clientInfo = `${socket.remoteAddress}:${socket.remotePort}`;
    
    console.log(`\n✅ CONNECTION #${clientId}`);
    console.log(`   Client: ${clientInfo}`);
    console.log(`   Local: ${socket.localAddress}:${socket.localPort}`);
    
    // ===== SOCKET EVENTS =====
    // Ogni socket ha il proprio lifecycle di eventi
    
    // Evento 'data': emesso quando arrivano dati sul socket
    // I dati arrivano come Buffer e possono essere frammentati (TCP è stream-based)
    socket.on('data', (chunk) => {
        console.log(`📩 DATA #${clientId} (${chunk.length} bytes)`);
        console.log(`   Content: "${chunk.toString().trim()}"`);
        
        // Echo back: rimanda i dati ricevuti al client
        socket.write(`ECHO: ${chunk}`);
    });
    
    // Evento 'drain': emesso quando il buffer di scrittura si svuota
    // Importante per il flow control: se write() ritorna false, significa che
    // il buffer è pieno; attendi 'drain' prima di scrivere altro
    socket.on('drain', () => {
        console.log(`💧 DRAIN #${clientId}`);
        console.log(`   Write buffer emptied`);
    });
    
    // Evento 'end': il peer ha inviato un pacchetto FIN (chiusura ordinata)
    // Significa che il client non invierà più dati, ma può ancora riceverne
    // Questo è diverso da 'close' che indica la chiusura completa del socket
    socket.on('end', () => {
        console.log(`🔚 END #${clientId}`);
        console.log(`   Client closed connection`);
    });
    
    // Evento 'close': il socket è stato completamente chiuso
    // hadError indica se la chiusura è avvenuta per un errore
    // Questo evento viene sempre emesso, anche dopo 'end' o 'error'
    socket.on('close', (hadError) => {
        console.log(`🚪 CLOSE #${clientId}`);
        console.log(`   Had error: ${hadError}`);
        console.log(`   Bytes read: ${socket.bytesRead}`);
        console.log(`   Bytes written: ${socket.bytesWritten}`);
    });
    
    // Evento 'error': emesso quando si verifica un errore sul socket
    // Esempi: ECONNRESET (connessione resettata dal peer),
    //         EPIPE (scrittura su socket chiuso)
    // Dopo 'error' viene sempre emesso 'close' con hadError=true
    socket.on('error', (err) => {
        console.log(`❌ ERROR #${clientId}`);
        console.log(`   Message: ${err.message}`);
        console.log(`   Code: ${err.code}`);
    });
    
    // Evento 'timeout': emesso quando il socket è inattivo oltre il tempo impostato
    // ATTENZIONE: 'timeout' NON chiude automaticamente il socket!
    // È responsabilità del programmatore chiamare socket.end() o socket.destroy()
    socket.on('timeout', () => {
        console.log(`⏱️  TIMEOUT #${clientId}`);
        console.log(`   Idle timeout reached`);
        // Chiude la connessione in modo ordinato dopo il timeout
        socket.end();
    });
    
    // setTimeout() imposta il periodo di inattività (in millisecondi)
    // Dopo 30 secondi senza attività, verrà emesso l'evento 'timeout'
    socket.setTimeout(30000);
    
    // Messaggio di benvenuto
    socket.write(`Welcome! You are client #${clientId}\n`);
    socket.write('Type messages and see the events fired.\n');
    socket.write('Type "quit" to close connection.\n\n');
});

// ===== SERVER EVENTS =====
// Eventi a livello di server (non di singola connessione)

// Evento 'error': errori del server (non dei singoli socket)
server.on('error', (err) => {
    console.log('❌ SERVER ERROR');
    console.log(`   Message: ${err.message}`);
    console.log(`   Code: ${err.code}`);
    
    // EADDRINUSE: la porta è già in uso da un altro processo
    if (err.code === 'EADDRINUSE') {
        console.log(`   Port ${PORT} is already in use`);
        process.exit(1);
    }
});

// Evento 'close': il server ha smesso di accettare nuove connessioni
// Le connessioni esistenti possono continuare a funzionare
server.on('close', () => {
    console.log('\n🚪 SERVER CLOSED');
    console.log('   No longer accepting connections');
});

// Avvia il server: bind sulla porta e inizia ad ascoltare
server.listen(PORT, 'localhost');

// ============================================
// GRACEFUL SHUTDOWN
// Pattern per chiudere il server in modo pulito
// ============================================
// SIGINT è il segnale inviato con Ctrl+C
process.on('SIGINT', () => {
    console.log('\n\n⏹️  SHUTDOWN SIGNAL RECEIVED');
    console.log('   Closing server...');
    
    // close() smette di accettare nuove connessioni
    // Il callback viene eseguito quando tutte le connessioni esistenti sono chiuse
    server.close(() => {
        console.log('   Server closed gracefully');
        process.exit(0);
    });
    
    // Timeout di sicurezza: forza la chiusura dopo 5 secondi
    // Previene blocchi se ci sono connessioni che non si chiudono
    setTimeout(() => {
        console.log('   Forcing shutdown...');
        process.exit(1);
    }, 5000);
});

// ============================================
// INFO
// ============================================
console.log('\n' + '='.repeat(50));
console.log('EVENT-DRIVEN SOCKET DEMO');
console.log('='.repeat(50));
console.log('\nThis demo shows all socket events.');
console.log('\nTo test:');
console.log('1. Connect with: nc localhost 3002');
console.log('2. Type messages');
console.log('3. Type "quit" or press Ctrl+D to disconnect');
console.log('4. Press Ctrl+C to shutdown server\n');
console.log('='.repeat(50) + '\n');
