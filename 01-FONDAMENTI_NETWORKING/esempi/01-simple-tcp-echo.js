/**
 * Esempio 01 - Simple TCP Echo Server e Client
 * 
 * Dimostrazione base di:
 * - Creazione server TCP
 * - Connessione client TCP
 * - Echo pattern (server rimanda ciò che riceve)
 * - Gestione eventi base
 * 
 * Uso:
 *   node 01-simple-tcp-echo.js server
 *   node 01-simple-tcp-echo.js client
 */

// Modulo 'net' di Node.js per la comunicazione TCP/IP
// Fornisce un'API asincrona per creare server e client TCP
const net = require('net');
// Modulo 'readline' per leggere input da terminale riga per riga
const readline = require('readline');

// Configurazione porta e host del server
const PORT = 3002;  // Porta su cui il server ascolta le connessioni
const HOST = 'localhost';  // Indirizzo di ascolto (127.0.0.1)

// ============================================
// SERVER
// ============================================
function startServer() {
    // createServer() crea un server TCP
    // Il callback viene eseguito ogni volta che un client si connette
    // 'socket' è l'oggetto che rappresenta la connessione con il client
    const server = net.createServer((socket) => {
        // socket.remoteAddress e socket.remotePort identificano il client connesso
        console.log('✅ Client connesso:', socket.remoteAddress + ':' + socket.remotePort);
        
        // Evento 'data': si attiva quando arrivano dati dal client
        // Il pattern echo consiste nel rimandare indietro ciò che si riceve
        socket.on('data', (data) => {
            // 'data' è un Buffer, lo convertiamo in stringa
            const message = data.toString().trim();
            console.log('📩 Ricevuto:', message);
            
            // socket.write() invia dati al client attraverso la connessione TCP
            // In TCP i dati sono inviati come stream di byte
            socket.write('ECHO: ' + message + '\n');
        });
        
        // Evento 'end': il client ha chiuso la connessione in modo ordinato (FIN)
        // Questo è diverso da una disconnessione improvvisa (errore di rete)
        socket.on('end', () => {
            console.log('❌ Client disconnesso');
        });
        
        // Evento 'error': gestisce errori sulla connessione socket
        // Es: perdita di connessione, reset della connessione, ecc.
        socket.on('error', (err) => {
            console.error('❌ Errore socket:', err.message);
        });
    });
    
    // listen() mette il server in ascolto sulla porta specificata
    // In TCP, il server deve fare 'bind' su una porta e 'listen' per accettare connessioni
    // Il callback viene eseguito quando il server è pronto
    server.listen(PORT, HOST, () => {
        console.log(`🚀 Server TCP in ascolto su ${HOST}:${PORT}`);
        console.log('In attesa di connessioni...\n');
    });
    
    // Gestione errori a livello server (non di singola connessione)
    // Es: EADDRINUSE se la porta è già occupata
    server.on('error', (err) => {
        console.error('❌ Errore server:', err.message);
        process.exit(1);
    });
}

// ============================================
// CLIENT
// ============================================
function startClient() {
    // net.connect() crea una connessione TCP al server specificato
    // Equivale a chiamare new net.Socket() e poi socket.connect()
    // Avvia il three-way handshake TCP (SYN, SYN-ACK, ACK)
    const socket = net.connect({ port: PORT, host: HOST });
    
    // Evento 'connect': si attiva quando la connessione TCP è stabilita
    // A questo punto il three-way handshake è completato
    socket.on('connect', () => {
        console.log(`✅ Connesso al server ${HOST}:${PORT}\n`);
        console.log('Digita un messaggio e premi INVIO (o "exit" per uscire):\n');
    });
    
    // Evento 'data': ricezione dati dal server
    // In TCP i dati possono arrivare in più chunk, qui assumiamo messaggi completi
    socket.on('data', (data) => {
        const response = data.toString().trim();
        console.log('📩', response);
        process.stdout.write('> ');
    });
    
    // Evento 'end': il server ha chiuso la connessione
    socket.on('end', () => {
        console.log('\n❌ Connessione chiusa dal server');
        process.exit(0);
    });
    
    // Evento 'error': errori di connessione (es: ECONNREFUSED se server non attivo)
    socket.on('error', (err) => {
        console.error('❌ Errore:', err.message);
        process.exit(1);
    });
    
    // readline.createInterface crea un'interfaccia per leggere input riga per riga
    // Utile per creare CLI interattive
    const rl = readline.createInterface({
        input: process.stdin,   // Legge da standard input (tastiera)
        output: process.stdout, // Scrive su standard output (terminale)
        prompt: '> '            // Prompt da mostrare all'utente
    });
    
    // Mostra il prompt iniziale
    rl.prompt();
    
    // Evento 'line': si attiva quando l'utente preme INVIO
    rl.on('line', (line) => {
        const message = line.trim();
        
        // Comando per uscire dal client
        if (message.toLowerCase() === 'exit') {
            console.log('👋 Chiusura connessione...');
            // socket.end() chiude la connessione in modo ordinato (invia FIN)
            socket.end();
            rl.close();
            return;
        }
        
        // Invia il messaggio al server se non è vuoto
        if (message.length > 0) {
            // In TCP, write() accoda i dati al buffer di invio
            socket.write(message + '\n');
        }
        
        // Mostra di nuovo il prompt
        rl.prompt();
    });
    
    // Evento 'SIGINT': gestisce Ctrl+C per chiusura pulita
    rl.on('SIGINT', () => {
        console.log('\n👋 Interruzione...');
        socket.end();
        rl.close();
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
    console.log('  node 01-simple-tcp-echo.js server');
    console.log('  node 01-simple-tcp-echo.js client');
    process.exit(1);
}
