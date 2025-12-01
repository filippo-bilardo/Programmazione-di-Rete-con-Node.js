# 1.4 Socket Programming

## Indice
- [Cosa sono i Socket](#cosa-sono-i-socket)
- [Stream Socket vs Datagram Socket](#stream-socket-vs-datagram-socket)
- [Socket Lifecycle](#socket-lifecycle)
- [Blocking vs Non-Blocking I/O](#blocking-vs-non-blocking-io)
- [Event Loop e Networking](#event-loop-e-networking)
- [Error Handling Patterns](#error-handling-patterns)

---

## Cosa sono i Socket

### Definizione

Un **socket** è un'astrazione software che rappresenta un **endpoint di comunicazione** di rete.

Pensa al socket come a una "presa" (socket in inglese significa "presa elettrica") dove "colleghi" la tua applicazione alla rete.

```
┌─────────────────┐
│  Application    │
│   (Your Code)   │
└────────┬────────┘
         │ write/read
         ↓
    ┌────────┐
    │ Socket │ ←─── Astrazione software
    └────────┘
         │
         ↓
┌─────────────────┐
│  TCP/IP Stack   │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│    Network      │
└─────────────────┘
```

### Componenti di un Socket

Un socket è identificato da:

```
┌──────────────────────────────────┐
│  Socket = (Protocol, IP, Port)   │
└──────────────────────────────────┘

Esempi:
- (TCP, 192.168.1.100, 8080)
- (UDP, 10.0.0.5, 53)
- (TCP, localhost, 3000)
```

#### 1. Protocol Family

```
AF_INET    → IPv4
AF_INET6   → IPv6
AF_UNIX    → Unix domain sockets (IPC locale)
```

#### 2. Socket Type

```
SOCK_STREAM   → TCP (stream socket)
SOCK_DGRAM    → UDP (datagram socket)
SOCK_RAW      → Raw IP packets
```

#### 3. Address

```
IP Address + Port Number

192.168.1.100:8080
localhost:3000
example.com:443
```

### Socket in Node.js

**Teoria:** In Node.js, un socket è un oggetto che implementa l'interfaccia Stream Duplex, permettendo sia la lettura che la scrittura di dati. Il modulo `net` fornisce un'API asincrona per creare socket TCP.

```javascript
const net = require('net');

// Crea un socket TCP client e inizia la connessione
// net.connect() ritorna immediatamente un oggetto socket
// La connessione avviene in modo ASINCRONO
const socket = net.connect({
    host: '192.168.1.100',  // Indirizzo IP del server (IPv4)
    port: 8080,             // Numero di porta del servizio
    family: 4               // Forza IPv4 (opzionale, default: auto)
    // family: 6            // Per IPv6
});

// Il socket è un oggetto JavaScript che rappresenta
// la connessione di rete e fornisce metodi per:
// - Inviare dati: socket.write()
// - Ricevere dati: socket.on('data')
// - Gestire eventi: socket.on('connect'), socket.on('error'), etc.
console.log('Socket creato:', socket);
console.log('Connessione in corso...');

// Aspetta che la connessione sia stabilita
socket.on('connect', () => {
    console.log('✓ Connessione stabilita!');
    console.log('Indirizzo locale:', socket.localAddress);
    console.log('Porta locale:', socket.localPort);
    console.log('Indirizzo remoto:', socket.remoteAddress);
    console.log('Porta remota:', socket.remotePort);
});

// Gestione errori (SEMPRE necessaria!)
socket.on('error', (err) => {
    console.error('✗ Errore di connessione:', err.message);
});
```

### Socket API

**Teoria:** L'API dei socket fornisce metodi per creare, connettere, leggere, scrivere e chiudere connessioni di rete. In Node.js, queste operazioni sono asincrone e basate su eventi.

#### Operazioni Base

```javascript
// --- 1. CREATE (Creazione Socket) ---
// Crea un socket e inizia la connessione in modo asincrono
const socket = net.connect({ port: 8080 });
// A questo punto il socket esiste ma NON è ancora connesso
console.log('Socket creato, connessione in corso...');

// --- 2. CONNECT (Connessione) ---
// L'evento 'connect' viene emesso quando il 3-way handshake TCP è completato
// Solo dopo questo evento il socket è pronto per inviare/ricevere dati
socket.on('connect', () => {
    console.log('✓ Socket connesso e pronto');
    console.log('Posso iniziare a inviare dati');
});

// --- 3. WRITE (Scrittura/Invio Dati) ---
// Scrive dati nel buffer di invio del socket
// I dati vengono inviati in modo asincrono
socket.write('Hello Server!'); // Accetta String o Buffer
socket.write(Buffer.from([0x01, 0x02, 0x03])); // Dati binari

// write() ritorna true/false per gestire backpressure
const canContinue = socket.write('More data');
if (!canContinue) {
    console.log('Buffer pieno, aspetto evento drain');
    socket.once('drain', () => {
        console.log('Buffer svuotato, posso continuare');
    });
}

// --- 4. READ (Lettura/Ricezione Dati) ---
// L'evento 'data' viene emesso quando arrivano dati
socket.on('data', (chunk) => {
    // chunk è un Buffer contenente i dati ricevuti
    console.log('Dati ricevuti:', chunk.toString());
    console.log('Byte ricevuti:', chunk.length);
    
    // IMPORTANTE: i dati possono arrivare frammentati!
    // Un messaggio "Hello World" potrebbe arrivare in 2 chunk:
    // chunk 1: "Hello"
    // chunk 2: " World"
});

// --- 5. CLOSE (Chiusura Connessione) ---

// Chiusura GRAZIOSA (graceful close)
// Invia FIN al server, chiude il lato di scrittura
// ma può ancora ricevere dati dal server
socket.end();
// Opzionale: invia ultimi dati prima di chiudere
socket.end('Goodbye!\n');

// Chiusura FORZATA (force close)
// Chiude immediatamente il socket senza attendere
// Utile in caso di errori o timeout
socket.destroy();
// Con errore opzionale:
socket.destroy(new Error('Timeout'));

// --- EVENTI DI CHIUSURA ---

// Evento 'end': l'altra parte ha chiuso la connessione
socket.on('end', () => {
    console.log('Server ha chiuso la connessione');
    // Di solito chiudiamo anche noi
    socket.end();
});

// Evento 'close': socket completamente chiuso
socket.on('close', (hadError) => {
    console.log('Socket chiuso');
    if (hadError) {
        console.log('Chiusura causata da un errore');
    }
});
```

---

## Stream Socket vs Datagram Socket

### Stream Socket (TCP)

**Connection-oriented, reliable, ordered**

```
┌─────────────┐                    ┌─────────────┐
│   Client    │                    │   Server    │
│             │                    │             │
│  Socket ────┼───── Connection ───┼──── Socket  │
│   (TCP)     │        (Stream)    │    (TCP)    │
└─────────────┘                    └─────────────┘
       │                                 │
       │ ←────── Data flow ────────────→ │
       │        (bidirectional)          │
```

#### Caratteristiche

✅ **Connection-oriented**: Richiede connessione (3-way handshake)  
✅ **Reliable**: Garantisce consegna dati  
✅ **Ordered**: Dati arrivano nell'ordine corretto  
✅ **Error checking**: Rileva e corregge errori  
✅ **Flow control**: Gestisce velocità trasmissione  
❌ **Overhead**: Header più grandi, più lento  

#### Quando Usarlo

- 🌐 **Web (HTTP/HTTPS)**
- 📧 **Email (SMTP, POP3, IMAP)**
- 📁 **File transfer (FTP)**
- 🔐 **SSH, Telnet**
- 🗄️ **Database connections**
- Qualsiasi cosa che richiede **affidabilità**

#### Esempio Node.js

**Teoria:** Un esempio completo di comunicazione TCP client-server che mostra il ciclo di vita completo di una connessione: connessione, scambio dati, chiusura.

```javascript
const net = require('net');

// ========== SERVER TCP ==========
// Il server crea un socket per ogni client che si connette
const server = net.createServer((socket) => {
    // Questo callback viene eseguito per OGNI nuovo client
    console.log('✓ Nuovo client connesso');
    console.log(`  Indirizzo: ${socket.remoteAddress}:${socket.remotePort}`);
    
    // Invia messaggio di benvenuto al client
    socket.write('Welcome to the server!\n');
    console.log('→ Messaggio di benvenuto inviato');
    
    // Gestisce dati in arrivo dal client
    socket.on('data', (data) => {
        // Converte il Buffer in stringa per visualizzazione
        const message = data.toString().trim();
        console.log('← Ricevuto dal client:', message);
        
        // Echo: rimanda indietro lo stesso messaggio
        socket.write('Echo: ' + message + '\n');
        console.log('→ Echo inviato al client');
    });
    
    // Gestisce disconnessione del client
    socket.on('end', () => {
        console.log('✗ Client ha chiuso la connessione');
    });
    
    // Gestisce errori sul socket del client
    socket.on('error', (err) => {
        console.error('✗ Errore socket client:', err.message);
    });
});

// Avvia il server sulla porta 8080
// Il server rimane in ascolto per connessioni in arrivo
server.listen(8080, () => {
    console.log('=================================');
    console.log('Server TCP in ascolto su porta 8080');
    console.log('In attesa di connessioni client...');
    console.log('=================================');
});

// Gestisce errori del server (es: porta già in uso)
server.on('error', (err) => {
    console.error('✗ Errore server:', err.message);
    if (err.code === 'EADDRINUSE') {
        console.error('La porta 8080 è già in uso!');
    }
});

// ========== CLIENT TCP ==========
// Crea un socket e si connette al server
const client = net.connect({ port: 8080, host: 'localhost' });

console.log('\n=================================');
console.log('Client TCP avviato');
console.log('Connessione a localhost:8080...');
console.log('=================================\n');

// Evento: connessione stabilita con successo
client.on('connect', () => {
    console.log('✓ Connesso al server');
    
    // Invia un messaggio al server
    client.write('Hello Server\n');
    console.log('→ Messaggio inviato al server');
});

// Evento: dati ricevuti dal server
client.on('data', (data) => {
    // Riceve il messaggio di benvenuto e l'echo
    console.log('← Risposta dal server:', data.toString().trim());
    
    // Dopo aver ricevuto la risposta, chiudi la connessione
    console.log('\nChiusura connessione...');
    client.end(); // Chiusura graziosa
});

// Evento: socket chiuso
client.on('close', () => {
    console.log('✓ Connessione chiusa');
});

// Evento: errore di connessione
client.on('error', (err) => {
    console.error('✗ Errore client:', err.message);
    // Errori comuni:
    // ECONNREFUSED: server non in ascolto
    // ETIMEDOUT: timeout di connessione
    // ENOTFOUND: host non trovato
});

// FLUSSO DI ESECUZIONE:
// 1. Server avviato, in ascolto su porta 8080
// 2. Client inizia connessione
// 3. Evento 'connect': connessione stabilita
// 4. Client invia "Hello Server"
// 5. Server riceve "Hello Server"
// 6. Server invia "Welcome" e "Echo: Hello Server"
// 7. Client riceve entrambi i messaggi
// 8. Client chiude connessione
// 9. Server rileva disconnessione
```

---

### Datagram Socket (UDP)

**Connectionless, unreliable, fast**

```
┌─────────────┐                    ┌─────────────┐
│   Client    │                    │   Server    │
│             │                    │             │
│  Socket ────┼──── Datagram ─────→│  Socket     │
│   (UDP)     │   (fire & forget)  │   (UDP)     │
└─────────────┘                    └─────────────┘
       │                                  │
       │ ─────→ Datagram 1                │
       │ ─────→ Datagram 2 (might be lost)│
       │ ─────→ Datagram 3                │
```

#### Caratteristiche

✅ **Connectionless**: Nessuna connessione preliminare  
✅ **Fast**: Minimo overhead  
✅ **Low latency**: Ideale per real-time  
❌ **Unreliable**: Nessuna garanzia di consegna  
❌ **No ordering**: Datagram possono arrivare disordinati  
❌ **No flow control**: Nessuna gestione velocità  

#### Quando Usarlo

- 🎮 **Gaming online** (latency-critical)
- 📹 **Video/audio streaming**
- 🗣️ **VoIP**
- 🌐 **DNS queries**
- 📡 **IoT sensors** (piccoli pacchetti frequenti)
- Qualsiasi cosa che privilegi **velocità su affidabilità**

#### Esempio Node.js

**Teoria:** UDP è un protocollo connectionless: non c'è una connessione persistente come in TCP. Ogni datagram è indipendente e può essere inviato/ricevuto senza stabilire una connessione preliminare.

```javascript
const dgram = require('dgram'); // Modulo per socket UDP/datagram

// ========== SERVER UDP ==========
// Crea un socket UDP (tipo 'udp4' = IPv4)
const server = dgram.createSocket('udp4');
// Alternativa: 'udp6' per IPv6

console.log('=================================');
console.log('Server UDP avviato');
console.log('=================================\n');

// Evento: messaggio ricevuto
// msg: Buffer contenente i dati
// rinfo: informazioni sul mittente (address, port, family, size)
server.on('message', (msg, rinfo) => {
    console.log('← Datagram ricevuto');
    console.log(`  Da: ${rinfo.address}:${rinfo.port}`);
    console.log(`  Famiglia: ${rinfo.family}`);
    console.log(`  Dimensione: ${rinfo.size} bytes`);
    console.log(`  Messaggio: ${msg.toString()}`);
    
    // Invia risposta al mittente (echo back)
    // UDP è connectionless: dobbiamo specificare destinazione ogni volta
    const response = Buffer.from(`Echo: ${msg.toString()}`);
    server.send(
        response,           // Dati da inviare
        rinfo.port,         // Porta destinazione (porta del client)
        rinfo.address,      // Indirizzo destinazione (IP del client)
        (err) => {
            if (err) {
                console.error('✗ Errore invio risposta:', err.message);
            } else {
                console.log('→ Echo inviato al client');
            }
        }
    );
});

// Evento: server pronto per ricevere datagram
server.on('listening', () => {
    const address = server.address();
    console.log(`✓ Server UDP in ascolto su ${address.address}:${address.port}`);
    console.log('In attesa di datagram...\n');
});

// Evento: errore server
server.on('error', (err) => {
    console.error('✗ Errore server:', err.message);
    server.close();
});

// Bind: associa il socket alla porta 8080
// Il server inizia ad ascoltare per datagram in arrivo
server.bind(8080);
// Alternativa con callback:
// server.bind(8080, () => { console.log('Listening'); });

// ========== CLIENT UDP ==========
// Crea socket UDP client
const client = dgram.createSocket('udp4');

console.log('=================================');
console.log('Client UDP avviato');
console.log('=================================\n');

// Prepara il messaggio da inviare
// UDP richiede Buffer (non accetta stringhe direttamente)
const message = Buffer.from('Hello Server via UDP!');

console.log('→ Invio datagram al server...');

// Invia datagram al server
// NOTA: UDP non ha connessione, invio diretto
client.send(
    message,                // Buffer con i dati
    8080,                   // Porta destinazione
    'localhost',            // Host destinazione (o IP)
    (err) => {
        if (err) {
            console.error('✗ Errore invio:', err.message);
            client.close();
        } else {
            console.log('✓ Datagram inviato con successo');
            console.log(`  Dimensione: ${message.length} bytes`);
            // NOTA: successo = "inviato", NON "consegnato"!
            // UDP non garantisce la consegna
        }
    }
);

// Evento: risposta ricevuta dal server
client.on('message', (msg, rinfo) => {
    console.log('\n← Risposta ricevuta dal server:');
    console.log(`  Messaggio: ${msg.toString()}`);
    console.log(`  Da: ${rinfo.address}:${rinfo.port}`);
    
    // Chiudi il socket dopo aver ricevuto la risposta
    console.log('\nChiusura socket client...');
    client.close();
});

// Evento: socket chiuso
client.on('close', () => {
    console.log('✓ Socket client chiuso');
});

// Evento: errore client
client.on('error', (err) => {
    console.error('✗ Errore client:', err.message);
    client.close();
});

// DIFFERENZE CHIAVE UDP vs TCP:
// 1. NO connessione (connectionless)
// 2. NO garanzia di consegna (unreliable)
// 3. NO ordine garantito (datagram possono arrivare disordinati)
// 4. send() specifica destinazione ogni volta
// 5. Più veloce, meno overhead
// 6. Adatto per: streaming, gaming, DNS, broadcast

// ESEMPIO DI USO UDP:
// - Gaming online (latenza critica, pacchetto perso = non grave)
// - Streaming video/audio (un frame perso non blocca tutto)
// - DNS queries (richiesta piccola, velocità importante)
// - Sensori IoT (dati frequenti, singolo dato non critico)
```

---

### Confronto Diretto

| Caratteristica | TCP (Stream) | UDP (Datagram) |
|----------------|--------------|----------------|
| **Connessione** | Connection-oriented | Connectionless |
| **Affidabilità** | Garantita | Non garantita |
| **Ordine** | Ordinato | Disordinato |
| **Velocità** | Più lento | Più veloce |
| **Overhead** | Alto (~20 bytes header) | Basso (~8 bytes header) |
| **Uso CPU** | Maggiore | Minore |
| **Flow control** | Sì | No |
| **Congestion control** | Sì | No |
| **Broadcasting** | No | Sì |
| **Multicast** | No | Sì |

---

## Socket Lifecycle

### TCP Socket Lifecycle (Client)

```
┌───────────┐
│  CLOSED   │
└─────┬─────┘
      │ socket()
      ↓
┌───────────┐
│  CREATED  │
└─────┬─────┘
      │ connect()
      ↓
┌────────────┐
│ CONNECTING │ (3-way handshake in progress)
└─────┬──────┘
      │
      ↓
┌─────────────┐
│ CONNECTED   │ ←───┐
│(ESTABLISHED)│     │
└─────┬───────┘     │ read()/write()
      │             │
      │ send/recv   │
      ↓             │
┌────────────┐      │
│   ACTIVE   │──────┘
└─────┬──────┘
      │ close()
      ↓
┌────────────┐
│ CLOSING    │
└─────┬──────┘
      │
      ↓
┌────────────┐
│  CLOSED    │
└────────────┘
```

#### Esempio Node.js

**Teoria:** Il ciclo di vita di un socket TCP client in Node.js attraversa diversi stati, ognuno corrispondente a un evento specifico. Comprendere questi stati è fondamentale per gestire correttamente le connessioni.

```javascript
const net = require('net');

console.log('=================================');
console.log('Tracciamento Ciclo di Vita Socket TCP');
console.log('=================================\n');

// STATO: CREATED → CONNECTING
// Creazione del socket e inizio connessione
const socket = net.connect({ port: 8080, host: 'localhost' });
console.log('1. CREATED → CONNECTING');
console.log('   Socket creato, tentativo di connessione in corso...');
console.log(`   Timestamp: ${Date.now()}`);

// STATO: CONNECTING → CONNECTED (ESTABLISHED)
// Evento emesso quando il 3-way handshake TCP è completato
socket.on('connect', () => {
    console.log('\n2. CONNECTING → CONNECTED (ESTABLISHED)');
    console.log('   ✓ Connessione TCP stabilita con successo');
    console.log(`   Socket locale: ${socket.localAddress}:${socket.localPort}`);
    console.log(`   Socket remoto: ${socket.remoteAddress}:${socket.remotePort}`);
    console.log(`   Timestamp: ${Date.now()}`);
    
    // STATO: ACTIVE (Scambio dati)
    console.log('\n3. ACTIVE - Invio dati...');
    socket.write('Hello Server!\n');
    console.log('   → Dati inviati al server');
});

// STATO: ACTIVE (Ricezione dati)
// Quando arrivano dati, il socket è nello stato ACTIVE
socket.on('data', (data) => {
    console.log('\n4. ACTIVE - Ricezione dati');
    console.log(`   ← Dati ricevuti: "${data.toString().trim()}"`);
    console.log(`   Bytes ricevuti: ${data.length}`);
    console.log(`   Timestamp: ${Date.now()}`);
    
    // Dopo aver ricevuto i dati, inizia la chiusura
    console.log('\n5. ACTIVE → CLOSING');
    console.log('   Inizio chiusura connessione...');
    socket.end(); // Invia FIN al server
});

// STATO: CLOSING
// Evento emesso quando l'altra parte chiude la connessione
// Il socket ha ricevuto FIN dal server
socket.on('end', () => {
    console.log('\n6. CLOSING');
    console.log('   ✓ Server ha inviato FIN (chiusura graziosa)');
    console.log('   Socket può ancora inviare dati (half-close)');
    console.log(`   Timestamp: ${Date.now()}`);
});

// STATO: CLOSED
// Evento emesso quando il socket è completamente chiuso
// Entrambe le direzioni (invio e ricezione) sono chiuse
socket.on('close', (hadError) => {
    console.log('\n7. CLOSING → CLOSED');
    console.log('   ✓ Socket completamente chiuso');
    console.log(`   Chiusura con errore: ${hadError ? 'Sì' : 'No'}`);
    console.log(`   Timestamp: ${Date.now()}`);
    console.log('\n=================================');
    console.log('Ciclo di vita socket completato');
    console.log('=================================');
});

// GESTIONE ERRORI (può avvenire in qualsiasi stato)
socket.on('error', (err) => {
    console.error('\n✗ ERRORE durante il ciclo di vita');
    console.error(`   Codice: ${err.code}`);
    console.error(`   Messaggio: ${err.message}`);
    console.error(`   Timestamp: ${Date.now()}`);
    
    // Errori comuni e i loro stati:
    // ECONNREFUSED: durante CONNECTING (server non disponibile)
    // ETIMEDOUT: durante CONNECTING (timeout handshake)
    // ECONNRESET: durante ACTIVE (connessione resettata)
    // EPIPE: durante ACTIVE (tentativo di scrivere su socket chiuso)
});

// TIMEOUT (opzionale)
// Imposta timeout di inattività di 30 secondi
socket.setTimeout(30000);

socket.on('timeout', () => {
    console.log('\n⏱ TIMEOUT');
    console.log('   Socket inattivo per troppo tempo');
    console.log('   Forzatura chiusura socket...');
    socket.destroy(); // Chiusura forzata
});

// RIEPILOGO STATI:
// 1. CREATED: socket.connect() chiamato
// 2. CONNECTING: SYN inviato, attesa SYN-ACK
// 3. CONNECTED (ESTABLISHED): Handshake completato
// 4. ACTIVE: Scambio dati bidirezionale
// 5. CLOSING: FIN inviato/ricevuto
// 6. CLOSED: Socket distrutto, risorse rilasciate

// TEMPI TIPICI (esempi):
// CREATED → CONNECTING: 0ms (immediato)
// CONNECTING → CONNECTED: 1-100ms (dipende da latenza rete)
// CONNECTED → ACTIVE: 0ms (immediato dopo connect)
// ACTIVE: variabile (dipende dall'applicazione)
// CLOSING → CLOSED: 1-10ms (chiusura graziosa)
```

---

### TCP Socket Lifecycle (Server)

```
┌───────────┐
│  CLOSED   │
└─────┬─────┘
      │ socket()
      ↓
┌───────────┐
│  CREATED  │
└─────┬─────┘
      │ bind()
      ↓
┌───────────┐
│   BOUND   │
└─────┬─────┘
      │ listen()
      ↓
┌───────────┐
│ LISTENING │ ←───────────────┐
└─────┬─────┘                 │
      │                       │
      │ accept()              │ (loop, accept more)
      ↓                       │
┌─────────────┐               │
│ NEW CLIENT  │               │
│ CONNECTION  │───────────────┘
└─────┬───────┘
      │
      ↓
┌─────────────┐
│   HANDLE    │
│   CLIENT    │
└─────┬───────┘
      │ close client
      ↓
┌─────────────┐
│ BACK TO     │
│ LISTENING   │
└─────────────┘
```

#### Esempio Node.js

**Teoria:** Un server TCP può gestire multiple connessioni client simultaneamente. Ogni connessione client ha il proprio socket, e il server cicla tra lo stato LISTENING (in attesa di nuove connessioni) e la gestione dei client connessi.

```javascript
const net = require('net');

console.log('=================================');
console.log('Tracciamento Ciclo di Vita Server TCP');
console.log('=================================\n');

// Array per tracciare tutti i client connessi
const connectedClients = [];
let clientIdCounter = 0; // Assegna ID univoco ad ogni client

// STATO: CREATED
// Crea il server TCP con un handler per ogni nuova connessione
const server = net.createServer((clientSocket) => {
    // Assegna ID univoco al client
    const clientId = ++clientIdCounter;
    clientSocket.clientId = clientId;
    
    // STATO: NEW CLIENT CONNECTION
    console.log(`\n[Client #${clientId}] NUOVA CONNESSIONE`);
    console.log(`   Indirizzo: ${clientSocket.remoteAddress}`);
    console.log(`   Porta: ${clientSocket.remotePort}`);
    console.log(`   Timestamp: ${new Date().toISOString()}`);
    
    // Aggiungi client alla lista dei connessi
    connectedClients.push(clientSocket);
    console.log(`   Totale client connessi: ${connectedClients.length}`);
    
    // Invia messaggio di benvenuto
    clientSocket.write(`Welcome! You are client #${clientId}\n`);
    
    // STATO: HANDLE CLIENT - Gestione dati
    clientSocket.on('data', (data) => {
        console.log(`\n[Client #${clientId}] DATI RICEVUTI`);
        console.log(`   Messaggio: "${data.toString().trim()}"`);
        console.log(`   Bytes: ${data.length}`);
        
        // Echo: rimanda i dati al client
        clientSocket.write(`Echo: ${data}`);
        console.log(`[Client #${clientId}] Echo inviato`);
    });
    
    // STATO: CLIENT CLOSING
    clientSocket.on('end', () => {
        console.log(`\n[Client #${clientId}] CHIUSURA INIZIATA`);
        console.log(`   Client ha inviato FIN`);
    });
    
    // STATO: CLIENT CLOSED
    clientSocket.on('close', (hadError) => {
        console.log(`\n[Client #${clientId}] CONNESSIONE CHIUSA`);
        console.log(`   Con errore: ${hadError ? 'Sì' : 'No'}`);
        console.log(`   Timestamp: ${new Date().toISOString()}`);
        
        // Rimuovi client dalla lista
        const index = connectedClients.indexOf(clientSocket);
        if (index > -1) {
            connectedClients.splice(index, 1);
        }
        console.log(`   Totale client ancora connessi: ${connectedClients.length}`);
        
        // BACK TO LISTENING STATE
        // Il server ritorna automaticamente in ascolto per nuovi client
        console.log('   Server LISTENING per nuove connessioni');
    });
    
    // Gestione errori client
    clientSocket.on('error', (err) => {
        console.error(`\n[Client #${clientId}] ERRORE`);
        console.error(`   Codice: ${err.code}`);
        console.error(`   Messaggio: ${err.message}`);
    });
});

// STATO: BOUND + LISTENING
// Associa il server alla porta 8080 e inizia ad ascoltare
server.listen(8080, () => {
    console.log('STATO: LISTENING');
    console.log('✓ Server avviato con successo');
    console.log('  Porta: 8080');
    console.log('  Indirizzo: 0.0.0.0 (tutte le interfacce)');
    console.log('  Timestamp:', new Date().toISOString());
    console.log('\nIn attesa di connessioni client...');
    console.log('=================================');
});

// Evento: nuova connessione in arrivo (prima di creare il socket)
server.on('connection', (socket) => {
    console.log('\n→ Rilevata nuova connessione in arrivo');
    // Questo evento viene emesso prima del callback createServer()
});

// Gestione chiusura server
server.on('close', () => {
    console.log('\n=================================');
    console.log('SERVER CHIUSO');
    console.log('Non accetta più nuove connessioni');
    console.log(`Client ancora connessi: ${connectedClients.length}`);
    console.log('=================================');
});

// Gestione errori server
server.on('error', (err) => {
    console.error('\n✗ ERRORE SERVER');
    console.error(`Codice: ${err.code}`);
    console.error(`Messaggio: ${err.message}`);
    
    // Errori comuni:
    if (err.code === 'EADDRINUSE') {
        console.error('La porta 8080 è già in uso!');
        console.error('Soluzione: chiudi l\'altra applicazione o usa porta diversa');
        process.exit(1);
    }
});

// Informazioni periodiche sullo stato del server
setInterval(() => {
    if (connectedClients.length > 0) {
        console.log(`\n[Stato] Client attivi: ${connectedClients.length}`);
        connectedClients.forEach(client => {
            console.log(`  - Client #${client.clientId}: ${client.remoteAddress}:${client.remotePort}`);
        });
    }
}, 30000); // Ogni 30 secondi

// Gestione chiusura graziosa del server
process.on('SIGINT', () => {
    console.log('\n\nRicevuto SIGINT (Ctrl+C)');
    console.log('Chiusura graziosa del server...');
    
    // Chiudi tutte le connessioni client
    connectedClients.forEach((client, index) => {
        console.log(`Chiusura client #${client.clientId}...`);
        client.end('Server shutting down\n');
    });
    
    // Chiudi il server (non accetta più nuove connessioni)
    server.close(() => {
        console.log('Server chiuso. Arrivederci!');
        process.exit(0);
    });
});

// CICLO DI VITA COMPLETO SERVER:
// 1. CREATED: net.createServer() chiamato
// 2. BOUND: server.listen() chiamato, porta assegnata
// 3. LISTENING: server in ascolto per connessioni
// 4. NEW CLIENT CONNECTION: client si connette
// 5. HANDLE CLIENT: gestione dati client
// 6. CLIENT CLOSED: client si disconnette
// 7. BACK TO LISTENING: server pronto per nuovi client
// (ripete step 4-7 per ogni client)
// 8. SERVER CLOSE: server.close() chiamato
// 9. CLOSED: server terminato

// NOTA: Il server può gestire MIGLIAIA di client simultaneamente
// grazie all'architettura non-blocking di Node.js
```

---

### UDP Socket Lifecycle

UDP è **connectionless**, quindi più semplice:

```
┌───────────┐
│  CLOSED   │
└─────┬─────┘
      │ socket()
      ↓
┌───────────┐
│  CREATED  │
└─────┬─────┘
      │ bind() (server)
      ↓
┌───────────┐
│   BOUND   │ ←────┐
└─────┬─────┘      │
      │            │ send()/receive()
      │ send/recv  │
      ↓            │
┌───────────┐      │
│  ACTIVE   │──────┘
└─────┬─────┘
      │ close()
      ↓
┌───────────┐
│  CLOSED   │
└───────────┘
```

---

## Blocking vs Non-Blocking I/O

### Blocking I/O (Sincrono)

```
┌──────────────┐
│ Application  │
└──────┬───────┘
       │ read()
       ↓
┌──────────────┐
│   Socket     │ ──── BLOCKED ────┐
└──────────────┘                  │
       │                          │ (waiting for data)
       │ ← data arrives           │
       ↓                          │
┌──────────────┐                  │
│ Application  │ ← resumes ───────┘
└──────────────┘
```

**Problema**: Thread bloccato in attesa → Spreco risorse

#### Esempio (pseudo-code, NON Node.js)

```c
// Blocking read (traditional Unix socket)
char buffer[1024];
int bytes = read(socket_fd, buffer, sizeof(buffer));
// ↑ Blocked here until data arrives
printf("Received: %s\n", buffer);
```

---

### Non-Blocking I/O (Asincrono)

```
┌──────────────┐
│ Application  │
└──────┬───────┘
       │ read() (returns immediately)
       ↓
┌──────────────┐
│   Socket     │ ──── Returns EWOULDBLOCK
└──────────────┘
       │
       │ (app continues doing other things)
       │
       │ ← data arrives (event)
       ↓
┌──────────────┐
│  Callback    │ ← invoked when data ready
└──────────────┘
```

**Vantaggio**: Thread non bloccato → Può gestire migliaia di connessioni

#### Node.js (sempre non-blocking)

```javascript
// Non-blocking read (Node.js)
socket.on('data', (chunk) => {
    // Callback invocato quando dati sono pronti
    console.log('Received:', chunk.toString());
});

// Application continues immediately
console.log('Registered data handler');
```

---

## Event Loop e Networking

Node.js usa un **single-threaded event loop** con **non-blocking I/O**.

### Architettura

```
┌────────────────────────────────────┐
│       JavaScript Code              │
│    (Your Application Logic)        │
└────────────┬───────────────────────┘
             │
┌────────────▼───────────────────────┐
│        Node.js APIs                │
│   (net, fs, http, etc.)            │
└────────────┬───────────────────────┘
             │
┌────────────▼───────────────────────┐
│         Event Loop                 │
│   (Single-threaded)                │
│                                    │
│  ┌──────────────────────────────┐  │
│  │ Phases:                      │  │
│  │  1. Timers                   │  │
│  │  2. Pending callbacks        │  │
│  │  3. Poll (I/O events)        │  │
│  │  4. Check (setImmediate)     │  │
│  │  5. Close callbacks          │  │
│  └──────────────────────────────┘  │
└────────────┬───────────────────────┘
             │
┌────────────▼───────────────────────┐
│          libuv                     │
│  (OS abstraction, thread pool)     │
└────────────┬───────────────────────┘
             │
┌────────────▼───────────────────────┐
│   Operating System (Kernel)        │
│    (epoll, kqueue, IOCP)           │
└────────────────────────────────────┘
```

### Come Funziona

#### 1. Registrazione Handler

```javascript
const server = net.createServer((socket) => {
    // Handler registrato nell'event loop
    socket.on('data', (chunk) => {
        console.log('Data received');
    });
});

server.listen(8080);
console.log('Server started'); // Esegue subito
```

#### 2. Event Loop Poll

```
┌─────────────────────┐
│   JavaScript Code   │
│   (synchronous)     │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│    Event Loop       │
│                     │
│ → Check for events  │ ← OS notifica: "Dati pronti su socket X"
│                     │
│ → Execute callback  │ → socket.on('data') callback invocato
└──────────┬──────────┘
           │
           ↓
┌──────────────────────┐
│  Back to Event Loop  │
└──────────────────────┘
```

### Gestione Multipla Connessioni

Con un singolo thread, Node.js gestisce migliaia di connessioni:

```javascript
const net = require('net');

const server = net.createServer((socket) => {
    // Ogni socket ha i suoi handler
    socket.on('data', (chunk) => {
        // Elabora dati di QUESTO socket
        console.log(`Client ${socket.remotePort}: ${chunk}`);
    });
});

server.listen(8080);

// Il server può gestire 10.000+ connessioni simultanee
// con un solo thread JavaScript
```

**Come?**

1. **Non-blocking I/O**: Nessun thread bloccato in attesa
2. **Event-driven**: OS notifica quando dati sono pronti
3. **Callbacks**: Codice eseguito solo quando necessario

---

## Error Handling Patterns

Gestione errori è **critica** nel networking.

### Errori Comuni

#### 1. ECONNREFUSED

**Teoria:** Questo errore si verifica quando tenti di connetterti a una porta su cui nessun server è in ascolto. È uno degli errori più comuni e indica che il server non è disponibile o non è stato avviato.

Connessione rifiutata (server non in ascolto):

```javascript
const net = require('net');

console.log('Tentativo di connessione a server non disponibile...');

// Tento di connettermi a una porta dove probabilmente non c'è un server
const socket = net.connect({ 
    port: 8080,           // Porta dove non c'è server in ascolto
    host: 'localhost',
    timeout: 5000         // Timeout opzionale di 5 secondi
});

// Gestione dell'errore ECONNREFUSED
socket.on('error', (err) => {
    // Verifica il codice di errore specifico
    if (err.code === 'ECONNREFUSED') {
        console.error('✗ ERRORE: Connessione rifiutata');
        console.error('  Causa: Nessun server in ascolto sulla porta specificata');
        console.error(`  Porta: ${err.port}`);
        console.error(`  Indirizzo: ${err.address}`);
        
        // Possibili soluzioni:
        console.log('\nPossibili soluzioni:');
        console.log('1. Verifica che il server sia in esecuzione');
        console.log('2. Controlla che la porta sia corretta');
        console.log('3. Verifica che il firewall non blocchi la connessione');
        console.log('4. Se su Windows, controlla Windows Defender');
        
        // Implementa logica di retry
        console.log('\nRitenterò tra 5 secondi...');
        setTimeout(() => {
            retryConnection(8080, 'localhost', 3); // Riprova 3 volte
        }, 5000);
    } else {
        // Altri errori
        console.error('✗ Errore diverso:', err.message);
    }
});

socket.on('connect', () => {
    console.log('✓ Connessione stabilita!');
    socket.end();
});

// Funzione per ritentare la connessione
function retryConnection(port, host, maxAttempts, currentAttempt = 1) {
    if (currentAttempt > maxAttempts) {
        console.error(`✗ Tutti i ${maxAttempts} tentativi falliti. Rinuncio.`);
        return;
    }
    
    console.log(`\nTentativo ${currentAttempt} di ${maxAttempts}...`);
    
    const socket = net.connect({ port, host });
    
    socket.on('error', (err) => {
        if (err.code === 'ECONNREFUSED') {
            console.error(`✗ Tentativo ${currentAttempt} fallito`);
            
            // Exponential backoff: attendi sempre più tempo tra i tentativi
            const delay = 1000 * Math.pow(2, currentAttempt - 1); // 1s, 2s, 4s, 8s...
            console.log(`Prossimo tentativo tra ${delay/1000} secondi...`);
            
            setTimeout(() => {
                retryConnection(port, host, maxAttempts, currentAttempt + 1);
            }, delay);
        }
    });
    
    socket.on('connect', () => {
        console.log(`✓ Connessione stabilita al tentativo ${currentAttempt}!`);
        socket.end();
    });
}

// QUANDO SI VERIFICA:
// - Server non avviato
// - Server crashato
// - Porta errata
// - Server occupato (troppi client, ha smesso di accettare connessioni)

// CODICI HTTP EQUIVALENTI:
// HTTP 503 Service Unavailable
```

#### 2. ETIMEDOUT

**Teoria:** Un timeout si verifica quando una connessione impiega troppo tempo a stabilirsi. Può essere causato da problemi di rete, firewall, server sovraccarico, o semplicemente una rete lenta.

Timeout connessione:

```javascript
const net = require('net');

console.log('Tentativo di connessione con timeout...');

// Crea socket con configurazione timeout
const socket = net.connect({ 
    port: 8080, 
    host: 'example.com' // Server potenzialmente lento
});

// Imposta timeout di 5 secondi per la connessione
// Se la connessione non è stabilita entro 5 secondi, emette evento 'timeout'
socket.setTimeout(5000); // 5000 ms = 5 secondi

// Evento: timeout scaduto
socket.on('timeout', () => {
    console.error('✗ TIMEOUT: La connessione ha impiegato troppo tempo');
    console.error(`  Timeout impostato: ${socket.timeout}ms`);
    console.error(`  Host: ${socket.remoteAddress || 'non ancora risolto'}`);
    
    // IMPORTANTE: Il timeout NON chiude automaticamente il socket!
    // Devi chiuderlo manualmente
    console.log('Chiusura forzata del socket...');
    socket.destroy(); // Distrugge il socket immediatamente
    
    // Genera errore ETIMEDOUT
    // Questo verrà catturato dall'handler 'error'
});

// Evento: errore (cattura ETIMEDOUT)
socket.on('error', (err) => {
    if (err.code === 'ETIMEDOUT') {
        console.error('\n✗ ERRORE: Timeout di connessione');
        console.error('  Causa: Il server non ha risposto in tempo');
        
        // Informazioni sull'errore
        console.error('\nDettagli:');
        console.error(`  Codice: ${err.code}`);
        console.error(`  Messaggio: ${err.message}`);
        console.error(`  Syscall: ${err.syscall}`); // es: 'connect'
        
        // Possibili cause
        console.log('\nPossibili cause:');
        console.log('1. Server sovraccarico');
        console.log('2. Problemi di rete (latenza alta)');
        console.log('3. Firewall che blocca la connessione');
        console.log('4. Server dietro NAT o proxy');
        console.log('5. Server non risponde (ma porta aperta)');
        
        // Azioni suggerite
        console.log('\nAzioni suggerite:');
        console.log('1. Aumenta il timeout');
        console.log('2. Verifica la connettività di rete');
        console.log('3. Prova a connetterti ad un altro server');
        console.log('4. Usa traceroute per diagnosticare il percorso');
        
    } else if (err.code === 'ECONNREFUSED') {
        console.error('✗ Connessione rifiutata (diverso da timeout)');
    } else {
        console.error('✗ Altro errore:', err.message);
    }
});

// Evento: connessione riuscita
socket.on('connect', () => {
    console.log('✓ Connessione stabilita entro il timeout!');
    console.log(`  Tempo impiegato: meno di ${socket.timeout}ms`);
    socket.end();
});

// Evento: socket chiuso
socket.on('close', () => {
    console.log('Socket chiuso');
});

// ESEMPIO CON TIMEOUT ADATTIVO
console.log('\n--- Esempio con timeout adattivo ---');

function connectWithAdaptiveTimeout(port, host, initialTimeout = 5000) {
    let timeout = initialTimeout;
    const maxTimeout = 30000; // 30 secondi max
    
    function attempt() {
        console.log(`\nTentativo con timeout di ${timeout}ms...`);
        
        const socket = net.connect({ port, host });
        socket.setTimeout(timeout);
        
        socket.on('timeout', () => {
            console.error(`✗ Timeout dopo ${timeout}ms`);
            socket.destroy();
            
            // Aumenta il timeout per il prossimo tentativo
            timeout = Math.min(timeout * 2, maxTimeout);
            
            if (timeout <= maxTimeout) {
                console.log(`Ritento con timeout aumentato: ${timeout}ms`);
                setTimeout(attempt, 1000);
            } else {
                console.error('Timeout massimo raggiunto. Rinuncio.');
            }
        });
        
        socket.on('connect', () => {
            console.log(`✓ Connesso con timeout di ${timeout}ms!`);
            socket.end();
        });
        
        socket.on('error', (err) => {
            if (err.code !== 'ETIMEDOUT') {
                console.error('Errore non-timeout:', err.message);
            }
        });
    }
    
    attempt();
}

// DIFFERENZA TRA TIMEOUT TIPI:
// 1. Connection timeout: tempo massimo per stabilire connessione
// 2. Idle timeout: tempo massimo di inattività dopo connessione
// 3. Request timeout: tempo massimo per completare una richiesta

// VALORI TIMEOUT TIPICI:
// - LAN: 1-5 secondi
// - Internet: 10-30 secondi
// - Connessioni lente: 60+ secondi
```

#### 3. EADDRINUSE

**Teoria:** Questo errore si verifica quando provi ad avviare un server su una porta che è già occupata da un altro processo. Ogni porta può essere usata da un solo processo alla volta.

Porta già in uso:

```javascript
const net = require('net');

console.log('Tentativo di avvio server sulla porta 8080...');

// Crea due server per simulare il conflitto di porta
const server1 = net.createServer();
const server2 = net.createServer();

// Primo server: si avvia correttamente
server1.on('listening', () => {
    console.log('✓ Server 1 avviato con successo sulla porta 8080');
    
    // Ora prova ad avviare un secondo server sulla STESSA porta
    console.log('\nTentativo di avviare Server 2 sulla stessa porta...');
    server2.listen(8080); // Questo causerà EADDRINUSE
});

// Gestione errori server 1
server1.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error('✗ Server 1: Porta già in uso');
    }
});

// Gestione errori server 2
server2.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error('\n✗ ERRORE Server 2: Porta già in uso (EADDRINUSE)');
        console.error('  Causa: Un altro processo sta usando la porta 8080');
        console.error(`  Porta: ${err.port}`);
        console.error(`  Address: ${err.address || 'non specificato'}`);
        
        // Informazioni diagnostiche
        console.log('\nInformazioni:');
        console.log('- Solo UN processo può ascoltare su una porta specifica');
        console.log('- La porta rimane "occupata" anche dopo crash del processo');
        console.log('- Può richiedere 1-2 minuti per liberarsi (TIME_WAIT)');
        
        // Soluzioni possibili
        console.log('\nSoluzioni:');
        console.log('1. Trova e termina il processo che usa la porta');
        console.log('   Linux/Mac: lsof -i :8080');
        console.log('   Windows: netstat -ano | findstr :8080');
        console.log('2. Usa una porta diversa');
        console.log('3. Abilita SO_REUSEADDR (in alcuni casi)');
        console.log('4. Aspetta che la porta si liberi (TIME_WAIT)');
        
        // Tentativo automatico con porta alternativa
        console.log('\nTentativo con porta alternativa...');
        findAvailablePort(8081, 8100, (port) => {
            if (port) {
                console.log(`✓ Porta ${port} disponibile, avvio server...`);
                server2.listen(port);
            } else {
                console.error('✗ Nessuna porta disponibile nel range 8081-8100');
                process.exit(1);
            }
        });
    } else {
        console.error('✗ Errore diverso:', err.message);
    }
});

