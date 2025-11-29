# **🚀 UDP Avanzato - Tecniche Avanzate**

## **📑 Indice**
1. [Introduzione](#introduzione)
2. [Message Ordering](#message-ordering)
3. [Reliability Patterns](#reliability-patterns)
4. [Multicast](#multicast)
5. [Broadcast](#broadcast)
6. [QoS Implementation](#qos-implementation)
7. [Advanced Patterns](#advanced-patterns)
8. [Esempi Completi](#esempi-completi)

---

## **🎯 Introduzione**

**Aggiungere affidabilità a UDP quando serve**

UDP di base non garantisce:
- ✗ Affidabilità (delivery) → Packet loss OK
- ✗ Ordinamento → Messaggi possono arrivare fuori ordine
- ✗ Controllo di flusso → Sender può saturare receiver
- ✗ Controllo di congestione → Può saturare rete

**Quando implementare queste funzionalità:**

| Funzionalità | Quando serve | Costo overhead |
|--------------|--------------|----------------|
| Ordering | Gaming (state updates), streaming | Basso (seq number) |
| Reliability | File transfer, transaction | Alto (ACK + retransmit) |
| Flow control | Sender veloce + receiver lento | Medio (window size) |
| Congestion control | Network saturation risk | Alto (monitoring + throttling) |

**Trade-off fondamentale:**
```
Più aggiungi → Più diventa simile a TCP
Se serve tutto → Usa TCP!

UDP avanzato è per:
  - Serve ALCUNE garanzie (non tutte)
  - Controllo fine-grained su cosa implementare
  - Custom protocol requirements
```

In questa guida implementeremo tecniche per aggiungere queste funzionalità quando necessario.

---

## **📊 Message Ordering**

### **Problema: Messaggi Fuori Ordine**

```javascript
// Server riceve: "3", "1", "2"
// Ma l'ordine corretto era: "1", "2", "3"
```

### **Soluzione 1: Sequence Numbers**

```javascript
class SequencedUDPClient {
    constructor() {
        this.socket = dgram.createSocket('udp4');
        this.sequenceNumber = 0;
    }
    
    send(data, port, host) {
        const message = {
            seq: this.sequenceNumber++,
            timestamp: Date.now(),
            data: data
        };
        
        const buffer = Buffer.from(JSON.stringify(message));
        this.socket.send(buffer, port, host);
    }
}

class SequencedUDPServer {
    constructor(port) {
        this.socket = dgram.createSocket('udp4');
        this.port = port;
        this.expectedSeq = new Map(); // clientId -> nextExpectedSeq
        this.buffer = new Map();      // clientId -> buffered messages
    }
    
    start() {
        this.socket.on('message', (msg, rinfo) => {
            const clientId = `${rinfo.address}:${rinfo.port}`;
            const message = JSON.parse(msg.toString());
            
            this.handleSequencedMessage(clientId, message);
        });
        
        this.socket.bind(this.port);
    }
    
    handleSequencedMessage(clientId, message) {
        // Inizializza expected sequence
        if (!this.expectedSeq.has(clientId)) {
            this.expectedSeq.set(clientId, 0);
            this.buffer.set(clientId, []);
        }
        
        const expected = this.expectedSeq.get(clientId);
        
        if (message.seq === expected) {
            // Messaggio nell'ordine corretto
            this.processMessage(message);
            this.expectedSeq.set(clientId, expected + 1);
            
            // Processa messaggi bufferizzati
            this.processBuffered(clientId);
        } else if (message.seq > expected) {
            // Messaggio futuro: bufferizza
            console.log(`Buffering message seq ${message.seq} (expected ${expected})`);
            this.buffer.get(clientId).push(message);
        } else {
            // Messaggio duplicato o vecchio
            console.log(`Ignoring old/duplicate message seq ${message.seq}`);
        }
    }
    
    processBuffered(clientId) {
        const buffer = this.buffer.get(clientId);
        const expected = this.expectedSeq.get(clientId);
        
        // Ordina per sequence number
        buffer.sort((a, b) => a.seq - b.seq);
        
        // Processa messaggi consecutivi
        while (buffer.length > 0 && buffer[0].seq === this.expectedSeq.get(clientId)) {
            const message = buffer.shift();
            this.processMessage(message);
            this.expectedSeq.set(clientId, message.seq + 1);
        }
    }
    
    processMessage(message) {
        console.log(`Processing message seq ${message.seq}: ${message.data}`);
    }
}

// Uso
const server = new SequencedUDPServer(41234);
server.start();
```

### **Soluzione 2: Timestamp-based Ordering**

```javascript
class TimestampOrderingBuffer {
    constructor(maxBufferTime = 2000) {
        this.maxBufferTime = maxBufferTime;
        this.buffer = [];
        this.lastProcessed = 0;
    }
    
    add(message) {
        this.buffer.push(message);
        this.processReady();
    }
    
    processReady() {
        const now = Date.now();
        
        // Ordina per timestamp
        this.buffer.sort((a, b) => a.timestamp - b.timestamp);
        
        // Processa messaggi "vecchi abbastanza"
        while (this.buffer.length > 0) {
            const message = this.buffer[0];
            const age = now - message.timestamp;
            
            if (age >= this.maxBufferTime) {
                this.buffer.shift();
                this.process(message);
            } else {
                break;
            }
        }
    }
    
    process(message) {
        if (message.timestamp <= this.lastProcessed) {
            console.log('Skipping duplicate/old message');
            return;
        }
        
        console.log(`Processing: ${message.data} (${message.timestamp})`);
        this.lastProcessed = message.timestamp;
    }
}

// Uso
const buffer = new TimestampOrderingBuffer(1000);

socket.on('message', (msg) => {
    const message = JSON.parse(msg.toString());
    buffer.add(message);
});
```

---

## **🔄 Reliability Patterns**

### **Pattern 1: Stop-and-Wait ARQ**

```javascript
class StopAndWaitUDP {
    constructor(timeout = 2000) {
        this.socket = dgram.createSocket('udp4');
        this.timeout = timeout;
        this.sequenceNumber = 0;
    }
    
    async sendReliable(data, port, host) {
        const message = {
            seq: this.sequenceNumber,
            data: data,
            timestamp: Date.now()
        };
        
        let ackReceived = false;
        let attempts = 0;
        const maxAttempts = 5;
        
        while (!ackReceived && attempts < maxAttempts) {
            attempts++;
            console.log(`Attempt ${attempts}: sending seq ${message.seq}`);
            
            // Invia messaggio
            this.socket.send(JSON.stringify(message), port, host);
            
            // Attendi ACK
            try {
                await this.waitForAck(message.seq, this.timeout);
                ackReceived = true;
                console.log(`ACK received for seq ${message.seq}`);
                this.sequenceNumber++;
            } catch (err) {
                console.log(`Timeout waiting for ACK seq ${message.seq}`);
            }
        }
        
        if (!ackReceived) {
            throw new Error(`Failed to send message seq ${message.seq}`);
        }
    }
    
    waitForAck(expectedSeq, timeout) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.socket.removeListener('message', handler);
                reject(new Error('ACK timeout'));
            }, timeout);
            
            const handler = (msg) => {
                try {
                    const ack = JSON.parse(msg.toString());
                    if (ack.type === 'ACK' && ack.seq === expectedSeq) {
                        clearTimeout(timer);
                        this.socket.removeListener('message', handler);
                        resolve();
                    }
                } catch (err) {
                    // Invalid message, ignore
                }
            };
            
            this.socket.on('message', handler);
        });
    }
}

// Server con ACK
class ReliableUDPServer {
    constructor(port) {
        this.socket = dgram.createSocket('udp4');
        this.port = port;
    }
    
    start() {
        this.socket.on('message', (msg, rinfo) => {
            try {
                const message = JSON.parse(msg.toString());
                
                // Processa messaggio
                console.log(`Received seq ${message.seq}: ${message.data}`);
                
                // Invia ACK
                const ack = {
                    type: 'ACK',
                    seq: message.seq,
                    timestamp: Date.now()
                };
                
                this.socket.send(JSON.stringify(ack), rinfo.port, rinfo.address);
            } catch (err) {
                console.error('Error processing message:', err);
            }
        });
        
        this.socket.bind(this.port);
        console.log(`Reliable server on port ${this.port}`);
    }
}

// Uso
const client = new StopAndWaitUDP();
const server = new ReliableUDPServer(41234);
server.start();

async function sendData() {
    for (let i = 0; i < 10; i++) {
        await client.sendReliable(`Message ${i}`, 41234, 'localhost');
    }
}

sendData();
```

### **Pattern 2: Sliding Window**

```javascript
class SlidingWindowUDP {
    constructor(windowSize = 10) {
        this.socket = dgram.createSocket('udp4');
        this.windowSize = windowSize;
        this.base = 0;
        this.nextSeqNum = 0;
        this.pending = new Map(); // seq -> { message, timer }
        this.timeout = 2000;
    }
    
    async send(data, port, host) {
        // Attendi se finestra piena
        while (this.nextSeqNum >= this.base + this.windowSize) {
            await this.sleep(10);
        }
        
        const seq = this.nextSeqNum++;
        const message = {
            seq: seq,
            data: data,
            timestamp: Date.now()
        };
        
        this.sendPacket(message, port, host);
    }
    
    sendPacket(message, port, host) {
        const buffer = Buffer.from(JSON.stringify(message));
        this.socket.send(buffer, port, host);
        
        // Imposta timer per ritrasmissione
        const timer = setTimeout(() => {
            console.log(`Timeout seq ${message.seq}, retransmitting...`);
            this.sendPacket(message, port, host);
        }, this.timeout);
        
        this.pending.set(message.seq, { message, timer, port, host });
    }
    
    handleAck(seq) {
        // Cumulative ACK: conferma tutti fino a seq
        for (let i = this.base; i <= seq; i++) {
            if (this.pending.has(i)) {
                const { timer } = this.pending.get(i);
                clearTimeout(timer);
                this.pending.delete(i);
            }
        }
        
        // Aggiorna base
        this.base = seq + 1;
        console.log(`ACK ${seq}, new base: ${this.base}`);
    }
    
    setupAckHandler() {
        this.socket.on('message', (msg) => {
            try {
                const ack = JSON.parse(msg.toString());
                if (ack.type === 'ACK') {
                    this.handleAck(ack.seq);
                }
            } catch (err) {
                // Invalid ACK, ignore
            }
        });
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Uso
const client = new SlidingWindowUDP(10);
client.setupAckHandler();

async function sendBulk() {
    const promises = [];
    for (let i = 0; i < 100; i++) {
        promises.push(client.send(`Message ${i}`, 41234, 'localhost'));
    }
    await Promise.all(promises);
    console.log('All messages sent (with sliding window)');
}

sendBulk();
```

### **Pattern 3: Selective Repeat**

```javascript
class SelectiveRepeatUDP {
    constructor(windowSize = 10) {
        this.socket = dgram.createSocket('udp4');
        this.windowSize = windowSize;
        this.base = 0;
        this.nextSeqNum = 0;
        this.ackReceived = new Set();
        this.pending = new Map();
        this.timeout = 2000;
        this.setupAckHandler();
    }
    
    async send(data, port, host) {
        while (this.nextSeqNum >= this.base + this.windowSize) {
            await this.sleep(10);
        }
        
        const seq = this.nextSeqNum++;
        const message = { seq, data, timestamp: Date.now() };
        
        this.sendPacket(message, port, host);
    }
    
    sendPacket(message, port, host) {
        const buffer = Buffer.from(JSON.stringify(message));
        this.socket.send(buffer, port, host);
        
        const timer = setTimeout(() => {
            if (!this.ackReceived.has(message.seq)) {
                console.log(`Retransmitting seq ${message.seq}`);
                this.sendPacket(message, port, host);
            }
        }, this.timeout);
        
        this.pending.set(message.seq, { message, timer, port, host });
    }
    
    handleAck(seq) {
        // Selective ACK: conferma solo questo specifico pacchetto
        this.ackReceived.add(seq);
        
        if (this.pending.has(seq)) {
            const { timer } = this.pending.get(seq);
            clearTimeout(timer);
            this.pending.delete(seq);
        }
        
        // Avanza base se possibile
        while (this.ackReceived.has(this.base)) {
            this.ackReceived.delete(this.base);
            this.base++;
        }
        
        console.log(`ACK ${seq}, base: ${this.base}`);
    }
    
    setupAckHandler() {
        this.socket.on('message', (msg) => {
            try {
                const ack = JSON.parse(msg.toString());
                if (ack.type === 'ACK') {
                    this.handleAck(ack.seq);
                }
            } catch (err) {
                // Invalid ACK
            }
        });
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
```

---

## **📡 Multicast**

### **Che cos'è Multicast?**

Multicast permette di inviare un datagram a **multipli destinatari** contemporaneamente:
- Un mittente → Gruppo di ricevitori
- Efficiente per streaming, discovery, etc.
- Range IP: 224.0.0.0 - 239.255.255.255

### **Multicast Sender**

```javascript
const dgram = require('dgram');

class MulticastSender {
    constructor(multicastAddress = '239.255.255.250', port = 41234) {
        this.socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
        this.multicastAddress = multicastAddress;
        this.port = port;
        this.ttl = 64; // Time To Live (hops)
    }
    
    start() {
        this.socket.bind(() => {
            this.socket.setMulticastTTL(this.ttl);
            this.socket.setBroadcast(true);
            console.log(`Multicast sender ready`);
        });
    }
    
    send(message) {
        const buffer = Buffer.from(JSON.stringify(message));
        this.socket.send(buffer, this.port, this.multicastAddress, (err) => {
            if (err) {
                console.error('Multicast send error:', err);
            } else {
                console.log(`Sent to multicast group: ${message.type}`);
            }
        });
    }
    
    close() {
        this.socket.close();
    }
}

// Uso
const sender = new MulticastSender();
sender.start();

// Invia messaggi al gruppo
setInterval(() => {
    sender.send({
        type: 'heartbeat',
        timestamp: Date.now(),
        data: 'Server is alive'
    });
}, 5000);
```

### **Multicast Receiver**

```javascript
class MulticastReceiver {
    constructor(multicastAddress = '239.255.255.250', port = 41234) {
        this.socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
        this.multicastAddress = multicastAddress;
        this.port = port;
    }
    
    start() {
        this.socket.on('message', (msg, rinfo) => {
            try {
                const data = JSON.parse(msg.toString());
                console.log(`Multicast received from ${rinfo.address}:`, data);
                this.handleMessage(data);
            } catch (err) {
                console.error('Invalid multicast message:', err);
            }
        });
        
        this.socket.on('error', (err) => {
            console.error('Multicast error:', err);
        });
        
        this.socket.bind(this.port, () => {
            this.socket.addMembership(this.multicastAddress);
            console.log(`Joined multicast group ${this.multicastAddress}`);
        });
    }
    
    handleMessage(data) {
        switch (data.type) {
            case 'heartbeat':
                console.log('Heartbeat received');
                break;
            case 'announcement':
                console.log('Announcement:', data.message);
                break;
            default:
                console.log('Unknown message type:', data.type);
        }
    }
    
    stop() {
        this.socket.dropMembership(this.multicastAddress);
        this.socket.close();
    }
}

// Uso
const receiver = new MulticastReceiver();
receiver.start();
```

### **Service Discovery con Multicast**

```javascript
class ServiceDiscovery {
    constructor() {
        this.socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
        this.multicastAddress = '239.255.255.250';
        this.port = 1900; // SSDP port
        this.services = new Map();
    }
    
    // Server: annuncia servizio
    announceService(serviceType, serviceInfo) {
        this.socket.bind(() => {
            const announcement = {
                type: 'SERVICE_ANNOUNCE',
                serviceType: serviceType,
                info: serviceInfo,
                timestamp: Date.now()
            };
            
            const message = Buffer.from(JSON.stringify(announcement));
            this.socket.send(message, this.port, this.multicastAddress);
            
            console.log(`Announced service: ${serviceType}`);
        });
    }
    
    // Client: scopri servizi
    discoverServices(timeout = 5000) {
        return new Promise((resolve) => {
            const discoveredServices = [];
            
            this.socket.on('message', (msg, rinfo) => {
                try {
                    const data = JSON.parse(msg.toString());
                    if (data.type === 'SERVICE_ANNOUNCE') {
                        discoveredServices.push({
                            ...data,
                            address: rinfo.address,
                            port: rinfo.port
                        });
                        console.log(`Discovered: ${data.serviceType} at ${rinfo.address}`);
                    }
                } catch (err) {
                    // Invalid message
                }
            });
            
            this.socket.bind(this.port, () => {
                this.socket.addMembership(this.multicastAddress);
                
                // Invia discovery request
                const request = {
                    type: 'SERVICE_DISCOVER',
                    timestamp: Date.now()
                };
                const message = Buffer.from(JSON.stringify(request));
                this.socket.send(message, this.port, this.multicastAddress);
                
                console.log('Discovery request sent');
            });
            
            setTimeout(() => {
                resolve(discoveredServices);
            }, timeout);
        });
    }
}

// Uso - Server
const server = new ServiceDiscovery();
server.announceService('http-server', {
    name: 'My Web Server',
    port: 8080,
    version: '1.0.0'
});

// Uso - Client
const client = new ServiceDiscovery();
client.discoverServices(3000).then(services => {
    console.log('Found services:', services);
});
```

---

## **📢 Broadcast**

### **Broadcast Sender**

```javascript
class BroadcastSender {
    constructor(port = 41234) {
        this.socket = dgram.createSocket('udp4');
        this.port = port;
        this.broadcastAddress = '255.255.255.255';
    }
    
    start() {
        this.socket.bind(() => {
            this.socket.setBroadcast(true);
            console.log('Broadcast enabled');
        });
    }
    
    broadcast(message) {
        const buffer = Buffer.from(JSON.stringify(message));
        this.socket.send(buffer, this.port, this.broadcastAddress, (err) => {
            if (err) {
                console.error('Broadcast error:', err);
            } else {
                console.log('Broadcast sent');
            }
        });
    }
}

// Uso
const sender = new BroadcastSender();
sender.start();

sender.broadcast({
    type: 'announcement',
    message: 'Server starting up',
    timestamp: Date.now()
});
```

### **Limited Broadcast vs Directed Broadcast**

```javascript
// Limited Broadcast: 255.255.255.255
// Non attraversa router, solo subnet locale
socket.send(message, port, '255.255.255.255');

// Directed Broadcast: 192.168.1.255
// Broadcast a una subnet specifica
socket.send(message, port, '192.168.1.255');

// Esempio: calcola broadcast address
function getBroadcastAddress(ip, netmask) {
    const ipParts = ip.split('.').map(Number);
    const maskParts = netmask.split('.').map(Number);
    
    const broadcast = ipParts.map((part, i) => {
        return part | (~maskParts[i] & 0xFF);
    });
    
    return broadcast.join('.');
}

console.log(getBroadcastAddress('192.168.1.10', '255.255.255.0'));
// Output: 192.168.1.255
```

---

## **⚙️ QoS Implementation**

### **Priority Queues**

```javascript
class QoSUDPSender {
    constructor() {
        this.socket = dgram.createSocket('udp4');
        this.queues = {
            high: [],
            medium: [],
            low: []
        };
        this.isProcessing = false;
    }
    
    send(message, port, host, priority = 'medium') {
        const packet = { message, port, host, priority, timestamp: Date.now() };
        
        this.queues[priority].push(packet);
        this.processQueues();
    }
    
    async processQueues() {
        if (this.isProcessing) return;
        this.isProcessing = true;
        
        while (this.hasPackets()) {
            // High priority first
            if (this.queues.high.length > 0) {
                await this.sendPacket(this.queues.high.shift());
            }
            // Then medium
            else if (this.queues.medium.length > 0) {
                await this.sendPacket(this.queues.medium.shift());
            }
            // Finally low
            else if (this.queues.low.length > 0) {
                await this.sendPacket(this.queues.low.shift());
            }
            
            // Small delay between packets
            await this.sleep(5);
        }
        
        this.isProcessing = false;
    }
    
    sendPacket(packet) {
        return new Promise((resolve) => {
            const buffer = Buffer.from(JSON.stringify(packet.message));
            this.socket.send(buffer, packet.port, packet.host, () => {
                console.log(`Sent ${packet.priority} priority message`);
                resolve();
            });
        });
    }
    
    hasPackets() {
        return this.queues.high.length > 0 ||
               this.queues.medium.length > 0 ||
               this.queues.low.length > 0;
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Uso
const qos = new QoSUDPSender();

qos.send({ type: 'telemetry' }, 41234, 'localhost', 'low');
qos.send({ type: 'alert' }, 41234, 'localhost', 'high');
qos.send({ type: 'status' }, 41234, 'localhost', 'medium');
// Alert viene inviato per primo
```

### **Traffic Shaping**

```javascript
class TrafficShaper {
    constructor(maxBytesPerSecond = 1024 * 1024) { // 1MB/s default
        this.socket = dgram.createSocket('udp4');
        this.maxBytesPerSecond = maxBytesPerSecond;
        this.bytesSent = 0;
        this.queue = [];
        this.startTime = Date.now();
        
        // Reset counter ogni secondo
        setInterval(() => {
            this.bytesSent = 0;
            this.startTime = Date.now();
        }, 1000);
    }
    
    async send(message, port, host) {
        const buffer = Buffer.from(message);
        
        // Attendi se superato limite
        while (this.bytesSent + buffer.length > this.maxBytesPerSecond) {
            await this.sleep(100);
        }
        
        return new Promise((resolve, reject) => {
            this.socket.send(buffer, port, host, (err) => {
                if (err) {
                    reject(err);
                } else {
                    this.bytesSent += buffer.length;
                    resolve();
                }
            });
        });
    }
    
    getStats() {
        const elapsed = (Date.now() - this.startTime) / 1000;
        const currentRate = this.bytesSent / elapsed;
        
        return {
            bytesSent: this.bytesSent,
            currentRate: currentRate.toFixed(2),
            maxRate: this.maxBytesPerSecond,
            utilization: ((currentRate / this.maxBytesPerSecond) * 100).toFixed(2) + '%'
        };
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Uso
const shaper = new TrafficShaper(100 * 1024); // 100KB/s limit

async function sendWithShaping() {
    for (let i = 0; i < 1000; i++) {
        await shaper.send(`Message ${i}`, 41234, 'localhost');
    }
    console.log('Stats:', shaper.getStats());
}

sendWithShaping();
```

---

## **🎓 Riepilogo**

**Message Ordering:**
- Sequence numbers per ordinamento
- Buffering per riordinare pacchetti
- Timestamp-based ordering

**Reliability:**
- Stop-and-Wait ARQ (semplice ma lento)
- Sliding Window (più efficiente)
- Selective Repeat (più complesso ma ottimale)

**Multicast:**
- Un sender → molti receivers
- IP range: 224.0.0.0 - 239.255.255.255
- Ideale per discovery e streaming

**Broadcast:**
- Invia a tutti nella subnet
- Limited (255.255.255.255) o Directed
- Utile per annunci locali

**QoS:**
- Priority queues per messaggi critici
- Traffic shaping per limitare banda
- Rate limiting per evitare flood

---

**Prossima Guida**: [05-UDP_Performance.md](./05-UDP_Performance.md) - Ottimizzazione performance UDP
