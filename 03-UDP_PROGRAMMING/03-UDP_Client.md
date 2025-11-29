# **💻 UDP Client - Guida Completa**

## **📑 Indice**
1. [Introduzione](#introduzione)
2. [Creazione Client UDP Base](#creazione-client-udp-base)
3. [Sending Datagrams](#sending-datagrams)
4. [Receiving Responses](#receiving-responses)
5. [Timeout Management](#timeout-management)
6. [Client UDP Avanzato](#client-udp-avanzato)
7. [Best Practices](#best-practices)
8. [Esempi Completi](#esempi-completi)

---

## **🎯 Introduzione**

**UDP Client: Fire-and-forget o Request-Response?**

Un **UDP Client** in Node.js invia datagram a un server UDP e opzionalmente riceve risposte. Caratteristiche principali:

**Modelli di comunicazione:**

**1. Fire-and-forget** (unidirezionale)
```
Client → Server
No risposta attesa

Use case: Logging, telemetry, metrics
Pro: Massima velocità
Contro: Zero feedback
```

**2. Request-Response** (bidirezionale)
```
Client → Server
Client ← Server (risposta)

Use case: DNS, SNMP, game state queries
Pro: Conferma ricezione
Contro: Devi gestire timeout manualmente
```

**Differenze con TCP Client:**
- ✅ Non stabilisce connessione (invia subito, no handshake)
- ✅ Può inviare a server multipli (stesso socket)
- ✅ Può ricevere da server multipli (broadcast/multicast)
- ❌ Gestione timeout manuale (no built-in)
- ❌ Implementazione retry logic se necessario (tu decidi strategia)

---

## **🚀 Creazione Client UDP Base**

### **Client Minimalista**

```javascript
const dgram = require('dgram');
const client = dgram.createSocket('udp4');

// Invia messaggio
const message = Buffer.from('Hello UDP Server!');
client.send(message, 41234, 'localhost', (err) => {
    if (err) {
        console.error('Errore invio:', err);
        client.close();
    } else {
        console.log('Messaggio inviato');
    }
});

// Ricevi risposta
client.on('message', (msg, rinfo) => {
    console.log(`Risposta: ${msg} da ${rinfo.address}:${rinfo.port}`);
    client.close();
});
```

### **Creare Socket Client**

```javascript
// IPv4
const client = dgram.createSocket('udp4');

// IPv6
const client = dgram.createSocket('udp6');

// Con opzioni
const client = dgram.createSocket({
    type: 'udp4',
    reuseAddr: true,
    lookup: (hostname, options, callback) => {
        // Custom DNS lookup
        dns.lookup(hostname, options, callback);
    }
});
```

---

## **📤 Sending Datagrams**

### **Invio Base**

```javascript
const dgram = require('dgram');
const client = dgram.createSocket('udp4');

// Buffer
const message = Buffer.from('Hello');
client.send(message, 41234, 'localhost');

// String (convertito automaticamente)
client.send('Hello', 41234, 'localhost');

// Con callback
client.send(message, 41234, 'localhost', (err) => {
    if (err) {
        console.error('Send error:', err);
    } else {
        console.log('Message sent');
    }
});
```

### **Invio con Offset e Length**

```javascript
const buffer = Buffer.from('Hello World');

// Invia solo "World" (offset 6, length 5)
client.send(buffer, 6, 5, 41234, 'localhost', (err) => {
    if (err) console.error(err);
});

// Invia array di buffer
const msg1 = Buffer.from('Part 1');
const msg2 = Buffer.from('Part 2');
client.send([msg1, msg2], 41234, 'localhost');
```

### **Invio JSON**

```javascript
function sendJSON(data, port, host) {
    const message = JSON.stringify(data);
    const buffer = Buffer.from(message);
    
    client.send(buffer, port, host, (err) => {
        if (err) {
            console.error('Error sending JSON:', err);
        } else {
            console.log('JSON sent:', data);
        }
    });
}

// Uso
sendJSON({ type: 'ping', timestamp: Date.now() }, 41234, 'localhost');
```

### **Invio a Server Multipli**

```javascript
const servers = [
    { host: 'server1.local', port: 41234 },
    { host: 'server2.local', port: 41234 },
    { host: 'server3.local', port: 41234 }
];

function broadcast(message) {
    const buffer = Buffer.from(message);
    
    servers.forEach(server => {
        client.send(buffer, server.port, server.host, (err) => {
            if (err) {
                console.error(`Error sending to ${server.host}:`, err);
            } else {
                console.log(`Sent to ${server.host}`);
            }
        });
    });
}

broadcast('Hello all servers!');
```

---

## **📥 Receiving Responses**

### **Ricevere Risposte Base**

```javascript
const dgram = require('dgram');
const client = dgram.createSocket('udp4');

// Invia richiesta
client.send('REQUEST', 41234, 'localhost');

// Ricevi risposta
client.on('message', (msg, rinfo) => {
    console.log(`Response from ${rinfo.address}:${rinfo.port}`);
    console.log(`Message: ${msg.toString()}`);
    
    // Chiudi dopo risposta
    client.close();
});

// Gestisci errori
client.on('error', (err) => {
    console.error('Client error:', err);
    client.close();
});
```

### **Ricevere Risposte Multiple**

```javascript
const dgram = require('dgram');
const client = dgram.createSocket('udp4');

let responsesReceived = 0;
const expectedResponses = 3;

// Invia richieste a 3 server
['server1', 'server2', 'server3'].forEach(host => {
    client.send('PING', 41234, host);
});

client.on('message', (msg, rinfo) => {
    console.log(`Response from ${rinfo.address}: ${msg}`);
    responsesReceived++;
    
    if (responsesReceived >= expectedResponses) {
        console.log('All responses received');
        client.close();
    }
});

// Timeout se non tutte le risposte arrivano
setTimeout(() => {
    if (responsesReceived < expectedResponses) {
        console.log(`Only ${responsesReceived}/${expectedResponses} responses received`);
        client.close();
    }
}, 5000);
```

### **Parsing Risposte JSON**

```javascript
client.on('message', (msg, rinfo) => {
    try {
        const data = JSON.parse(msg.toString());
        
        switch (data.type) {
            case 'pong':
                console.log('Pong received, latency:', Date.now() - data.timestamp);
                break;
            case 'data':
                console.log('Data received:', data.payload);
                break;
            case 'error':
                console.error('Server error:', data.message);
                break;
            default:
                console.log('Unknown message type:', data.type);
        }
    } catch (err) {
        console.error('Invalid JSON response:', err);
    }
});
```

---

## **⏱️ Timeout Management**

### **Timeout Semplice**

```javascript
const dgram = require('dgram');
const client = dgram.createSocket('udp4');

const TIMEOUT = 3000; // 3 secondi
let timeoutHandle;

// Invia richiesta
client.send('REQUEST', 41234, 'localhost');

// Imposta timeout
timeoutHandle = setTimeout(() => {
    console.log('Timeout: nessuna risposta ricevuta');
    client.close();
}, TIMEOUT);

// Ricevi risposta
client.on('message', (msg, rinfo) => {
    clearTimeout(timeoutHandle);
    console.log('Risposta ricevuta:', msg.toString());
    client.close();
});
```

### **Timeout con Retry**

```javascript
class UDPClientWithRetry {
    constructor(maxRetries = 3, timeout = 2000) {
        this.socket = dgram.createSocket('udp4');
        this.maxRetries = maxRetries;
        this.timeout = timeout;
        this.retries = 0;
        this.setupHandlers();
    }
    
    setupHandlers() {
        this.socket.on('message', (msg, rinfo) => {
            this.handleResponse(msg, rinfo);
        });
        
        this.socket.on('error', (err) => {
            console.error('Socket error:', err);
        });
    }
    
    send(message, port, host) {
        return new Promise((resolve, reject) => {
            this.resolve = resolve;
            this.reject = reject;
            this.message = message;
            this.port = port;
            this.host = host;
            
            this.attemptSend();
        });
    }
    
    attemptSend() {
        console.log(`Attempt ${this.retries + 1}/${this.maxRetries}`);
        
        const buffer = Buffer.from(this.message);
        this.socket.send(buffer, this.port, this.host);
        
        // Imposta timeout
        this.timeoutHandle = setTimeout(() => {
            this.retries++;
            
            if (this.retries < this.maxRetries) {
                console.log('Timeout, retrying...');
                this.attemptSend();
            } else {
                this.reject(new Error('Max retries reached'));
                this.socket.close();
            }
        }, this.timeout);
    }
    
    handleResponse(msg, rinfo) {
        clearTimeout(this.timeoutHandle);
        console.log('Response received!');
        this.resolve({ message: msg, rinfo });
        this.socket.close();
    }
}

// Uso
async function main() {
    const client = new UDPClientWithRetry(3, 2000);
    
    try {
        const result = await client.send('PING', 41234, 'localhost');
        console.log('Success:', result.message.toString());
    } catch (err) {
        console.error('Failed:', err.message);
    }
}

main();
```

### **Timeout con Promise**

```javascript
function sendWithTimeout(message, port, host, timeout = 5000) {
    const client = dgram.createSocket('udp4');
    
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            client.close();
            reject(new Error('Timeout'));
        }, timeout);
        
        client.on('message', (msg, rinfo) => {
            clearTimeout(timer);
            client.close();
            resolve({ message: msg, rinfo });
        });
        
        client.on('error', (err) => {
            clearTimeout(timer);
            client.close();
            reject(err);
        });
        
        // Invia messaggio
        client.send(message, port, host, (err) => {
            if (err) {
                clearTimeout(timer);
                client.close();
                reject(err);
            }
        });
    });
}

// Uso con async/await
async function queryServer() {
    try {
        const result = await sendWithTimeout('QUERY', 41234, 'localhost', 3000);
        console.log('Response:', result.message.toString());
    } catch (err) {
        console.error('Error:', err.message);
    }
}

queryServer();
```

---

## **🔥 Client UDP Avanzato**

### **Client con Connection Pooling**

```javascript
class UDPClientPool {
    constructor(poolSize = 5) {
        this.poolSize = poolSize;
        this.pool = [];
        this.currentIndex = 0;
        
        // Crea pool di socket
        for (let i = 0; i < poolSize; i++) {
            this.pool.push(dgram.createSocket('udp4'));
        }
    }
    
    getSocket() {
        const socket = this.pool[this.currentIndex];
        this.currentIndex = (this.currentIndex + 1) % this.poolSize;
        return socket;
    }
    
    send(message, port, host) {
        return new Promise((resolve, reject) => {
            const socket = this.getSocket();
            const buffer = Buffer.from(message);
            
            const handler = (msg, rinfo) => {
                socket.removeListener('message', handler);
                resolve({ message: msg, rinfo });
            };
            
            socket.on('message', handler);
            
            socket.send(buffer, port, host, (err) => {
                if (err) {
                    socket.removeListener('message', handler);
                    reject(err);
                }
            });
        });
    }
    
    close() {
        this.pool.forEach(socket => socket.close());
    }
}

// Uso
const pool = new UDPClientPool(10);

async function sendMany() {
    const promises = [];
    
    for (let i = 0; i < 100; i++) {
        promises.push(pool.send(`Message ${i}`, 41234, 'localhost'));
    }
    
    const results = await Promise.all(promises);
    console.log(`Received ${results.length} responses`);
}

sendMany().then(() => pool.close());
```

### **Client con Rate Limiting**

```javascript
class RateLimitedUDPClient {
    constructor(messagesPerSecond = 100) {
        this.socket = dgram.createSocket('udp4');
        this.messagesPerSecond = messagesPerSecond;
        this.queue = [];
        this.isSending = false;
        this.interval = 1000 / messagesPerSecond;
    }
    
    send(message, port, host) {
        return new Promise((resolve, reject) => {
            this.queue.push({ message, port, host, resolve, reject });
            this.processQueue();
        });
    }
    
    async processQueue() {
        if (this.isSending || this.queue.length === 0) return;
        
        this.isSending = true;
        
        while (this.queue.length > 0) {
            const item = this.queue.shift();
            
            try {
                await this.sendNow(item.message, item.port, item.host);
                item.resolve();
            } catch (err) {
                item.reject(err);
            }
            
            // Attendi per rispettare rate limit
            await this.sleep(this.interval);
        }
        
        this.isSending = false;
    }
    
    sendNow(message, port, host) {
        return new Promise((resolve, reject) => {
            const buffer = Buffer.from(message);
            this.socket.send(buffer, port, host, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    close() {
        this.socket.close();
    }
}

// Uso: max 50 messaggi al secondo
const client = new RateLimitedUDPClient(50);

async function sendBurst() {
    const promises = [];
    
    for (let i = 0; i < 200; i++) {
        promises.push(client.send(`Message ${i}`, 41234, 'localhost'));
    }
    
    await Promise.all(promises);
    console.log('All messages sent (rate limited)');
    client.close();
}

sendBurst();
```

### **Client con Metriche**

```javascript
class MetricsUDPClient {
    constructor() {
        this.socket = dgram.createSocket('udp4');
        this.metrics = {
            messagesSent: 0,
            messagesReceived: 0,
            bytesSent: 0,
            bytesReceived: 0,
            errors: 0,
            latencies: []
        };
        this.setupHandlers();
    }
    
    setupHandlers() {
        this.socket.on('message', (msg, rinfo) => {
            this.metrics.messagesReceived++;
            this.metrics.bytesReceived += msg.length;
        });
        
        this.socket.on('error', (err) => {
            this.metrics.errors++;
            console.error('Socket error:', err);
        });
    }
    
    send(message, port, host) {
        const startTime = Date.now();
        const buffer = Buffer.from(message);
        
        return new Promise((resolve, reject) => {
            this.socket.send(buffer, port, host, (err) => {
                if (err) {
                    this.metrics.errors++;
                    reject(err);
                } else {
                    this.metrics.messagesSent++;
                    this.metrics.bytesSent += buffer.length;
                    
                    const latency = Date.now() - startTime;
                    this.metrics.latencies.push(latency);
                    
                    resolve();
                }
            });
        });
    }
    
    getMetrics() {
        const avgLatency = this.metrics.latencies.length > 0
            ? this.metrics.latencies.reduce((a, b) => a + b, 0) / this.metrics.latencies.length
            : 0;
        
        return {
            ...this.metrics,
            averageLatency: avgLatency.toFixed(2),
            minLatency: Math.min(...this.metrics.latencies),
            maxLatency: Math.max(...this.metrics.latencies)
        };
    }
    
    resetMetrics() {
        this.metrics = {
            messagesSent: 0,
            messagesReceived: 0,
            bytesSent: 0,
            bytesReceived: 0,
            errors: 0,
            latencies: []
        };
    }
    
    close() {
        this.socket.close();
    }
}

// Uso
const client = new MetricsUDPClient();

async function testWithMetrics() {
    for (let i = 0; i < 100; i++) {
        await client.send(`Test message ${i}`, 41234, 'localhost');
    }
    
    console.log('Metrics:', client.getMetrics());
    client.close();
}

testWithMetrics();
```

---

## **✅ Best Practices**

### **1. Gestisci Sempre gli Errori**

```javascript
const client = dgram.createSocket('udp4');

client.on('error', (err) => {
    console.error('Client error:', err);
    
    // Gestisci errori specifici
    switch (err.code) {
        case 'ENOTFOUND':
            console.error('Host not found');
            break;
        case 'ENETUNREACH':
            console.error('Network unreachable');
            break;
        case 'EHOSTUNREACH':
            console.error('Host unreachable');
            break;
        default:
            console.error('Unknown error:', err.code);
    }
    
    client.close();
});

// Gestisci errori di send
client.send(message, port, host, (err) => {
    if (err) {
        console.error('Send failed:', err);
        // Implementa retry logic
    }
});
```

### **2. Implementa Timeout**

```javascript
function sendWithTimeout(message, port, host, timeout = 5000) {
    const client = dgram.createSocket('udp4');
    
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            client.close();
            reject(new Error('Request timeout'));
        }, timeout);
        
        client.on('message', (msg) => {
            clearTimeout(timer);
            client.close();
            resolve(msg);
        });
        
        client.send(message, port, host, (err) => {
            if (err) {
                clearTimeout(timer);
                client.close();
                reject(err);
            }
        });
    });
}
```

### **3. Valida le Risposte**

```javascript
client.on('message', (msg, rinfo) => {
    // Verifica lunghezza
    if (msg.length > MAX_SIZE) {
        console.error('Message too large');
        return;
    }
    
    // Verifica provenienza
    if (rinfo.address !== expectedHost) {
        console.warn('Message from unexpected host:', rinfo.address);
        return;
    }
    
    // Valida formato
    try {
        const data = JSON.parse(msg.toString());
        
        if (!data.type || !data.timestamp) {
            throw new Error('Invalid message format');
        }
        
        // Processa messaggio valido
        processMessage(data);
    } catch (err) {
        console.error('Invalid message:', err);
    }
});
```

### **4. Chiudi le Socket Correttamente**

```javascript
function gracefulClose(client) {
    // Rimuovi listener
    client.removeAllListeners('message');
    client.removeAllListeners('error');
    
    // Chiudi socket
    client.close(() => {
        console.log('Client closed');
    });
}

// Gestisci signal di chiusura
process.on('SIGINT', () => {
    gracefulClose(client);
    process.exit(0);
});

process.on('SIGTERM', () => {
    gracefulClose(client);
    process.exit(0);
});
```

### **5. Rispetta MTU**

```javascript
const MTU = 1500;
const HEADERS = 28; // IP(20) + UDP(8)
const MAX_PAYLOAD = MTU - HEADERS; // 1472 bytes

function sendSafe(message, port, host) {
    const buffer = Buffer.from(message);
    
    if (buffer.length > MAX_PAYLOAD) {
        console.error('Message exceeds safe UDP size');
        console.error(`Size: ${buffer.length}, Max: ${MAX_PAYLOAD}`);
        return false;
    }
    
    client.send(buffer, port, host);
    return true;
}
```

---

## **📋 Esempi Completi**

### **Esempio 1: DNS Query Client**

```javascript
const dgram = require('dgram');
const dns = require('dns');

class SimpleDNSClient {
    constructor() {
        this.socket = dgram.createSocket('udp4');
    }
    
    query(domain, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error('DNS query timeout'));
            }, timeout);
            
            dns.resolve4(domain, (err, addresses) => {
                clearTimeout(timer);
                
                if (err) {
                    reject(err);
                } else {
                    resolve(addresses);
                }
            });
        });
    }
    
    close() {
        this.socket.close();
    }
}

// Uso
async function lookupDomain() {
    const client = new SimpleDNSClient();
    
    try {
        const addresses = await client.query('google.com');
        console.log('IP addresses:', addresses);
    } catch (err) {
        console.error('DNS query failed:', err);
    } finally {
        client.close();
    }
}

lookupDomain();
```

### **Esempio 2: NTP Client (Network Time Protocol)**

```javascript
const dgram = require('dgram');

class NTPClient {
    constructor() {
        this.socket = dgram.createSocket('udp4');
        this.NTP_PORT = 123;
    }
    
    getTime(server = 'time.google.com', timeout = 5000) {
        return new Promise((resolve, reject) => {
            // NTP request packet (48 bytes)
            const buffer = Buffer.alloc(48);
            buffer[0] = 0x1B; // LI, Version, Mode
            
            const timer = setTimeout(() => {
                this.socket.close();
                reject(new Error('NTP request timeout'));
            }, timeout);
            
            this.socket.on('message', (msg) => {
                clearTimeout(timer);
                
                // Parse NTP response
                const seconds = msg.readUInt32BE(40);
                const fraction = msg.readUInt32BE(44);
                
                // Convert to JavaScript Date
                const milliseconds = (seconds - 2208988800) * 1000 + (fraction / 0x100000000) * 1000;
                const date = new Date(milliseconds);
                
                this.socket.close();
                resolve(date);
            });
            
            this.socket.send(buffer, this.NTP_PORT, server, (err) => {
                if (err) {
                    clearTimeout(timer);
                    this.socket.close();
                    reject(err);
                }
            });
        });
    }
}

// Uso
async function syncTime() {
    const client = new NTPClient();
    
    try {
        const time = await client.getTime();
        console.log('Network time:', time.toISOString());
        console.log('Local time:', new Date().toISOString());
        console.log('Difference:', time - new Date(), 'ms');
    } catch (err) {
        console.error('NTP error:', err);
    }
}

syncTime();
```

### **Esempio 3: IoT Sensor Client**

```javascript
const dgram = require('dgram');
const os = require('os');

class IoTSensorClient {
    constructor(serverHost, serverPort) {
        this.socket = dgram.createSocket('udp4');
        this.serverHost = serverHost;
        this.serverPort = serverPort;
        this.sensorId = os.hostname();
    }
    
    sendReading(type, value) {
        const data = {
            sensorId: this.sensorId,
            type: type,
            value: value,
            timestamp: Date.now(),
            unit: this.getUnit(type)
        };
        
        const message = JSON.stringify(data);
        
        return new Promise((resolve, reject) => {
            this.socket.send(message, this.serverPort, this.serverHost, (err) => {
                if (err) {
                    reject(err);
                } else {
                    console.log(`Sent ${type}: ${value}`);
                    resolve();
                }
            });
        });
    }
    
    getUnit(type) {
        const units = {
            temperature: '°C',
            humidity: '%',
            pressure: 'hPa',
            light: 'lux'
        };
        return units[type] || 'unknown';
    }
    
    startMonitoring(interval = 5000) {
        this.intervalId = setInterval(async () => {
            try {
                // Simula letture sensori
                await this.sendReading('temperature', (Math.random() * 10 + 20).toFixed(2));
                await this.sendReading('humidity', (Math.random() * 30 + 40).toFixed(2));
                await this.sendReading('pressure', (Math.random() * 50 + 1000).toFixed(2));
            } catch (err) {
                console.error('Error sending readings:', err);
            }
        }, interval);
    }
    
    stopMonitoring() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }
    
    close() {
        this.stopMonitoring();
        this.socket.close();
    }
}

// Uso
const sensor = new IoTSensorClient('iot-gateway.local', 8000);
sensor.startMonitoring(5000); // Invia ogni 5 secondi

// Chiudi dopo 1 minuto
setTimeout(() => {
    sensor.close();
    console.log('Sensor client closed');
}, 60000);
```

---

## **🎓 Riepilogo**

**UDP Client Basics:**
- Crea socket con `dgram.createSocket()`
- Invia con `send(message, port, host)`
- Ricevi con `on('message')`
- Sempre implementa timeout

**Key Features:**
- Nessuna connessione da stabilire
- Può inviare a server multipli
- Gestione manuale di timeout e retry
- Validazione risposte essenziale

**Best Practices:**
- Implementa sempre timeout
- Gestisci errori specifici
- Valida risposte ricevute
- Rispetta MTU (max 1472 bytes)
- Chiudi socket correttamente
- Usa Promise/async-await per codice pulito

**Advanced Patterns:**
- Connection pooling per throughput
- Rate limiting per evitare flood
- Retry logic con backoff esponenziale
- Metriche per monitoring

---

**Prossima Guida**: [04-UDP_Avanzato.md](./04-UDP_Avanzato.md) - Tecniche UDP avanzate