server2.on('listening', () => {
    const addr = server2.address();
    console.log(`✓ Server 2 avviato sulla porta alternativa ${addr.port}`);
    
    // Cleanup: chiudi entrambi i server
    setTimeout(() => {
        console.log('\nChiusura server...');
        server1.close();
        server2.close();
    }, 2000);
});

// Avvia il primo server
server1.listen(8080);

// FUNZIONE HELPER: Trova porta disponibile
function findAvailablePort(startPort, endPort, callback) {
    let port = startPort;
    
    function tryPort() {
        if (port > endPort) {
            callback(null); // Nessuna porta disponibile
            return;
        }
        
        const testServer = net.createServer();
        
        testServer.once('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                console.log(`  Porta ${port} occupata, provo ${port + 1}...`);
                port++;
                tryPort(); // Prova porta successiva
            } else {
                callback(null); // Altro errore
            }
        });
        
        testServer.once('listening', () => {
            // Porta disponibile!
            testServer.close(() => {
                callback(port);
            });
        });
        
        testServer.listen(port);
    }
    
    tryPort();
}

// ESEMPIO: Server con fallback automatico
console.log('\n--- Esempio: Server con fallback automatico ---');

function startServerWithFallback(preferredPort, maxAttempts = 10) {
    let currentPort = preferredPort;
    let attempts = 0;
    
    function tryStart() {
        attempts++;
        
        if (attempts > maxAttempts) {
            console.error(`✗ Impossibile avviare server dopo ${maxAttempts} tentativi`);
            process.exit(1);
            return;
        }
        
        console.log(`Tentativo ${attempts}: porta ${currentPort}...`);
        
        const server = net.createServer((socket) => {
            socket.write('Hello!\n');
            socket.end();
        });
        
        server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                console.log(`  Porta ${currentPort} occupata`);
                currentPort++; // Prova porta successiva
                tryStart();
            } else {
                console.error('Errore:', err.message);
                process.exit(1);
            }
        });
        
        server.on('listening', () => {
            console.log(`✓ Server avviato su porta ${currentPort}`);
            
            // Salva la porta per riferimento futuro
            const fs = require('fs');
            fs.writeFileSync('.port', currentPort.toString());
        });
        
        server.listen(currentPort);
    }
    
    tryStart();
}

