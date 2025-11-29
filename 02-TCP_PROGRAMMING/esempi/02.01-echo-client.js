/**
 * 02.01 - Echo Client Base
 * 
 * Client TCP che si connette a un server echo e invia messaggi interattivi.
 * Dimostra la connessione base a un server TCP e l'uso di readline per input utente.
 * 
 * Utilizzo:
 *   node 02.01-echo-client.js
 * 
 * Prerequisito:
 *   Avvia prima il server: node 01.01-echo-server.js
 */

const net = require('net');
const readline = require('readline');

// Configurazione
const HOST = 'localhost';
const PORT = 3000;

// Crea interfaccia readline
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '> '
});

// Connessione al server
console.log(`🔌 Connessione a ${HOST}:${PORT}...`);

const client = net.connect({ host: HOST, port: PORT });

// Evento: connessione stabilita
client.on('connect', () => {
    console.log('✅ Connesso al server!\n');
    
    // Avvia il prompt
    rl.prompt();
});

// Evento: dati ricevuti dal server
client.on('data', (data) => {
    const message = data.toString().trim();
    
    // Pulisci la riga corrente e stampa il messaggio
    process.stdout.clearLine();
    process.stdout.cursorTo(0);
    console.log(`📥 ${message}`);
    
    // Ripristina il prompt
    rl.prompt();
});

// Evento: connessione chiusa
client.on('close', () => {
    console.log('\n👋 Connessione chiusa dal server');
    rl.close();
    process.exit(0);
});

// Evento: errore connessione
client.on('error', (err) => {
    console.error('❌ Errore connessione:', err.message);
    
    if (err.code === 'ECONNREFUSED') {
        console.error(`💡 Assicurati che il server sia in esecuzione su ${HOST}:${PORT}`);
    }
    
    rl.close();
    process.exit(1);
});

// Evento: timeout
client.on('timeout', () => {
    console.error('⏰ Timeout connessione');
    client.destroy();
});

// Gestione input utente
rl.on('line', (input) => {
    const message = input.trim();
    
    if (message.length === 0) {
        rl.prompt();
        return;
    }
    
    // Comandi speciali
    if (message.toLowerCase() === 'exit') {
        console.log('👋 Disconnessione...');
        client.write('quit\n');
        return;
    }
    
    // Invia il messaggio al server
    client.write(message + '\n', (err) => {
        if (err) {
            console.error('❌ Errore invio:', err.message);
        }
    });
});

// Gestione chiusura readline
rl.on('close', () => {
    if (!client.destroyed) {
        client.end();
    }
});

// Gestione SIGINT (Ctrl+C)
process.on('SIGINT', () => {
    console.log('\n\n🛑 Interruzione...');
    client.end();
    rl.close();
});
