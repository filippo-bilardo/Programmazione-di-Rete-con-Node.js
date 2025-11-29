/**
 * 01.01 - Echo Server Base
 * 
 * Server TCP che riceve messaggi dai client e li rispedisce indietro (echo).
 * Dimostra la creazione base di un server TCP con il modulo net.
 * 
 * Utilizzo:
 *   node 01.01-echo-server.js
 * 
 * Test con netcat:
 *   nc localhost 3000
 */

const net = require('net');

// Configurazione server
const PORT = 3000;
const HOST = '0.0.0.0';

// Crea il server
const server = net.createServer((socket) => {
    console.log('📥 Nuova connessione da:', 
        `${socket.remoteAddress}:${socket.remotePort}`);
    
    // Benvenuto al client
    socket.write('Benvenuto all\'Echo Server!\n');
    socket.write('Scrivi qualcosa e te lo rispedirò indietro.\n');
    socket.write('Digita "quit" per disconnetterti.\n\n');
    
    // Gestione dati ricevuti
    socket.on('data', (data) => {
        const message = data.toString().trim();
        
        console.log(`📨 Ricevuto: "${message}"`);
        
        // Se il client vuole disconnettersi
        if (message.toLowerCase() === 'quit') {
            socket.write('Arrivederci!\n');
            socket.end();
            return;
        }
        
        // Echo del messaggio
        socket.write(`Echo: ${message}\n`);
    });
    
    // Gestione chiusura connessione
    socket.on('close', () => {
        console.log('👋 Connessione chiusa:', 
            `${socket.remoteAddress}:${socket.remotePort}`);
    });
    
    // Gestione errori
    socket.on('error', (err) => {
        console.error('❌ Errore socket:', err.message);
    });
});

// Gestione errori del server
server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`❌ Porta ${PORT} già in uso`);
    } else {
        console.error('❌ Errore server:', err.message);
    }
    process.exit(1);
});

// Avvio del server
server.listen(PORT, HOST, () => {
    console.log(`✅ Echo Server avviato su ${HOST}:${PORT}`);
    console.log(`📝 Test con: nc localhost ${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\n🛑 Chiusura server...');
    
    server.close(() => {
        console.log('✅ Server chiuso');
        process.exit(0);
    });
});