// BEST PRACTICES:
// 1. Usa sempre handler 'error' sui server
// 2. Implementa fallback automatico su porte alternative
// 3. Documenta quale porta usa la tua app
// 4. In produzione, usa process manager (PM2) che gestisce questo
// 5. Considera l'uso di SO_REUSEADDR per development

// PORTE COMUNI DA EVITARE:
// 80, 443 (HTTP/HTTPS - richiedono privilegi)
// 22 (SSH)
// 25 (SMTP)
// 3306 (MySQL)
// 5432 (PostgreSQL)
// 6379 (Redis)
// 27017 (MongoDB)
```

#### 4. ENOTFOUND

**Teoria:** Questo errore si verifica quando il sistema DNS non riesce a risolvere il nome host in un indirizzo IP. È equivalente a digitare un indirizzo web che non esiste.

Host non trovato (DNS failed):

```javascript
const net = require('net');

console.log('Tentativo di connessione a host inesistente...');

// Tento di connettermi a un hostname che sicuramente non esiste
const socket = net.connect({ 
    port: 80, 
    host: 'questo-sito-non-esiste-assolutamente.invalid' // TLD .invalid non esiste
});

// Gestione errore ENOTFOUND
socket.on('error', (err) => {
    if (err.code === 'ENOTFOUND') {
        console.error('\n✗ ERRORE: Host non trovato (ENOTFOUND)');
        console.error('  Causa: DNS non è riuscito a risolvere il nome host');
        
        // Dettagli dell'errore
        console.error('\nDettagli:');
        console.error(`  Hostname: ${err.hostname}`);
        console.error(`  Codice: ${err.code}`);
        console.error(`  Syscall: ${err.syscall}`); // 'getaddrinfo'
        console.error(`  Messaggio: ${err.message}`);
        
        // Possibili cause
        console.log('\nPossibili cause:');
        console.log('1. Hostname digitato male (typo)');
        console.log('2. Dominio non esiste o non è registrato');
        console.log('3. Server DNS non raggiungibile');
        console.log('4. Problemi di connessione Internet');
        console.log('5. File /etc/hosts mancante (Linux/Mac)');
        console.log('6. DNS cache corrotta');
        
        // Soluzioni
        console.log('\nSoluzioni:');
        console.log('1. Verifica il nome host');
        console.log('2. Testa con comando: ping <hostname>');
        console.log('3. Testa con comando: nslookup <hostname>');
        console.log('4. Prova con IP diretto invece di hostname');
        console.log('5. Cambia server DNS (es: 8.8.8.8 Google DNS)');
        console.log('6. Svuota cache DNS:');
        console.log('   - Windows: ipconfig /flushdns');
        console.log('   - Mac: sudo dscacheutil -flushcache');
        console.log('   - Linux: sudo systemd-resolve --flush-caches');
        
        // Tentativo con IP diretto (bypass DNS)
        console.log('\nTentativo con indirizzo IP diretto...');
        retryWithIP();
        
    } else if (err.code === 'ECONNREFUSED') {
        console.error('✗ Host trovato ma connessione rifiutata');
    } else if (err.code === 'ETIMEDOUT') {
        console.error('✗ Timeout (host potrebbe non esistere o essere irraggiungibile)');
    } else {
        console.error('✗ Altro errore:', err.code, err.message);
    }
});

