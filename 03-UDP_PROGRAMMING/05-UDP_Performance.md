# **⚡ UDP Performance - Ottimizzazione e Best Practices**

## **📑 Indice**
1. [Introduzione](#introduzione)
2. [Low-Latency Optimization](#low-latency-optimization)
3. [Packet Loss Handling](#packet-loss-handling)
4. [Congestion Control](#congestion-control)
5. [Buffer Sizing](#buffer-sizing)
6. [Batching e Coalescing](#batching-e-coalescing)
7. [Monitoring e Metrics](#monitoring-e-metrics)
8. [Esempi Completi](#esempi-completi)

---

## **🎯 Introduzione**

**Ottimizzare UDP: Bilanciare latenza, throughput e affidabilità**

Ottimizzare UDP significa:
- ⚡ Minimizzare latenza (target: <10ms)
- 📊 Gestire packet loss (detect + mitigation)
- 🔄 Evitare congestione (throttling + backoff)
- 💾 Configurare buffer ottimali (kernel + application)
- 📈 Monitorare performance (metrics real-time)

**Key Metrics:**

| Metrica | Target | Misurazione |
|---------|--------|-------------|
| **Latency** | <10ms (LAN), <50ms (WAN) | timestamp send → recv |
| **Throughput** | >100MB/s | bytes_sent / time |
| **Packet Loss Rate** | <1% | lost / total_sent |
| **Jitter** | <5ms | variazione latenza |

**Trade-off fondamentali:**

```
Latenza bassa VS Throughput alto:
  - Messaggi piccoli → Bassa latenza
  - Batch grandi → Alto throughput
  
Affidabilità VS Performance:
  - ACK + Retransmit → Più lento
  - Fire-and-forget → Più veloce
  
Buffer grandi VS Memory:
  - Buffer grandi → Meno packet loss
  - Buffer piccoli → Meno memoria
```

---

## **⚡ Low-Latency Optimization**

### **1. Evitare Blocking Operations**

```javascript
// ❌ BAD: Operazioni sincrone
socket.on('message', (msg, rinfo) => {
    // Blocking JSON parse su messaggi grandi
    const data = JSON.parse(msg.toString());
    
    // Blocking I/O
    fs.writeFileSync('log.txt', data);
    
    // Computazione pesante
    const result = heavyComputation(data);
});

// ✅ GOOD: Operazioni asincrone
socket.on('message', async (msg, rinfo) => {
    // Parse asincrono (per messaggi grandi)
    const data = await parseAsync(msg);
    
    // I/O asincrono
    await fs.promises.appendFile('log.txt', JSON.stringify(data));
    
    // Offload computazione pesante
    worker.postMessage(data);
});

// Helper per parsing asincrono di grandi messaggi
function parseAsync(buffer) {
    return new Promise((resolve, reject) => {
        setImmediate(() => {
            try {
                const data = JSON.parse(buffer.toString());
                resolve(data);
            } catch (err) {
                reject(err);
            }
        });
    });
}
```

### **2. Pooling e Object Reuse**

```javascript
class BufferPool {
    constructor(size = 100, bufferSize = 65535) {
        this.pool = [];
        this.size = size;
        this.bufferSize = bufferSize;
        
        // Pre-alloca buffers
        for (let i = 0; i < size; i++) {
            this.pool.push(Buffer.allocUnsafe(bufferSize));
        }
    }
    
    acquire() {
        return this.pool.pop() || Buffer.allocUnsafe(this.bufferSize);
    }
    
    release(buffer) {
        if (this.pool.length < this.size) {
            this.pool.push(buffer);
        }
    }
}

class LowLatencyUDPServer {
    constructor(port) {
        this.socket = dgram.createSocket('udp4');
        this.port = port;
        this.bufferPool = new BufferPool(50);
        
        // Object pooling per ridurre GC
        this.messagePool = [];
    }
    
    start() {
        this.socket.on('message', (msg, rinfo) => {
            // Riusa buffer dal pool
            const buffer = this.bufferPool.acquire();
            msg.copy(buffer);
            
            // Process
            this.handleMessage(buffer, rinfo);
            
            // Rilascia buffer
            this.bufferPool.release(buffer);
        });
        
        // Aumenta receive buffer size
        this.socket.setRecvBufferSize(2 * 1024 * 1024); // 2MB
        
        this.socket.bind(this.port);
        console.log(`Low-latency server on port ${this.port}`);
    }
    
    handleMessage(buffer, rinfo) {
        // Fast path: evita conversioni quando possibile
        // Process direttamente il buffer
        const msgType = buffer.readUInt8(0);
        
        switch (msgType) {
            case 0x01: // Ping
                this.handlePing(buffer, rinfo);
                break;
            case 0x02: // Data
                this.handleData(buffer, rinfo);
                break;
        }
    }
    
    handlePing(buffer, rinfo) {
        // Echo back senza conversioni
        this.socket.send(buffer.subarray(0, 1), rinfo.port, rinfo.address);
    }
    
    handleData(buffer, rinfo) {
        // Process data con minimal overhead
        const dataLength = buffer.readUInt16BE(1);
        const data = buffer.subarray(3, 3 + dataLength);
        // ... process data ...
    }
}
```

### **3. Zero-Copy Patterns**

```javascript
class ZeroCopyUDPClient {
    constructor() {
        this.socket = dgram.createSocket('udp4');
        
        // Pre-allocate header buffer
        this.headerBuffer = Buffer.allocUnsafe(4);
    }
    
    // Zero-copy: invia buffer senza copying
    sendBinary(type, data, port, host) {
        // Costruisce header in-place
        this.headerBuffer.writeUInt8(type, 0);
        this.headerBuffer.writeUInt16BE(data.length, 1);
        this.headerBuffer.writeUInt8(0, 3); // padding
        
        // Invia header + data come array (zero-copy)
        this.socket.send([this.headerBuffer, data], port, host);
    }
    
    // Metodo classico (con copy) per confronto
    sendBinaryCopy(type, data, port, host) {
        // Copia data in nuovo buffer (overhead!)
        const fullBuffer = Buffer.allocUnsafe(4 + data.length);
        fullBuffer.writeUInt8(type, 0);
        fullBuffer.writeUInt16BE(data.length, 1);
        fullBuffer.writeUInt8(0, 3);
        data.copy(fullBuffer, 4);
        
        this.socket.send(fullBuffer, port, host);
    }
}

// Benchmark
const client = new ZeroCopyUDPClient();
const testData = Buffer.allocUnsafe(1400); // MTU-safe

console.time('With Copy');
for (let i = 0; i < 10000; i++) {
    client.sendBinaryCopy(0x02, testData, 41234, 'localhost');
}
console.timeEnd('With Copy');

console.time('Zero Copy');
for (let i = 0; i < 10000; i++) {
    client.sendBinary(0x02, testData, 41234, 'localhost');
}
console.timeEnd('Zero Copy');
// Zero Copy è ~30% più veloce
```

### **4. Batch Processing**

```javascript
class BatchedUDPServer {
    constructor(port, batchSize = 10) {
        this.socket = dgram.createSocket('udp4');
        this.port = port;
        this.batch = [];
        this.batchSize = batchSize;
    }
    
    start() {
        this.socket.on('message', (msg, rinfo) => {
            this.batch.push({ msg, rinfo, timestamp: Date.now() });
            
            if (this.batch.length >= this.batchSize) {
                this.processBatch();
            }
        });
        
        // Process batch anche se non pieno (timeout)
        setInterval(() => {
            if (this.batch.length > 0) {
                this.processBatch();
            }
        }, 50); // 50ms max delay
        
        this.socket.bind(this.port);
    }
    
    processBatch() {
        const currentBatch = this.batch;
        this.batch = [];
        
        // Process batch in parallelo
        currentBatch.forEach(item => {
            this.handleMessage(item.msg, item.rinfo);
        });
        
        console.log(`Processed batch of ${currentBatch.length} messages`);
    }
    
    handleMessage(msg, rinfo) {
        // Handle individual message
    }
}
```

---

## **📉 Packet Loss Handling**

### **1. Adaptive Timeout**

```javascript
class AdaptiveTimeoutUDP {
    constructor() {
        this.socket = dgram.createSocket('udp4');
        
        // RTT tracking
        this.srtt = 0;      // Smoothed RTT
        this.rttvar = 0;    // RTT variance
        this.rto = 1000;    // Retransmission timeout (initial)
        
        this.alpha = 0.125; // SRTT weight
        this.beta = 0.25;   // RTTVAR weight
        this.K = 4;         // RTO multiplier
    }
    
    async sendWithAdaptiveTimeout(data, port, host) {
        const sendTime = Date.now();
        
        try {
            await this.sendAndWaitAck(data, port, host, this.rto);
            
            // Measure RTT
            const rtt = Date.now() - sendTime;
            this.updateRTO(rtt);
            
            console.log(`RTT: ${rtt}ms, RTO: ${this.rto}ms`);
        } catch (err) {
            // Timeout: increase RTO
            this.rto = Math.min(this.rto * 2, 60000); // Max 60s
            console.log(`Timeout, new RTO: ${this.rto}ms`);
            throw err;
        }
    }
    
    updateRTO(rtt) {
        if (this.srtt === 0) {
            // First measurement
            this.srtt = rtt;
            this.rttvar = rtt / 2;
        } else {
            // RFC 6298 algorithm
            this.rttvar = (1 - this.beta) * this.rttvar + 
                          this.beta * Math.abs(this.srtt - rtt);
            this.srtt = (1 - this.alpha) * this.srtt + this.alpha * rtt;
        }
        
        this.rto = this.srtt + this.K * this.rttvar;
        this.rto = Math.max(this.rto, 100);  // Min 100ms
        this.rto = Math.min(this.rto, 60000); // Max 60s
    }
    
    sendAndWaitAck(data, port, host, timeout) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.socket.removeListener('message', handler);
                reject(new Error('Timeout'));
            }, timeout);
            
            const handler = (msg) => {
                clearTimeout(timer);
                this.socket.removeListener('message', handler);
                resolve();
            };
            
            this.socket.on('message', handler);
            this.socket.send(data, port, host);
        });
    }
}
```

### **2. Forward Error Correction (FEC)**

```javascript
class FECEncoder {
    constructor(dataChunks = 4, parityChunks = 2) {
        this.dataChunks = dataChunks;
        this.parityChunks = parityChunks;
        this.totalChunks = dataChunks + parityChunks;
    }
    
    encode(data) {
        const chunkSize = Math.ceil(data.length / this.dataChunks);
        const chunks = [];
        
        // Split data in chunks
        for (let i = 0; i < this.dataChunks; i++) {
            const start = i * chunkSize;
            const end = Math.min(start + chunkSize, data.length);
            chunks.push(data.slice(start, end));
        }
        
        // Generate parity chunks (XOR semplice)
        for (let i = 0; i < this.parityChunks; i++) {
            const parity = this.generateParity(chunks);
            chunks.push(parity);
        }
        
        return chunks.map((chunk, index) => ({
            index: index,
            total: this.totalChunks,
            data: chunk
        }));
    }
    
    generateParity(chunks) {
        const maxLength = Math.max(...chunks.map(c => c.length));
        const parity = Buffer.alloc(maxLength);
        
        for (const chunk of chunks) {
            for (let i = 0; i < chunk.length; i++) {
                parity[i] ^= chunk[i];
            }
        }
        
        return parity;
    }
}

class FECDecoder {
    constructor(dataChunks = 4, parityChunks = 2) {
        this.dataChunks = dataChunks;
        this.parityChunks = parityChunks;
        this.totalChunks = dataChunks + parityChunks;
        this.received = new Map();
    }
    
    addChunk(chunk) {
        this.received.set(chunk.index, chunk.data);
    }
    
    canDecode() {
        return this.received.size >= this.dataChunks;
    }
    
    decode() {
        if (!this.canDecode()) {
            throw new Error('Not enough chunks to decode');
        }
        
        // Se abbiamo tutti i data chunks
        if (this.hasAllDataChunks()) {
            return this.decodeComplete();
        }
        
        // Altrimenti usa parity per recovery
        return this.decodeWithRecovery();
    }
    
    hasAllDataChunks() {
        for (let i = 0; i < this.dataChunks; i++) {
            if (!this.received.has(i)) return false;
        }
        return true;
    }
    
    decodeComplete() {
        const chunks = [];
        for (let i = 0; i < this.dataChunks; i++) {
            chunks.push(this.received.get(i));
        }
        return Buffer.concat(chunks);
    }
    
    decodeWithRecovery() {
        // Trova chunk mancante
        const missing = [];
        for (let i = 0; i < this.dataChunks; i++) {
            if (!this.received.has(i)) {
                missing.push(i);
            }
        }
        
        if (missing.length > this.parityChunks) {
            throw new Error('Too many missing chunks');
        }
        
        // Recupera usando XOR
        // (implementazione semplificata)
        const chunks = [];
        for (let i = 0; i < this.dataChunks; i++) {
            if (this.received.has(i)) {
                chunks.push(this.received.get(i));
            } else {
                // Recupera da parity
                chunks.push(this.recoverChunk(i));
            }
        }
        
        return Buffer.concat(chunks);
    }
    
    recoverChunk(index) {
        // Simplified recovery (usa primo parity chunk)
        const parityIndex = this.dataChunks;
        const parity = this.received.get(parityIndex);
        
        // XOR con tutti gli altri chunk
        const recovered = Buffer.from(parity);
        for (let i = 0; i < this.dataChunks; i++) {
            if (i !== index && this.received.has(i)) {
                const chunk = this.received.get(i);
                for (let j = 0; j < chunk.length; j++) {
                    recovered[j] ^= chunk[j];
                }
            }
        }
        
        return recovered;
    }
}

// Uso
const encoder = new FECEncoder(4, 2); // 4 data + 2 parity
const decoder = new FECDecoder(4, 2);

const originalData = Buffer.from('Hello World with FEC!');
const encodedChunks = encoder.encode(originalData);

// Simula perdita di 1 chunk
encodedChunks.splice(2, 1);
console.log('Lost chunk 2');

// Decoder riceve i chunk rimanenti
encodedChunks.forEach(chunk => {
    decoder.addChunk(chunk);
});

if (decoder.canDecode()) {
    const recovered = decoder.decode();
    console.log('Recovered:', recovered.toString());
}
```

### **3. Duplicate Detection**

```javascript
class DuplicateDetector {
    constructor(windowSize = 1000) {
        this.windowSize = windowSize;
        this.seen = new Set();
        this.sequence = 0;
    }
    
    isDuplicate(messageId) {
        if (this.seen.has(messageId)) {
            return true;
        }
        
        this.seen.add(messageId);
        
        // Cleanup old IDs
        if (this.seen.size > this.windowSize) {
            const toDelete = this.seen.values().next().value;
            this.seen.delete(toDelete);
        }
        
        return false;
    }
    
    generateId() {
        return `${Date.now()}-${this.sequence++}`;
    }
}

// Uso
socket.on('message', (msg, rinfo) => {
    const data = JSON.parse(msg.toString());
    
    if (detector.isDuplicate(data.id)) {
        console.log('Duplicate message, ignoring');
        return;
    }
    
    // Process message
    handleMessage(data);
});
```

---

## **🔄 Congestion Control**

### **1. AIMD (Additive Increase Multiplicative Decrease)**

```javascript
class AIMDCongestionControl {
    constructor(initialWindow = 10) {
        this.cwnd = initialWindow;        // Congestion window
        this.ssthresh = 65535;            // Slow start threshold
        this.packetsInFlight = 0;
        this.ackReceived = 0;
        this.lossDetected = 0;
    }
    
    canSend() {
        return this.packetsInFlight < this.cwnd;
    }
    
    onPacketSent() {
        this.packetsInFlight++;
    }
    
    onAck() {
        this.packetsInFlight--;
        this.ackReceived++;
        
        // Slow start vs congestion avoidance
        if (this.cwnd < this.ssthresh) {
            // Slow start: exponential growth
            this.cwnd += 1;
        } else {
            // Congestion avoidance: linear growth
            this.cwnd += 1 / this.cwnd;
        }
        
        console.log(`ACK received, cwnd: ${this.cwnd.toFixed(2)}`);
    }
    
    onLoss() {
        this.packetsInFlight--;
        this.lossDetected++;
        
        // Multiplicative decrease
        this.ssthresh = Math.max(this.cwnd / 2, 2);
        this.cwnd = this.ssthresh;
        
        console.log(`Loss detected, cwnd reduced to: ${this.cwnd.toFixed(2)}`);
    }
    
    getStats() {
        return {
            cwnd: this.cwnd.toFixed(2),
            ssthresh: this.ssthresh,
            inFlight: this.packetsInFlight,
            ackReceived: this.ackReceived,
            lossDetected: this.lossDetected,
            lossRate: ((this.lossDetected / (this.ackReceived + this.lossDetected)) * 100).toFixed(2) + '%'
        };
    }
}

// Uso
const cc = new AIMDCongestionControl();

async function sendWithCongestionControl(messages, port, host) {
    for (const message of messages) {
        // Attendi se finestra piena
        while (!cc.canSend()) {
            await sleep(10);
        }
        
        cc.onPacketSent();
        
        try {
            await sendWithTimeout(message, port, host, 2000);
            cc.onAck();
        } catch (err) {
            cc.onLoss();
        }
    }
    
    console.log('Final stats:', cc.getStats());
}
```

### **2. Rate Limiting con Token Bucket**

```javascript
class TokenBucket {
    constructor(capacity = 100, refillRate = 10) {
        this.capacity = capacity;
        this.tokens = capacity;
        this.refillRate = refillRate; // tokens per second
        this.lastRefill = Date.now();
    }
    
    refill() {
        const now = Date.now();
        const elapsed = (now - this.lastRefill) / 1000;
        const tokensToAdd = elapsed * this.refillRate;
        
        this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
        this.lastRefill = now;
    }
    
    async consume(tokens = 1) {
        this.refill();
        
        while (this.tokens < tokens) {
            await sleep(50);
            this.refill();
        }
        
        this.tokens -= tokens;
    }
    
    availableTokens() {
        this.refill();
        return Math.floor(this.tokens);
    }
}

class RateLimitedSender {
    constructor(packetsPerSecond = 100) {
        this.socket = dgram.createSocket('udp4');
        this.bucket = new TokenBucket(packetsPerSecond, packetsPerSecond);
    }
    
    async send(message, port, host) {
        await this.bucket.consume(1);
        
        return new Promise((resolve, reject) => {
            const buffer = Buffer.from(message);
            this.socket.send(buffer, port, host, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }
}

// Uso
const sender = new RateLimitedSender(50); // 50 packets/sec max

async function sendBurst() {
    for (let i = 0; i < 200; i++) {
        await sender.send(`Message ${i}`, 41234, 'localhost');
        console.log(`Sent ${i}, tokens: ${sender.bucket.availableTokens()}`);
    }
}

sendBurst(); // Automatically rate-limited to 50 pps
```

---

## **💾 Buffer Sizing**

### **Socket Buffer Configuration**

```javascript
const dgram = require('dgram');

function createOptimizedSocket() {
    const socket = dgram.createSocket({
        type: 'udp4',
        reuseAddr: true
    });
    
    socket.on('listening', () => {
        // Aumenta receive buffer (default ~200KB)
        socket.setRecvBufferSize(4 * 1024 * 1024); // 4MB
        
        // Aumenta send buffer
        socket.setSendBufferSize(4 * 1024 * 1024); // 4MB
        
        console.log('Buffer sizes:');
        console.log('- Receive:', socket.getRecvBufferSize());
        console.log('- Send:', socket.getSendBufferSize());
    });
    
    return socket;
}

// Uso
const socket = createOptimizedSocket();
socket.bind(41234);
```

### **Application-Level Buffering**

```javascript
class SmartBuffer {
    constructor(maxSize = 1000) {
        this.buffer = [];
        this.maxSize = maxSize;
        this.dropped = 0;
    }
    
    push(message) {
        if (this.buffer.length >= this.maxSize) {
            // Buffer pieno: strategia di scarto
            
            // Opzione 1: Drop oldest (FIFO)
            this.buffer.shift();
            
            // Opzione 2: Drop lowest priority
            // const lowestPriority = this.findLowestPriority();
            // this.buffer.splice(lowestPriority, 1);
            
            this.dropped++;
        }
        
        this.buffer.push(message);
    }
    
    pop() {
        return this.buffer.shift();
    }
    
    size() {
        return this.buffer.length;
    }
    
    stats() {
        return {
            current: this.buffer.length,
            max: this.maxSize,
            dropped: this.dropped,
            dropRate: ((this.dropped / (this.buffer.length + this.dropped)) * 100).toFixed(2) + '%'
        };
    }
}

// Uso
const appBuffer = new SmartBuffer(500);

socket.on('message', (msg, rinfo) => {
    appBuffer.push({ msg, rinfo, timestamp: Date.now() });
});

// Process buffer periodically
setInterval(() => {
    while (appBuffer.size() > 0) {
        const item = appBuffer.pop();
        processMessage(item);
    }
}, 100);
```

---

## **📊 Monitoring e Metrics**

### **Performance Monitor**

```javascript
class UDPPerformanceMonitor {
    constructor() {
        this.metrics = {
            packetsSent: 0,
            packetsReceived: 0,
            bytesReceived: 0,
            bytesSent: 0,
            errors: 0,
            latencies: [],
            startTime: Date.now()
        };
        
        // Latency histogram
        this.latencyBuckets = {
            '0-10ms': 0,
            '10-50ms': 0,
            '50-100ms': 0,
            '100-500ms': 0,
            '500ms+': 0
        };
    }
    
    recordSent(bytes) {
        this.metrics.packetsSent++;
        this.metrics.bytesSent += bytes;
    }
    
    recordReceived(bytes) {
        this.metrics.packetsReceived++;
        this.metrics.bytesReceived += bytes;
    }
    
    recordLatency(latency) {
        this.metrics.latencies.push(latency);
        
        // Update histogram
        if (latency < 10) this.latencyBuckets['0-10ms']++;
        else if (latency < 50) this.latencyBuckets['10-50ms']++;
        else if (latency < 100) this.latencyBuckets['50-100ms']++;
        else if (latency < 500) this.latencyBuckets['100-500ms']++;
        else this.latencyBuckets['500ms+']++;
    }
    
    recordError() {
        this.metrics.errors++;
    }
    
    getStats() {
        const elapsed = (Date.now() - this.metrics.startTime) / 1000;
        const latencies = this.metrics.latencies;
        
        return {
            uptime: elapsed.toFixed(2) + 's',
            packetsSent: this.metrics.packetsSent,
            packetsReceived: this.metrics.packetsReceived,
            sendRate: (this.metrics.packetsSent / elapsed).toFixed(2) + ' pps',
            receiveRate: (this.metrics.packetsReceived / elapsed).toFixed(2) + ' pps',
            throughput: (this.metrics.bytesReceived / elapsed / 1024).toFixed(2) + ' KB/s',
            errorRate: ((this.metrics.errors / this.metrics.packetsSent) * 100).toFixed(2) + '%',
            latency: {
                min: Math.min(...latencies).toFixed(2) + 'ms',
                max: Math.max(...latencies).toFixed(2) + 'ms',
                avg: (latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(2) + 'ms',
                p50: this.percentile(latencies, 50).toFixed(2) + 'ms',
                p95: this.percentile(latencies, 95).toFixed(2) + 'ms',
                p99: this.percentile(latencies, 99).toFixed(2) + 'ms'
            },
            latencyHistogram: this.latencyBuckets
        };
    }
    
    percentile(arr, p) {
        const sorted = arr.slice().sort((a, b) => a - b);
        const index = Math.ceil((p / 100) * sorted.length) - 1;
        return sorted[index];
    }
    
    reset() {
        this.metrics = {
            packetsSent: 0,
            packetsReceived: 0,
            bytesReceived: 0,
            bytesSent: 0,
            errors: 0,
            latencies: [],
            startTime: Date.now()
        };
        
        for (const key in this.latencyBuckets) {
            this.latencyBuckets[key] = 0;
        }
    }
}

// Uso
const monitor = new UDPPerformanceMonitor();

socket.on('message', (msg, rinfo) => {
    monitor.recordReceived(msg.length);
    
    // Measure latency se messaggio contiene timestamp
    const data = JSON.parse(msg.toString());
    if (data.timestamp) {
        const latency = Date.now() - data.timestamp;
        monitor.recordLatency(latency);
    }
});

// Print stats ogni 5 secondi
setInterval(() => {
    console.log('\n=== UDP Performance Stats ===');
    console.log(JSON.stringify(monitor.getStats(), null, 2));
}, 5000);
```

---

## **🎓 Esempio Completo: High-Performance UDP Server**

```javascript
const dgram = require('dgram');

class HighPerformanceUDPServer {
    constructor(port, options = {}) {
        this.port = port;
        this.options = {
            maxBufferSize: options.maxBufferSize || 4 * 1024 * 1024,
            batchSize: options.batchSize || 100,
            batchTimeout: options.batchTimeout || 50,
            enableMonitoring: options.enableMonitoring || true,
            ...options
        };
        
        this.socket = dgram.createSocket({
            type: 'udp4',
            reuseAddr: true
        });
        
        this.bufferPool = new BufferPool(100, 65535);
        this.batch = [];
        this.monitor = new UDPPerformanceMonitor();
        this.duplicateDetector = new DuplicateDetector(10000);
    }
    
    start() {
        this.socket.on('listening', () => {
            // Optimize buffers
            this.socket.setRecvBufferSize(this.options.maxBufferSize);
            this.socket.setSendBufferSize(this.options.maxBufferSize);
            
            console.log(`HP Server listening on port ${this.port}`);
            console.log('- Recv buffer:', this.socket.getRecvBufferSize());
            console.log('- Send buffer:', this.socket.getSendBufferSize());
        });
        
        this.socket.on('message', (msg, rinfo) => {
            this.handleMessage(msg, rinfo);
        });
        
        this.socket.on('error', (err) => {
            console.error('Socket error:', err);
            if (this.options.enableMonitoring) {
                this.monitor.recordError();
            }
        });
        
        // Batch processing timer
        setInterval(() => {
            if (this.batch.length > 0) {
                this.processBatch();
            }
        }, this.options.batchTimeout);
        
        // Stats reporting
        if (this.options.enableMonitoring) {
            setInterval(() => {
                console.log('\n=== Stats ===');
                console.log(JSON.stringify(this.monitor.getStats(), null, 2));
            }, 10000);
        }
        
        this.socket.bind(this.port);
    }
    
    handleMessage(msg, rinfo) {
        if (this.options.enableMonitoring) {
            this.monitor.recordReceived(msg.length);
        }
        
        // Fast path: binary protocol
        if (msg[0] === 0x01 || msg[0] === 0x02) {
            this.handleBinaryMessage(msg, rinfo);
            return;
        }
        
        // Slow path: JSON
        this.batch.push({ msg, rinfo, timestamp: Date.now() });
        
        if (this.batch.length >= this.options.batchSize) {
            this.processBatch();
        }
    }
    
    handleBinaryMessage(msg, rinfo) {
        const type = msg.readUInt8(0);
        
        if (type === 0x01) {
            // Ping: immediate response
            this.socket.send(msg, rinfo.port, rinfo.address);
            if (this.options.enableMonitoring) {
                this.monitor.recordSent(msg.length);
            }
        }
    }
    
    async processBatch() {
        const currentBatch = this.batch;
        this.batch = [];
        
        // Process in parallel with worker pool
        await Promise.all(
            currentBatch.map(item => this.processMessage(item.msg, item.rinfo))
        );
    }
    
    async processMessage(msg, rinfo) {
        try {
            const data = JSON.parse(msg.toString());
            
            // Duplicate detection
            if (data.id && this.duplicateDetector.isDuplicate(data.id)) {
                return;
            }
            
            // Latency tracking
            if (data.timestamp && this.options.enableMonitoring) {
                const latency = Date.now() - data.timestamp;
                this.monitor.recordLatency(latency);
            }
            
            // Application logic
            await this.handleData(data, rinfo);
            
        } catch (err) {
            console.error('Process error:', err);
            if (this.options.enableMonitoring) {
                this.monitor.recordError();
            }
        }
    }
    
    async handleData(data, rinfo) {
        // Override this method in subclass
        console.log('Received:', data);
    }
    
    stop() {
        this.socket.close();
    }
}

// Uso
const server = new HighPerformanceUDPServer(41234, {
    maxBufferSize: 8 * 1024 * 1024,
    batchSize: 50,
    batchTimeout: 100,
    enableMonitoring: true
});

server.start();
```

---

## **🎓 Riepilogo**

**Low-Latency:**
- Evita blocking operations
- Buffer/Object pooling
- Zero-copy patterns
- Batch processing

**Packet Loss:**
- Adaptive timeout (RFC 6298)
- Forward Error Correction (FEC)
- Duplicate detection

**Congestion Control:**
- AIMD algorithm
- Token Bucket rate limiting
- Sliding window

**Buffer Sizing:**
- Socket buffers (4MB+ per high throughput)
- Application buffers con drop policies
- Buffer pooling per ridurre GC

**Monitoring:**
- Latency (min/max/avg/percentiles)
- Throughput (bytes/sec, packets/sec)
- Error rate
- Histograms

---

**Prossima Guida**: [06-UDP_Protocol_Design.md](./06-UDP_Protocol_Design.md) - Design di protocolli UDP custom
