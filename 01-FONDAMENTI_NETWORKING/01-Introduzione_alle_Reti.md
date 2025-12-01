# 1.1 Introduzione alle Reti

## Indice
- [Modello OSI e TCP/IP Stack](#modello-osi-e-tcpip-stack)
- [Protocolli di Rete Principali](#protocolli-di-rete-principali)
- [Client-Server Architecture](#client-server-architecture)
- [Peer-to-Peer Architecture](#peer-to-peer-architecture)
- [Request-Response Pattern](#request-response-pattern)
- [Socket Programming Basics](#socket-programming-basics)
- [Use Case per Applicazioni di Rete](#use-case-per-applicazioni-di-rete)
- [Architettura di Rete in Node.js](#architettura-di-rete-in-nodejs)

---

## Modello OSI e TCP/IP Stack

### Il Modello OSI (7 Layer)

Il modello **OSI** (Open Systems Interconnection) è un framework concettuale che divide la comunicazione di rete in 7 livelli distinti:

| Livello | Nome | Funzione | Esempi |
|---------|------|----------|--------|
| 7 | **Application** | Interfaccia applicazioni | HTTP, FTP, SMTP, DNS |
| 6 | **Presentation** | Formattazione dati | SSL/TLS, JPEG, ASCII |
| 5 | **Session** | Gestione sessioni | NetBIOS, RPC |
| 4 | **Transport** | Trasporto end-to-end | TCP, UDP |
| 3 | **Network** | Routing pacchetti | IP, ICMP, ARP |
| 2 | **Data Link** | Trasmissione frame | Ethernet, Wi-Fi |
| 1 | **Physical** | Trasmissione bit | Cavi, Hub, Onde Radio |

### Il Modello TCP/IP (4 Layer)

Il modello **TCP/IP** è il modello pratico utilizzato su Internet:

| Livello TCP/IP | Corrispondenza OSI | Protocolli |
|----------------|-------------------|------------|
| **Application** | 7, 6, 5 | HTTP, FTP, SMTP, DNS, SSH |
| **Transport** | 4 | TCP, UDP, SCTP |
| **Internet** | 3 | IP, ICMP, ARP |
| **Network Access** | 2, 1 | Ethernet, Wi-Fi, PPP |

### Confronto OSI vs TCP/IP

```
    OSI Model              TCP/IP Model
┌─────────────────┐    ┌─────────────────┐
│  Application    │    │                 │
├─────────────────┤    │                 │
│  Presentation   │    │  Application    │
├─────────────────┤    │                 │
│  Session        │    │                 │
├─────────────────┤    ├─────────────────┤
│  Transport      │    │  Transport      │
├─────────────────┤    ├─────────────────┤
│  Network        │    │  Internet       │
├─────────────────┤    ├─────────────────┤
│  Data Link      │    │  Network        │
├─────────────────┤    │  Access         │
│  Physical       │    │                 │
└─────────────────┘    └─────────────────┘
```

---

## Protocolli di Rete Principali

### TCP (Transmission Control Protocol)

**Caratteristiche:**
- ✅ **Connection-oriented**: Stabilisce connessione prima di trasmettere
- ✅ **Reliable**: Garantisce la consegna dei dati nell'ordine corretto
- ✅ **Flow control**: Gestisce la velocità di trasmissione
- ✅ **Error checking**: Rileva e corregge errori
- ❌ **Overhead**: Più lento di UDP

**Quando usarlo:**
- Transfer di file (FTP, HTTP)
- Email (SMTP, POP3, IMAP)
- Web browsing (HTTP/HTTPS)
- SSH, Telnet
- Qualsiasi applicazione che richiede affidabilità

### UDP (User Datagram Protocol)

**Caratteristiche:**
- ✅ **Connectionless**: Nessuna connessione preliminare
- ✅ **Fast**: Minimo overhead
- ✅ **Low latency**: Ideale per real-time
- ❌ **Unreliable**: Nessuna garanzia di consegna
- ❌ **No ordering**: I pacchetti possono arrivare disordinati

**Quando usarlo:**
- Streaming video/audio
- Gaming online
- DNS queries
- VoIP
- IoT sensors
- Broadcast/Multicast

### IP (Internet Protocol)

**IPv4:**
- Indirizzo a 32 bit (es: `192.168.1.1`)
- ~4.3 miliardi di indirizzi
- Classi: A, B, C, D, E
- Subnetting con CIDR

**IPv6:**
- Indirizzo a 128 bit (es: `2001:0db8:85a3::8a2e:0370:7334`)
- 340 undecilioni di indirizzi
- Semplifica routing
- Security integrata (IPsec)

### Altri Protocolli Importanti

| Protocollo | Livello | Funzione |
|------------|---------|----------|
| **HTTP/HTTPS** | Application | Web browsing |
| **DNS** | Application | Risoluzione nomi |
| **FTP** | Application | File transfer |
| **SMTP** | Application | Email sending |
| **SSH** | Application | Remote access sicuro |
| **ICMP** | Network | Diagnostica (ping) |
| **ARP** | Network | IP → MAC address |

---

## Client-Server Architecture

### Concetto Base

Il modello **Client-Server** è il paradigma fondamentale delle reti moderne:

```
┌─────────────┐          Request         ┌─────────────┐
│             │ ───────────────────────> │             │
│   CLIENT    │                          │   SERVER    │
│             │ <─────────────────────── │             │
└─────────────┘          Response        └─────────────┘
```

### Caratteristiche

**Server:**
- 🎯 **Sempre in ascolto**: Attende connessioni su una porta specifica
- 🎯 **Fornisce servizi**: Elabora richieste e restituisce risposte
- 🎯 **Gestisce più client**: Serve contemporaneamente più connessioni
- 🎯 **Centralizzato**: Controlla dati e logica di business

**Client:**
- 📱 **Inizia la comunicazione**: Apre connessione verso il server
- 📱 **Richiede servizi**: Invia richieste e riceve risposte
- 📱 **Può essere multiplo**: Molti client per un server
- 📱 **Leggero**: Logica minima, delega al server

### Vantaggi

✅ **Centralizzazione**: Dati e logica in un unico punto  
✅ **Sicurezza**: Controllo centralizzato degli accessi  
✅ **Manutenzione**: Aggiornamenti solo lato server  
✅ **Scalabilità**: Possibile aumentare risorse server  
✅ **Backup**: Backup centralizzato dei dati  

### Svantaggi

❌ **Single Point of Failure**: Se il server cade, tutto si ferma  
❌ **Bottleneck**: Il server può diventare un collo di bottiglia  
❌ **Costo**: Server potenti sono costosi  
❌ **Latenza**: Ogni richiesta passa per il server  

### Esempi

- **Web**: Browser (client) → Web Server
- **Email**: Client email → Mail Server (SMTP/POP3/IMAP)
- **Database**: App → Database Server
- **Gaming**: Game client → Game server
- **Cloud Storage**: App → Cloud server (Dropbox, Google Drive)

---

## Peer-to-Peer Architecture

### Concetto Base

Nel modello **P2P**, ogni nodo è contemporaneamente client e server:

```
    ┌─────────┐
    │  Peer A │ ←─────────────┐
    └────┬────┘               │
         │                    │
         ↓                    │
    ┌─────────┐          ┌────┴────┐
    │  Peer B │ ←───────>│  Peer C │
    └─────────┘          └─────────┘
```

### Caratteristiche

- 🔄 **Decentralizzato**: Nessun server centrale
- 🔄 **Simmetrico**: Ogni peer ha stesse responsabilità
- 🔄 **Scalabile**: Performance aumenta con più peer
- 🔄 **Resiliente**: Nessun single point of failure

### Vantaggi

✅ **Costo ridotto**: Nessun server centrale costoso  
✅ **Scalabilità**: Più peer = più risorse disponibili  
✅ **Resilienza**: Sistema continua anche se peer vanno offline  
✅ **Distribuzione carico**: Carico distribuito su tutti i peer  

### Svantaggi

❌ **Complessità**: Più difficile da implementare  
❌ **Sicurezza**: Difficile controllare accessi  
❌ **Consistenza**: Difficile mantenere dati sincronizzati  
❌ **Discovery**: Trovare peer può essere complesso  

### Esempi

- **BitTorrent**: File sharing P2P
- **Bitcoin/Blockchain**: Cryptocurrency network
- **WebRTC**: Video chat P2P
- **IPFS**: Distributed file system
- **Tor**: Anonymous network

### Hybrid P2P

Alcuni sistemi usano un approccio **ibrido**:

```
         ┌────────────────┐
         │  Index Server  │ (centrale)
         └────────┬───────┘
              │   │   │
         ┌────┘   │   └────┐
         ↓        ↓        ↓
    ┌────────┐ ┌────────┐ ┌────────┐
    │ Peer A │ │ Peer B │ │ Peer C │
    └───┬────┘ └────┬───┘ └───┬────┘
        └───────────┴─────────┘
         (comunicazione P2P)
```

**Esempio:** Skype (vecchia architettura) - server per login e discovery, comunicazione P2P

---

## Request-Response Pattern

### Concetto Base

Il pattern **Request-Response** è il modello di comunicazione più comune:

```
CLIENT                               SERVER
  │                                    │
  │──── (1) Request ───────────────>   │
  │                                    │
  │                              (2) Process
  │                                    │
  │  <───── (3) Response ──────────────│
  │                                    │
```

### Caratteristiche

1. **Request (Richiesta)**
   - Inviata dal client
   - Contiene: metodo, dati, headers
   - Può essere sincrona o asincrona

2. **Processing (Elaborazione)**
   - Server elabora la richiesta
   - Può accedere a database
   - Applica logica di business

3. **Response (Risposta)**
   - Inviata dal server
   - Contiene: status, dati, headers
   - Termina il ciclo request-response

### Tipi di Request-Response

#### 1. Sincrone (Blocking)

```javascript
// Client attende la risposta
const response = await fetch('/api/data');
const data = await response.json();
console.log(data); // Esegue solo dopo la risposta
```

#### 2. Asincrone (Non-blocking)

```javascript
// Client continua l'esecuzione
fetch('/api/data')
    .then(response => response.json())
    .then(data => console.log(data));

console.log('Continua...'); // Esegue subito
```

### HTTP Request-Response

**HTTP Request:**
```http
GET /api/users/123 HTTP/1.1
Host: example.com
Authorization: Bearer token123
Content-Type: application/json
```

**HTTP Response:**
```http
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 58

{"id": 123, "name": "Mario Rossi", "email": "mario@example.com"}
```

### Pattern Avanzati

#### 1. Long Polling

Client fa polling periodico per aggiornamenti:

```
CLIENT                  SERVER
  │──── Request ──────>  │
  │                      │ (attende evento)
  │                      │
  │  <─── Response ──────│ (dopo evento)
  │                      │
  │──── Request ──────>  │ (nuovo ciclo)
```

#### 2. Streaming Response

Server invia risposta in chunk:

```
CLIENT                  SERVER
  │──── Request ──────>  │
  │                      │
  │  <─── Chunk 1 ───────│
  │  <─── Chunk 2 ───────│
  │  <─── Chunk 3 ───────│
  │  <─── End ───────────│
```

---

## Socket Programming Basics

### Cos'è un Socket?

Un **socket** è un'astrazione software che rappresenta un **endpoint di comunicazione** di rete.

```
Application Layer         [App writes to socket]
                                  │
Transport Layer           [TCP/UDP Socket]
                                  │
Network Layer             [IP Packet]
                                  │
Data Link Layer           [Frame]
                                  │
Physical Layer            [Bits sul wire]
```

### Tipi di Socket

#### 1. Stream Socket (TCP)

```javascript
const net = require('net');

// Connection-oriented
const socket = net.connect({port: 8080, host: 'localhost'});
```

**Caratteristiche:**
- ✅ Connection-oriented
- ✅ Reliable, ordered
- ✅ Byte stream
- ❌ Maggiore overhead

#### 2. Datagram Socket (UDP)

```javascript
const dgram = require('dgram');

// Connectionless
const socket = dgram.createSocket('udp4');
```

**Caratteristiche:**
- ✅ Connectionless
- ✅ Low latency
- ❌ Unreliable
- ❌ No ordering

### Socket Lifecycle

#### TCP Socket (Client)

```
┌──────────────┐
│   CREATED    │
└──────┬───────┘
       │ socket()
       ↓
┌──────────────┐
│  CONNECTING  │
└──────┬───────┘
       │ connect()
       ↓
┌──────────────┐
│  CONNECTED   │ ←────┐
└──────┬───────┘      │
       │              │ read()/write()
       │ read/write   │
       ↓              │
┌──────────────┐      │
│    ACTIVE    │──────┘
└──────┬───────┘
       │ close()
       ↓
┌──────────────┐
│    CLOSED    │
└──────────────┘
```

#### TCP Socket (Server)

```
┌──────────────┐
│   CREATED    │
└──────┬───────┘
       │ socket()
       ↓
┌──────────────┐
│     BIND     │
└──────┬───────┘
       │ bind()
       ↓
┌──────────────┐
│   LISTENING  │ ←────┐
└──────┬───────┘      │
       │              │
       │ accept()     │ (loop)
       ↓              │
┌──────────────┐      │
│  NEW CLIENT  │──────┘
│  CONNECTION  │
└──────┬───────┘
       │
       ↓
┌──────────────┐
│    HANDLE    │
│    CLIENT    │
└──────────────┘
```

### Indirizzamento Socket

Un socket è identificato da:

```
IP Address : Port Number

Esempi:
192.168.1.100:8080
localhost:3000
example.com:443
```

### Socket Address Structure

```javascript
{
    address: '192.168.1.100',  // IP address
    family: 'IPv4',             // IPv4 o IPv6
    port: 8080                  // Porta
}
```

---

## Use Case per Applicazioni di Rete

### 1. Web Applications

**Protocollo:** HTTP/HTTPS (su TCP)

```
Browser ──[HTTP Request]──> Web Server
        <─[HTTP Response]──
```

**Esempi:**
- Siti web dinamici
- REST API
- Single Page Applications (SPA)
- E-commerce
- Social networks

**Tecnologie:**
- Express.js, Fastify, Koa
- HTTP/2, HTTP/3
- WebSocket per real-time

---

### 2. Chat Applications

**Protocollo:** TCP o WebSocket

```
Client A ─┐
          ├──> Chat Server ──> Client B
Client C ─┘
```

**Esempi:**
- Messaging apps (WhatsApp-like)
- Team collaboration (Slack-like)
- Customer support chat
- IRC-like systems

**Tecnologie:**
- Socket.io, ws
- XMPP protocol
- Matrix protocol

---

### 3. File Transfer

**Protocollo:** TCP

```
Client ──[Upload/Download]──> File Server
```

**Esempi:**
- FTP servers
- Cloud storage (Dropbox-like)
- Backup systems
- Content delivery

**Tecnologie:**
- Custom TCP protocols
- HTTP multipart
- Chunked transfer
- Resume capability

---

### 4. Real-Time Gaming

**Protocollo:** UDP (principalmente)

```
Game Client ──[Player Actions]──> Game Server
             <─[Game State]─────
```

**Esempi:**
- Multiplayer FPS
- MOBA games
- Racing games
- Real-time strategy

**Tecnologie:**
- UDP sockets
- Client-side prediction
- Server reconciliation
- Lag compensation

---

### 5. IoT Data Collection

**Protocollo:** UDP, TCP, MQTT

```
Sensor 1 ─┐
Sensor 2 ─┼──> IoT Gateway ──> Cloud
Sensor N ─┘
```

**Esempi:**
- Smart home devices
- Industrial sensors
- Weather stations
- Health monitors

**Tecnologie:**
- MQTT protocol
- CoAP (UDP)
- LoRaWAN
- Zigbee

---

### 6. Video/Audio Streaming

**Protocollo:** UDP + proprietary

```
Source ──[Live Stream]──> Media Server ──> Clients
```

**Esempi:**
- Live streaming (Twitch-like)
- Video conferencing (Zoom-like)
- IPTV
- VoIP

**Tecnologie:**
- WebRTC
- RTMP, HLS, DASH
- RTP/RTCP
- SIP protocol

---

### 7. Database Access

**Protocollo:** TCP (custom protocols)

```
Application ──[Query]──> Database Server
            <─[Result]──
```

**Esempi:**
- MySQL/PostgreSQL clients
- MongoDB drivers
- Redis clients
- Cassandra connections

**Tecnologie:**
- Custom binary protocols
- Connection pooling
- Query optimization
- Transaction management

---

### 8. Remote Procedure Call (RPC)

**Protocollo:** TCP

```
Client ──[Function Call]──> RPC Server
       <─[Return Value]───
```

**Esempi:**
- Microservices communication
- Distributed computing
- API backends
- Service mesh

**Tecnologie:**
- gRPC
- JSON-RPC
- Apache Thrift
- Protocol Buffers

---

## Architettura di Rete in Node.js

### Event-Driven Architecture

Node.js è basato su un'architettura **event-driven** e **non-blocking**:

```
┌───────────────────────────────┐
│      JavaScript Code          │
│   (Your Application Logic)    │
└───────────┬───────────────────┘
            │
┌───────────▼───────────────────┐
│        Node.js APIs           │
│    (net, dgram, http, etc.)   │
└───────────┬───────────────────┘
            │
┌───────────▼───────────────────┐
│         Event Loop            │
│  (Single-threaded, async)     │
└───────────┬───────────────────┘
            │
┌───────────▼───────────────────┐
│          libuv                │
│   (OS abstraction layer)      │
└───────────┬───────────────────┘
            │
┌───────────▼───────────────────┐
│    Operating System           │
│   (Network Stack, Sockets)    │
└───────────────────────────────┘
```

### Single-Threaded Event Loop

```javascript
// Node.js Event Loop
console.log('1 - Start');

setTimeout(() => {
    console.log('3 - Timeout callback');
}, 0);

const server = net.createServer((socket) => {
    console.log('5 - Client connected');
});

server.listen(8080, () => {
    console.log('4 - Server listening');
});

console.log('2 - End of sync code');

// Output:
// 1 - Start
// 2 - End of sync code
// 3 - Timeout callback
// 4 - Server listening
// 5 - Client connected (quando un client si connette)
```

### Vantaggi Event-Driven

✅ **Efficienza**: Gestisce migliaia di connessioni simultanee  
✅ **Non-blocking I/O**: Nessun thread in attesa  
✅ **Scalabilità**: Scale bene con connessioni concorrenti  
✅ **Resource efficiency**: Usa meno memoria dei thread  

### Moduli Networking in Node.js

#### 1. Modulo `net` (TCP)

```javascript
const net = require('net');

// TCP Server
const server = net.createServer((socket) => {
    console.log('Client connected');
});

// TCP Client
const client = net.connect({port: 8080});
```

#### 2. Modulo `dgram` (UDP)

```javascript
const dgram = require('dgram');

// UDP Socket
const socket = dgram.createSocket('udp4');
```

#### 3. Modulo `http` / `https`

```javascript
const http = require('http');

// HTTP Server
const server = http.createServer((req, res) => {
    res.end('Hello World');
});
```

#### 4. Modulo `tls` / `net` sicuro

```javascript
const tls = require('tls');

// TLS/SSL Server
const server = tls.createServer(options, (socket) => {
    console.log('Secure connection');
});
```

### Stream e Buffer

#### Stream

Node.js networking si basa su **Stream**:

```javascript
socket.on('data', (chunk) => {
    // chunk è un Buffer
    console.log('Received:', chunk.toString());
});

socket.write('Hello\n'); // Invia dati
```

**Tipi di Stream:**
- **Readable**: Legge dati (es: socket.on('data'))
- **Writable**: Scrive dati (es: socket.write())
- **Duplex**: Legge e scrive (es: TCP socket)
- **Transform**: Trasforma dati (es: encryption)

#### Buffer

I **Buffer** gestiscono dati binari:

```javascript
// Crea buffer
const buf1 = Buffer.from('Hello');
const buf2 = Buffer.alloc(10);

// Leggi buffer
console.log(buf1.toString()); // 'Hello'
console.log(buf1[0]);          // 72 (codice ASCII 'H')

// Scrivi buffer
buf2.write('World');
```

### Async/Await Pattern

Node.js supporta async/await per operazioni asincrone:

```javascript
const net = require('net');
const { promisify } = require('util');

async function connectToServer() {
    const socket = net.connect({port: 8080});
    
    // Aspetta connessione
    await new Promise((resolve, reject) => {
        socket.on('connect', resolve);
        socket.on('error', reject);
    });
    
    console.log('Connected!');
    
    // Invia dati
    socket.write('Hello Server\n');
    
    // Aspetta risposta
    const response = await new Promise((resolve) => {
        socket.once('data', resolve);
    });
    
    console.log('Response:', response.toString());
    
    socket.end();
}

connectToServer().catch(console.error);
```

### Error Handling Pattern

```javascript
const net = require('net');

const socket = net.connect({port: 8080});

// Gestione errori essenziale
socket.on('error', (err) => {
    console.error('Socket error:', err.message);
    // ECONNREFUSED, ETIMEDOUT, etc.
});

socket.on('close', (hadError) => {
    console.log('Socket closed', hadError ? 'with error' : 'cleanly');
});

socket.on('timeout', () => {
    console.log('Socket timeout');
    socket.end();
});

// Timeout dopo 5 secondi
socket.setTimeout(5000);
```

---

## Riepilogo

In questa guida abbiamo esplorato:

✅ **Modello OSI e TCP/IP**: Comprensione dei layer di rete  
✅ **Protocolli**: TCP, UDP, IP e protocolli applicativi  
✅ **Architetture**: Client-Server vs Peer-to-Peer  
✅ **Pattern**: Request-Response e sue varianti  
✅ **Socket**: Concetti base, tipi e lifecycle  
✅ **Use Cases**: Applicazioni reali di networking  
✅ **Node.js**: Architettura event-driven e moduli networking  

Questi concetti sono la base per comprendere la programmazione di rete con Node.js.

---

## Prossimi Passi

Nella prossima guida esploreremo in dettaglio il **Modulo NET di Node.js** e inizieremo a scrivere i nostri primi server e client TCP.

📖 **Prossima guida:** [1.2 Il Modulo NET di Node.js](./02-Il_Modulo_NET.md)