socket.on('connect', () => {
    console.log('✓ Connessione stabilita!');
    socket.end();
});

// Funzione per ritentare con IP invece di hostname
function retryWithIP() {
    // Esempio: uso IP di Google invece di hostname
    const ipSocket = net.connect({ port: 80, host: '8.8.8.8' });
    
    ipSocket.on('connect', () => {
        console.log('✓ Connessione riuscita usando IP diretto');
        ipSocket.end();
    });
    
    ipSocket.on('error', (err) => {
        console.error('✗ Errore anche con IP:', err.message);
    });
}

// ESEMPIO: Verifica DNS prima di connettersi
console.log('\n--- Esempio: Verifica DNS prima di connessione ---');

const dns = require('dns');

function connectWithDnsCheck(hostname, port) {
    console.log(`\nVerifica DNS per ${hostname}...`);
    
    // Risolvi hostname in IP usando DNS
    dns.lookup(hostname, (err, address, family) => {
        if (err) {
            if (err.code === 'ENOTFOUND') {
                console.error(`✗ DNS: Hostname "${hostname}" non trovato`);
                console.log('Impossibile procedere con la connessione');
            } else {
                console.error('✗ Errore DNS:', err.message);
            }
            return;
        }
        
        // DNS risoluzione riuscita
        console.log(`✓ DNS risolto: ${hostname} → ${address} (IPv${family})`);
        console.log('Procedo con la connessione...');
        
        // Ora connettiti usando l'IP risolto
        const socket = net.connect({ port, host: address });
        
        socket.on('connect', () => {
            console.log(`✓ Connesso a ${hostname} (${address}:${port})`);
            socket.end();
        });
        
        socket.on('error', (err) => {
            console.error('✗ Errore connessione:', err.message);
        });
    });
}

