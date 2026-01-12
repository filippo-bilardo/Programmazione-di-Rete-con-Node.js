/**
 * Esempio 02 - UDP Echo Server e Client
 * 
 * Dimostrazione di:
 * - Differenza tra TCP e UDP
 * - Server UDP (connectionless)
 * - Client UDP
 * - Invio datagrammi
 * 
 * Uso:
 *   node 02-udp-echo.js server
 *   node 02-udp-echo.js client
 */

// Modulo 'dgram' di Node.js per comunicazione UDP (User Datagram Protocol)
// UDP è connectionless, più veloce ma meno affidabile di TCP
const dgram = require('dgram');
const readline = require('readline');

const PORT = 3001;
const HOST = 'localhost';

// ============================================
// SERVER UDP
// ============================================
function startServer() {
    // createSocket() crea un socket UDP
    // 'udp4' indica IPv4, esiste anche 'udp6' per IPv6
    // A differenza di TCP, non c'è concetto di "connessione"
    const server = dgram.createSocket('udp4');
    
    // Evento 'listening': il socket è pronto a ricevere datagrammi
    server.on('listening', () => {
        const address = server.address();
        console.log(`🚀 Server UDP in ascolto su ${address.address}:${address.port}`);
        console.log('In attesa di datagrammi...\n');
    });
    
    // Evento 'message': si attiva quando arriva un datagramma UDP
    // msg: Buffer contenente i dati ricevuti
    // rinfo: oggetto con informazioni sul mittente (address, port, family, size)
    server.on('message', (msg, rinfo) => {
        const message = msg.toString().trim();
        console.log(`📩 Ricevuto da ${rinfo.address}:${rinfo.port}: ${message}`);
        
        // Echo: rimanda lo stesso messaggio
        // In UDP ogni messaggio è un datagramma indipendente
        const response = Buffer.from('ECHO: ' + message);
        // send() invia un datagramma UDP all'indirizzo specificato
        // Non c'è garanzia di consegna né di ordine (caratteristica UDP)
        server.send(response, rinfo.port, rinfo.address, (err) => {
            if (err) {
                console.error('❌ Errore invio:', err.message);
            }
        });
    });
    
    // Gestione errori UDP (es: porta già in uso)
    server.on('error', (err) => {
        console.error('❌ Errore server:', err.message);
        server.close();
    });
    
    // bind() associa il socket alla porta specificata
    // In UDP non c'è listen(), basta fare bind per ricevere datagrammi
    server.bind(PORT, HOST);
}

// ============================================
// CLIENT UDP
// ============================================
function startClient() {
    // Crea un socket UDP per il client
    // Non serve "connettersi" come in TCP, UDP è connectionless
    const client = dgram.createSocket('udp4');
    
    console.log(`📡 Client UDP pronto per inviare a ${HOST}:${PORT}\n`);
    console.log('Digita un messaggio e premi INVIO (o "exit" per uscire):\n');
    
    // Evento 'message': ricezione risposta dal server
    // In UDP ogni datagramma è indipendente, non c'è stream come in TCP
    client.on('message', (msg, rinfo) => {
        const response = msg.toString().trim();
        console.log('📩', response);
        process.stdout.write('> ');
    });
    
    // Gestione errori del client UDP
    client.on('error', (err) => {
        console.error('❌ Errore client:', err.message);
        client.close();
        process.exit(1);
    });
    
    // Interfaccia readline per input interattivo da terminale
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: '> '
    });
    
    rl.prompt();
    
    // Gestione input utente
    rl.on('line', (line) => {
        const message = line.trim();
        
        if (message.toLowerCase() === 'exit') {
            console.log('👋 Chiusura client...');
            client.close();
            rl.close();
            process.exit(0);
            return;
        }
        
        if (message.length > 0) {
            // Converti stringa in Buffer per l'invio
            const buffer = Buffer.from(message);
            // send() invia il datagramma all'host:port specificato
            // Ogni invio è un datagramma UDP separato e indipendente
            // Non c'è garanzia che arrivi (unreliable delivery)
            client.send(buffer, PORT, HOST, (err) => {
                if (err) {
                    console.error('❌ Errore invio:', err.message);
                }
            });
        }
        
        rl.prompt();
    });
    
    rl.on('SIGINT', () => {
        console.log('\n👋 Interruzione...');
        client.close();
        rl.close();
        process.exit(0);
    });
}

// ============================================
// MAIN
// ============================================
const mode = process.argv[2];

if (mode === 'server') {
    startServer();
} else if (mode === 'client') {
    startClient();
} else {
    console.log('Uso:');
    console.log('  node 02-udp-echo.js server');
    console.log('  node 02-udp-echo.js client');
    process.exit(1);
}
