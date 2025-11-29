/**
 * 04.01 - Client with Auto-Reconnection
 * 
 * Client TCP con riconnessione automatica ed exponential backoff.
 * Dimostra gestione resiliente delle connessioni.
 * 
 * Utilizzo:
 *   node 04.01-auto-reconnect-client.js
 * 
 * Test:
 *   1. Avvia il client (senza server)
 *   2. Osserva i tentativi di riconnessione
 *   3. Avvia il server: node 01.01-echo-server.js
 *   4. Osserva la connessione riuscita
 */

const net = require('net');
const readline = require('readline');

// Configurazione
const HOST = 'localhost';
const PORT = 3000;
const MAX_RETRIES = 10;
const INITIAL_DELAY = 1000; // 1 secondo
const MAX_DELAY = 30000; // 30 secondi
const BACKOFF_MULTIPLIER = 2;
const JITTER = 0.1; // 10% jitter

// Stato del client
let client = null;
let isConnected = false;
let retryCount = 0;
let currentDelay = INITIAL_DELAY;
let reconnectTimer = null;
let isShuttingDown = false;

// Interfaccia readline
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Calcola delay con exponential backoff e jitter
function calculateDelay() {
    // Exponential backoff
    let delay = Math.min(INITIAL_DELAY * Math.pow(BACKOFF_MULTIPLIER, retryCount), MAX_DELAY);
    
    // Aggiungi jitter (randomness)
    const jitterAmount = delay * JITTER;
    delay = delay + (Math.random() * jitterAmount * 2 - jitterAmount);
    
    return Math.floor(delay);
}

// Funzione di connessione
function connect() {
    if (isShuttingDown) {
        return;
    }
    
    console.log(`\n🔌 [Attempt ${retryCount + 1}/${MAX_RETRIES}] Connessione a ${HOST}:${PORT}...`);
    
    client = net.connect({ host: HOST, port: PORT });
    
    // Timeout connessione
    client.setTimeout(5000);
    
    // Connesso
    client.on('connect', () => {
        console.log('✅ Connesso al server!\n');
        isConnected = true;
        retryCount = 0;
        currentDelay = INITIAL_DELAY;
        
        // Disabilita timeout dopo connessione
        client.setTimeout(0);
        
        // Mostra prompt
        rl.setPrompt('> ');
        rl.prompt();
    });
    
    // Dati ricevuti
    client.on('data', (data) => {
        const message = data.toString().trim();
        
        // Pulisci la riga e stampa
        process.stdout.clearLine();
        process.stdout.cursorTo(0);
        console.log(`📥 ${message}`);
        
        if (isConnected) {
            rl.prompt();
        }
    });
    
    // Timeout
    client.on('timeout', () => {
        console.log('⏰ Timeout connessione');
        client.destroy();
    });
    
    // Errore
    client.on('error', (err) => {
        if (err.code === 'ECONNREFUSED') {
            console.log(`❌ Connessione rifiutata`);
        } else if (err.code === 'ETIMEDOUT') {
            console.log(`❌ Timeout`);
        } else {
            console.log(`❌ Errore: ${err.message}`);
        }
        
        // Il reconnect sarà gestito dall'evento 'close'
    });
    
    // Chiusura
    client.on('close', () => {
        const wasConnected = isConnected;
        isConnected = false;
        
        if (wasConnected) {
            console.log('\n👋 Connessione chiusa');
        }
        
        // Riconnetti se non stiamo chiudendo
        if (!isShuttingDown) {
            scheduleReconnect();
        }
    });
}

// Pianifica riconnessione
function scheduleReconnect() {
    if (retryCount >= MAX_RETRIES) {
        console.log(`\n❌ Numero massimo di tentativi raggiunto (${MAX_RETRIES})`);
        console.log('💡 Riavvia il client manualmente');
        shutdown();
        return;
    }
    
    currentDelay = calculateDelay();
    retryCount++;
    
    console.log(`⏳ Prossimo tentativo tra ${(currentDelay / 1000).toFixed(1)}s...`);
    
    reconnectTimer = setTimeout(() => {
        connect();
    }, currentDelay);
}

// Gestione input
rl.on('line', (input) => {
    const message = input.trim();
    
    if (!isConnected) {
        console.log('⚠️  Non connesso. Attendi la riconnessione...');
        return;
    }
    
    if (message.length === 0) {
        rl.prompt();
        return;
    }
    
    if (message.toLowerCase() === 'exit') {
        shutdown();
        return;
    }
    
    // Invia messaggio
    client.write(message + '\n', (err) => {
        if (err) {
            console.error('❌ Errore invio:', err.message);
        }
    });
});

// Shutdown
function shutdown() {
    if (isShuttingDown) {
        return;
    }
    
    isShuttingDown = true;
    console.log('\n👋 Disconnessione...');
    
    // Cancella timer riconnessione
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
    }
    
    // Chiudi connessione
    if (client && !client.destroyed) {
        if (isConnected) {
            client.write('quit\n');
        }
        client.end();
    }
    
    rl.close();
    
    setTimeout(() => {
        process.exit(0);
    }, 500);
}

// SIGINT
process.on('SIGINT', () => {
    console.log('\n\n🛑 Interruzione...');
    shutdown();
});

// Avvio
console.log('='.repeat(60));
console.log('AUTO-RECONNECT CLIENT');
console.log('='.repeat(60));
console.log(`Target: ${HOST}:${PORT}`);
console.log(`Max retries: ${MAX_RETRIES}`);
console.log(`Initial delay: ${INITIAL_DELAY}ms`);
console.log(`Max delay: ${MAX_DELAY}ms`);
console.log(`Backoff multiplier: ${BACKOFF_MULTIPLIER}`);
console.log('='.repeat(60));
console.log('\n💡 Il client tenterà di riconnettersi automaticamente');
console.log('💡 Digita "exit" per uscire\n');

// Prima connessione
connect();