// Test con hostname valido
connectWithDnsCheck('www.google.com', 80);

// ESEMPIO: Cache DNS custom
console.log('\n--- Esempio: Cache DNS custom ---');

class DnsCache {
    constructor(ttl = 300000) { // TTL default: 5 minuti
        this.cache = new Map();
        this.ttl = ttl;
    }
    
    resolve(hostname, callback) {
        // Controlla cache
        if (this.cache.has(hostname)) {
            const cached = this.cache.get(hostname);
            const age = Date.now() - cached.timestamp;
            
            if (age < this.ttl) {
                console.log(`✓ Cache HIT per ${hostname} (età: ${age}ms)`);
                callback(null, cached.address, cached.family);
                return;
            } else {
                console.log(`⚠ Cache EXPIRED per ${hostname}`);
                this.cache.delete(hostname);
            }
        }
        
        console.log(`Cache MISS per ${hostname}, interrogo DNS...`);
        
        // Risolvi con DNS
        dns.lookup(hostname, (err, address, family) => {
            if (err) {
                callback(err);
                return;
            }
            
            // Salva in cache
            this.cache.set(hostname, {
                address,
                family,
                timestamp: Date.now()
            });
            
            console.log(`✓ DNS risolto e cachato: ${hostname} → ${address}`);
            callback(null, address, family);
        });
    }
    
