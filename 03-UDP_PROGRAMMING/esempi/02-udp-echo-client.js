/**
 * UDP Echo Client - Esempio Base
 * 
 * Caratteristiche:
 * - Invia messaggio a server UDP
 * - Riceve echo di risposta
 * - Gestisce timeout
 * 
 * Uso: node 02-udp-echo-client.js [messaggio]
 */

const dgram = require('dgram');

// Configurazione
const SERVER_HOST = 'localhost';
const SERVER_PORT = 41234;
const TIMEOUT = 5000; // 5 secondi

// Messaggio da inviare (da args o default)
const message = process.argv[2] || 'Hello UDP Server!';

// Crea socket client
const client = dgram.createSocket('udp4');

// Timer per timeout
let timeoutId;

// Evento: risposta ricevuta
client.on('message', (msg, rinfo) => {
    clearTimeout(timeoutId);
    
    console.log(`📥 Risposta ricevuta: "${msg}"`);
    console.log(`   Da: ${rinfo.address}:${rinfo.port}`);
    
    client.close();
});

// Evento: errore
client.on('error', (err) => {
    console.error('❌ Errore:', err);
    client.close();
});

// Invia messaggio
console.log(`📤 Invio messaggio: "${message}"`);
console.log(`   A: ${SERVER_HOST}:${SERVER_PORT}`);

const buffer = Buffer.from(message);
client.send(buffer, SERVER_PORT, SERVER_HOST, (err) => {
    if (err) {
        console.error('❌ Errore invio:', err);
        client.close();
        return;
    }
    
    console.log('✅ Messaggio inviato, in attesa risposta...');
    
    // Imposta timeout
    timeoutId = setTimeout(() => {
        console.error('⏰ Timeout: nessuna risposta dal server');
        client.close();
        process.exit(1);
    }, TIMEOUT);
});
