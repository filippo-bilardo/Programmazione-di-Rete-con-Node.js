# **🔗 Gestione Connessioni**

## **📑 Indice**
1. [Introduzione](#introduzione)
2. [Connection Pooling Architecture](#connection-pooling-architecture)
3. [Pool Configuration](#pool-configuration)
4. [Health Checking](#health-checking)
5. [Load Balancing Algorithms](#load-balancing-algorithms)
6. [Session Management](#session-management)
7. [Resource Limits](#resource-limits)
8. [Production Example](#production-example)

---

## **🎯 Introduzione**

**Scaling oltre la singola connessione**

**Il problema:**
```
1 Client = 1 Connection TCP
1000 Clients = 1000 Connections?
  → Overhead creazione/distruzione
  → Latenza handshake (3-way)
  → Spreco risorse
```

**Soluzioni in questa guida:**

1. **Connection Pooling** 🏊
   - Riuso connessioni esistenti
   - Riduzione handshake overhead
   - Limite connessioni simultaneous

2. **Health Checking** 🏥
   - Verifica connessioni funzionanti
   - Rimozione connessioni morte
   - Prevenzione errori runtime

3. **Load Balancing** ⚖️
   - Distribuzione carico su N server
   - Round-robin, Least-connections
   - Failover automatico

4. **Session Management** 📝
   - Tracciamento stato client
   - Session persistence
   - Session affinity

5. **Resource Limits** 🛡️
   - Max connections per IP
   - Rate limiting
   - Memory/CPU protection

**Quando implementare:**

| Scenario | Soluzioni necessarie |
|----------|---------------------|
| <100 clients, low traffic | Base connection handling |
| 100-1K clients | Connection pooling, health checks |
| 1K-10K clients | + Load balancing, resource limits |
| 10K+ clients | + Session management, advanced monitoring |

Gestione efficiente delle connessioni per:
- 🏊 **Connection pooling**: riuso connessioni
- ⚙️ **Configuration**: tuning parametri
- 🏥 **Health checks**: monitoring stato
- ⚖️ **Load balancing**: distribuzione carico
- 📝 **Session tracking**: gestione sessioni
- 🛡️ **Resource limits**: protezione risorse
- 📊 **Monitoring**: metriche e stats

---

## **🏊 Connection Pooling Architecture**

**Perché Connection Pool?**

**Senza pool:**
```
Client request:
  1. Create socket
  2. TCP handshake (3-way) ← 50-200ms latency!
  3. Send/receive data
  4. Close socket
  5. Repeat for OGNI request...
```

**Con pool:**
```
Client request:
  1. Get connection from pool (already connected)
  2. Send/receive data
  3. Return connection to pool
  → Risparmio 50-200ms per request!
```

**Vantaggi:**
- ✅ Latenza ridotta (no handshake)
- ✅ Riuso connessioni (meno overhead)
- ✅ Controllo risorse (max connections)
- ✅ Connection warming (keep-alive)

**Stati connessione:**
```
idle → Disponibile nel pool
active → In uso da un client
connecting → Handshake in corso
broken → Errore, da rimuovere
```

**Quando usare:**
- ✅ Multiple richieste allo stesso server
- ✅ Latenza critica
- ✅ High throughput necessario
- ❌ NON usare: connessioni long-lived (WebSocket, streaming)

### **Advanced Connection Pool**

```javascript
const EventEmitter = require('events');

class Connection extends EventEmitter {
    constructor(id, options) {
        super();
        
        this.id = id;
        this.options = options;
        this.socket = null;
        this.state = 'idle'; // idle, active, connecting, broken
        this.createdAt = Date.now();
        this.lastUsedAt = Date.now();
        this.usageCount = 0;
        this.errorCount = 0;
        this.healthCheckCount = 0;
    }
    
    async connect() {
        if (this.socket && !this.socket.destroyed) {
            return;
        }
        
        this.state = 'connecting';
        
        return new Promise((resolve, reject) => {
            this.socket = require('net').connect({
                host: this.options.host,
                port: this.options.port,
                keepAlive: true,
                keepAliveInitialDelay: 30000
            });
            
            const timeout = setTimeout(() => {
                this.socket.destroy();
                reject(new Error('Connection timeout'));
            }, this.options.connectTimeout || 10000);
            
            this.socket.once('connect', () => {
                clearTimeout(timeout);
                this.state = 'idle';
                this.setupSocketEvents();
                resolve();
            });
            
            this.socket.once('error', (err) => {
                clearTimeout(timeout);
                this.state = 'broken';
                this.errorCount++;
                reject(err);
            });
        });
    }
    
    setupSocketEvents() {
        this.socket.on('close', () => {
            this.state = 'broken';
            this.emit('closed');
        });
        
        this.socket.on('error', (err) => {
            this.errorCount++;
            this.emit('error', err);
        });
        
        this.socket.on('timeout', () => {
            this.state = 'broken';
            this.emit('timeout');
        });
    }
    
    async healthCheck() {
        if (this.state !== 'idle') {
            return false;
        }
        
        this.healthCheckCount++;
        
        // Check socket state
        if (!this.socket || this.socket.destroyed || !this.socket.writable) {
            this.state = 'broken';
            return false;
        }
        
        // Optional: send ping
        if (this.options.healthCheckPing) {
            try {
                await this.send('PING\n');
                // Wait for PONG (simplified)
                return true;
            } catch (err) {
                this.state = 'broken';
                return false;
            }
        }
        
        return true;
    }
    
    async send(data) {
        if (this.state !== 'active' && this.state !== 'idle') {
            throw new Error(`Cannot send: connection is ${this.state}`);
        }
        
        return new Promise((resolve, reject) => {
            this.socket.write(data, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }
    
    markActive() {
        this.state = 'active';
        this.lastUsedAt = Date.now();
        this.usageCount++;
    }
    
    markIdle() {
        this.state = 'idle';
        this.lastUsedAt = Date.now();
    }
    
    destroy() {
        if (this.socket) {
            this.socket.destroy();
        }
        this.state = 'broken';
    }
    
    getStats() {
        return {
            id: this.id,
            state: this.state,
            age: Date.now() - this.createdAt,
            idleTime: Date.now() - this.lastUsedAt,
            usageCount: this.usageCount,
            errorCount: this.errorCount,
            healthCheckCount: this.healthCheckCount
        };
    }
}

class AdvancedConnectionPool extends EventEmitter {
    constructor(options) {
        super();
        
        this.options = {
            host: options.host || 'localhost',
            port: options.port || 3000,
            minConnections: options.minConnections || 2,
            maxConnections: options.maxConnections || 10,
            acquireTimeout: options.acquireTimeout || 5000,
            idleTimeout: options.idleTimeout || 60000,
            maxIdleTime: options.maxIdleTime || 300000,
            maxConnectionAge: options.maxConnectionAge || 3600000,
            healthCheckInterval: options.healthCheckInterval || 30000,
            connectTimeout: options.connectTimeout || 10000,
            evictionRunInterval: options.evictionRunInterval || 60000,
            ...options
        };
        
        this.connections = [];
        this.availableQueue = [];
        this.waitQueue = [];
        this.nextConnectionId = 0;
        this.totalCreated = 0;
        this.totalAcquired = 0;
        this.totalReleased = 0;
        this.totalDestroyed = 0;
        
        this.healthCheckTimer = null;
        this.evictionTimer = null;
    }
    
    async init() {
        // Create minimum connections
        for (let i = 0; i < this.options.minConnections; i++) {
            await this.createConnection();
        }
        
        // Start background tasks
        this.startHealthChecks();
        this.startEviction();
        
        this.emit('initialized', this.getStats());
    }
    
    async createConnection() {
        if (this.connections.length >= this.options.maxConnections) {
            throw new Error('Max connections reached');
        }
        
        const conn = new Connection(++this.nextConnectionId, this.options);
        
        conn.on('closed', () => {
            this.handleConnectionClosed(conn);
        });
        
        conn.on('error', (err) => {
            this.emit('connectionError', { id: conn.id, error: err.message });
        });
        
        try {
            await conn.connect();
            
            this.connections.push(conn);
            this.availableQueue.push(conn);
            this.totalCreated++;
            
            this.emit('connectionCreated', conn.id);
            
            return conn;
        } catch (err) {
            this.emit('connectionFailed', err);
            throw err;
        }
    }
    
    async acquire() {
        this.totalAcquired++;
        
        // Try to get available connection
        while (this.availableQueue.length > 0) {
            const conn = this.availableQueue.shift();
            
            // Validate connection
            if (conn.state === 'idle' && await conn.healthCheck()) {
                conn.markActive();
                return conn;
            } else {
                // Connection is broken, remove it
                await this.destroyConnection(conn);
            }
        }
        
        // Try to create new connection
        if (this.connections.length < this.options.maxConnections) {
            const conn = await this.createConnection();
            conn.markActive();
            return conn;
        }
        
        // Wait for available connection
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                const index = this.waitQueue.findIndex(w => w.resolve === resolve);
                if (index > -1) {
                    this.waitQueue.splice(index, 1);
                }
                reject(new Error('Acquire timeout'));
            }, this.options.acquireTimeout);
            
            this.waitQueue.push({ resolve, reject, timeout });
        });
    }
    
    release(conn) {
        if (!conn || conn.state === 'broken') {
            return;
        }
        
        this.totalReleased++;
        conn.markIdle();
        
        // Serve waiting clients
        if (this.waitQueue.length > 0) {
            const waiter = this.waitQueue.shift();
            clearTimeout(waiter.timeout);
            conn.markActive();
            waiter.resolve(conn);
        } else {
            this.availableQueue.push(conn);
        }
    }
    
    async execute(fn) {
        const conn = await this.acquire();
        
        try {
            const result = await fn(conn);
            return result;
        } finally {
            this.release(conn);
        }
    }
    
    handleConnectionClosed(conn) {
        // Remove from connections
        const index = this.connections.indexOf(conn);
        if (index > -1) {
            this.connections.splice(index, 1);
        }
        
        // Remove from available queue
        const queueIndex = this.availableQueue.indexOf(conn);
        if (queueIndex > -1) {
            this.availableQueue.splice(queueIndex, 1);
        }
        
        this.emit('connectionClosed', conn.id);
        
        // Maintain minimum connections
        if (this.connections.length < this.options.minConnections) {
            this.createConnection().catch(err => {
                this.emit('error', err);
            });
        }
    }
    
    async destroyConnection(conn) {
        conn.destroy();
        
        const index = this.connections.indexOf(conn);
        if (index > -1) {
            this.connections.splice(index, 1);
        }
        
        const queueIndex = this.availableQueue.indexOf(conn);
        if (queueIndex > -1) {
            this.availableQueue.splice(queueIndex, 1);
        }
        
        this.totalDestroyed++;
        this.emit('connectionDestroyed', conn.id);
    }
    
    startHealthChecks() {
        this.healthCheckTimer = setInterval(async () => {
            for (const conn of this.connections) {
                if (conn.state === 'idle') {
                    const healthy = await conn.healthCheck();
                    if (!healthy) {
                        await this.destroyConnection(conn);
                    }
                }
            }
        }, this.options.healthCheckInterval);
    }
    
    startEviction() {
        this.evictionTimer = setInterval(() => {
            this.evictStaleConnections();
        }, this.options.evictionRunInterval);
    }
    
    evictStaleConnections() {
        const now = Date.now();
        const toEvict = [];
        
        for (const conn of this.availableQueue) {
            // Check idle time
            const idleTime = now - conn.lastUsedAt;
            if (idleTime > this.options.maxIdleTime) {
                toEvict.push(conn);
                continue;
            }
            
            // Check age
            const age = now - conn.createdAt;
            if (age > this.options.maxConnectionAge) {
                toEvict.push(conn);
                continue;
            }
        }
        
        // Keep minimum connections
        const canEvict = this.connections.length - this.options.minConnections;
        const toEvictCount = Math.min(toEvict.length, canEvict);
        
        for (let i = 0; i < toEvictCount; i++) {
            this.destroyConnection(toEvict[i]);
        }
        
        if (toEvictCount > 0) {
            this.emit('evicted', toEvictCount);
        }
    }
    
    getStats() {
        return {
            total: this.connections.length,
            available: this.availableQueue.length,
            active: this.connections.filter(c => c.state === 'active').length,
            waiting: this.waitQueue.length,
            totalCreated: this.totalCreated,
            totalAcquired: this.totalAcquired,
            totalReleased: this.totalReleased,
            totalDestroyed: this.totalDestroyed,
            connections: this.connections.map(c => c.getStats())
        };
    }
    
    async close() {
        // Stop timers
        if (this.healthCheckTimer) {
            clearInterval(this.healthCheckTimer);
        }
        
        if (this.evictionTimer) {
            clearInterval(this.evictionTimer);
        }
        
        // Reject waiting requests
        for (const waiter of this.waitQueue) {
            clearTimeout(waiter.timeout);
            waiter.reject(new Error('Pool is closing'));
        }
        this.waitQueue = [];
        
        // Destroy all connections
        for (const conn of this.connections) {
            conn.destroy();
        }
        
        this.connections = [];
        this.availableQueue = [];
        
        this.emit('closed');
    }
}

// Uso
const pool = new AdvancedConnectionPool({
    host: 'localhost',
    port: 3000,
    minConnections: 5,
    maxConnections: 20,
    idleTimeout: 60000,
    maxIdleTime: 300000,
    maxConnectionAge: 3600000,
    healthCheckInterval: 30000
});

pool.on('initialized', (stats) => {
    console.log('✅ Pool initialized:', stats);
});

pool.on('connectionCreated', (id) => {
    console.log(`➕ Connection ${id} created`);
});

pool.on('connectionDestroyed', (id) => {
    console.log(`➖ Connection ${id} destroyed`);
});

pool.on('evicted', (count) => {
    console.log(`🧹 Evicted ${count} stale connections`);
});

await pool.init();

// Use pool
await pool.execute(async (conn) => {
    await conn.send('Hello!\n');
});

// Stats
setInterval(() => {
    console.log('Pool stats:', pool.getStats());
}, 10000);
```

---

## **⚙️ Pool Configuration**

### **Configuration Tuning**

```javascript
class PoolConfigurator {
    static getRecommendedConfig(scenario) {
        const configs = {
            'high-throughput': {
                minConnections: 10,
                maxConnections: 50,
                acquireTimeout: 3000,
                idleTimeout: 30000,
                maxIdleTime: 120000,
                maxConnectionAge: 600000,
                healthCheckInterval: 15000,
                evictionRunInterval: 30000
            },
            
            'low-latency': {
                minConnections: 20,
                maxConnections: 100,
                acquireTimeout: 1000,
                idleTimeout: 10000,
                maxIdleTime: 60000,
                maxConnectionAge: 300000,
                healthCheckInterval: 10000,
                evictionRunInterval: 20000
            },
            
            'resource-constrained': {
                minConnections: 2,
                maxConnections: 10,
                acquireTimeout: 10000,
                idleTimeout: 120000,
                maxIdleTime: 600000,
                maxConnectionAge: 7200000,
                healthCheckInterval: 60000,
                evictionRunInterval: 120000
            },
            
            'balanced': {
                minConnections: 5,
                maxConnections: 20,
                acquireTimeout: 5000,
                idleTimeout: 60000,
                maxIdleTime: 300000,
                maxConnectionAge: 3600000,
                healthCheckInterval: 30000,
                evictionRunInterval: 60000
            }
        };
        
        return configs[scenario] || configs.balanced;
    }
    
    static calculatePoolSize(expectedLoad, avgRequestTime) {
        // Little's Law: L = λ * W
        // L = average number in system
        // λ = arrival rate (requests/sec)
        // W = average time in system (sec)
        
        const minSize = Math.ceil(expectedLoad * avgRequestTime * 0.5);
        const maxSize = Math.ceil(expectedLoad * avgRequestTime * 2);
        
        return {
            minConnections: Math.max(2, minSize),
            maxConnections: Math.max(10, maxSize)
        };
    }
    
    static validateConfig(config) {
        const issues = [];
        
        if (config.minConnections > config.maxConnections) {
            issues.push('minConnections cannot be greater than maxConnections');
        }
        
        if (config.acquireTimeout < 1000) {
            issues.push('acquireTimeout should be at least 1000ms');
        }
        
        if (config.maxIdleTime < config.idleTimeout) {
            issues.push('maxIdleTime should be greater than idleTimeout');
        }
        
        if (config.healthCheckInterval < 10000) {
            issues.push('healthCheckInterval should be at least 10000ms');
        }
        
        return {
            valid: issues.length === 0,
            issues
        };
    }
}

// Uso
const config = PoolConfigurator.getRecommendedConfig('high-throughput');
console.log('Recommended config:', config);

// Calculate for specific load
const sized = PoolConfigurator.calculatePoolSize(100, 0.05); // 100 req/s, 50ms avg
console.log('Calculated pool size:', sized);

// Validate
const validation = PoolConfigurator.validateConfig(config);
if (!validation.valid) {
    console.error('Configuration issues:', validation.issues);
}
```

---

## **🏥 Health Checking**

**Rilevare connessioni morte prima di usarle**

**Il problema:**
```
Connection nel pool:
  - Sembra valida (socket.destroyed = false)
  - Ma server remoto ha chiuso
  - Client prova a inviare → ERRORE!
```

**Strategie:**

**1. Passive Health Check** (reattivo)
```
Usa connessione → Errore? → Rimuovi dal pool
Pro: Zero overhead
Contro: Errore arriva al client
```

**2. Active Health Check** (proattivo)
```
Ogni 30s: Invia ping a tutte le connessioni
No risposta? → Rimuovi PRIMA che client usi
Pro: Previene errori client
Contro: Overhead ping
```

**3. Hybrid** (best practice)
```
- Passive per errori immediati
- Active ogni N secondi per pulizia preventiva
```

**Metriche da tracciare:**
- Failure rate (errori / richieste totali)
- Response time (latenza connessione)
- Error count (numero errori consecutivi)
- Last success time (ultima risposta OK)

**Quando rimuovere connessione:**
- ❌ 3+ errori consecutivi
- ❌ Timeout > 5 secondi
- ❌ No risposta a health check
- ❌ Socket closed/destroyed

### **Comprehensive Health Checks**

```javascript
class HealthChecker {
    constructor(pool) {
        this.pool = pool;
        this.history = [];
        this.maxHistory = 100;
    }
    
    async checkConnection(conn) {
        const checks = {
            socketState: this.checkSocketState(conn),
            responseTime: await this.checkResponseTime(conn),
            errorRate: this.checkErrorRate(conn),
            age: this.checkAge(conn)
        };
        
        const healthy = Object.values(checks).every(c => c.passed);
        
        this.recordCheck({
            connectionId: conn.id,
            timestamp: Date.now(),
            healthy,
            checks
        });
        
        return { healthy, checks };
    }
    
    checkSocketState(conn) {
        const passed = conn.socket && 
                      !conn.socket.destroyed && 
                      conn.socket.writable && 
                      conn.socket.readable;
        
        return {
            name: 'Socket State',
            passed,
            message: passed ? 'Socket is healthy' : 'Socket is not usable'
        };
    }
    
    async checkResponseTime(conn, timeout = 1000) {
        const start = Date.now();
        
        try {
            await Promise.race([
                conn.send('PING\n'),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Timeout')), timeout)
                )
            ]);
            
            const responseTime = Date.now() - start;
            const passed = responseTime < timeout;
            
            return {
                name: 'Response Time',
                passed,
                value: responseTime,
                message: `Response time: ${responseTime}ms`
            };
        } catch (err) {
            return {
                name: 'Response Time',
                passed: false,
                message: `Failed: ${err.message}`
            };
        }
    }
    
    checkErrorRate(conn) {
        const errorRate = conn.errorCount / Math.max(conn.usageCount, 1);
        const passed = errorRate < 0.1; // Less than 10% errors
        
        return {
            name: 'Error Rate',
            passed,
            value: errorRate,
            message: `Error rate: ${(errorRate * 100).toFixed(2)}%`
        };
    }
    
    checkAge(conn) {
        const age = Date.now() - conn.createdAt;
        const maxAge = this.pool.options.maxConnectionAge;
        const passed = age < maxAge;
        
        return {
            name: 'Connection Age',
            passed,
            value: age,
            message: `Age: ${(age / 1000).toFixed(0)}s / ${(maxAge / 1000).toFixed(0)}s`
        };
    }
    
    recordCheck(result) {
        this.history.push(result);
        
        if (this.history.length > this.maxHistory) {
            this.history.shift();
        }
    }
    
    getHealthReport() {
        const recent = this.history.slice(-10);
        const healthy = recent.filter(r => r.healthy).length;
        const total = recent.length;
        
        return {
            overallHealth: total > 0 ? (healthy / total * 100).toFixed(1) + '%' : 'N/A',
            recentChecks: recent.length,
            healthyChecks: healthy,
            unhealthyChecks: total - healthy,
            lastCheck: this.history[this.history.length - 1]
        };
    }
}

// Uso
const healthChecker = new HealthChecker(pool);

// Check periodically
setInterval(async () => {
    for (const conn of pool.connections) {
        if (conn.state === 'idle') {
            const result = await healthChecker.checkConnection(conn);
            
            if (!result.healthy) {
                console.log(`⚠️ Unhealthy connection ${conn.id}:`, result.checks);
            }
        }
    }
    
    console.log('Health report:', healthChecker.getHealthReport());
}, 30000);
```

---

## **⚖️ Load Balancing Algorithms**

**Distribuire richieste su N server**

**Algoritmi:**

**1. Round Robin** (semplice)
```
Server: [A, B, C]
Request 1 → A
Request 2 → B
Request 3 → C
Request 4 → A (ricomincia)

Pro: ✅ Semplice, fair distribution
Contro: ❌ Ignora carico effettivo server
```

**2. Least Connections** (smart)
```
Server A: 10 connessioni
Server B: 5 connessioni
Server C: 8 connessioni

Nuova request → Server B (ha meno carico)

Pro: ✅ Distribuzione basata su carico reale
Contro: ❌ Overhead tracking connessioni
```

**3. Weighted Round Robin** (priorità)
```
Server A (weight=3): riceve 3 request
Server B (weight=2): riceve 2 request
Server C (weight=1): riceve 1 request

Quando: Server con capacità diverse
```

**4. IP Hash** (session affinity)
```
hash(client_ip) % num_servers = server_index

Stesso client → Sempre stesso server

Quando: Stateful sessions (cache, auth)
```

**Confronto:**

| Algoritmo | Complessità | Fairness | Session Affinity |
|-----------|--------------|----------|------------------|
| Round Robin | ⭐ | ⭐⭐⭐⭐ | ❌ |
| Least Conn | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ❌ |
| Weighted RR | ⭐⭐ | ⭐⭐⭐ | ❌ |
| IP Hash | ⭐⭐ | ⭐⭐⭐ | ✅ |

### **Load Balancing Strategies**

```javascript
class LoadBalancer {
    constructor(pools) {
        this.pools = pools;
        this.currentIndex = 0;
        this.stats = new Map();
        
        pools.forEach(pool => {
            this.stats.set(pool, {
                requests: 0,
                errors: 0,
                totalResponseTime: 0
            });
        });
    }
    
    // Round Robin
    roundRobin() {
        const pool = this.pools[this.currentIndex];
        this.currentIndex = (this.currentIndex + 1) % this.pools.length;
        return pool;
    }
    
    // Least Connections
    leastConnections() {
        return this.pools.reduce((min, pool) => {
            const minActive = min.getStats().active;
            const poolActive = pool.getStats().active;
            return poolActive < minActive ? pool : min;
        });
    }
    
    // Weighted Round Robin
    weightedRoundRobin(weights) {
        const totalWeight = weights.reduce((sum, w) => sum + w, 0);
        let random = Math.random() * totalWeight;
        
        for (let i = 0; i < this.pools.length; i++) {
            random -= weights[i];
            if (random <= 0) {
                return this.pools[i];
            }
        }
        
        return this.pools[0];
    }
    
    // Least Response Time
    leastResponseTime() {
        return this.pools.reduce((best, pool) => {
            const bestStats = this.stats.get(best);
            const poolStats = this.stats.get(pool);
            
            const bestAvg = bestStats.requests > 0 
                ? bestStats.totalResponseTime / bestStats.requests 
                : 0;
            
            const poolAvg = poolStats.requests > 0
                ? poolStats.totalResponseTime / poolStats.requests
                : 0;
            
            return poolAvg < bestAvg ? pool : best;
        });
    }
    
    // Random
    random() {
        const index = Math.floor(Math.random() * this.pools.length);
        return this.pools[index];
    }
    
    // Power of Two Choices
    powerOfTwo() {
        const idx1 = Math.floor(Math.random() * this.pools.length);
        const idx2 = Math.floor(Math.random() * this.pools.length);
        
        const pool1 = this.pools[idx1];
        const pool2 = this.pools[idx2];
        
        const active1 = pool1.getStats().active;
        const active2 = pool2.getStats().active;
        
        return active1 <= active2 ? pool1 : pool2;
    }
    
    async execute(strategy, fn) {
        const pool = this[strategy]();
        const stats = this.stats.get(pool);
        
        stats.requests++;
        const start = Date.now();
        
        try {
            const result = await pool.execute(fn);
            stats.totalResponseTime += Date.now() - start;
            return result;
        } catch (err) {
            stats.errors++;
            throw err;
        }
    }
    
    getStats() {
        return Array.from(this.stats.entries()).map(([pool, stats]) => ({
            pool: pool.options.host + ':' + pool.options.port,
            requests: stats.requests,
            errors: stats.errors,
            errorRate: (stats.errors / stats.requests * 100).toFixed(2) + '%',
            avgResponseTime: stats.requests > 0
                ? (stats.totalResponseTime / stats.requests).toFixed(2) + 'ms'
                : 'N/A'
        }));
    }
}

// Uso
const pool1 = new AdvancedConnectionPool({ host: 'server1', port: 3000 });
const pool2 = new AdvancedConnectionPool({ host: 'server2', port: 3000 });
const pool3 = new AdvancedConnectionPool({ host: 'server3', port: 3000 });

await Promise.all([pool1.init(), pool2.init(), pool3.init()]);

const lb = new LoadBalancer([pool1, pool2, pool3]);

// Execute with different strategies
for (let i = 0; i < 100; i++) {
    await lb.execute('leastConnections', async (conn) => {
        await conn.send(`Request ${i}\n`);
    });
}

console.log('Load balancer stats:');
console.table(lb.getStats());
```

---

## **📝 Session Management**

### **Session Tracking**

```javascript
class SessionManager {
    constructor(pool) {
        this.pool = pool;
        this.sessions = new Map();
        this.sessionTimeout = 1800000; // 30 minutes
        
        this.startCleanup();
    }
    
    async createSession(userId) {
        const sessionId = this.generateSessionId();
        const conn = await this.pool.acquire();
        
        const session = {
            id: sessionId,
            userId,
            connection: conn,
            createdAt: Date.now(),
            lastAccessedAt: Date.now(),
            requestCount: 0,
            data: {}
        };
        
        this.sessions.set(sessionId, session);
        
        return sessionId;
    }
    
    getSession(sessionId) {
        const session = this.sessions.get(sessionId);
        
        if (!session) {
            return null;
        }
        
        // Check timeout
        const age = Date.now() - session.lastAccessedAt;
        if (age > this.sessionTimeout) {
            this.destroySession(sessionId);
            return null;
        }
        
        session.lastAccessedAt = Date.now();
        session.requestCount++;
        
        return session;
    }
    
    async execute(sessionId, fn) {
        const session = this.getSession(sessionId);
        
        if (!session) {
            throw new Error('Invalid or expired session');
        }
        
        return await fn(session.connection, session);
    }
    
    destroySession(sessionId) {
        const session = this.sessions.get(sessionId);
        
        if (session) {
            this.pool.release(session.connection);
            this.sessions.delete(sessionId);
        }
    }
    
    startCleanup() {
        setInterval(() => {
            const now = Date.now();
            
            for (const [sessionId, session] of this.sessions) {
                const age = now - session.lastAccessedAt;
                
                if (age > this.sessionTimeout) {
                    this.destroySession(sessionId);
                }
            }
        }, 60000); // Check every minute
    }
    
    generateSessionId() {
        return require('crypto').randomBytes(32).toString('hex');
    }
    
    getStats() {
        return {
            totalSessions: this.sessions.size,
            sessions: Array.from(this.sessions.values()).map(s => ({
                id: s.id,
                userId: s.userId,
                age: Date.now() - s.createdAt,
                idleTime: Date.now() - s.lastAccessedAt,
                requestCount: s.requestCount
            }))
        };
    }
}

// Uso
const sessionManager = new SessionManager(pool);

// Create session
const sessionId = await sessionManager.createSession('user123');

// Use session
await sessionManager.execute(sessionId, async (conn, session) => {
    console.log(`Request #${session.requestCount} for user ${session.userId}`);
    await conn.send('Hello!\n');
});

// Stats
console.log('Session stats:', sessionManager.getStats());
```

---

## **🛡️ Resource Limits**

### **Resource Limiting**

```javascript
class ResourceLimiter {
    constructor(options) {
        this.options = {
            maxConnectionsPerUser: options.maxConnectionsPerUser || 5,
            maxConnectionsPerIP: options.maxConnectionsPerIP || 10,
            maxRequestsPerSecond: options.maxRequestsPerSecond || 100,
            maxBandwidthPerSecond: options.maxBandwidthPerSecond || 1024 * 1024, // 1MB/s
            ...options
        };
        
        this.userConnections = new Map();
        this.ipConnections = new Map();
        this.requestTimestamps = [];
        this.bandwidth = {
            current: 0,
            resetAt: Date.now() + 1000
        };
    }
    
    canConnect(userId, ipAddress) {
        // Check per-user limit
        const userConns = this.userConnections.get(userId) || 0;
        if (userConns >= this.options.maxConnectionsPerUser) {
            return {
                allowed: false,
                reason: 'max_connections_per_user',
                limit: this.options.maxConnectionsPerUser
            };
        }
        
        // Check per-IP limit
        const ipConns = this.ipConnections.get(ipAddress) || 0;
        if (ipConns >= this.options.maxConnectionsPerIP) {
            return {
                allowed: false,
                reason: 'max_connections_per_ip',
                limit: this.options.maxConnectionsPerIP
            };
        }
        
        return { allowed: true };
    }
    
    registerConnection(userId, ipAddress) {
        this.userConnections.set(userId, (this.userConnections.get(userId) || 0) + 1);
        this.ipConnections.set(ipAddress, (this.ipConnections.get(ipAddress) || 0) + 1);
    }
    
    unregisterConnection(userId, ipAddress) {
        const userConns = this.userConnections.get(userId) || 0;
        if (userConns > 1) {
            this.userConnections.set(userId, userConns - 1);
        } else {
            this.userConnections.delete(userId);
        }
        
        const ipConns = this.ipConnections.get(ipAddress) || 0;
        if (ipConns > 1) {
            this.ipConnections.set(ipAddress, ipConns - 1);
        } else {
            this.ipConnections.delete(ipAddress);
        }
    }
    
    canMakeRequest() {
        const now = Date.now();
        const oneSecondAgo = now - 1000;
        
        this.requestTimestamps = this.requestTimestamps.filter(ts => ts > oneSecondAgo);
        
        if (this.requestTimestamps.length >= this.options.maxRequestsPerSecond) {
            return {
                allowed: false,
                reason: 'rate_limit',
                limit: this.options.maxRequestsPerSecond
            };
        }
        
        this.requestTimestamps.push(now);
        return { allowed: true };
    }
    
    canUseBandwidth(bytes) {
        const now = Date.now();
        
        if (now > this.bandwidth.resetAt) {
            this.bandwidth.current = 0;
            this.bandwidth.resetAt = now + 1000;
        }
        
        if (this.bandwidth.current + bytes > this.options.maxBandwidthPerSecond) {
            return {
                allowed: false,
                reason: 'bandwidth_limit',
                limit: this.options.maxBandwidthPerSecond
            };
        }
        
        this.bandwidth.current += bytes;
        return { allowed: true };
    }
    
    getStats() {
        return {
            connections: {
                byUser: this.userConnections.size,
                byIP: this.ipConnections.size,
                topUsers: Array.from(this.userConnections.entries())
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5)
            },
            requests: {
                currentRate: this.requestTimestamps.length,
                limit: this.options.maxRequestsPerSecond
            },
            bandwidth: {
                current: this.bandwidth.current,
                limit: this.options.maxBandwidthPerSecond,
                percentage: (this.bandwidth.current / this.options.maxBandwidthPerSecond * 100).toFixed(2) + '%'
            }
        };
    }
}
```

---

## **🎓 Riepilogo**

**Connection Management:**
- Connection pooling con health checks
- Configuration tuning per scenario
- Load balancing con varie strategie
- Session management per utenti
- Resource limits per protezione

**Best Practices:**
- ✅ Pool con min/max connessioni
- ✅ Health checks periodici
- ✅ Eviction di connessioni stale
- ✅ Load balancing intelligente
- ✅ Rate limiting e resource limits
- ✅ Monitoring e metrics
- ✅ Graceful shutdown

---

**Prossima Guida**: [07-Performance_Optimization.md](./07-Performance_Optimization.md) - Ottimizzazione performance TCP