    clear() {
        console.log('Cache DNS svuotata');
        this.cache.clear();
    }
}

const dnsCache = new DnsCache();

// Usa cache DNS
dnsCache.resolve('www.example.com', (err, address) => {
    if (err) {
        console.error('Errore:', err.message);
    } else {
        console.log(`Risolto: ${address}`);
    }
});

// DIFFERENZA TRA ERRORI DNS:
// ENOTFOUND: hostname non esiste (DNS lookup failed)
// ENOENT: file hosts non trovato (raro)
// ESERVFAIL: server DNS ha fallito (problema server DNS)
// ETIMEDOUT: DNS server non risponde

// BEST PRACTICES:
// 1. Implementa retry per errori temporanei DNS
// 2. Usa cache DNS per ridurre latenza
// 3. Considera fallback a IP diretto se possibile
// 4. Monitora e logga errori DNS in produzione
// 5. Usa DNS affidabili (8.8.8.8, 1.1.1.1)
```

---

### Pattern di Gestione Errori

#### 1. Always Listen for Errors

**Teoria:** In Node.js, se un EventEmitter (come un socket) emette un evento 'error' e non c'è un listener registrato, l'applicazione CRASHA. È quindi FONDAMENTALE registrare sempre un handler per gli errori.

```javascript
const net = require('net');

// ❌ MALE: Nessun handler errori
// Se si verifica un errore, l'applicazione CRASHA con:
// "Uncaught Error: connect ECONNREFUSED"
console.log('❌ Esempio SBAGLIATO:');
const badSocket = net.connect({ port: 9999 }); // Porta probabilmente non in uso
// Questo socket NON ha handler 'error' → PERICOLOSO!

