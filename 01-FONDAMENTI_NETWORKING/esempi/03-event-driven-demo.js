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
let clientCounter = 0;

// ============================================
// SERVER
// ============================================
const server = net.createServer();

// Evento: Server inizia ad ascoltare
server.on('listening', () => {
    const addr = server.address();
    console.log('🎧 SERVER LISTENING');
    console.log(`   Address: ${addr.address}`);
    console.log(`   Port: ${addr.port}`);
    console.log(`   Family: ${addr.family}\n`);
});

// Evento: Nuova connessione
server.on('connection', (socket) => {
    const clientId = ++clientCounter;
    const clientInfo = `${socket.remoteAddress}:${socket.remotePort}`;
    
    console.log(`\n✅ CONNECTION #${clientId}`);
    console.log(`   Client: ${clientInfo}`);
    console.log(`   Local: ${socket.localAddress}:${socket.localPort}`);
    
    // Socket Events
    
    // L'evento 'data' viene emesso quando arrivano dati
    socket.on('data', (chunk) => {
        console.log(`📩 DATA #${clientId} (${chunk.length} bytes)`);
        console.log(`   Content: "${chunk.toString().trim()}"`);
        
        // Echo back
        socket.write(`ECHO: ${chunk}`);
    });
    
    // L'evento 'drain' indica che il buffer di scrittura è stato svuotato
    socket.on('drain', () => {
        console.log(`💧 DRAIN #${clientId}`);
        console.log(`   Write buffer emptied`);
    });
    
    // L'evento 'end' indica che il client ha chiuso la connessione
    // a differenza di 'close', non indica errori
    socket.on('end', () => {
        console.log(`🔚 END #${clientId}`);
        console.log(`   Client closed connection`);
    });
    
    // L'evento 'close' indica che la connessione è stata chiusa
    // a differenza di 'end', può essere causato da errori
    socket.on('close', (hadError) => {
        console.log(`🚪 CLOSE #${clientId}`);
        console.log(`   Had error: ${hadError}`);
        console.log(`   Bytes read: ${socket.bytesRead}`);
        console.log(`   Bytes written: ${socket.bytesWritten}`);
    });
    
    socket.on('error', (err) => {
        console.log(`❌ ERROR #${clientId}`);
        console.log(`   Message: ${err.message}`);
        console.log(`   Code: ${err.code}`);
    });
    
    // L'evento 'timeout' indica che il socket è inattivo da troppo tempo
    socket.on('timeout', () => {
        console.log(`⏱️  TIMEOUT #${clientId}`);
        console.log(`   Idle timeout reached`);
        socket.end();
    });
    
    // Imposta timeout di 30 secondi
    socket.setTimeout(30000);
    
    // Messaggio di benvenuto
    socket.write(`Welcome! You are client #${clientId}\n`);
    socket.write('Type messages and see the events fired.\n');
    socket.write('Type "quit" to close connection.\n\n');
});

// Server Events

server.on('error', (err) => {
    console.log('❌ SERVER ERROR');
    console.log(`   Message: ${err.message}`);
    console.log(`   Code: ${err.code}`);
    
    if (err.code === 'EADDRINUSE') {
        console.log(`   Port ${PORT} is already in use`);
        process.exit(1);
    }
});

server.on('close', () => {
    console.log('\n🚪 SERVER CLOSED');
    console.log('   No longer accepting connections');
});

// Avvia server
server.listen(PORT, 'localhost');

// ============================================
// GRACEFUL SHUTDOWN
// Quando riceviamo SIGINT (Ctrl+C), chiudiamo il server
// ============================================
process.on('SIGINT', () => {
    console.log('\n\n⏹️  SHUTDOWN SIGNAL RECEIVED');
    console.log('   Closing server...');
    
    server.close(() => {
        console.log('   Server closed gracefully');
        process.exit(0);
    });
    
    // Force close after 5 seconds
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
