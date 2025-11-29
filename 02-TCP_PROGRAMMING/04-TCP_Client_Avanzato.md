# **🚀 TCP Client Avanzato**

## **📑 Indice**
1. [Introduzione](#introduzione)
2. [Auto-Reconnection](#auto-reconnection)
3. [Connection Pooling](#connection-pooling)
4. [Load Balancing](#load-balancing)
5. [Circuit Breaker](#circuit-breaker)
6. [Request Queue](#request-queue)
7. [Heartbeat Mechanism](#heartbeat-mechanism)
8. [Esempi Completi](#esempi-completi)

---

## **🎯 Introduzione**

**Pattern avanzati per client production-ready**

Questa guida copre pattern **AVANZATI** per client TCP affidabili e resilienti.

⚠️ **ATTENZIONE:** Questi pattern aggiungono complessità. Implementali **SOLO** se necessario!

**Quando implementare questi pattern:**

| Pattern | Quando serve | Problema che risolve |
|---------|--------------|----------------------|
| **Auto-Reconnection** | Rete instabile | Client disconnette permanentemente |
| **Connection Pooling** | Molte richieste | Overhead di handshake TCP per ogni richiesta |
| **Load Balancing** | Multiple server | Carico non distribuito, failover manuale |
| **Circuit Breaker** | Server instabile | Retry infiniti su server morto |
| **Request Queue** | Burst di richieste | Perdita richieste durante disconnessione |
| **Heartbeat** | Detect silent failure | Connessione morta ma non rilevata |

**Scenari d'uso comuni:**

```
Scenario 1: Microservices
  Service A → Service B (via TCP)
  Problemi: B può restartare, network instabile
  Soluzione: Auto-reconnection + Circuit Breaker

Scenario 2: High-throughput client
  Client → Database TCP (1000 req/s)
  Problemi: Handshake overhead per ogni req
  Soluzione: Connection Pooling

Scenario 3: Multi-region deployment
  Client → Server1, Server2, Server3
  Problemi: Un server down, latency varies
  Soluzione: Load Balancing + Health checks

Scenario 4: Mobile app
  App → Backend (via TCP)
  Problemi: Network intermittente, offline mode
  Soluzione: Request Queue + Auto-reconnection + Heartbeat
```

**Un client TCP avanzato deve gestire:**
- 🔄 **Auto-reconnection**: Riconnessione automatica con exponential backoff
- 🏊 **Connection pooling**: Riuso connessioni per evitare overhead handshake
- ⚖️ **Load balancing**: Distribuzione carico su multiple server (round-robin, least-conn, etc)
- 🛡️ **Circuit breaker**: Protezione da cascading failures su server down
- 📬 **Request queue**: Buffering richieste durante disconnessioni temporanee
- 💓 **Heartbeat**: Keep-alive intelligente per detect silent failures

**Complessità vs Benefici:**

```
Client Base (Guida 02):
  Complessità: ⭐ (Bassa)
  Affidabilità: ⭐⭐ (Media)
  Features: Connessione, invio, ricezione
  Use case: Prototipi, script semplici

Client Avanzato (Questa Guida):
  Complessità: ⭐⭐⭐⭐ (Alta)
  Affidabilità: ⭐⭐⭐⭐⭐ (Massima)
  Features: Reconnect, pooling, failover, queue
  Use case: Produzione, mission-critical
```

💡 **Regola d'oro:** Inizia semplice (Guida 02), aggiungi pattern avanzati solo quando i problemi si manifestano.

---

## **🔄 Auto-Reconnection**

**Auto-reconnection - ESSENZIALE per client produttivi**

**Il problema:**
```
Client semplice:                  Client con auto-reconnect:
  Connect → OK                      Connect → OK
  Send data → OK                   Send data → OK
  [Network blip!]                  [Network blip!]
  Connection lost 💥                Reconnecting... ⏳
  Client MORTO permanente          Connected! ✅
  → Devi restart manuale           → Trasparente per utente
```

Senza auto-reconnection, **ogni** problema di rete richiede intervento manuale o restart dell'applicazione.

**Scenari che causano disconnessioni:**
1. Server restart (deployment, crash)
2. Network instabile (WiFi, mobile)
3. Firewall timeout
4. Load balancer rotation
5. Idle timeout
6. Server overload (rifiuta conn)

**Exponential Backoff - Perché è CRITICO:**

```
Senza backoff (retry fisso ogni 1s):
  Tentativo 1: 1s → fail
  Tentativo 2: 1s → fail  
  Tentativo 3: 1s → fail
  ...
  Tentativo 100: 1s → fail
  → SPAM il server!
  → DDoS involontario
  → Ban da firewall

Con exponential backoff:
  Tentativo 1: 1s → fail
  Tentativo 2: 2s → fail
  Tentativo 3: 4s → fail
  Tentativo 4: 8s → fail
  Tentativo 5: 16s → success! ✅
  → Riduce carico sul server
  → Dà tempo al server di recuperare
  → Rispetta rate limits
```

**FORMULA:** `delay = min(initialDelay * (multiplier ^ retries), maxDelay)`

**Esempio:**
```javascript
initialDelay: 1000ms
multiplier: 2
maxDelay: 30000ms

Retry 1: 1000ms
Retry 2: 2000ms
Retry 3: 4000ms
Retry 4: 8000ms
Retry 5: 16000ms
Retry 6: 30000ms (capped!)
Retry 7+: 30000ms
```

**Parametri da tuning:**

| Parametro | Tipico | Aggressivo | Conservativo |
|-----------|--------|------------|-------------|
| initialDelay | 1000ms | 500ms | 2000ms |
| maxDelay | 30000ms | 10000ms | 60000ms |
| multiplier | 2 | 1.5 | 3 |
| maxRetries | Infinity | 5 | 20 |

**Quando usare quale:**
- **Aggressivo**: Development, server stabile
- **Tipico**: Produzione, balance
- **Conservativo**: Public APIs con rate limits

**Stati del client:**
```
disconnected → connecting → connected
     ↑                ↓
     ←──── reconnecting ←───┘
```

### **Reconnection con Exponential Backoff**

```javascript
const net = require('net');
const EventEmitter = require('events');

class ResilientTCPClient extends EventEmitter {
    constructor(options) {
        super();
        
        this.options = {
            host: options.host || 'localhost',
            port: options.port || 3000,
            reconnect: options.reconnect !== false,
            maxRetries: options.maxRetries || Infinity,
            initialDelay: options.initialDelay || 1000,
            maxDelay: options.maxDelay || 30000,
            backoffMultiplier: options.backoffMultiplier || 2,
            ...options
        };
        
        this.socket = null;
        this.connected = false;
        this.connecting = false;
        this.retries = 0;
        this.currentDelay = this.options.initialDelay;
        this.reconnectTimer = null;
    }
    
    connect() {
        if (this.connected || this.connecting) {
            return Promise.resolve();
        }
        
        this.connecting = true;
        this.emit('connecting', { attempt: this.retries + 1 });
        
        return new Promise((resolve, reject) => {
            this.socket = net.connect({
                host: this.options.host,
                port: this.options.port
            });
            
            this.socket.once('connect', () => {
                this.connected = true;
                this.connecting = false;
                this.retries = 0;
                this.currentDelay = this.options.initialDelay;
                
                this.setupSocketEvents();
                this.emit('connected');
                resolve();
            });
            
            this.socket.once('error', (err) => {
                this.connecting = false;
                
                if (!this.connected) {
                    this.handleConnectionError(err);
                    reject(err);
                }
            });
        });
    }
    
    setupSocketEvents() {
        this.socket.on('data', (data) => {
            this.emit('data', data);
        });
        
        this.socket.on('close', () => {
            const wasConnected = this.connected;
            this.connected = false;
            this.socket = null;
            
            this.emit('disconnected');
            
            if (wasConnected && this.options.reconnect) {
                this.scheduleReconnect();
            }
        });
        
        this.socket.on('error', (err) => {
            this.emit('error', err);
        });
    }
    
    handleConnectionError(err) {
        this.emit('connectionError', err);
        
        if (this.options.reconnect && this.retries < this.options.maxRetries) {
            this.scheduleReconnect();
        } else {
            this.emit('reconnectFailed');
        }
    }
    
    scheduleReconnect() {
        if (this.reconnectTimer) {
            return;
        }
        
        this.retries++;
        
        console.log(`⏳ Reconnecting in ${this.currentDelay}ms (attempt ${this.retries})`);
        
        this.emit('reconnecting', {
            attempt: this.retries,
            delay: this.currentDelay
        });
        
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connect().catch(() => {
                // Error già gestito
            });
        }, this.currentDelay);
        
        // Exponential backoff
        this.currentDelay = Math.min(
            this.currentDelay * this.options.backoffMultiplier,
            this.options.maxDelay
        );
    }
    
    send(data) {
        return new Promise((resolve, reject) => {
            if (!this.connected || !this.socket) {
                reject(new Error('Not connected'));
                return;
            }
            
            this.socket.write(data, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }
    
    disconnect() {
        this.options.reconnect = false;
        
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        
        if (this.socket) {
            this.socket.end();
        }
    }
}

// Uso
const client = new ResilientTCPClient({
    host: 'localhost',
    port: 3000,
    maxRetries: 10,
    initialDelay: 1000,
    maxDelay: 30000
});

client.on('connected', () => {
    console.log('✅ Connected!');
    client.send('Hello Server!\n');
});

client.on('disconnected', () => {
    console.log('❌ Disconnected');
});

client.on('reconnecting', ({ attempt, delay }) => {
    console.log(`🔄 Reconnecting... attempt ${attempt}, waiting ${delay}ms`);
});

client.on('data', (data) => {
    console.log('📥 Received:', data.toString());
});

client.connect().catch(err => {
    console.error('Initial connection failed:', err.message);
});
```

---

## **🏊 Connection Pooling**

**Connection Pooling - Riduce drasticamente overhead**

**Il problema senza pooling:**
```
Per OGNI richiesta:
  1. TCP handshake (3 roundtrips)    → ~30ms
  2. Invia dati                       → ~5ms
  3. Ricevi risposta                  → ~5ms
  4. TCP close (2 roundtrips)         → ~20ms
  TOTALE: ~60ms

100 richieste = 6000ms (6 secondi!)
```

**Con connection pooling:**
```
Setup iniziale:
  - Crea 5 connessioni (1 volta)     → ~150ms

Per ogni richiesta:
  1. Prendi conn dal pool (instant)   → 0ms
  2. Invia dati                       → ~5ms
  3. Ricevi risposta                  → ~5ms
  4. Rimetti conn nel pool            → 0ms
  TOTALE: ~10ms

100 richieste = 1000ms (1 secondo!) → 6x più veloce!
```

**Quando usare Connection Pooling:**

✅ **USALO se:**
- Fai molte richieste allo stesso server (>10/sec)
- Latenza critica (ogni ms conta)
- High-throughput application
- Database client, cache client, API client

❌ **NON serve se:**
- Poche richieste (<1/sec)
- Connessione long-lived (WebSocket-like)
- Server diversi per ogni richiesta

**Parametri chiave:**

| Parametro | Cosa fa | Valore tipico | Trade-off |
|-----------|---------|---------------|----------|
| `minConnections` | Sempre mantenute aperte | 2-5 | Più alto = meno latency, più RAM |
| `maxConnections` | Limite massimo | 10-50 | Più alto = più throughput, più RAM |
| `acquireTimeout` | Max attesa per conn | 5000ms | Più alto = più patient, più lento fail |
| `idleTimeout` | Quando chiudere idle | 60000ms | Più alto = meno reconnect, più RAM |

**Lifecycle di una connessione nel pool:**

```
┌────────────────────────────────────────┐
│          Connection Pool               │
├────────────────────────────────────────┤
│  Available: [conn1, conn2, conn3]      │  ← Pronte
│  In-Use: {conn4, conn5}                │  ← Occupate
│  Wait Queue: [req1, req2]              │  ← In attesa
├────────────────────────────────────────┤
│  Total: 5/10 (max)                     │
└────────────────────────────────────────┘
```

**Algoritmo acquire():**
```
1. Se available.length > 0:
     → Prendi subito (O(1))

2. Altrimenti, se total < max:
     → Crea nuova connessione

3. Altrimenti:
     → Aspetta in coda (con timeout)
     → Se timeout: Error("Acquire timeout")
```

**Cleanup idle connections:**
```javascript
setInterval(() => {
    // Per ogni conn disponibile:
    if (now - conn.lastUsed > idleTimeout) {
        if (total > minConnections) {
            // Chiudi conn in eccesso
            conn.close();
        }
    }
}, 60000);
```

**Metriche utili:**
```javascript
{
  total: 8,           // Connessioni totali nel pool
  available: 3,       // Pronte per uso
  inUse: 5,           // Attualmente usate
  pending: 2,         // Richieste in attesa
  totalCreated: 15    // Totale create da inizio (per debug leak)
}
```

### **Client Connection Pool**

```javascript
class ConnectionPool extends EventEmitter {
    constructor(options) {
        super();
        
        this.options = {
            host: options.host || 'localhost',
            port: options.port || 3000,
            minConnections: options.minConnections || 2,
            maxConnections: options.maxConnections || 10,
            acquireTimeout: options.acquireTimeout || 5000,
            idleTimeout: options.idleTimeout || 60000,
            ...options
        };
        
        this.connections = [];
        this.availableConnections = [];
        this.pendingRequests = [];
        this.totalCreated = 0;
    }
    
    async init() {
        for (let i = 0; i < this.options.minConnections; i++) {
            await this.createConnection();
        }
    }
    
    async createConnection() {
        if (this.connections.length >= this.options.maxConnections) {
            throw new Error('Max connections reached');
        }
        
        const conn = {
            id: ++this.totalCreated,
            client: new ResilientTCPClient({
                host: this.options.host,
                port: this.options.port,
                reconnect: true
            }),
            inUse: false,
            lastUsed: Date.now(),
            createdAt: Date.now(),
            requestCount: 0
        };
        
        await conn.client.connect();
        
        this.connections.push(conn);
        this.availableConnections.push(conn);
        
        this.emit('connectionCreated', conn.id);
        
        return conn;
    }
    
    async acquire() {
        // Try to get available connection
        if (this.availableConnections.length > 0) {
            const conn = this.availableConnections.shift();
            conn.inUse = true;
            conn.lastUsed = Date.now();
            conn.requestCount++;
            return conn;
        }
        
        // Try to create new connection
        if (this.connections.length < this.options.maxConnections) {
            const conn = await this.createConnection();
            conn.inUse = true;
            conn.lastUsed = Date.now();
            conn.requestCount++;
            return conn;
        }
        
        // Wait for available connection
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                const index = this.pendingRequests.indexOf(request);
                if (index > -1) {
                    this.pendingRequests.splice(index, 1);
                }
                reject(new Error('Acquire timeout'));
            }, this.options.acquireTimeout);
            
            const request = { resolve, reject, timeout };
            this.pendingRequests.push(request);
        });
    }
    
    release(conn) {
        conn.inUse = false;
        conn.lastUsed = Date.now();
        
        // Serve pending requests
        if (this.pendingRequests.length > 0) {
            const request = this.pendingRequests.shift();
            clearTimeout(request.timeout);
            conn.inUse = true;
            request.resolve(conn);
        } else {
            this.availableConnections.push(conn);
        }
    }
    
    async execute(fn) {
        const conn = await this.acquire();
        
        try {
            const result = await fn(conn.client);
            return result;
        } finally {
            this.release(conn);
        }
    }
    
    cleanupIdleConnections() {
        const now = Date.now();
        const minToKeep = this.options.minConnections;
        
        for (let i = this.availableConnections.length - 1; i >= 0; i--) {
            if (this.connections.length <= minToKeep) {
                break;
            }
            
            const conn = this.availableConnections[i];
            const idleTime = now - conn.lastUsed;
            
            if (idleTime > this.options.idleTimeout) {
                this.availableConnections.splice(i, 1);
                
                const connIndex = this.connections.indexOf(conn);
                if (connIndex > -1) {
                    this.connections.splice(connIndex, 1);
                }
                
                conn.client.disconnect();
                this.emit('connectionClosed', conn.id);
            }
        }
    }
    
    getStats() {
        return {
            total: this.connections.length,
            available: this.availableConnections.length,
            inUse: this.connections.filter(c => c.inUse).length,
            pending: this.pendingRequests.length,
            totalCreated: this.totalCreated
        };
    }
    
    async close() {
        for (const conn of this.connections) {
            conn.client.disconnect();
        }
        
        this.connections = [];
        this.availableConnections = [];
        this.pendingRequests.forEach(req => {
            clearTimeout(req.timeout);
            req.reject(new Error('Pool closed'));
        });
        this.pendingRequests = [];
    }
}

// Uso
const pool = new ConnectionPool({
    host: 'localhost',
    port: 3000,
    minConnections: 2,
    maxConnections: 10,
    idleTimeout: 30000
});

await pool.init();

// Cleanup idle connections ogni minuto
setInterval(() => {
    pool.cleanupIdleConnections();
}, 60000);

// Esegui richieste
async function makeRequest(data) {
    return pool.execute(async (client) => {
        await client.send(data);
        
        return new Promise((resolve) => {
            client.once('data', (response) => {
                resolve(response.toString());
            });
        });
    });
}

// Multiple concurrent requests
const requests = [];
for (let i = 0; i < 20; i++) {
    requests.push(makeRequest(`Request ${i}\n`));
}

const results = await Promise.all(requests);
console.log(`✅ Completed ${results.length} requests`);
console.log('Pool stats:', pool.getStats());
```

---

## **⚖️ Load Balancing**

**Load Balancing client-side - Distribuisci carico su multiple server**

**Perché serve:**
```
Senza load balancing:              Con load balancing:
  Client → Server1 (overloaded)     Client → Server1 (33% load)
                                          └─→ Server2 (33% load)
                                          └─→ Server3 (33% load)
  
  Server1: 100% CPU                   Tutti: ~33% CPU
  Latency: 500ms                      Latency: 50ms
  Throughput: 100 req/s               Throughput: 300 req/s
```

**Strategie di load balancing:**

**1. Round-Robin** (più semplice)
```
Req 1 → Server1
Req 2 → Server2
Req 3 → Server3
Req 4 → Server1  ← Ricomincia
Req 5 → Server2
...

Pro: Semplice, distribuisce uniformemente
Contro: Ignora carico reale dei server
```

**2. Least Connections** (più intelligente)
```
Server1: 5 conn attive
Server2: 8 conn attive  
Server3: 3 conn attive  ← Scelgo questo!

Prossima richiesta va al server con MENO connessioni.

Pro: Bilancia carico reale
Contro: Overhead tracking connessioni
```

**3. Weighted** (per server eterogenei)
```
Server1: weight=3 (potente)   → 60% traffico
Server2: weight=2 (medio)     → 30% traffico
Server3: weight=1 (debole)    → 10% traffico

Pro: Adatta a server con capacità diverse
Contro: Devi configurare pesi manualmente
```

**Confronto strategie:**

| Strategia | Complessità | Efficacia | Quando usare |
|-----------|--------------|-----------|---------------|
| **Round-Robin** | ⭐ | ⭐⭐⭐ | Server identici, carico uniforme |
| **Least-Conn** | ⭐⭐ | ⭐⭐⭐⭐ | Server identici, carico variabile |
| **Weighted** | ⭐⭐ | ⭐⭐⭐⭐⭐ | Server eterogenei (diversa potenza) |
| **Random** | ⭐ | ⭐⭐ | Semplicità massima, OK per pochi server |

**Health Checks - CRITICI per load balancing:**

```
Senza health check:                Con health check:
  Client → Server1 (OK)              Client → Server1 (OK) ✅
       → Server2 (DOWN!) 💥                ✗ Server2 (DOWN) ← Rimosso
       → Server3 (OK)                    → Server3 (OK) ✅
  
  50% richieste falliscono!          100% richieste OK!
```

**Health check strategy:**
```javascript
setInterval(() => {
    for (server of servers) {
        try {
            await ping(server);  // Invia PING
            server.available = true;
        } catch {
            server.available = false;  // Rimuovi dal pool
        }
    }
}, 30000);  // Check ogni 30s
```

**Metriche per decisioni:**
```javascript
{
  server: 'server1.com:3000',
  available: true,              // Health check OK?
  currentConnections: 15,       // Conn attive ora
  totalRequests: 10523,         // Totale richieste
  errors: 45,                   // Totale errori
  errorRate: '0.43%',           // Percentuale errori
  avgResponseTime: '23ms'       // Latency media
}
```

**Failover automatico:**
```
Req → Server1 (DOWN)
  ↓
Retry → Server2 (OK) ✅

Client non sa che Server1 è down, tutto trasparente!
```

### **Multi-Server Load Balancer**

```javascript
class LoadBalancedClient extends EventEmitter {
    constructor(servers, options = {}) {
        super();
        
        this.servers = servers.map(s => ({
            host: s.host,
            port: s.port,
            weight: s.weight || 1,
            currentConnections: 0,
            totalRequests: 0,
            errors: 0,
            available: true
        }));
        
        this.options = {
            strategy: options.strategy || 'round-robin', // 'round-robin', 'least-connections', 'weighted'
            maxConnectionsPerServer: options.maxConnectionsPerServer || 10,
            healthCheckInterval: options.healthCheckInterval || 30000,
            ...options
        };
        
        this.currentIndex = 0;
        this.pools = new Map();
        
        this.initializePools();
        this.startHealthChecks();
    }
    
    async initializePools() {
        for (const server of this.servers) {
            const pool = new ConnectionPool({
                host: server.host,
                port: server.port,
                maxConnections: this.options.maxConnectionsPerServer
            });
            
            await pool.init().catch(err => {
                console.error(`Failed to init pool for ${server.host}:${server.port}`, err);
                server.available = false;
            });
            
            this.pools.set(`${server.host}:${server.port}`, pool);
        }
    }
    
    selectServer() {
        const available = this.servers.filter(s => s.available);
        
        if (available.length === 0) {
            throw new Error('No available servers');
        }
        
        switch (this.options.strategy) {
            case 'round-robin':
                return this.roundRobin(available);
            
            case 'least-connections':
                return this.leastConnections(available);
            
            case 'weighted':
                return this.weighted(available);
            
            default:
                return available[0];
        }
    }
    
    roundRobin(servers) {
        const server = servers[this.currentIndex % servers.length];
        this.currentIndex = (this.currentIndex + 1) % servers.length;
        return server;
    }
    
    leastConnections(servers) {
        return servers.reduce((min, server) => 
            server.currentConnections < min.currentConnections ? server : min
        );
    }
    
    weighted(servers) {
        const totalWeight = servers.reduce((sum, s) => sum + s.weight, 0);
        let random = Math.random() * totalWeight;
        
        for (const server of servers) {
            random -= server.weight;
            if (random <= 0) {
                return server;
            }
        }
        
        return servers[0];
    }
    
    async execute(fn) {
        const server = this.selectServer();
        const poolKey = `${server.host}:${server.port}`;
        const pool = this.pools.get(poolKey);
        
        server.currentConnections++;
        server.totalRequests++;
        
        try {
            const result = await pool.execute(fn);
            return result;
        } catch (err) {
            server.errors++;
            throw err;
        } finally {
            server.currentConnections--;
        }
    }
    
    async healthCheck(server) {
        const poolKey = `${server.host}:${server.port}`;
        const pool = this.pools.get(poolKey);
        
        try {
            await pool.execute(async (client) => {
                // Simple ping
                await client.send('PING\n');
                return true;
            });
            
            if (!server.available) {
                console.log(`✅ Server ${poolKey} is back online`);
                server.available = true;
            }
        } catch (err) {
            if (server.available) {
                console.log(`❌ Server ${poolKey} is down`);
                server.available = false;
            }
        }
    }
    
    startHealthChecks() {
        setInterval(() => {
            for (const server of this.servers) {
                this.healthCheck(server);
            }
        }, this.options.healthCheckInterval);
    }
    
    getStats() {
        return this.servers.map(s => ({
            server: `${s.host}:${s.port}`,
            available: s.available,
            currentConnections: s.currentConnections,
            totalRequests: s.totalRequests,
            errors: s.errors,
            errorRate: (s.errors / s.totalRequests * 100).toFixed(2) + '%'
        }));
    }
}

// Uso
const lb = new LoadBalancedClient([
    { host: 'server1.example.com', port: 3000, weight: 3 },
    { host: 'server2.example.com', port: 3000, weight: 2 },
    { host: 'server3.example.com', port: 3000, weight: 1 }
], {
    strategy: 'weighted',
    maxConnectionsPerServer: 20
});

// Esegui richieste
for (let i = 0; i < 100; i++) {
    lb.execute(async (client) => {
        await client.send(`Request ${i}\n`);
    }).catch(err => {
        console.error(`Request ${i} failed:`, err.message);
    });
}

setTimeout(() => {
    console.log('Load balancer stats:');
    console.table(lb.getStats());
}, 5000);
```

---

## **🛡️ Circuit Breaker**

**Circuit Breaker - Protezione da cascading failures**

**Il problema senza Circuit Breaker:**
```
Server DOWN:
  Client fa richiesta → Timeout (5s)
  Client retry      → Timeout (5s)
  Client retry      → Timeout (5s)
  ...
  → Spreca tempo su server morto
  → Risorse bloccate
  → Esperienza utente pessima
```

**Con Circuit Breaker:**
```
Server DOWN:
  Client fa richiesta → Timeout (5s)
  Client retry      → Timeout (5s)
  Client retry      → Timeout (5s)
  → Circuit breaker: OPEN! 🚨
  
  Prossime richieste:
    → Fail immediato (0s)
    → "Circuit breaker is OPEN"
    → Nessun tentativo di connessione
  
  Dopo 60s:
    → Prova 1 richiesta (HALF_OPEN)
    → Se OK → CLOSED (normale)
    → Se fail → OPEN altri 60s
```

**Stati del Circuit Breaker:**

```
        successi < threshold
    ┌─────────────────────────┐
    │                         │
    ↓                         │
┌──────────┐   failures    ┌───────────┐
│  CLOSED   ├─────────────>│   OPEN    │
│ (Normal) │  >= threshold│ (Blocked) │
└──────────┘              └──────┬─────┘
    ↑                         │
    │                         │ timeout
    │                         │ expired
    │                         │
    │  successi            ┌──┘─────────┐
    └───── >= threshold ───┤ HALF_OPEN │
                            │  (Testing) │
                            └───────────┘
```

**CLOSED** (normale):
- Richieste passano normalmente
- Conta failures consecutive
- Se failures >= threshold → OPEN

**OPEN** (bloccato):
- Richieste falliscono IMMEDIATAMENTE
- Nessun tentativo verso server
- Dopo timeout → HALF_OPEN

**HALF_OPEN** (test):
- Permette alcune richieste di test
- Se successi >= threshold → CLOSED
- Se failure → OPEN di nuovo

**Parametri di tuning:**

| Parametro | Significato | Valore tipico | Trade-off |
|-----------|-------------|---------------|----------|
| `failureThreshold` | Quanti errori prima di OPEN | 5 | Basso = più reattivo, alto = più tolerante |
| `successThreshold` | Quanti successi per CLOSED | 2 | Basso = recover veloce, alto = più sicuro |
| `timeout` | Quanto resta OPEN | 60000ms | Breve = retry veloce, lungo = meno stress |

**Quando usare Circuit Breaker:**

✅ **USALO se:**
- Chiami servizi esterni (API, DB, microservices)
- Timeout possibili
- Fallimenti possono cascadare
- Vuoi fail-fast invece di retry infinito

❌ **NON serve se:**
- Connessioni locali affidabili
- Singolo punto di failure critico (non puoi "skip")
- Server sempre disponibile

**Esempio scenario:**
```
E-commerce:
  Client → Payment Service (circuit breaker)
  
  Payment Service DOWN:
    - Senza CB: ogni checkout aspetta 30s timeout
    - Con CB: dopo 5 failures, instant fail
    → Mostra "Payment temporarily unavailable"
    → User experience migliore
    → Sistema non sovraccaricato
```

### **Circuit Breaker Pattern**

```javascript
class CircuitBreaker {
    constructor(options = {}) {
        this.options = {
            failureThreshold: options.failureThreshold || 5,
            successThreshold: options.successThreshold || 2,
            timeout: options.timeout || 60000,
            ...options
        };
        
        this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
        this.failures = 0;
        this.successes = 0;
        this.nextAttempt = Date.now();
    }
    
    async execute(fn) {
        if (this.state === 'OPEN') {
            if (Date.now() < this.nextAttempt) {
                throw new Error('Circuit breaker is OPEN');
            }
            
            this.state = 'HALF_OPEN';
            this.successes = 0;
        }
        
        try {
            const result = await fn();
            this.onSuccess();
            return result;
        } catch (err) {
            this.onFailure();
            throw err;
        }
    }
    
    onSuccess() {
        this.failures = 0;
        
        if (this.state === 'HALF_OPEN') {
            this.successes++;
            
            if (this.successes >= this.options.successThreshold) {
                this.state = 'CLOSED';
                console.log('✅ Circuit breaker: HALF_OPEN → CLOSED');
            }
        }
    }
    
    onFailure() {
        this.failures++;
        this.successes = 0;
        
        if (this.failures >= this.options.failureThreshold) {
            this.state = 'OPEN';
            this.nextAttempt = Date.now() + this.options.timeout;
            console.log(`❌ Circuit breaker: OPEN (retry after ${this.options.timeout}ms)`);
        }
    }
    
    getState() {
        return {
            state: this.state,
            failures: this.failures,
            successes: this.successes,
            nextAttempt: this.state === 'OPEN' ? new Date(this.nextAttempt) : null
        };
    }
}

// Uso con client
class ProtectedClient {
    constructor(host, port) {
        this.client = new ResilientTCPClient({ host, port });
        this.breaker = new CircuitBreaker({
            failureThreshold: 3,
            successThreshold: 2,
            timeout: 30000
        });
    }
    
    async send(data) {
        return this.breaker.execute(async () => {
            await this.client.connect();
            await this.client.send(data);
            
            return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Response timeout'));
                }, 5000);
                
                this.client.once('data', (response) => {
                    clearTimeout(timeout);
                    resolve(response.toString());
                });
            });
        });
    }
}

const client = new ProtectedClient('localhost', 3000);

async function makeRequests() {
    for (let i = 0; i < 10; i++) {
        try {
            const response = await client.send(`Request ${i}\n`);
            console.log(`✅ ${i}:`, response);
        } catch (err) {
            console.log(`❌ ${i}:`, err.message);
        }
        
        console.log('Circuit breaker:', client.breaker.getState());
        
        await new Promise(r => setTimeout(r, 1000));
    }
}

makeRequests();
```

---

## **📬 Request Queue**

**Request Queue - Buffer richieste durante disconnessioni**

**Il problema:**
```
Senza queue:                    Con queue:
  User click → Request           User click → Add to queue
  Network down! → LOST 💥        Network down!
  User click → LOST 💥              User click → Add to queue
  User click → LOST 💥              User click → Add to queue
  Network up                     Network up
  → 3 richieste perse!            → Process queue ✅
                                  → Tutte le richieste inviate!
```

**Quando serve una Request Queue:**

✅ **Scenari ideali:**
- Mobile app (network intermittente)
- Offline-first applications
- Burst di richieste improvvisi
- Upload file/dati in background
- IoT devices con connectivity limitata

**Features essenziali:**

1. **Priorità**: Richieste critiche prima
```javascript
queue.add({ data: 'Critical' }, priority: 10);  // Prima
queue.add({ data: 'Normal' }, priority: 5);     // Dopo
queue.add({ data: 'Low' }, priority: 1);        // Ultima
```

2. **Retry logic**: Riprova failed requests
```javascript
if (request.retries < maxRetries) {
    queue.add(request);  // Re-add to queue
} else {
    logError('Max retries exceeded');
}
```

3. **Persistence** (opzionale): Salva su disk
```javascript
// Semplice: in-memory (perdi dati se crash)
// Avanzato: localStorage, SQLite, file
queue.save('queue.json');
```

4. **Max size**: Previeni memory leak
```javascript
if (queue.size() >= maxSize) {
    throw new Error('Queue full');
    // Opzioni:
    // - Rifiuta nuove richieste
    // - Rimuovi oldest (FIFO)
    // - Rimuovi lowest priority
}
```

**Pattern tipici:**

**FIFO** (First In First Out):
```
Add: [1, 2, 3, 4, 5]
Process: 1 → 2 → 3 → 4 → 5
```

**Priority Queue**:
```
Add: [A:5, B:10, C:3, D:8]
Process: B(10) → D(8) → A(5) → C(3)
         ↑ Highest priority first
```

**Con retry:**
```
Process A → Success ✅
Process B → Fail ❌ → Re-add (retry 1)
Process C → Success ✅
Process B → Fail ❌ → Re-add (retry 2)
Process B → Success ✅
```

**Trade-offs:**

| Aspetto | Pro | Contro |
|---------|-----|--------|
| In-memory queue | Veloce, semplice | Perdi dati se crash |
| Persistent queue | Dati safe | Più lento, complessità |
| Unlimited size | Mai rifiuti | Memory leak possibile |
| Limited size | Safe memory | Devi gestire "queue full" |

**Integrazione con reconnection:**
```javascript
client.on('disconnected', () => {
    console.log('Offline - buffering requests');
    // Richieste vanno in queue automaticamente
});

client.on('connected', () => {
    console.log('Online - processing queue');
    queue.process((request) => {
        return client.send(request.data);
    });
});
```

### **Request Queue con Priorità**

```javascript
class RequestQueue {
    constructor(options = {}) {
        this.options = {
            maxSize: options.maxSize || 1000,
            maxRetries: options.maxRetries || 3,
            timeout: options.timeout || 30000,
            ...options
        };
        
        this.queue = [];
        this.processing = false;
    }
    
    add(request, priority = 0) {
        if (this.queue.length >= this.options.maxSize) {
            throw new Error('Queue is full');
        }
        
        const item = {
            id: Date.now() + Math.random(),
            request,
            priority,
            retries: 0,
            addedAt: Date.now()
        };
        
        // Insert sorted by priority (higher first)
        const index = this.queue.findIndex(q => q.priority < priority);
        if (index === -1) {
            this.queue.push(item);
        } else {
            this.queue.splice(index, 0, item);
        }
        
        return item.id;
    }
    
    async process(executor) {
        if (this.processing) {
            return;
        }
        
        this.processing = true;
        
        while (this.queue.length > 0) {
            const item = this.queue.shift();
            
            try {
                await executor(item.request);
            } catch (err) {
                item.retries++;
                
                if (item.retries < this.options.maxRetries) {
                    // Re-add to queue
                    this.queue.push(item);
                    console.log(`Retry ${item.retries}/${this.options.maxRetries} for request ${item.id}`);
                } else {
                    console.error(`Request ${item.id} failed after ${item.retries} retries`);
                }
            }
        }
        
        this.processing = false;
    }
    
    size() {
        return this.queue.length;
    }
    
    clear() {
        this.queue = [];
    }
}

// Uso
const queue = new RequestQueue({ maxSize: 100, maxRetries: 3 });
const client = new ResilientTCPClient({ host: 'localhost', port: 3000 });

// Add requests with priority
queue.add({ data: 'Critical request' }, 10);
queue.add({ data: 'Normal request' }, 5);
queue.add({ data: 'Low priority' }, 1);

// Process queue
await client.connect();

queue.process(async (request) => {
    console.log('Processing:', request.data);
    await client.send(request.data + '\n');
    await new Promise(r => setTimeout(r, 100));
});
```

---

## **💓 Heartbeat Mechanism**

**Heartbeat - Rileva connessioni "zombie" (morte silenti)**

**Il problema delle connessioni morte:**
```
Senza heartbeat:                Con heartbeat:
  Client connesso                Client connesso
  Network cable unplugged!       Network cable unplugged!
  ↓                              ↓
  Client pensa: "Connesso” ✅      Client invia: PING
  Server pensa: "Connesso” ✅      Nessuna risposta...
  ↓                              Timeout!
  Invii dati → Hang forever!      → "Connection dead" ❌
  → Mai sai che è morto!          → Reconnect automatico ✅
```

**Perché TCP non basta:**

TCP ha keep-alive nativo, MA:
- Default timeout: **2 ore!** 😱
- Non configurabile finemente
- Non detecta network partition
- Non detecta application-level hang

**Heartbeat application-level:**
- Timeout: **secondi** (es. 30s)
- Configurabile come vuoi
- Detecta anche application freeze
- Controllo completo

**Come funziona:**

```
Client                    Server
  │                         │
  ├─── PING ───────────>│
  │                         │
  │<─── PONG ───────────┤  (OK ✅)
  │                         │
  [Wait 30s]
  │                         │
  ├─── PING ───────────>│
  │                         │
  [Wait 5s]
  │                         │
  Nessuna risposta! → Timeout ❌
  │                         │
  Destroy socket
  Reconnect...
```

**Parametri:**

| Parametro | Significato | Valore tipico | Trade-off |
|-----------|-------------|---------------|----------|
| `heartbeatInterval` | Ogni quanto PING | 30000ms | Breve = detect veloce, molto traffico |
| `heartbeatTimeout` | Max attesa PONG | 5000ms | Breve = reattivo, false positive |

**Calcolo overhead:**
```
heartbeatInterval: 30s
PING size: 5 bytes
PONG size: 5 bytes

Overhead: 10 bytes / 30s = 0.33 bytes/s
→ TRASCURABILE!
```

**Pattern PING/PONG:**
```javascript
// Client
setInterval(() => {
    socket.write('PING\n');
    
    setTimeout(() => {
        if (!receivedPONG) {
            console.log('Heartbeat timeout!');
            socket.destroy();  // Force reconnect
        }
    }, 5000);
}, 30000);

// Server
socket.on('data', (data) => {
    if (data.toString() === 'PING\n') {
        socket.write('PONG\n');
    }
});
```

**Quando usare Heartbeat:**

✅ **USALO se:**
- Connessioni long-lived (minuti/ore)
- Network instabile
- Devi detectare failures velocemente (<1 min)
- WebSocket-like persistent connections
- IoT, real-time apps, chat

❌ **NON serve se:**
- Connessioni short-lived (secondi)
- Request-response rapido
- Overhead anche minimo è problema

**Alternative/Integrazioni:**

1. **TCP Keep-Alive** (OS level):
```javascript
socket.setKeepAlive(true, 30000);
// Pro: Built-in, zero code
// Contro: Timeout lunghi (minuti)
```

2. **Application Data as Heartbeat**:
```javascript
// Se hai già traffico regolare, non serve PING separato
if (timeSinceLastData > 30s) {
    // Connection idle troppo lungo
}
```

3. **Bidirezionale**:
```javascript
// Sia client CHE server mandano PING
// Detecta hang da entrambi i lati
```

### **Keep-Alive con Heartbeat**

```javascript
class HeartbeatClient extends ResilientTCPClient {
    constructor(options) {
        super(options);
        
        this.heartbeatInterval = options.heartbeatInterval || 30000;
        this.heartbeatTimeout = options.heartbeatTimeout || 5000;
        this.heartbeatTimer = null;
        this.heartbeatTimeoutTimer = null;
        this.lastHeartbeat = null;
    }
    
    connect() {
        return super.connect().then(() => {
            this.startHeartbeat();
        });
    }
    
    startHeartbeat() {
        this.stopHeartbeat();
        
        this.heartbeatTimer = setInterval(() => {
            this.sendHeartbeat();
        }, this.heartbeatInterval);
        
        this.sendHeartbeat();
    }
    
    sendHeartbeat() {
        if (!this.connected) {
            return;
        }
        
        this.send('PING\n').catch(err => {
            console.error('Heartbeat send failed:', err.message);
        });
        
        this.heartbeatTimeoutTimer = setTimeout(() => {
            console.log('❌ Heartbeat timeout - connection appears dead');
            this.emit('heartbeatTimeout');
            
            if (this.socket) {
                this.socket.destroy();
            }
        }, this.heartbeatTimeout);
    }
    
    setupSocketEvents() {
        super.setupSocketEvents();
        
        this.on('data', (data) => {
            const str = data.toString().trim();
            
            if (str === 'PONG') {
                this.onHeartbeatResponse();
            }
        });
    }
    
    onHeartbeatResponse() {
        if (this.heartbeatTimeoutTimer) {
            clearTimeout(this.heartbeatTimeoutTimer);
            this.heartbeatTimeoutTimer = null;
        }
        
        this.lastHeartbeat = Date.now();
        this.emit('heartbeat', this.lastHeartbeat);
    }
    
    stopHeartbeat() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
        
        if (this.heartbeatTimeoutTimer) {
            clearTimeout(this.heartbeatTimeoutTimer);
            this.heartbeatTimeoutTimer = null;
        }
    }
    
    disconnect() {
        this.stopHeartbeat();
        super.disconnect();
    }
    
    getConnectionHealth() {
        if (!this.connected) {
            return { healthy: false, reason: 'disconnected' };
        }
        
        if (!this.lastHeartbeat) {
            return { healthy: true, reason: 'no heartbeat yet' };
        }
        
        const timeSinceHeartbeat = Date.now() - this.lastHeartbeat;
        const healthy = timeSinceHeartbeat < (this.heartbeatInterval + this.heartbeatTimeout);
        
        return {
            healthy,
            lastHeartbeat: new Date(this.lastHeartbeat),
            timeSinceHeartbeat,
            reason: healthy ? 'ok' : 'heartbeat delayed'
        };
    }
}

// Uso
const client = new HeartbeatClient({
    host: 'localhost',
    port: 3000,
    heartbeatInterval: 10000,
    heartbeatTimeout: 3000
});

client.on('heartbeat', (timestamp) => {
    console.log('💓 Heartbeat OK at', new Date(timestamp));
});

client.on('heartbeatTimeout', () => {
    console.log('💔 Heartbeat timeout - connection may be dead');
});

client.connect();

// Check health periodically
setInterval(() => {
    const health = client.getConnectionHealth();
    console.log('Connection health:', health);
}, 5000);
```

---

## **🎓 Riepilogo**

**Client Avanzato:**
- Auto-reconnection con exponential backoff
- Connection pooling per riuso efficiente
- Load balancing tra server multipli
- Circuit breaker per fault tolerance
- Request queue con priorità
- Heartbeat per keep-alive

**Best Practices:**
- ✅ Implementare retry con backoff esponenziale
- ✅ Usare connection pool per performance
- ✅ Load balancing per scalabilità
- ✅ Circuit breaker per protezione
- ✅ Heartbeat per rilevare connessioni morte
- ✅ Queue per gestire picchi di traffico

---

**Prossima Guida**: [05-Interazione_Client_Server.md](./05-Interazione_Client_Server.md) - Pattern di interazione