// Aspetta 1 secondo per dare tempo all'errore di verificarsi
setTimeout(() => {
    console.log('\n✅ Esempio CORRETTO:');
    
    // ✅ BENE: Gestisci SEMPRE gli errori
    const goodSocket = net.connect({ port: 9999 });
    
    // IMPORTANTE: Registra l'handler PRIMA che l'errore possa verificarsi
    goodSocket.on('error', (err) => {
        // Questo handler previene il crash dell'applicazione
        console.error('Errore catturato:', err.message);
        console.log('✓ Applicazione continua a funzionare');
        
        // Puoi gestire l'errore come preferisci:
        // - Log per debugging
        // - Notifica all'utente
        // - Retry automatico
        // - Fallback a servizio alternativo
        // - Etc.
    });
    
    goodSocket.on('connect', () => {
        console.log('Connesso!');
        goodSocket.end();
    });
    
}, 1000);

// ESEMPIO: Handler errori generico riutilizzabile
function createSafeSocket(options) {
    const socket = net.connect(options);
    
    // Handler errori di default che previene crash
    socket.on('error', (err) => {
        console.error(`[Socket Error] ${err.code}: ${err.message}`);
        
        // Log dettagli per debugging
        console.error('Stack trace:', err.stack);
        
        // Emetti evento custom per permettere gestione personalizzata
        socket.emit('safeError', err);
    });
    
    return socket;
}

// Uso:
const safeSocket = createSafeSocket({ port: 8080, host: 'localhost' });

// Puoi comunque aggiungere gestione personalizzata
safeSocket.on('safeError', (err) => {
    if (err.code === 'ECONNREFUSED') {
        console.log('Implementa retry logic...');
    }
});

// BEST PRACTICE: Error-first pattern
function connectWithCallback(options, callback) {
    const socket = net.connect(options);
    
    socket.on('error', (err) => {
        // Error-first callback: primo argomento è sempre l'errore
        callback(err, null);
    });
    
    socket.on('connect', () => {
        // Successo: primo argomento null, secondo il risultato
        callback(null, socket);
    });
}

// Uso con error-first callback
connectWithCallback({ port: 8080 }, (err, socket) => {
    if (err) {
        console.error('Connessione fallita:', err.message);
        return; // Gestisci errore ed esci
    }
    
    // Successo: usa il socket
    console.log('✓ Socket connesso');
    socket.end();
});

// PERCHÉ È COSÌ IMPORTANTE:
// 1. Previene crash inaspettati dell'applicazione
// 2. Permette recovery graceful da errori
// 3. Migliora esperienza utente (no crash)
// 4. Facilita debugging con log appropriati
// 5. Permette retry e fallback logic

// REGOLA D'ORO:
// OGNI socket DEVE avere un handler 'error' registrato
// SUBITO dopo la creazione, PRIMA di qualsiasi operazione
```

#### 2. Graceful Degradation

**Teoria:** La "Graceful Degradation" (degradazione elegante) è un pattern che permette all'applicazione di continuare a funzionare anche quando un servizio secondario non è disponibile. Invece di crashare, l'applicazione offre funzionalità ridotte ma comunque utili.

```javascript
const net = require('net');

// ESEMPIO: Applicazione che continua a funzionare anche senza cache
const socket = net.connect({ port: 8080 });

socket.on('error', (err) => {
    // IMPORTANTE: Non terminare l'applicazione, ma adattarsi
    console.error('Connection failed:', err.message);
    console.log('→ Fallback: usando cache locale o dati di default');
    
    // DEGRADATION: Funzionalità ridotte ma app continua
    // Opzione 1: Usa cache locale (più lenta ma funziona)
    const cachedData = getFromCache();
    processData(cachedData);
    
    // Opzione 2: Usa dati di default
    // processData(DEFAULT_DATA);
    
    // Opzione 3: Modalità read-only
    // enableReadOnlyMode();
});

socket.on('connect', () => {
    console.log('✓ Servizio esterno connesso - Funzionalità complete');
});

// IMPLEMENTAZIONE COMPLETA con gestione stato
function getFromCache() {
    // Simulazione cache locale
    return { status: 'cached', data: 'fallback data' };
}

function processData(data) {
    console.log('Elaborazione dati:', data);
}

/**
 * PATTERN: Multi-tier fallback
 * Tenta servizi in ordine di preferenza
 */
class ServiceClient {
    constructor() {
        this.primaryHost = 'primary.example.com';
        this.secondaryHost = 'secondary.example.com';
        this.localCache = new Map();
    }
    
    async getData(key) {
        // TIER 1: Servizio primario (preferito)
        try {
            console.log('Tentativo servizio primario...');
            return await this.getFromPrimary(key);
        } catch (err) {
            console.warn('Primario fallito:', err.message);
        }
        
        // TIER 2: Servizio secondario (backup)
        try {
            console.log('Tentativo servizio secondario...');
            return await this.getFromSecondary(key);
        } catch (err) {
            console.warn('Secondario fallito:', err.message);
        }
        
        // TIER 3: Cache locale (last resort)
        console.log('Usando cache locale (degraded mode)');
        return this.localCache.get(key) || null;
    }
    
    getFromPrimary(key) {
        return new Promise((resolve, reject) => {
            const socket = net.connect({ 
                host: this.primaryHost, 
                port: 8080,
                timeout: 2000 // Timeout breve per fallback rapido
            });
            
            socket.on('connect', () => {
                socket.write(`GET ${key}\n`);
            });
            
            socket.on('data', (data) => {
                resolve(data.toString());
                socket.end();
            });
            
            socket.on('error', reject);
            socket.on('timeout', () => {
                socket.destroy();
                reject(new Error('Primary timeout'));
            });
        });
    }
    
    getFromSecondary(key) {
        // Implementazione simile a getFromPrimary
        return Promise.reject(new Error('Not implemented'));
    }
}

// VANTAGGI:
// - Resilienza: app funziona sempre
// - UX migliore: no downtime totale
// - Tempo per fix: puoi riparare servizi senza urgenza
// - Deploy sicuro: servizi possono riavviarsi indipendentemente
```

#### 3. Retry Logic

**Teoria:** Il "Retry Logic" (logica di riprova) è un pattern fondamentale per gestire errori di rete transitori. Molti errori di connessione sono TEMPORANEI (server sovraccarico, rete congestionata), quindi riprovare dopo un breve intervallo spesso risolve il problema.

**Exponential Backoff:** Tecnica che aumenta progressivamente l'intervallo tra tentativi per:
1. Evitare di sovraccaricare ulteriormente un server già in difficoltà
2. Dare tempo al problema di risolversi
3. Ridurre il traffico di rete durante problemi

```javascript
/**
 * Connessione con retry automatico e exponential backoff
 * 
 * @param {number} port - Porta di destinazione
 * @param {string} host - Host di destinazione
 * @param {number} maxRetries - Numero massimo di tentativi (default: 5)
 * @returns {Socket} Socket connesso (o che continuerà a riprovare)
 */
function connectWithRetry(port, host, maxRetries = 5) {
    let attempt = 0; // Contatore tentativi correnti
    
    function tryConnect() {
        attempt++; // Incrementa contatore ad ogni tentativo
        
        console.log(`🔄 Tentativo ${attempt}/${maxRetries}...`);
        
        // Crea nuovo socket per questo tentativo
        const socket = net.connect({ port, host });
        
        socket.on('connect', () => {
            // ✅ SUCCESSO: Connessione riuscita
            console.log(`✅ Connesso al tentativo ${attempt}`);
            
            // Reset contatore per eventuali future disconnessioni
            attempt = 0;
        });
        
        socket.on('error', (err) => {
            // ❌ FALLIMENTO: Tentativo non riuscito
            console.error(`❌ Attempt ${attempt} failed:`, err.message);
            
            if (attempt < maxRetries) {
                // EXPONENTIAL BACKOFF: Attesa crescente tra tentativi
                // Tentativo 1: 1000ms (1 secondo)
                // Tentativo 2: 2000ms (2 secondi)
                // Tentativo 3: 3000ms (3 secondi)
                // Tentativo 4: 4000ms (4 secondi)
                // Tentativo 5: 5000ms (5 secondi)
                const delayMs = 1000 * attempt;
                
                console.log(`⏳ Nuovo tentativo tra ${delayMs}ms...`);
                
                // Programma nuovo tentativo dopo il delay
                setTimeout(() => {
                    tryConnect(); // RICORSIONE: richiama sé stessa
                }, delayMs);
            } else {
                // MAX RETRIES RAGGIUNTO: Abbandona
                console.error('Max retries reached');
                console.error('→ Connessione definitivamente fallita');
                
                // Emetti evento custom per gestione esterna
                socket.emit('maxRetriesReached', {
                    attempts: attempt,
                    lastError: err
                });
            }
        });
        
        return socket;
    }
    
    return tryConnect(); // Avvia il primo tentativo
}

// UTILIZZO
const socket = connectWithRetry(8080, 'localhost');

socket.on('maxRetriesReached', (info) => {
    console.log('Implementa fallback o notifica utente');
    console.log(`Fallito dopo ${info.attempts} tentativi`);
});

// PERCHÉ EXPONENTIAL BACKOFF?
// 1. Server sovraccarico: dargli tempo di recuperare
// 2. Rete congestionata: ridurre traffico aggiuntivo
// 3. Rate limiting: rispettare limiti API
// 4. Fairness: non monopolizzare risorse

