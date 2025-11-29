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

```javascript
const net = require('net');

// Socket TCP
const socket = net.connect({
    host: '192.168.1.100',  // IP address
    port: 8080,             // Port number
    family: 4               // IPv4 (opzionale)
});

// Il socket è un oggetto JavaScript che rappresenta
// la connessione di rete
console.log('Socket creato:', socket);
```

### Socket API

#### Operazioni Base

```javascript
// CREATE
const socket = net.connect({ port: 8080 });

// CONNECT (automatico con net.connect)
socket.on('connect', () => {
    console.log('Connesso');
});

// WRITE (invia dati)
socket.write('Hello');

// READ (ricevi dati)
socket.on('data', (chunk) => {
    console.log('Dati:', chunk);
});

// CLOSE
socket.end(); // graceful close
socket.destroy(); // force close
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

```javascript
const net = require('net');

// Server TCP
const server = net.createServer((socket) => {
    console.log('Client connesso');
    
    socket.write('Welcome!\n');
    
    socket.on('data', (data) => {
        console.log('Ricevuto:', data.toString());
        socket.write('Echo: ' + data);
    });
});

server.listen(8080);

// Client TCP
const client = net.connect({ port: 8080 });

client.on('connect', () => {
    client.write('Hello Server\n');
});

client.on('data', (data) => {
    console.log('Risposta:', data.toString());
});
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

```javascript
const dgram = require('dgram');

// Server UDP
const server = dgram.createSocket('udp4');

server.on('message', (msg, rinfo) => {
    console.log(`Ricevuto da ${rinfo.address}:${rinfo.port}`);
    console.log('Messaggio:', msg.toString());
    
    // Echo back
    server.send(msg, rinfo.port, rinfo.address);
});

server.bind(8080);

// Client UDP
const client = dgram.createSocket('udp4');

const message = Buffer.from('Hello Server');
client.send(message, 8080, 'localhost', (err) => {
    if (err) console.error(err);
});

client.on('message', (msg) => {
    console.log('Risposta:', msg.toString());
    client.close();
});
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

```javascript
const net = require('net');

const socket = net.connect({ port: 8080 });

// CREATED → CONNECTING
console.log('State: CONNECTING');

socket.on('connect', () => {
    // CONNECTING → CONNECTED
    console.log('State: CONNECTED');
    
    socket.write('Hello\n');
});

socket.on('data', (data) => {
    // ACTIVE (reading/writing)
    console.log('State: ACTIVE (data exchange)');
});

socket.on('end', () => {
    // CLOSING
    console.log('State: CLOSING');
});

socket.on('close', () => {
    // CLOSED
    console.log('State: CLOSED');
});
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

```javascript
const net = require('net');

// CREATED
const server = net.createServer((clientSocket) => {
    // NEW CLIENT CONNECTION
    console.log('New client connected');
    
    // HANDLE CLIENT
    clientSocket.on('data', (data) => {
        console.log('Data from client:', data.toString());
    });
    
    clientSocket.on('close', () => {
        console.log('Client disconnected');
        // BACK TO LISTENING (for next client)
    });
});

// BOUND + LISTENING
server.listen(8080, () => {
    console.log('Server LISTENING on port 8080');
});
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

Connessione rifiutata (server non in ascolto):

```javascript
const socket = net.connect({ port: 8080 });

socket.on('error', (err) => {
    if (err.code === 'ECONNREFUSED') {
        console.error('❌ Server non disponibile');
        // Retry logic...
    }
});
```

#### 2. ETIMEDOUT

Timeout connessione:

```javascript
socket.setTimeout(5000); // 5 secondi

socket.on('timeout', () => {
    console.error('❌ Timeout');
    socket.destroy();
});
```

#### 3. EADDRINUSE

Porta già in uso:

```javascript
const server = net.createServer();

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error('❌ Porta già in uso');
        process.exit(1);
    }
});

server.listen(8080);
```

#### 4. ENOTFOUND

Host non trovato (DNS failed):

```javascript
const socket = net.connect({ 
    port: 80, 
    host: 'nonexistent.invalid' 
});

socket.on('error', (err) => {
    if (err.code === 'ENOTFOUND') {
        console.error('❌ Host non trovato');
    }
});
```

---

### Pattern di Gestione Errori

#### 1. Always Listen for Errors

```javascript
// ❌ BAD: Nessun handler errori
const socket = net.connect({ port: 8080 });

// ✅ GOOD: Gestisci errori
const socket = net.connect({ port: 8080 });
socket.on('error', (err) => {
    console.error('Error:', err.message);
});
```

**Perché?** Senza handler, errori causano crash dell'applicazione.

#### 2. Graceful Degradation

```javascript
const socket = net.connect({ port: 8080 });

socket.on('error', (err) => {
    console.error('Connection failed:', err.message);
    
    // Fallback: Usa cache o valori di default
    const cachedData = getFromCache();
    processData(cachedData);
});
```

#### 3. Retry Logic

```javascript
function connectWithRetry(port, host, maxRetries = 5) {
    let attempt = 0;
    
    function tryConnect() {
        attempt++;
        
        const socket = net.connect({ port, host });
        
        socket.on('connect', () => {
            console.log('✅ Connected');
        });
        
        socket.on('error', (err) => {
            console.error(`❌ Attempt ${attempt} failed:`, err.message);
            
            if (attempt < maxRetries) {
                setTimeout(() => {
                    tryConnect();
                }, 1000 * attempt); // Exponential backoff
            } else {
                console.error('Max retries reached');
            }
        });
        
        return socket;
    }
    
    return tryConnect();
}

connectWithRetry(8080, 'localhost');
```

#### 4. Circuit Breaker

```javascript
class CircuitBreaker {
    constructor(threshold = 5) {
        this.failures = 0;
        this.threshold = threshold;
        this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    }
    
    async connect(port, host) {
        if (this.state === 'OPEN') {
            throw new Error('Circuit breaker OPEN');
        }
        
        try {
            const socket = await this.tryConnect(port, host);
            this.onSuccess();
            return socket;
        } catch (err) {
            this.onFailure();
            throw err;
        }
    }
    
    onSuccess() {
        this.failures = 0;
        this.state = 'CLOSED';
    }
    
    onFailure() {
        this.failures++;
        if (this.failures >= this.threshold) {
            this.state = 'OPEN';
            console.log('🚨 Circuit breaker OPEN');
            
            // Reset after timeout
            setTimeout(() => {
                this.state = 'HALF_OPEN';
                this.failures = 0;
            }, 30000); // 30 seconds
        }
    }
    
    tryConnect(port, host) {
        return new Promise((resolve, reject) => {
            const socket = net.connect({ port, host });
            socket.on('connect', () => resolve(socket));
            socket.on('error', reject);
        });
    }
}

const breaker = new CircuitBreaker();

breaker.connect(8080, 'localhost')
    .catch(err => console.error('Failed:', err.message));
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
