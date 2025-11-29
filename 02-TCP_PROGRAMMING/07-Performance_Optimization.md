# **⚡ Performance Optimization**

## **📑 Indice**
1. [Introduzione](#introduzione)
2. [Buffer Management](#buffer-management)
3. [Memory Optimization](#memory-optimization)
4. [Zero-Copy Techniques](#zero-copy-techniques)
5. [Nagle's Algorithm](#nagles-algorithm)
6. [Keep-Alive Configuration](#keep-alive-configuration)
7. [Throughput Optimization](#throughput-optimization)
8. [Benchmarking](#benchmarking)

---

## **🎯 Introduzione**

**Ottimizzare performance TCP**

**Bottleneck comuni:**
```
1. Buffer allocation → GC pressure
2. Memory copies → CPU overhead
3. Small writes → Nagle delays
4. Connection overhead → Latency
5. Throughput limits → Bandwidth waste
```

**Principi di ottimizzazione:**

**Measure First, Optimize Later**
```
1. Benchmark current performance
2. Identify bottleneck
3. Apply optimization
4. Re-measure
5. Repeat
```

**Ottimizzazioni in questa guida:**

| Ottimizzazione | Impatto | Complessità | Quando |
|----------------|---------|-------------|---------|
| Buffer Pooling | ⭐⭐⭐⭐⭐ | ⭐⭐ | High GC time |
| Zero-Copy | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | Large transfers |
| Nagle Disable | ⭐⭐⭐ | ⭐ | Real-time apps |
| Keep-Alive | ⭐⭐⭐ | ⭐⭐ | Idle connections |
| Throughput Tuning | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | Bandwidth critical |

**Performance targets:**
- Latency: <10ms per request (LAN), <100ms (WAN)
- Throughput: >100MB/s (gigabit network)
- Memory: <100MB per 1000 connections
- CPU: <30% load at peak

Ottimizzazioni per performance TCP:
- 📦 **Buffer management**: gestione buffer efficienti
- 💾 **Memory optimization**: riduzione allocazioni
- 🚀 **Zero-copy**: trasferimenti efficienti
- 🔧 **Nagle's algorithm**: controllo buffering
- 💓 **Keep-alive**: gestione connessioni idle
- 📈 **Throughput**: massimizzare banda
- 📊 **Benchmarking**: misurare performance

---

## **📦 Buffer Management**

**Ridurre allocazioni buffer**

**Il problema:**
```javascript
// ❌ BAD: Ogni read alloca nuovo Buffer
socket.on('data', (data) => {
  const buffer = Buffer.from(data); // ALLOCAZIONE!
  process(buffer);
  // GC deve deallocare → GC pressure
});

// Con 1000 req/s → 1000 allocazioni/s → GC thrashing
```

**Soluzione: Buffer Pool**
```javascript
// ✅ GOOD: Riuso buffer
const pool = new BufferPool();

socket.on('data', (data) => {
  const buffer = pool.acquire(); // Riuso!
  data.copy(buffer);
  process(buffer);
  pool.release(buffer); // Torna nel pool
});
```

**Vantaggi:**
- ✅ Zero allocazioni dopo warmup
- ✅ GC pressure ridotto drasticamente
- ✅ Latenza prevedibile (no GC pauses)
- ✅ Memory footprint controllato

**Best practices:**
- Preallocate buffer pool all'avvio
- Usa `Buffer.allocUnsafe()` (faster, no zero-fill)
- Fai `.fill(0)` prima di riusare (security)
- Max pool size = max concurrent connections

**Quando usare:**
- ✅ High throughput (>1000 req/s)
- ✅ GC pauses misurabili
- ✅ Buffer size uniforme
- ❌ NON usare: Buffer size variabile

### **Buffer Pooling**

```javascript
class BufferPool {
    constructor(options = {}) {
        this.options = {
            bufferSize: options.bufferSize || 8192,
            maxBuffers: options.maxBuffers || 100,
            preallocate: options.preallocate || 10
        };
        
        this.available = [];
        this.inUse = new Set();
        this.totalCreated = 0;
        this.totalAllocated = 0;
        this.totalReleased = 0;
        
        this.preallocate();
    }
    
    preallocate() {
        for (let i = 0; i < this.options.preallocate; i++) {
            this.available.push(this.createBuffer());
        }
    }
    
    createBuffer() {
        this.totalCreated++;
        return Buffer.allocUnsafe(this.options.bufferSize);
    }
    
    acquire() {
        this.totalAllocated++;
        
        let buffer;
        
        if (this.available.length > 0) {
            buffer = this.available.pop();
        } else if (this.inUse.size < this.options.maxBuffers) {
            buffer = this.createBuffer();
        } else {
            throw new Error('Buffer pool exhausted');
        }
        
        this.inUse.add(buffer);
        return buffer;
    }
    
    release(buffer) {
        if (!this.inUse.has(buffer)) {
            return;
        }
        
        this.totalReleased++;
        this.inUse.delete(buffer);
        
        // Clear buffer before reuse
        buffer.fill(0);
        
        if (this.available.length < this.options.maxBuffers) {
            this.available.push(buffer);
        }
    }
    
    getStats() {
        return {
            available: this.available.length,
            inUse: this.inUse.size,
            totalCreated: this.totalCreated,
            totalAllocated: this.totalAllocated,
            totalReleased: this.totalReleased,
            bufferSize: this.options.bufferSize,
            poolUtilization: (this.inUse.size / this.options.maxBuffers * 100).toFixed(2) + '%'
        };
    }
}

// Uso con server TCP
const net = require('net');
const bufferPool = new BufferPool({
    bufferSize: 8192,
    maxBuffers: 100,
    preallocate: 20
});

const server = net.createServer((socket) => {
    const buffer = bufferPool.acquire();
    
    socket.on('data', (chunk) => {
        // Process data using pooled buffer
        chunk.copy(buffer, 0, 0, Math.min(chunk.length, buffer.length));
        
        // Process buffer...
        console.log('Data:', buffer.toString('utf8', 0, chunk.length));
    });
    
    socket.on('close', () => {
        bufferPool.release(buffer);
    });
});

server.listen(3000, () => {
    console.log('Server listening with buffer pool');
    
    setInterval(() => {
        console.log('Buffer pool stats:', bufferPool.getStats());
    }, 5000);
});
```

### **Adaptive Buffer Sizing**

```javascript
class AdaptiveBuffer {
    constructor(initialSize = 1024) {
        this.buffer = Buffer.allocUnsafe(initialSize);
        this.position = 0;
        this.resizeCount = 0;
    }
    
    write(data) {
        const needed = this.position + data.length;
        
        if (needed > this.buffer.length) {
            this.resize(needed);
        }
        
        data.copy(this.buffer, this.position);
        this.position += data.length;
    }
    
    resize(minSize) {
        // Grow by 2x or to minSize, whichever is larger
        const newSize = Math.max(this.buffer.length * 2, minSize);
        
        const newBuffer = Buffer.allocUnsafe(newSize);
        this.buffer.copy(newBuffer, 0, 0, this.position);
        
        this.buffer = newBuffer;
        this.resizeCount++;
        
        console.log(`Buffer resized to ${newSize} bytes (resize #${this.resizeCount})`);
    }
    
    getData() {
        return this.buffer.slice(0, this.position);
    }
    
    clear() {
        this.position = 0;
    }
    
    getStats() {
        return {
            size: this.buffer.length,
            used: this.position,
            utilization: (this.position / this.buffer.length * 100).toFixed(2) + '%',
            resizeCount: this.resizeCount
        };
    }
}
```

---

## **💾 Memory Optimization**

### **Object Pooling**

```javascript
class ObjectPool {
    constructor(factory, options = {}) {
        this.factory = factory;
        this.options = {
            max: options.max || 50,
            min: options.min || 5
        };
        
        this.available = [];
        this.inUse = new Set();
        
        // Preallocate
        for (let i = 0; i < this.options.min; i++) {
            this.available.push(this.factory.create());
        }
    }
    
    acquire() {
        let obj;
        
        if (this.available.length > 0) {
            obj = this.available.pop();
        } else if (this.inUse.size < this.options.max) {
            obj = this.factory.create();
        } else {
            throw new Error('Object pool exhausted');
        }
        
        this.inUse.add(obj);
        
        if (this.factory.reset) {
            this.factory.reset(obj);
        }
        
        return obj;
    }
    
    release(obj) {
        if (!this.inUse.has(obj)) {
            return;
        }
        
        this.inUse.delete(obj);
        this.available.push(obj);
    }
}

// Factory per oggetti richiesta/risposta
const requestFactory = {
    create: () => ({
        id: null,
        command: null,
        data: null,
        timestamp: null
    }),
    
    reset: (obj) => {
        obj.id = null;
        obj.command = null;
        obj.data = null;
        obj.timestamp = Date.now();
    }
};

const requestPool = new ObjectPool(requestFactory, { max: 100, min: 10 });

// Uso
const request = requestPool.acquire();
request.id = 123;
request.command = 'getData';
request.data = { userId: 'user1' };

// ... use request ...

requestPool.release(request);
```

### **Memory Monitoring**

```javascript
class MemoryMonitor {
    constructor(threshold = 0.8) {
        this.threshold = threshold;
        this.samples = [];
        this.maxSamples = 60;
    }
    
    check() {
        const usage = process.memoryUsage();
        
        const heapUsed = usage.heapUsed;
        const heapTotal = usage.heapTotal;
        const heapUsage = heapUsed / heapTotal;
        
        const sample = {
            timestamp: Date.now(),
            heapUsed: heapUsed / 1024 / 1024, // MB
            heapTotal: heapTotal / 1024 / 1024, // MB
            heapUsage: heapUsage,
            rss: usage.rss / 1024 / 1024, // MB
            external: usage.external / 1024 / 1024 // MB
        };
        
        this.samples.push(sample);
        
        if (this.samples.length > this.maxSamples) {
            this.samples.shift();
        }
        
        return {
            current: sample,
            warning: heapUsage > this.threshold,
            trend: this.getTrend()
        };
    }
    
    getTrend() {
        if (this.samples.length < 2) {
            return 'stable';
        }
        
        const recent = this.samples.slice(-5);
        const avg = recent.reduce((sum, s) => sum + s.heapUsage, 0) / recent.length;
        const older = this.samples.slice(-10, -5);
        const oldAvg = older.length > 0
            ? older.reduce((sum, s) => sum + s.heapUsage, 0) / older.length
            : avg;
        
        const diff = avg - oldAvg;
        
        if (Math.abs(diff) < 0.05) return 'stable';
        return diff > 0 ? 'increasing' : 'decreasing';
    }
    
    shouldGC() {
        const latest = this.samples[this.samples.length - 1];
        return latest && latest.heapUsage > this.threshold;
    }
    
    forceGC() {
        if (global.gc) {
            console.log('🧹 Running manual GC');
            global.gc();
            return true;
        }
        return false;
    }
    
    getReport() {
        const latest = this.samples[this.samples.length - 1];
        
        if (!latest) {
            return { status: 'no data' };
        }
        
        return {
            heapUsed: latest.heapUsed.toFixed(2) + ' MB',
            heapTotal: latest.heapTotal.toFixed(2) + ' MB',
            heapUsage: (latest.heapUsage * 100).toFixed(2) + '%',
            rss: latest.rss.toFixed(2) + ' MB',
            external: latest.external.toFixed(2) + ' MB',
            trend: this.getTrend(),
            warning: latest.heapUsage > this.threshold
        };
    }
}

// Uso
const memMonitor = new MemoryMonitor(0.8);

setInterval(() => {
    const check = memMonitor.check();
    
    if (check.warning) {
        console.warn('⚠️ High memory usage:', memMonitor.getReport());
        
        if (memMonitor.shouldGC()) {
            memMonitor.forceGC();
        }
    }
}, 10000);

// Start Node.js with: node --expose-gc server.js
```

---

## **🚀 Zero-Copy Techniques**

### **Direct Buffer Transfer**

```javascript
class ZeroCopyServer {
    constructor(port) {
        this.port = port;
        this.server = null;
    }
    
    start() {
        this.server = require('net').createServer((socket) => {
            // Disable Nagle's algorithm for low latency
            socket.setNoDelay(true);
            
            // Optimize TCP window size
            socket.setKeepAlive(true, 60000);
            
            socket.on('data', (chunk) => {
                // Direct echo without copying
                // Node.js internally uses zero-copy when possible
                socket.write(chunk);
            });
        });
        
        return new Promise((resolve) => {
            this.server.listen(this.port, resolve);
        });
    }
}

// File transfer con zero-copy
const fs = require('fs');

class ZeroCopyFileServer {
    constructor(port) {
        this.port = port;
        this.server = null;
    }
    
    start() {
        this.server = require('net').createServer((socket) => {
            socket.on('data', (data) => {
                const filename = data.toString().trim();
                
                // Use pipe for zero-copy file transfer
                const stream = fs.createReadStream(filename, {
                    highWaterMark: 64 * 1024 // 64KB chunks
                });
                
                stream.on('error', (err) => {
                    socket.end(`ERROR: ${err.message}\n`);
                });
                
                // Pipe automatically uses zero-copy when available
                stream.pipe(socket, { end: false });
                
                stream.on('end', () => {
                    socket.end();
                });
            });
        });
        
        return new Promise((resolve) => {
            this.server.listen(this.port, resolve);
        });
    }
}
```

---

## **🔧 Nagle's Algorithm**

**Trade-off: Latenza vs Throughput**

**Cosa fa Nagle:**
```
Nagle Algorithm (default ON):
  - Bufferizza small writes
  - Invia quando buffer pieno O ack ricevuto
  
Esempio:
  write('H')  ← Buffered
  write('e')  ← Buffered
  write('l')  ← Buffered
  write('lo') ← Flush tutto: "Hello"
  
Pro: Meno pacchetti TCP (più efficiente)
Contro: Latenza +20-200ms
```

**Disabilitare con TCP_NODELAY:**
```javascript
socket.setNoDelay(true);

Risultato:
  write('H')  → Invia immediato
  write('e')  → Invia immediato
  write('l')  → Invia immediato
  
Pro: Latenza minima
Contro: Più pacchetti (meno efficiente)
```

**Quando usare:**

| Scenario | Nagle | Motivo |
|----------|-------|--------|
| Real-time gaming | OFF (setNoDelay true) | Latenza critica |
| Chat, SSH | OFF | Interattività |
| File transfer | ON (default) | Throughput importante |
| REST API | OFF | Risposta veloce |
| Database queries | OFF | Latenza query |
| Bulk data | ON | Efficienza rete |

**Benchmark:**
```
Con Nagle (default):
  - Latency: 50-200ms
  - Packets/s: 100-500
  - Bandwidth efficiency: 95%

Senza Nagle (setNoDelay):
  - Latency: 1-10ms
  - Packets/s: 5000-10000
  - Bandwidth efficiency: 70%
```

### **TCP_NODELAY Configuration**

```javascript
class LowLatencyServer {
    constructor(port, options = {}) {
        this.port = port;
        this.options = {
            noDelay: options.noDelay !== false, // Default true
            keepAlive: options.keepAlive !== false,
            keepAliveInitialDelay: options.keepAliveInitialDelay || 60000
        };
        
        this.server = null;
        this.latencies = [];
    }
    
    start() {
        this.server = require('net').createServer((socket) => {
            // Disable Nagle's algorithm for immediate send
            socket.setNoDelay(this.options.noDelay);
            
            // Enable TCP keep-alive
            socket.setKeepAlive(
                this.options.keepAlive,
                this.options.keepAliveInitialDelay
            );
            
            socket.on('data', (data) => {
                const start = process.hrtime.bigint();
                
                // Echo immediately
                socket.write(data, () => {
                    const end = process.hrtime.bigint();
                    const latency = Number(end - start) / 1000000; // Convert to ms
                    
                    this.recordLatency(latency);
                });
            });
        });
        
        return new Promise((resolve) => {
            this.server.listen(this.port, () => {
                console.log(`Low latency server on port ${this.port}`);
                console.log(`TCP_NODELAY: ${this.options.noDelay}`);
                resolve();
            });
        });
    }
    
    recordLatency(latency) {
        this.latencies.push(latency);
        
        if (this.latencies.length > 1000) {
            this.latencies.shift();
        }
    }
    
    getLatencyStats() {
        if (this.latencies.length === 0) {
            return null;
        }
        
        const sorted = [...this.latencies].sort((a, b) => a - b);
        const sum = sorted.reduce((a, b) => a + b, 0);
        
        return {
            count: sorted.length,
            avg: (sum / sorted.length).toFixed(3) + ' ms',
            min: sorted[0].toFixed(3) + ' ms',
            max: sorted[sorted.length - 1].toFixed(3) + ' ms',
            p50: sorted[Math.floor(sorted.length * 0.5)].toFixed(3) + ' ms',
            p95: sorted[Math.floor(sorted.length * 0.95)].toFixed(3) + ' ms',
            p99: sorted[Math.floor(sorted.length * 0.99)].toFixed(3) + ' ms'
        };
    }
}

// Comparison: with and without Nagle
async function compareNagle() {
    const serverNoDelay = new LowLatencyServer(3000, { noDelay: true });
    const serverNagle = new LowLatencyServer(3001, { noDelay: false });
    
    await serverNoDelay.start();
    await serverNagle.start();
    
    // Run tests...
    
    setTimeout(() => {
        console.log('\n📊 With TCP_NODELAY (Nagle disabled):');
        console.log(serverNoDelay.getLatencyStats());
        
        console.log('\n📊 Without TCP_NODELAY (Nagle enabled):');
        console.log(serverNagle.getLatencyStats());
    }, 30000);
}
```

---

## **💓 Keep-Alive Configuration**

### **TCP Keep-Alive Tuning**

```javascript
class KeepAliveServer {
    constructor(port, options = {}) {
        this.port = port;
        this.options = {
            keepAlive: options.keepAlive !== false,
            keepAliveInitialDelay: options.keepAliveInitialDelay || 60000,
            timeout: options.timeout || 120000,
            ...options
        };
        
        this.server = null;
        this.connections = new Map();
    }
    
    start() {
        this.server = require('net').createServer((socket) => {
            const connId = Date.now() + Math.random();
            
            // Configure keep-alive
            socket.setKeepAlive(
                this.options.keepAlive,
                this.options.keepAliveInitialDelay
            );
            
            // Set socket timeout
            socket.setTimeout(this.options.timeout);
            
            const conn = {
                id: connId,
                socket: socket,
                connectedAt: Date.now(),
                lastActivity: Date.now(),
                keepAlivesSent: 0,
                timeouts: 0
            };
            
            this.connections.set(connId, conn);
            
            socket.on('data', () => {
                conn.lastActivity = Date.now();
            });
            
            socket.on('timeout', () => {
                conn.timeouts++;
                console.log(`⏰ Connection ${connId} timeout (${conn.timeouts})`);
                
                // Don't close immediately, let keep-alive handle it
                if (conn.timeouts > 3) {
                    socket.destroy();
                }
            });
            
            socket.on('close', () => {
                const duration = Date.now() - conn.connectedAt;
                const idleTime = Date.now() - conn.lastActivity;
                
                console.log(`Connection ${connId} closed:`);
                console.log(`  Duration: ${(duration / 1000).toFixed(0)}s`);
                console.log(`  Idle time: ${(idleTime / 1000).toFixed(0)}s`);
                console.log(`  Timeouts: ${conn.timeouts}`);
                
                this.connections.delete(connId);
            });
        });
        
        return new Promise((resolve) => {
            this.server.listen(this.port, () => {
                console.log(`Keep-alive server on port ${this.port}`);
                console.log(`Keep-alive: ${this.options.keepAlive}`);
                console.log(`Keep-alive delay: ${this.options.keepAliveInitialDelay}ms`);
                console.log(`Timeout: ${this.options.timeout}ms`);
                resolve();
            });
        });
    }
    
    getConnectionStats() {
        return Array.from(this.connections.values()).map(c => ({
            id: c.id,
            duration: Date.now() - c.connectedAt,
            idleTime: Date.now() - c.lastActivity,
            timeouts: c.timeouts
        }));
    }
}

// System-level keep-alive tuning (Linux)
const { execSync } = require('child_process');

function configureSystemKeepAlive() {
    try {
        // Time before sending first keep-alive probe (seconds)
        execSync('sysctl -w net.ipv4.tcp_keepalive_time=60');
        
        // Interval between keep-alive probes (seconds)
        execSync('sysctl -w net.ipv4.tcp_keepalive_intvl=10');
        
        // Number of failed probes before considering connection dead
        execSync('sysctl -w net.ipv4.tcp_keepalive_probes=6');
        
        console.log('✅ System keep-alive configured');
    } catch (err) {
        console.error('Failed to configure system keep-alive:', err.message);
    }
}
```

---

## **📈 Throughput Optimization**

### **High Throughput Server**

```javascript
class HighThroughputServer {
    constructor(port, options = {}) {
        this.port = port;
        this.options = {
            highWaterMark: options.highWaterMark || 64 * 1024, // 64KB
            noDelay: options.noDelay !== false,
            allowHalfOpen: options.allowHalfOpen || false,
            ...options
        };
        
        this.server = null;
        this.stats = {
            connections: 0,
            bytesReceived: 0,
            bytesSent: 0,
            messagesReceived: 0,
            messagesSent: 0,
            startTime: Date.now()
        };
    }
    
    start() {
        this.server = require('net').createServer({
            allowHalfOpen: this.options.allowHalfOpen
        }, (socket) => {
            this.stats.connections++;
            
            // Optimize for throughput
            socket.setNoDelay(this.options.noDelay);
            
            // Increase buffer size
            socket.setKeepAlive(true, 60000);
            
            let bytesReceivedThisConn = 0;
            let bytesSentThisConn = 0;
            
            socket.on('data', (chunk) => {
                this.stats.bytesReceived += chunk.length;
                this.stats.messagesReceived++;
                bytesReceivedThisConn += chunk.length;
                
                // Batch responses for better throughput
                const response = this.processChunk(chunk);
                
                if (response) {
                    socket.write(response, () => {
                        this.stats.bytesSent += response.length;
                        this.stats.messagesSent++;
                        bytesSentThisConn += response.length;
                    });
                }
            });
            
            socket.on('close', () => {
                console.log(`Connection closed: ${bytesReceivedThisConn} bytes received, ${bytesSentThisConn} bytes sent`);
            });
            
            socket.on('error', (err) => {
                console.error('Socket error:', err.message);
            });
        });
        
        this.server.maxConnections = this.options.maxConnections || 10000;
        
        return new Promise((resolve) => {
            this.server.listen(this.port, () => {
                console.log(`High throughput server on port ${this.port}`);
                this.startStatsReporting();
                resolve();
            });
        });
    }
    
    processChunk(chunk) {
        // Simple echo for benchmark
        return chunk;
    }
    
    startStatsReporting() {
        setInterval(() => {
            const uptime = (Date.now() - this.stats.startTime) / 1000;
            
            console.log('\n📊 Throughput Stats:');
            console.log(`  Uptime: ${uptime.toFixed(0)}s`);
            console.log(`  Connections: ${this.stats.connections}`);
            console.log(`  Bytes received: ${(this.stats.bytesReceived / 1024 / 1024).toFixed(2)} MB`);
            console.log(`  Bytes sent: ${(this.stats.bytesSent / 1024 / 1024).toFixed(2)} MB`);
            console.log(`  Throughput in: ${(this.stats.bytesReceived / uptime / 1024 / 1024).toFixed(2)} MB/s`);
            console.log(`  Throughput out: ${(this.stats.bytesSent / uptime / 1024 / 1024).toFixed(2)} MB/s`);
            console.log(`  Messages/sec: ${(this.stats.messagesReceived / uptime).toFixed(0)}`);
        }, 5000);
    }
}

// Uso
const server = new HighThroughputServer(3000, {
    highWaterMark: 128 * 1024, // 128KB buffers
    noDelay: true,
    maxConnections: 10000
});

server.start();
```

---

## **📊 Benchmarking**

### **Performance Benchmark Tool**

```javascript
class TCPBenchmark {
    constructor(host, port, options = {}) {
        this.host = host;
        this.port = port;
        this.options = {
            connections: options.connections || 10,
            duration: options.duration || 10000,
            messageSize: options.messageSize || 1024,
            messagesPerConnection: options.messagesPerConnection || 100,
            ...options
        };
        
        this.results = {
            totalConnections: 0,
            successfulConnections: 0,
            failedConnections: 0,
            totalMessages: 0,
            totalBytes: 0,
            errors: 0,
            latencies: [],
            connectionTimes: []
        };
    }
    
    async run() {
        console.log('🚀 Starting benchmark...');
        console.log(`  Target: ${this.host}:${this.port}`);
        console.log(`  Connections: ${this.options.connections}`);
        console.log(`  Duration: ${this.options.duration}ms`);
        console.log(`  Message size: ${this.options.messageSize} bytes`);
        
        const startTime = Date.now();
        const promises = [];
        
        for (let i = 0; i < this.options.connections; i++) {
            promises.push(this.runConnection(i));
        }
        
        await Promise.all(promises);
        
        const duration = Date.now() - startTime;
        
        return this.generateReport(duration);
    }
    
    async runConnection(connId) {
        return new Promise((resolve) => {
            const connectStart = Date.now();
            
            const socket = require('net').connect({
                host: this.host,
                port: this.port
            });
            
            socket.setNoDelay(true);
            
            this.results.totalConnections++;
            
            socket.once('connect', () => {
                const connectTime = Date.now() - connectStart;
                this.results.connectionTimes.push(connectTime);
                this.results.successfulConnections++;
                
                this.sendMessages(socket, connId).then(() => {
                    socket.end();
                    resolve();
                });
            });
            
            socket.on('error', (err) => {
                this.results.errors++;
                this.results.failedConnections++;
                resolve();
            });
        });
    }
    
    async sendMessages(socket, connId) {
        const message = Buffer.alloc(this.options.messageSize, 'x');
        
        for (let i = 0; i < this.options.messagesPerConnection; i++) {
            const start = process.hrtime.bigint();
            
            await new Promise((resolve) => {
                socket.write(message, () => {
                    const end = process.hrtime.bigint();
                    const latency = Number(end - start) / 1000000; // ms
                    
                    this.results.latencies.push(latency);
                    this.results.totalMessages++;
                    this.results.totalBytes += message.length;
                    
                    resolve();
                });
            });
        }
    }
    
    generateReport(duration) {
        const latencies = this.results.latencies.sort((a, b) => a - b);
        
        const report = {
            summary: {
                duration: (duration / 1000).toFixed(2) + 's',
                connections: this.results.totalConnections,
                successful: this.results.successfulConnections,
                failed: this.results.failedConnections,
                messages: this.results.totalMessages,
                bytes: this.results.totalBytes,
                errors: this.results.errors
            },
            
            throughput: {
                messagesPerSecond: (this.results.totalMessages / (duration / 1000)).toFixed(0),
                bytesPerSecond: (this.results.totalBytes / (duration / 1000)).toFixed(0),
                mbPerSecond: (this.results.totalBytes / (duration / 1000) / 1024 / 1024).toFixed(2)
            },
            
            latency: {
                min: latencies[0]?.toFixed(3) + 'ms' || 'N/A',
                max: latencies[latencies.length - 1]?.toFixed(3) + 'ms' || 'N/A',
                avg: latencies.length > 0
                    ? (latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(3) + 'ms'
                    : 'N/A',
                p50: latencies[Math.floor(latencies.length * 0.5)]?.toFixed(3) + 'ms' || 'N/A',
                p95: latencies[Math.floor(latencies.length * 0.95)]?.toFixed(3) + 'ms' || 'N/A',
                p99: latencies[Math.floor(latencies.length * 0.99)]?.toFixed(3) + 'ms' || 'N/A'
            },
            
            connections: {
                avgConnectTime: this.results.connectionTimes.length > 0
                    ? (this.results.connectionTimes.reduce((a, b) => a + b, 0) / this.results.connectionTimes.length).toFixed(3) + 'ms'
                    : 'N/A',
                successRate: (this.results.successfulConnections / this.results.totalConnections * 100).toFixed(2) + '%'
            }
        };
        
        return report;
    }
}

// Uso
async function benchmark() {
    const bench = new TCPBenchmark('localhost', 3000, {
        connections: 100,
        duration: 10000,
        messageSize: 1024,
        messagesPerConnection: 100
    });
    
    const report = await bench.run();
    
    console.log('\n📊 Benchmark Report:');
    console.log('\nSummary:');
    console.table(report.summary);
    
    console.log('\nThroughput:');
    console.table(report.throughput);
    
    console.log('\nLatency:');
    console.table(report.latency);
    
    console.log('\nConnections:');
    console.table(report.connections);
}

// Run benchmark
benchmark().catch(console.error);
```

### **Comparison Benchmark**

```javascript
async function compareBenchmark() {
    console.log('🔬 Running comparison benchmark...\n');
    
    // Scenario 1: With Nagle (default)
    console.log('Test 1: With Nagle\'s algorithm');
    const bench1 = new TCPBenchmark('localhost', 3001, {
        connections: 50,
        messagesPerConnection: 100,
        messageSize: 512
    });
    const report1 = await bench1.run();
    
    // Scenario 2: Without Nagle (TCP_NODELAY)
    console.log('\nTest 2: Without Nagle\'s algorithm (TCP_NODELAY)');
    const bench2 = new TCPBenchmark('localhost', 3002, {
        connections: 50,
        messagesPerConnection: 100,
        messageSize: 512
    });
    const report2 = await bench2.run();
    
    // Scenario 3: Large buffers
    console.log('\nTest 3: Large message size');
    const bench3 = new TCPBenchmark('localhost', 3002, {
        connections: 50,
        messagesPerConnection: 100,
        messageSize: 8192
    });
    const report3 = await bench3.run();
    
    // Compare
    console.log('\n📊 Comparison:');
    console.log('\nThroughput (MB/s):');
    console.log(`  With Nagle: ${report1.throughput.mbPerSecond}`);
    console.log(`  TCP_NODELAY: ${report2.throughput.mbPerSecond}`);
    console.log(`  Large buffers: ${report3.throughput.mbPerSecond}`);
    
    console.log('\nAverage Latency:');
    console.log(`  With Nagle: ${report1.latency.avg}`);
    console.log(`  TCP_NODELAY: ${report2.latency.avg}`);
    console.log(`  Large buffers: ${report3.latency.avg}`);
}
```

---

## **🎓 Riepilogo**

**Performance Optimization:**
- Buffer pooling per ridurre allocazioni
- Memory monitoring e GC management
- Zero-copy per trasferimenti efficienti
- TCP_NODELAY per bassa latenza
- Keep-alive configuration
- High throughput con buffer grandi
- Benchmarking per misurare performance

**Best Practices:**
- ✅ Usare buffer pool per ridurre GC
- ✅ TCP_NODELAY per low-latency
- ✅ Keep-alive per connessioni persistenti
- ✅ Aumentare highWaterMark per throughput
- ✅ Zero-copy con pipe quando possibile
- ✅ Monitor memory usage
- ✅ Benchmark prima/dopo ottimizzazioni
- ✅ Profiling per identificare bottleneck

**Quando usare:**
- TCP_NODELAY: messaggi piccoli, bassa latenza
- Nagle's algorithm: batch di dati, throughput
- Large buffers: trasferimenti grandi
- Keep-alive: connessioni persistenti
- Buffer pooling: alte frequenze di allocazione

---

**Fine Modulo 2**: TCP Programming completo! 🎉

**Prossimi Moduli**: [README.md](../README.md) - Torna all'indice principale