// QUANDO USARE RETRY:
// ✅ ECONNREFUSED - Server potrebbe essere in avvio
// ✅ ETIMEDOUT - Rete congestionata, riprova
// ✅ EHOSTUNREACH - Route temporaneamente down
// ❌ ENOTFOUND - DNS error, riprovare non aiuta
// ❌ 4xx HTTP Errors - Errore client, non server
```

#### 4. Circuit Breaker

**Teoria:** Il "Circuit Breaker" (interruttore automatico) è un pattern avanzato ispirato agli interruttori elettrici. Quando un servizio continua a fallire, invece di bombardarlo con richieste, il circuit breaker "apre il circuito" e blocca temporaneamente le richieste, dando tempo al servizio di recuperare.

**Stati del Circuit Breaker:**
1. **CLOSED (Chiuso)**: Tutto normale, richieste passano
2. **OPEN (Aperto)**: Troppi errori, richieste bloccate
3. **HALF_OPEN (Semi-aperto)**: Test se il servizio è recuperato

**Vantaggi:**
- Previene sovraccarico di servizi già in difficoltà
- Fallimento veloce invece di timeout lunghi
- Recovery automatico quando servizio torna disponibile

```javascript
const net = require('net');

/**
 * Circuit Breaker Pattern Implementation
 * 
 * Protegge un servizio bloccando richieste quando troppi errori
 * si verificano in sequenza
 */
class CircuitBreaker {
    /**
     * @param {number} threshold - Numero errori consecutivi prima di aprire (default: 5)
     * @param {number} timeout - Millisecondi prima di testare recovery (default: 30000)
     */
    constructor(threshold = 5, timeout = 30000) {
        this.failures = 0;           // Contatore errori consecutivi
        this.threshold = threshold;  // Limite errori tollerati
        this.timeout = timeout;      // Tempo prima di retry
        this.state = 'CLOSED';       // Stato iniziale: tutto OK
        this.nextAttempt = Date.now(); // Quando tentare prossimo test
        
        console.log(`Circuit Breaker inizializzato:`);
        console.log(`  - Threshold: ${threshold} failures`);
        console.log(`  - Timeout: ${timeout}ms`);
        console.log(`  - Stato iniziale: CLOSED\n`);
    }
    
    /**
     * Tenta connessione attraverso il circuit breaker
     * Blocca richiesta se circuito OPEN
     */
    async connect(port, host) {
        // CHECK 1: Se circuito APERTO, verifica se è tempo di test
        if (this.state === 'OPEN') {
            const now = Date.now();
            
            if (now < this.nextAttempt) {
                // Troppo presto, blocca richiesta
                const waitMs = this.nextAttempt - now;
                console.log(`🚨 Circuit breaker OPEN`);
                console.log(`   Retry disponibile tra ${waitMs}ms`);
                throw new Error('Circuit breaker OPEN - Service unavailable');
            }
            
            // È tempo di test: passa a HALF_OPEN
            console.log('🔄 Circuit breaker → HALF_OPEN (testing recovery)');
            this.state = 'HALF_OPEN';
        }
        
        // CHECK 2: Tenta connessione
        try {
            console.log(`Tentativo connessione (stato: ${this.state})...`);
            const socket = await this.tryConnect(port, host);
            
            // ✅ SUCCESSO: Reset e chiudi circuito
            this.onSuccess();
            return socket;
            
        } catch (err) {
            // ❌ FALLIMENTO: Registra errore
            this.onFailure();
            throw err;
        }
    }
    
    /**
     * Chiamato su connessione RIUSCITA
     * Reset contatore e chiudi circuito
     */
    onSuccess() {
        console.log('✅ Connessione riuscita');
        
        // Reset completo
        this.failures = 0;
        this.state = 'CLOSED';
        
        console.log('   Circuit breaker → CLOSED');
        console.log('   Failures counter reset to 0\n');
    }
    
    /**
     * Chiamato su connessione FALLITA
     * Incrementa contatore e valuta se aprire circuito
     */
    onFailure() {
        this.failures++; // Incrementa contatore errori
        
        console.error(`❌ Failure ${this.failures}/${this.threshold}`);
        
        // THRESHOLD RAGGIUNTO: Apri circuito
        if (this.failures >= this.threshold) {
            this.state = 'OPEN';
            this.nextAttempt = Date.now() + this.timeout;
            
            const retryDate = new Date(this.nextAttempt);
            console.log('🚨 Circuit breaker → OPEN');
            console.log(`   Threshold raggiunto (${this.failures} failures)`);
            console.log(`   Prossimo test: ${retryDate.toLocaleTimeString()}`);
            console.log(`   Tutte le richieste BLOCCATE per ${this.timeout}ms\n`);
            
            // NOTA: In stato OPEN, le richieste sono IMMEDIATAMENTE
            // respinte senza tentare connessione, riducendo carico
        } else {
            console.log(`   Circuit breaker ancora CLOSED (${this.threshold - this.failures} failures rimasti)\n`);
        }
    }
    
    /**
     * Tenta connessione TCP effettiva
     * @returns {Promise<Socket>}
     */
    tryConnect(port, host) {
        return new Promise((resolve, reject) => {
            const socket = net.connect({ 
                port, 
                host,
                timeout: 5000 // 5 secondi timeout
            });
            
            socket.on('connect', () => {
                console.log('   Socket connesso');
                resolve(socket);
            });
            
            socket.on('error', (err) => {
                console.error(`   Socket error: ${err.message}`);
                reject(err);
            });
            
            socket.on('timeout', () => {
                console.error('   Socket timeout');
                socket.destroy();
                reject(new Error('Connection timeout'));
            });
        });
    }
    
    /**
     * Stato corrente del circuit breaker
     */
    getStatus() {
        return {
            state: this.state,
            failures: this.failures,
            threshold: this.threshold,
            nextAttempt: this.state === 'OPEN' ? 
                new Date(this.nextAttempt).toISOString() : null
        };
    }
}

// ============================================
// ESEMPIO DI UTILIZZO
// ============================================

console.log('=== DEMO Circuit Breaker ===\n');

// Crea circuit breaker con threshold basso per demo
const breaker = new CircuitBreaker(3, 10000); // 3 failures, 10s timeout

// Simula 5 richieste consecutive a servizio down
async function testCircuitBreaker() {
    for (let i = 1; i <= 5; i++) {
        console.log(`--- Richiesta ${i} ---`);
        
        try {
            const socket = await breaker.connect(9999, 'localhost');
            console.log('Connessione OK');
            socket.end();
        } catch (err) {
            console.error('Richiesta fallita:', err.message);
        }
        
        // Mostra stato breaker
        const status = breaker.getStatus();
        console.log('Status:', JSON.stringify(status, null, 2));
        
        // Pausa tra richieste
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('\n=== Nota il comportamento: ===');
    console.log('Richieste 1-3: Tentano connessione (failures counter aumenta)');
    console.log('Richiesta 4+: BLOCCATE immediatamente (circuit OPEN)');
    console.log('             → Fail fast invece di timeout lunghi');
    console.log('             → Protegge servizio da ulteriore carico');
}

testCircuitBreaker();

// ============================================
// INTEGRAZIONE CON RETRY LOGIC
// ============================================

/**
 * Circuit Breaker + Retry Logic combinati
 * Massima resilienza con protezione servizio
 */
class ResilientClient {
    constructor() {
        this.breaker = new CircuitBreaker(5, 30000);
        this.maxRetries = 3;
    }
    
    async connectWithRetry(port, host) {
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                // Tenta attraverso circuit breaker
                return await this.breaker.connect(port, host);
            } catch (err) {
                console.error(`Tentativo ${attempt} fallito: ${err.message}`);
                
                if (err.message.includes('Circuit breaker OPEN')) {
                    // Circuit aperto: non retry, aspetta reset
                    console.log('Circuit OPEN - Attendi timeout');
                    throw err;
                }
                
                if (attempt < this.maxRetries) {
                    // Retry con backoff
                    const delay = 1000 * attempt;
                    console.log(`Retry tra ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
        
        throw new Error('Max retries reached');
    }
}

// VANTAGGI COMBINAZIONE:
// - Retry: gestisce errori transitori
// - Circuit Breaker: protegge da failure prolungati
// - Fail Fast: quando servizio è down
// - Auto Recovery: testa periodicamente se servizio è tornato

/**
 * QUANDO USARE CIRCUIT BREAKER:
 * ✅ Chiamate a servizi esterni (API, microservizi)
 * ✅ Operazioni che possono fallire ripetutamente
 * ✅ Sistemi distribuiti con dipendenze
 * ✅ Prevenzione cascading failures
 * 
 * PARAMETRI TIPICI:
 * - Threshold: 5-10 failures
 * - Timeout: 30-60 secondi
 * - Monitora metriche per tuning
 */
```

---

## Riepilogo

In questa guida abbiamo esplorato:

✅ **Socket**: Concetto e componenti  
✅ **Stream vs Datagram**: TCP vs UDP  
✅ **Lifecycle**: Stati di un socket  
✅ **Blocking vs Non-blocking**: I/O asincrono  
✅ **Event Loop**: Architettura Node.js  
✅ **Error Handling**: Pattern di gestione errori  

Questi concetti sono essenziali per scrivere applicazioni di rete robuste e scalabili.

---

## Prossimi Passi

Nella prossima guida vedremo come preparare l'**Ambiente di Sviluppo** per networking con Node.js.

📖 **Prossima guida:** [1.5 Preparazione Ambiente di Sviluppo](./05-Preparazione_Ambiente.md)
