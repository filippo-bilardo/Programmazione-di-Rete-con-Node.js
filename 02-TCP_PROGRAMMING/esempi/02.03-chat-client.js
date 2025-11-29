/**
 * 02.03 - Chat Client
 * 
 * Client TCP per connettersi al chat server e chattare con altri utenti.
 * Dimostra la gestione asincrona di input utente e messaggi dal server.
 * 
 * Utilizzo:
 *   node 02.03-chat-client.js [username]
 * 
 * Prerequisito:
 *   Avvia prima il server: node 01.03-chat-server.js
 */

const net = require('net');
const readline = require('readline');

// Configurazione
const HOST = 'localhost';
const PORT = 3002;
const USERNAME = process.argv[2] || `User${Math.floor(Math.random() * 1000)}`;

// Interfaccia readline
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

let connected = false;
let authenticated = false;

console.log(`🔌 Connessione a ${HOST}:${PORT}...`);

// Connetti al server
const client = net.connect({ host: HOST, port: PORT });

// Evento: connesso
client.on('connect', () => {
    console.log('✅ Connesso al server!\n');
    connected = true;
});

// Evento: dati ricevuti
client.on('data', (data) => {
    const message = data.toString();
    
    // Pulisci la riga corrente
    process.stdout.clearLine();
    process.stdout.cursorTo(0);
    
    // Stampa il messaggio dal server
    process.stdout.write(message);
    
    // Se chiede username, invialo automaticamente
    if (message.includes('Inserisci il tuo username:')) {
        setTimeout(() => {
            client.write(USERNAME + '\n');
        }, 100);
        return;
    }
    
    // Se autenticato, mostra il prompt
    if (message.includes('Benvenuto') && !authenticated) {
        authenticated = true;
        setTimeout(() => {
            rl.setPrompt(`${USERNAME}> `);
            rl.prompt();
        }, 100);
    } else if (authenticated) {
        rl.prompt();
    }
});

// Evento: connessione chiusa
client.on('close', () => {
    console.log('\n👋 Disconnesso dal server');
    rl.close();
    process.exit(0);
});

// Evento: errore
client.on('error', (err) => {
    console.error('❌ Errore:', err.message);
    
    if (err.code === 'ECONNREFUSED') {
        console.error(`💡 Server non disponibile su ${HOST}:${PORT}`);
        console.error('   Avvia prima il server: node 01.03-chat-server.js');
    }
    
    rl.close();
    process.exit(1);
});

// Gestione input utente
rl.on('line', (input) => {
    const message = input.trim();
    
    if (!connected) {
        console.log('⚠️  Non ancora connesso');
        return;
    }
    
    if (message.length === 0) {
        rl.prompt();
        return;
    }
    
    // Comandi locali
    if (message === '/clear') {
        console.clear();
        rl.prompt();
        return;
    }
    
    // Invia al server
    client.write(message + '\n', (err) => {
        if (err) {
            console.error('❌ Errore invio:', err.message);
        }
    });
    
    // Non mostrare subito il prompt, aspetta conferma dal server
});

// Gestione chiusura
rl.on('close', () => {
    if (!client.destroyed) {
        client.end();
    }
});

// SIGINT (Ctrl+C)
process.on('SIGINT', () => {
    console.log('\n\n🛑 Disconnessione...');
    
    if (authenticated) {
        client.write('/quit\n');
    }
    
    setTimeout(() => {
        client.end();
        rl.close();
        process.exit(0);
    }, 100);
});

// Mostra istruzioni iniziali
console.log(`👤 Username: ${USERNAME}`);
console.log('💡 Comandi disponibili:');
console.log('   /help   - Mostra aiuto');
console.log('   /users  - Lista utenti online');
console.log('   /quit   - Esci dalla chat');
console.log('   /clear  - Pulisci schermo (locale)');
console.log('');
