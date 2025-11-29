# **🖥️ UDP Server - Guida Completa**

## **📑 Indice**
1. [Introduzione](#introduzione)
2. [Creazione Server UDP Base](#creazione-server-udp-base)
3. [Datagram Handling](#datagram-handling)
4. [Binding e Listening](#binding-e-listening)
5. [Error Handling](#error-handling)
6. [Server UDP Avanzato](#server-udp-avanzato)
7. [Best Practices](#best-practices)
8. [Esempi Completi](#esempi-completi)

---

## **🎯 Introduzione**

**UDP Server: Gestire migliaia di client senza connessioni**

Un **UDP Server** in Node.js si crea usando il modulo `dgram` (datagram). A differenza di un TCP server, un UDP server:

**Differenze chiave:**
```
TCP Server:
  - 1 socket listening + N socket per client
  - Overhead: 1 connessione = 1 socket + stato
  - 1000 client = 1000 socket aperti

UDP Server:
  - 1 SOLO socket per tutti i client
  - Overhead: Nessuno stato persistente
  - 10000 client = 1 socket (!)
```

**Vantaggi architetturali:**
- ✅ Non mantiene connessioni persistenti (zero memory per client)
- ✅ Gestisce singoli datagram indipendenti (stateless)
- ✅ Non ha concetto di "client connessi" (ogni msg è nuovo)
- ✅ Può ricevere da migliaia di client contemporaneamente senza overhead
- ✅ Scalabilità estrema (limitato solo da bandwidth)

**Svantaggi:**
- ❌ Devi implementare tu affidabilità/ordine se serve
- ❌ Nessun controllo flusso (client può saturare server)
- ❌ Difficile tracciare "sessioni" (serve logica applicativa)

---

## **🚀 Creazione Server UDP Base**

### **Server Minimalista**

```javascript
const dgram = require('dgram');

// Crea un socket UDP IPv4
const server = dgram.createSocket('udp4');

// Evento: messaggio ricevuto
server.on('message', (msg, rinfo) => {
    console.log(`Server ricevuto: ${msg} da ${rinfo.address}:${rinfo.port}`);
});

// Evento: server pronto
server.on('listening', () => {
    const address = server.address();
    console.log(`Server UDP in ascolto su ${address.address}:${address.port}`);
});

// Bind su porta 41234
server.bind(41234);
```

### **Creare Socket UDP**

```javascript
// IPv4
const server = dgram.createSocket('udp4');

// IPv6
const server = dgram.createSocket('udp6');

// Con opzioni
const server = dgram.createSocket({
    type: 'udp4',
    reuseAddr: true,  // Permette riuso porta
    ipv6Only: false,  // Solo IPv6
    recvBufferSize: 1024 * 1024,  // Buffer ricezione
    sendBufferSize: 1024 * 1024   // Buffer invio
});
```

---

## **📦 Datagram Handling**

### **Ricevere Messaggi**

```javascript
server.on('message', (msg, rinfo) => {
    // msg: Buffer contenente i dati
    // rinfo: Informazioni sul mittente
    
    console.log('Messaggio:', msg.toString());
    console.log('Da:', rinfo.address);
    console.log('Porta:', rinfo.port);
    console.log('Famiglia:', rinfo.family); // IPv4 o IPv6
    console.log('Size:', rinfo.size);       // Dimensione in bytes
});
```

### **Inviare Risposte**

```javascript
server.on('message', (msg, rinfo) => {
    // Echo: rimanda il messaggio al mittente
    server.send(msg, rinfo.port, rinfo.address, (err) => {
        if (err) {
            console.error('Errore invio:', err);
        } else {
            console.log('Risposta inviata');
        }
    });
});
```

### **Parsing Messaggi**

```javascript
server.on('message', (msg, rinfo) => {
    try {
        // Assumiamo JSON
        const data = JSON.parse(msg.toString());
        console.log('Tipo:', data.type);
        console.log('Payload:', data.payload);
        
        // Risposta
        const response = JSON.stringify({
            status: 'ok',
            receivedAt: Date.now()
        });
        server.send(response, rinfo.port, rinfo.address);
        
    } catch (err) {
        console.error('Errore parsing:', err);
        // Invia errore al client
        const error = JSON.stringify({ error: 'Invalid JSON' });
        server.send(error, rinfo.port, rinfo.address);
    }
});
```

---

## **🔌 Binding e Listening**

### **Bind Base**

```javascript
// Bind su porta specifica
server.bind(41234);

// Bind su porta specifica e indirizzo
server.bind(41234, 'localhost');

// Bind su porta casuale
server.bind(); // Sistema sceglie porta disponibile

// Bind con callback
server.bind(41234, () => {
    console.log('Server bound!');
});
```

### **Bind con Opzioni**

```javascript
server.bind({
    port: 41234,
    address: '0.0.0.0',  // Tutte le interfacce
    exclusive: false      // Permetti riuso porta
}, () => {
    console.log('Server ready');
});
```

### **Informazioni Server**

```javascript
server.on('listening', () => {
    const address = server.address();
    console.log('IP:', address.address);
    console.log('Porta:', address.port);
    console.log('Famiglia:', address.family);
});
```

### **Riuso Porta (SO_REUSEADDR)**

```javascript
const server1 = dgram.createSocket({ type: 'udp4', reuseAddr: true });
const server2 = dgram.createSocket({ type: 'udp4', reuseAddr: true });

// Entrambi possono bindare sulla stessa porta
server1.bind(41234);
server2.bind(41234);

// Utile per:
// - Load balancing
// - Cluster mode
// - Multicast
```

---

## **❌ Error Handling**

### **Gestione Errori Completa**

```javascript
const dgram = require('dgram');
const server = dgram.createSocket('udp4');

// Errore generico
server.on('error', (err) => {
    console.error('Errore server:', err.message);
    console.error('Stack:', err.stack);
    
    // Chiudi server in caso di errore critico
    if (err.code === 'EADDRINUSE') {
        console.error('Porta già in uso!');
        server.close();
    }
});

// Tentativo bind
try {
    server.bind(41234);
} catch (err) {
    console.error('Errore bind:', err);
}

// Gestione errori invio
server.on('message', (msg, rinfo) => {
    server.send('response', rinfo.port, rinfo.address, (err) => {
        if (err) {
            if (err.code === 'ENOTFOUND') {
                console.error('Host non trovato');
            } else if (err.code === 'ENETUNREACH') {
                console.error('Rete non raggiungibile');
            } else {
                console.error('Errore invio:', err);
            }
        }
    });
});

// Chiusura server
server.on('close', () => {
    console.log('Server chiuso');
});
```

### **Errori Comuni**

```javascript
// EADDRINUSE: Porta già in uso
server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.log('Porta occupata, riprovo tra 1 secondo...');
        setTimeout(() => {
            server.close();
            server.bind(41234);
        }, 1000);
    }
});

// EACCES: Permessi insufficienti
// (porte < 1024 richiedono privilegi root)
if (port < 1024 && process.getuid && process.getuid() !== 0) {
    console.error('Privilegi root richiesti per porte < 1024');
    process.exit(1);
}

// EMSGSIZE: Messaggio troppo grande
const MAX_UDP_SIZE = 65507; // Max UDP payload
if (msg.length > MAX_UDP_SIZE) {
    console.error('Messaggio troppo grande per UDP');
}
```

---

## **🔥 Server UDP Avanzato**

### **Server con Statistiche**

```javascript
class UDPServer {
    constructor(port) {
        this.port = port;
        this.socket = dgram.createSocket('udp4');
        this.stats = {
            messagesReceived: 0,
            messagesSent: 0,
            bytesReceived: 0,
            bytesSent: 0,
            errors: 0,
            startTime: Date.now()
        };
        this.setupHandlers();
    }
    
    setupHandlers() {
        this.socket.on('message', (msg, rinfo) => {
            this.stats.messagesReceived++;
            this.stats.bytesReceived += msg.length;
            this.handleMessage(msg, rinfo);
        });
        
        this.socket.on('error', (err) => {
            this.stats.errors++;
            console.error('Error:', err);
        });
        
        this.socket.on('listening', () => {
            const addr = this.socket.address();
            console.log(`Server listening on ${addr.address}:${addr.port}`);
        });
    }
    
    handleMessage(msg, rinfo) {
        console.log(`Received from ${rinfo.address}:${rinfo.port}: ${msg}`);
        this.sendResponse('ACK', rinfo);
    }
    
    sendResponse(data, rinfo) {
        const message = Buffer.from(data);
        this.socket.send(message, rinfo.port, rinfo.address, (err) => {
            if (!err) {
                this.stats.messagesSent++;
                this.stats.bytesSent += message.length;
            }
        });
    }
    
    getStats() {
        const uptime = Date.now() - this.stats.startTime;
        return {
            ...this.stats,
            uptime: Math.floor(uptime / 1000),
            messagesPerSecond: (this.stats.messagesReceived / (uptime / 1000)).toFixed(2)
        };
    }
    
    start() {
        this.socket.bind(this.port);
    }
    
    stop() {
        this.socket.close();
        console.log('Server stopped');
    }
}

// Uso
const server = new UDPServer(41234);
server.start();

// Stampa stats ogni 10 secondi
setInterval(() => {
    console.log('Stats:', server.getStats());
}, 10000);
```

### **Server con Routing**

```javascript
class RoutingUDPServer {
    constructor(port) {
        this.port = port;
        this.socket = dgram.createSocket('udp4');
        this.routes = new Map();
        this.setupSocket();
    }
    
    setupSocket() {
        this.socket.on('message', (msg, rinfo) => {
            try {
                const data = JSON.parse(msg.toString());
                this.route(data, rinfo);
            } catch (err) {
                this.sendError('Invalid JSON', rinfo);
            }
        });
        
        this.socket.on('error', (err) => {
            console.error('Server error:', err);
        });
    }
    
    // Registra route
    on(type, handler) {
        this.routes.set(type, handler);
    }
    
    // Routing messaggi
    route(data, rinfo) {
        const handler = this.routes.get(data.type);
        if (handler) {
            handler(data, rinfo, this.socket);
        } else {
            this.sendError(`Unknown type: ${data.type}`, rinfo);
        }
    }
    
    sendError(message, rinfo) {
        const error = JSON.stringify({ error: message });
        this.socket.send(error, rinfo.port, rinfo.address);
    }
    
    start() {
        this.socket.bind(this.port);
        console.log(`Routing server on port ${this.port}`);
    }
}

// Uso
const server = new RoutingUDPServer(41234);

server.on('ping', (data, rinfo, socket) => {
    const response = JSON.stringify({ type: 'pong', timestamp: Date.now() });
    socket.send(response, rinfo.port, rinfo.address);
});

server.on('echo', (data, rinfo, socket) => {
    const response = JSON.stringify({ type: 'echo', data: data.payload });
    socket.send(response, rinfo.port, rinfo.address);
});

server.on('stats', (data, rinfo, socket) => {
    const response = JSON.stringify({ 
        type: 'stats', 
        uptime: process.uptime(),
        memory: process.memoryUsage()
    });
    socket.send(response, rinfo.port, rinfo.address);
});

server.start();
```

### **Server con Rate Limiting**

```javascript
class RateLimitedUDPServer {
    constructor(port, maxMessagesPerSecond = 100) {
        this.port = port;
        this.maxMessagesPerSecond = maxMessagesPerSecond;
        this.socket = dgram.createSocket('udp4');
        this.clientTokens = new Map(); // IP -> tokens
        this.setupSocket();
        this.startTokenRefill();
    }
    
    setupSocket() {
        this.socket.on('message', (msg, rinfo) => {
            if (this.checkRateLimit(rinfo.address)) {
                this.handleMessage(msg, rinfo);
            } else {
                console.log(`Rate limit exceeded for ${rinfo.address}`);
                this.sendRateLimitError(rinfo);
            }
        });
    }
    
    checkRateLimit(ip) {
        if (!this.clientTokens.has(ip)) {
            this.clientTokens.set(ip, this.maxMessagesPerSecond);
        }
        
        const tokens = this.clientTokens.get(ip);
        if (tokens > 0) {
            this.clientTokens.set(ip, tokens - 1);
            return true;
        }
        return false;
    }
    
    startTokenRefill() {
        setInterval(() => {
            // Rifornisci tokens ogni secondo
            for (const [ip, tokens] of this.clientTokens.entries()) {
                this.clientTokens.set(ip, Math.min(
                    tokens + this.maxMessagesPerSecond,
                    this.maxMessagesPerSecond
                ));
            }
            
            // Cleanup vecchie entries (nessun messaggio da 60s)
            const now = Date.now();
            for (const [ip, lastSeen] of this.clientTokens.entries()) {
                if (now - lastSeen > 60000) {
                    this.clientTokens.delete(ip);
                }
            }
        }, 1000);
    }
    
    handleMessage(msg, rinfo) {
        console.log(`Accepted message from ${rinfo.address}`);
        // Processa messaggio...
    }
    
    sendRateLimitError(rinfo) {
        const error = JSON.stringify({ error: 'Rate limit exceeded' });
        this.socket.send(error, rinfo.port, rinfo.address);
    }
    
    start() {
        this.socket.bind(this.port);
        console.log(`Rate-limited server (${this.maxMessagesPerSecond} msg/s) on port ${this.port}`);
    }
}

const server = new RateLimitedUDPServer(41234, 50); // Max 50 msg/s per client
server.start();
```

---

## **✅ Best Practices**

### **1. Valida Sempre l'Input**

```javascript
server.on('message', (msg, rinfo) => {
    // Controlla dimensione
    if (msg.length > MAX_SIZE) {
        console.error('Message too large');
        return;
    }
    
    // Valida formato
    try {
        const data = JSON.parse(msg.toString());
        
        // Valida campi richiesti
        if (!data.type || !data.payload) {
            throw new Error('Missing required fields');
        }
        
        // Processa...
    } catch (err) {
        console.error('Invalid message:', err);
        sendError('Invalid message format', rinfo);
    }
});
```

### **2. Gestisci MTU**

```javascript
const MTU = 1500;
const IP_HEADER = 20;
const UDP_HEADER = 8;
const MAX_SAFE_PAYLOAD = MTU - IP_HEADER - UDP_HEADER; // 1472

function sendSafeMessage(data, port, address) {
    const message = Buffer.from(JSON.stringify(data));
    
    if (message.length > MAX_SAFE_PAYLOAD) {
        console.error('Message exceeds safe UDP payload size');
        // Opzioni:
        // 1. Dividi in chunk
        // 2. Comprimi
        // 3. Usa TCP invece
        return;
    }
    
    server.send(message, port, address);
}
```

### **3. Implementa Logging**

```javascript
const fs = require('fs');
const logStream = fs.createWriteStream('udp-server.log', { flags: 'a' });

function log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    console.log(logMessage.trim());
    logStream.write(logMessage);
}

server.on('message', (msg, rinfo) => {
    log(`Received ${msg.length} bytes from ${rinfo.address}:${rinfo.port}`);
});

server.on('error', (err) => {
    log(`ERROR: ${err.message}`);
});
```

### **4. Graceful Shutdown**

```javascript
function gracefulShutdown() {
    console.log('Shutting down gracefully...');
    
    // Stop accettare nuovi messaggi
    server.removeAllListeners('message');
    
    // Attendi messaggi in uscita
    setTimeout(() => {
        server.close(() => {
            console.log('Server closed');
            process.exit(0);
        });
    }, 1000);
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
```

### **5. Monitora Performance**

```javascript
const performanceMonitor = {
    messagesReceived: 0,
    lastCheck: Date.now(),
    
    record() {
        this.messagesReceived++;
    },
    
    check() {
        const now = Date.now();
        const elapsed = (now - this.lastCheck) / 1000;
        const rate = this.messagesReceived / elapsed;
        
        console.log(`Message rate: ${rate.toFixed(2)} msg/s`);
        
        this.messagesReceived = 0;
        this.lastCheck = now;
    }
};

server.on('message', (msg, rinfo) => {
    performanceMonitor.record();
    // Handle message...
});

setInterval(() => performanceMonitor.check(), 5000);
```

---

## **📋 Esempi Completi**

### **Esempio 1: Time Server**

```javascript
const dgram = require('dgram');
const server = dgram.createSocket('udp4');

server.on('message', (msg, rinfo) => {
    const request = msg.toString();
    console.log(`Time request from ${rinfo.address}:${rinfo.port}`);
    
    let response;
    switch (request) {
        case 'TIME':
            response = new Date().toISOString();
            break;
        case 'TIMESTAMP':
            response = Date.now().toString();
            break;
        case 'UNIX':
            response = Math.floor(Date.now() / 1000).toString();
            break;
        default:
            response = 'Unknown command. Use: TIME, TIMESTAMP, or UNIX';
    }
    
    server.send(response, rinfo.port, rinfo.address);
});

server.bind(37); // Standard time protocol port
console.log('Time server listening on port 37');
```

### **Esempio 2: Chat Server**

```javascript
const dgram = require('dgram');
const server = dgram.createSocket('udp4');

const clients = new Map(); // nickname -> { address, port }

server.on('message', (msg, rinfo) => {
    try {
        const data = JSON.parse(msg.toString());
        
        switch (data.type) {
            case 'join':
                clients.set(data.nickname, { 
                    address: rinfo.address, 
                    port: rinfo.port 
                });
                broadcast(`${data.nickname} joined the chat`, rinfo);
                break;
                
            case 'message':
                broadcast(`${data.nickname}: ${data.message}`, rinfo);
                break;
                
            case 'leave':
                clients.delete(data.nickname);
                broadcast(`${data.nickname} left the chat`, rinfo);
                break;
        }
    } catch (err) {
        console.error('Invalid message:', err);
    }
});

function broadcast(message, excludeRinfo) {
    const data = JSON.stringify({ type: 'message', text: message });
    
    for (const [nickname, client] of clients.entries()) {
        // Non inviare a chi ha inviato il messaggio
        if (client.address === excludeRinfo.address && 
            client.port === excludeRinfo.port) {
            continue;
        }
        
        server.send(data, client.port, client.address);
    }
}

server.bind(41234);
console.log('Chat server listening on port 41234');
```

### **Esempio 3: Load Balancer UDP**

```javascript
const dgram = require('dgram');
const server = dgram.createSocket('udp4');

const backends = [
    { host: 'backend1.local', port: 8001 },
    { host: 'backend2.local', port: 8002 },
    { host: 'backend3.local', port: 8003 }
];

let currentBackend = 0;

server.on('message', (msg, rinfo) => {
    // Round-robin load balancing
    const backend = backends[currentBackend];
    currentBackend = (currentBackend + 1) % backends.length;
    
    console.log(`Forwarding to ${backend.host}:${backend.port}`);
    
    // Forward messaggio
    server.send(msg, backend.port, backend.host, (err) => {
        if (err) {
            console.error(`Error forwarding to ${backend.host}:`, err);
        }
    });
});

server.bind(41234);
console.log('UDP Load Balancer listening on port 41234');
```

---

## **🎓 Riepilogo**

**UDP Server Basics:**
- Usa `dgram.createSocket()` per creare server
- `bind()` per iniziare ad ascoltare
- `on('message')` per ricevere datagram
- `send()` per rispondere

**Key Points:**
- Nessuna connessione da accettare
- Ogni datagram è indipendente
- Gestisci migliaia di client senza overhead
- Implementa validazione e rate limiting

**Best Practices:**
- Valida sempre l'input
- Gestisci errori correttamente
- Monitora performance
- Implementa graceful shutdown
- Rispetta MTU (1472 bytes safe payload)

---

**Prossima Guida**: [03-UDP_Client.md](./03-UDP_Client.md) - Implementazione di un client UDP
