/**
 * UDP Echo Server - Esempio Base
 * 
 * Caratteristiche:
 * - Riceve datagram UDP
 * - Rimanda echo al mittente
 * - Log di tutte le operazioni
 * 
 * Uso: node 01-udp-echo-server.js
 */

const dgram = require('dgram');

// Crea socket UDP IPv4
const server = dgram.createSocket('udp4');

// Evento: messaggio ricevuto
server.on('message', (msg, rinfo) => {
    console.log(`📥 Ricevuto: "${msg}" da ${rinfo.address}:${rinfo.port}`);
    
    // Echo: rimanda il messaggio al mittente
    server.send(msg, rinfo.port, rinfo.address, (err) => {
        if (err) {
            console.error('❌ Errore invio:', err);
        } else {
            console.log(`📤 Echo inviato a ${rinfo.address}:${rinfo.port}`);
        }
    });
});

// Evento: server pronto
server.on('listening', () => {
    const address = server.address();
    console.log(`✅ UDP Echo Server in ascolto su ${address.address}:${address.port}`);
});

// Evento: errore
server.on('error', (err) => {
    console.error('❌ Errore server:', err);
    server.close();
});

// Evento: chiusura
server.on('close', () => {
    console.log('🛑 Server chiuso');
});

// Bind su porta 41234
const PORT = 41234;
server.bind(PORT);

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n⏹️  Chiusura server...');
    server.close();
    process.exit(0);
});
