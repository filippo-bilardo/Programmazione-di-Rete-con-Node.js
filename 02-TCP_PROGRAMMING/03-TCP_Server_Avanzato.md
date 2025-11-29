# **🏗️ TCP Server Avanzato**

## **📑 Indice**
1. [Introduzione](#introduzione)
2. [Custom TCP Server Class](#custom-tcp-server-class)
3. [Connection Management](#connection-management)
4. [Statistics e Monitoring](#statistics-e-monitoring)
5. [Graceful Shutdown](#graceful-shutdown)
6. [Middleware Pattern](#middleware-pattern)
7. [Health Checks](#health-checks)
8. [Esempi Completi](#esempi-completi)

---

## **🎯 Introduzione**

**Pattern avanzati per server production-ready**

Questa guida copre pattern **AVANZATI** per server TCP professionali.

⚠️ **IMPORTANTE: NON implementare tutto subito!** Inizia con un server semplice e aggiungi features solo quando necessario.

**Roadmap implementazione consigliata:**

```
1. ✅ Server base funzionante (Guida 01)
2. ✅ Client base funzionante (Guida 02)
3. → Custom class con statistiche (questa guida, prima parte)
4. → Connection management (quando hai >100 connessioni)
5. → Graceful shutdown (per deployment in produzione)
6. → Middleware (per features cross-cutting)
7. → Health checks (per monitoring e load balancer)
```

**Quando implementare questi pattern:**

| Pattern | Quando serve | Segno che ti serve |
|---------|--------------|--------------------|
| Custom Server Class | Server >500 righe | Codice disorganizzato, logica sparsa |
| Connection Management | >50 connessioni | Memoria cresce, performance degrada |
| Statistics | Produzione | Non sai cosa succede nel server |
| Graceful Shutdown | Deployment | Connessioni perse durante restart |
| Middleware | >3 features | Logica duplicata ovunque |
| Health Checks | Load balancer | Load balancer non sa se server healthy |

**Un server TCP avanzato deve gestire:**
- 📊 **Statistics**: metriche in tempo reale (uptime, connessioni, traffico)
- 🔄 **Connection pooling**: gestione efficiente memoria e risorse
- 🛡️ **Error recovery**: resilienza agli errori senza crash
- ⚡ **Performance**: ottimizzazione risorse (CPU, RAM, network)
- 🔐 **Security**: rate limiting, blacklisting, max connections
- 📈 **Scalability**: gestione carico crescente

**Trade-off da considerare:**

✅ **VANTAGGI** pattern avanzati:
- Codice organizzato e manutenibile
- Monitoring e debugging facilitati
- Deployment sicuri senza downtime
- Performance e scalabilità migliori

❌ **SVANTAGGI** pattern avanzati:
- Complessità aumentata (più codice)
- Boilerplate overhead
- Overkill per server semplici
- Curva di apprendimento

💡 **Regola d'oro:** Inizia semplice, aggiungi complessità solo quando i benefici superano i costi.

---

## **🏗️ Custom TCP Server Class**

**Perché creare una classe invece di usare direttamente net.createServer()?**

**VANTAGGI di una Custom Class:**

✅ **Encapsulation**: Tutta la logica server racchiusa in un'unica classe  
✅ **State management**: Traccia connessioni, statistiche, configurazione  
✅ **Reusability**: Riutilizza in progetti diversi senza duplicare codice  
✅ **Testability**: Più facile testare con unit tests  
✅ **Extensibility**: Eredita e estendi per aggiungere features  
✅ **API chiara**: Interfaccia pulita per chi usa il server

**SVANTAGGI di una Custom Class:**

❌ **Complessità aumentata**: Più codice da scrivere e mantenere  
❌ **Boilerplate code**: Setup iniziale lungo  
❌ **Overkill per server semplici**: Script <100 righe non ne hanno bisogno  
❌ **Learning curve**: Devi capire OOP e design patterns

**QUANDO USARE una Custom Class:**
- ✅ Server con >1000 righe di codice
- ✅ Necessità di tracking connessioni attive
- ✅ Statistiche e monitoring richiesti
- ✅ Multiple istanze con config diverse
- ✅ Team development (API chiara e documentata)
- ✅ Produzione con requisiti di stabilità

**QUANDO NON USARE una Custom Class:**
- ❌ Prototipi veloci e demo
- ❌ Script one-off per testing
- ❌ Server molto semplici (<100 righe)
- ❌ Learning/tutorial (meglio iniziare semplice)

**Confronto approcci:**

```javascript
// Approccio diretto (semplice, veloce)
const server = net.createServer(socket => {
    socket.write('Hello\n');
});
server.listen(3000);
// Pro: 4 righe, chiaro
// Contro: non scalabile

// Approccio Class (strutturato, scalabile)
class MyServer extends EventEmitter {
    constructor(options) { /* setup */ }
    start() { /* listen */ }
    stop() { /* cleanup */ }
}
const server = new MyServer({ port: 3000 });
server.start();
// Pro: scalabile, testabile, riusabile
// Contro: più codice iniziale
```

### **Server Class Base**

```javascript
const net = require('net');
const EventEmitter = require('events');

class AdvancedTCPServer extends EventEmitter {
    constructor(options = {}) {
        super();  // Eredita da EventEmitter per emettere eventi custom
        
        // 1. Merge opzioni con defaults
        this.options = {
            port: options.port || 3000,
            host: options.host || '0.0.0.0',
            maxConnections: options.maxConnections || 100,  // Limita carico
            timeout: options.timeout || 30000,  // 30s idle timeout
            ...options
        };
        
        // 2. State del server
        this.server = null;  // net.Server instance
        this.connections = new Map();  // Map<connectionId, connectionObject>
        this.connectionId = 0;  // Auto-increment ID per ogni connessione
        
        // 3. Statistiche in tempo reale
        this.stats = {
            connectionsTotal: 0,      // Totale connessioni da startup
            connectionsCurrent: 0,    // Connessioni attive ora
            bytesReceived: 0,         // Totale byte ricevuti
            bytesSent: 0,             // Totale byte inviati
            errors: 0                 // Totale errori
        };
    }
    
    start() {
        this.server = net.createServer(this.handleConnection.bind(this));
        
        this.server.maxConnections = this.options.maxConnections;
        
        this.setupServerEvents();
        
        return new Promise((resolve, reject) => {
            this.server.listen(this.options.port, this.options.host, (err) => {
                if (err) {
                    reject(err);
                } else {
                    this.emit('started', {
                        host: this.options.host,
                        port: this.options.port
                    });
                    resolve();
                }
            });
        });
    }
    
    setupServerEvents() {
        this.server.on('error', (err) => {
            this.stats.errors++;
            this.emit('error', err);
        });
        
        this.server.on('close', () => {
            this.emit('closed');
        });
    }
    
    handleConnection(socket) {
        const connId = ++this.connectionId;
        
        const connection = {
            id: connId,
            socket: socket,
            connectedAt: Date.now(),
            remoteAddress: socket.remoteAddress,
            remotePort: socket.remotePort,
            bytesReceived: 0,
            bytesSent: 0
        };
        
        this.connections.set(connId, connection);
        this.stats.connectionsTotal++;
        this.stats.connectionsCurrent++;
        
        socket.setTimeout(this.options.timeout);
        
        this.setupSocketEvents(connId, socket, connection);
        
        this.emit('connection', connection);
    }
    
    setupSocketEvents(connId, socket, connection) {
        socket.on('data', (data) => {
            connection.bytesReceived += data.length;
            this.stats.bytesReceived += data.length;
            this.emit('data', connId, data);
        });
        
        socket.on('close', () => {
            connection.bytesSent = socket.bytesWritten;
            this.stats.bytesSent += socket.bytesWritten;
            this.stats.connectionsCurrent--;
            this.connections.delete(connId);
            this.emit('disconnect', connection);
        });
        
        socket.on('error', (err) => {
            this.stats.errors++;
            this.emit('socketError', connId, err);
        });
        
        socket.on('timeout', () => {
            this.emit('timeout', connId);
            socket.end();
        });
    }
    
    send(connId, data) {
        const connection = this.connections.get(connId);
        if (connection && !connection.socket.destroyed) {
            connection.socket.write(data);
            return true;
        }
        return false;
    }
    
    broadcast(data, excludeId = null) {
        let count = 0;
        for (const [id, conn] of this.connections) {
            if (id !== excludeId && !conn.socket.destroyed) {
                conn.socket.write(data);
                count++;
            }
        }
        return count;
    }
    
    getStats() {
        return {
            ...this.stats,
            uptime: this.server ? Date.now() - this.stats.startTime : 0,
            connections: this.stats.connectionsCurrent,
            maxConnections: this.options.maxConnections
        };
    }
    
    getConnections() {
        return Array.from(this.connections.values()).map(c => ({
            id: c.id,
            address: `${c.remoteAddress}:${c.remotePort}`,
            duration: Date.now() - c.connectedAt,
            bytesReceived: c.bytesReceived,
            bytesSent: c.socket.bytesWritten
        }));
    }
    
    async stop() {
        return new Promise((resolve) => {
            // Chiudi tutte le connessioni
            for (const [id, conn] of this.connections) {
                conn.socket.end();
            }
            
            // Chiudi il server
            this.server.close(() => {
                this.emit('stopped');
                resolve();
            });
        });
    }
}

// Uso
const server = new AdvancedTCPServer({ port: 3000, maxConnections: 50 });

server.on('started', (info) => {
    console.log(`✅ Server started on ${info.host}:${info.port}`);
});

server.on('connection', (conn) => {
    console.log(`New connection: ${conn.id} from ${conn.remoteAddress}`);
});

server.on('data', (connId, data) => {
    console.log(`[${connId}] Received:`, data.toString());
    server.send(connId, `Echo: ${data}`);
});

server.on('disconnect', (conn) => {
    console.log(`Disconnected: ${conn.id}`);
});

server.start().catch(console.error);
```

---

## **🔗 Connection Management**

**Gestione avanzata delle connessioni**

**Perché serve un Connection Manager?**

Un server base con `net.createServer()` accetta **tutte** le connessioni finché il sistema non esaurisce risorse (file descriptors, memoria). Questo è **pericoloso** in produzione.

**Problemi senza Connection Management:**
```
Senza limiti:                     Con Connection Manager:
  Client 1 → OK                     Client 1 → OK
  Client 2 → OK                     Client 2 → OK
  ...                                ...
  Client 1000 → OK                  Client 100 → OK
  Client 1001 → OK (memoria!)       Client 101 → REJECTED (max reached)
  Server CRASH! 💥                  Server continua ✅
```

**Cosa gestisce un Connection Manager:**

1. **Max connections globali**: Limite totale connessioni
2. **Max per IP**: Previene abuse da singolo client
3. **Idle timeout**: Chiude connessioni inattive
4. **Activity tracking**: Monitora ultima attività
5. **Request counting**: Statistiche per connessione
6. **IP blacklisting**: Blocca IP malevoli (opzionale)

**Strategie di limitazione:**

| Strategia | Cosa fa | Quando usare |
|-----------|---------|---------------|
| Global limit | Max N connessioni totali | Sempre (previene esaurimento risorse) |
| Per-IP limit | Max N conn per IP | Previeni abuse/DoS da singolo attacker |
| Idle timeout | Chiudi se inattivo >N secondi | Libera risorse da conn zombie |
| Rate limiting | Max N req/sec per conn | Previeni spam/flood |

**Metriche importanti:**
```javascript
{
  total: 87,              // Connessioni attive ora
  maxConnections: 100,    // Limite configurato
  byIP: [
    { ip: '192.168.1.10', count: 3 },   // OK
    { ip: '10.0.0.5', count: 15 }       // Possibile abuse!
  ]
}
```

### **Connection Pool Manager**

```javascript
class ConnectionManager {
    constructor(maxConnections = 100) {
        this.maxConnections = maxConnections;
        this.connections = new Map();
        this.connectionsByIP = new Map();
        this.maxPerIP = 10;
    }
    
    canAccept(remoteAddress) {
        if (this.connections.size >= this.maxConnections) {
            return { allowed: false, reason: 'max_connections' };
        }
        
        const ipConnections = this.connectionsByIP.get(remoteAddress) || [];
        if (ipConnections.length >= this.maxPerIP) {
            return { allowed: false, reason: 'max_per_ip' };
        }
        
        return { allowed: true };
    }
    
    add(id, socket) {
        const ip = socket.remoteAddress;
        
        const conn = {
            id,
            socket,
            ip,
            connectedAt: Date.now(),
            lastActivity: Date.now(),
            requestCount: 0
        };
        
        this.connections.set(id, conn);
        
        if (!this.connectionsByIP.has(ip)) {
            this.connectionsByIP.set(ip, []);
        }
        this.connectionsByIP.get(ip).push(id);
        
        return conn;
    }
    
    remove(id) {
        const conn = this.connections.get(id);
        if (conn) {
            const ipConns = this.connectionsByIP.get(conn.ip);
            const index = ipConns.indexOf(id);
            if (index > -1) {
                ipConns.splice(index, 1);
            }
            
            if (ipConns.length === 0) {
                this.connectionsByIP.delete(conn.ip);
            }
            
            this.connections.delete(id);
        }
    }
    
    updateActivity(id) {
        const conn = this.connections.get(id);
        if (conn) {
            conn.lastActivity = Date.now();
            conn.requestCount++;
        }
    }
    
    getIdleConnections(idleTimeout = 60000) {
        const now = Date.now();
        const idle = [];
        
        for (const [id, conn] of this.connections) {
            if (now - conn.lastActivity > idleTimeout) {
                idle.push(id);
            }
        }
        
        return idle;
    }
    
    closeIdle(idleTimeout = 60000) {
        const idle = this.getIdleConnections(idleTimeout);
        
        for (const id of idle) {
            const conn = this.connections.get(id);
            if (conn) {
                conn.socket.end('Idle timeout\n');
            }
        }
        
        return idle.length;
    }
    
    getStats() {
        return {
            total: this.connections.size,
            byIP: Array.from(this.connectionsByIP.entries()).map(([ip, conns]) => ({
                ip,
                count: conns.length
            }))
        };
    }
}
```

---

## **📊 Statistics e Monitoring**

**Perché le statistiche sono critiche**

In produzione, devi sapere **cosa succede** nel tuo server in tempo reale:
- Quante connessioni ci sono ora?
- Quanti byte/sec sto servendo?
- Qual è il tempo medio di risposta?
- Ci sono errori? Che tipo?

**Senza statistiche:**
```
Utente: "Il server è lento!"
Tu: "🤷 Non so... forse?"
     → Non hai dati per debug
     → Non puoi identificare bottleneck
     → Non sai se è il server o il network
```

**Con statistiche:**
```
Utente: "Il server è lento!"
Tu: "Vedo che:
     - Connessioni: 95/100 (quasi al limite!)
     - Response time: 2000ms (normale è 50ms)
     - CPU: 98% (bottleneck identificato!)"
     → Hai dati concreti
     → Puoi diagnosticare problema
     → Puoi applicare fix mirato
```

**Metriche essenziali da tracciare:**

| Categoria | Metriche | Perché importante |
|-----------|----------|--------------------|
| **Connessioni** | Total, Current, Peak | Carico del server |
| **Traffico** | Bytes RX/TX, Messages RX/TX | Bandwidth usage |
| **Performance** | Avg response time, RPS | Velocità risposta |
| **Errori** | Total errors, By type | Stabilità sistema |
| **Uptime** | Server uptime | Affidabilità |

**Pattern di raccolta:**
```
1. Event-driven: Registra su ogni evento (conn, data, error)
2. Time-windowed: Calcola medie su finestre temporali (es. RPS su 1s)
3. Cleanup periodico: Rimuovi dati vecchi per evitare memory leak
4. Aggregazione: Fornisci report sintetici
```

**Dashboard tipica:**
```
┌────────────────────────────────────────┐
│  Server Statistics                  │
├────────────────────────────────────────┤
│  Uptime: 5h 23m                     │
│  Connections: 87 / 100 (87%)        │
│  Peak: 95                           │
│  RPS: 145 req/s                     │
│  Avg Response: 23ms                 │
│  Traffic: 234 MB RX / 456 MB TX     │
│  Errors: 12 (0.02%)                 │
└────────────────────────────────────────┘
```

### **Real-time Statistics**

```javascript
class ServerStatistics {
    constructor() {
        this.stats = {
            startTime: Date.now(),
            connections: {
                total: 0,
                current: 0,
                peak: 0
            },
            traffic: {
                bytesReceived: 0,
                bytesSent: 0,
                messagesReceived: 0,
                messagesSent: 0
            },
            performance: {
                avgResponseTime: 0,
                requestsPerSecond: 0
            },
            errors: {
                total: 0,
                byType: {}
            }
        };
        
        this.requestTimestamps = [];
        this.responseTimes = [];
        
        // Cleanup old data ogni minuto
        setInterval(() => this.cleanup(), 60000);
    }
    
    recordConnection() {
        this.stats.connections.total++;
        this.stats.connections.current++;
        
        if (this.stats.connections.current > this.stats.connections.peak) {
            this.stats.connections.peak = this.stats.connections.current;
        }
    }
    
    recordDisconnection() {
        this.stats.connections.current = Math.max(0, this.stats.connections.current - 1);
    }
    
    recordRequest() {
        this.stats.traffic.messagesReceived++;
        this.requestTimestamps.push(Date.now());
    }
    
    recordResponse(responseTime) {
        this.stats.traffic.messagesSent++;
        this.responseTimes.push(responseTime);
        
        // Update avg response time
        const sum = this.responseTimes.reduce((a, b) => a + b, 0);
        this.stats.performance.avgResponseTime = sum / this.responseTimes.length;
    }
    
    recordTraffic(bytesReceived, bytesSent) {
        this.stats.traffic.bytesReceived += bytesReceived;
        this.stats.traffic.bytesSent += bytesSent;
    }
    
    recordError(errorType) {
        this.stats.errors.total++;
        this.stats.errors.byType[errorType] = (this.stats.errors.byType[errorType] || 0) + 1;
    }
    
    calculateRPS() {
        const now = Date.now();
        const oneSecondAgo = now - 1000;
        
        const recentRequests = this.requestTimestamps.filter(ts => ts > oneSecondAgo);
        this.stats.performance.requestsPerSecond = recentRequests.length;
    }
    
    cleanup() {
        const now = Date.now();
        const fiveMinutesAgo = now - 300000;
        
        this.requestTimestamps = this.requestTimestamps.filter(ts => ts > fiveMinutesAgo);
        this.responseTimes = this.responseTimes.slice(-1000); // Keep last 1000
    }
    
    getReport() {
        this.calculateRPS();
        
        return {
            uptime: Date.now() - this.stats.startTime,
            ...this.stats,
            throughput: {
                mbReceived: (this.stats.traffic.bytesReceived / 1024 / 1024).toFixed(2),
                mbSent: (this.stats.traffic.bytesSent / 1024 / 1024).toFixed(2)
            }
        };
    }
}
```

---

## **🔚 Graceful Shutdown**

**Perché il graceful shutdown è ESSENZIALE in produzione**

**Shutdown normale (BAD):**
```
$ kill <pid>
  → Server termina IMMEDIATAMENTE
  → Connessioni attive PERSE 💥
  → Dati in transito PERSI 💥
  → Client ricevono errori inaspettati
  → Esperienza utente PESSIMA
```

**Graceful shutdown (GOOD):**
```
$ kill <pid>
  1. Server riceve SIGTERM/SIGINT
  2. Stop accettare NUOVE connessioni
  3. Notifica client connessi
  4. ASPETTA che finiscano (con timeout)
  5. Cleanup risorse (DB, file, etc)
  6. Termina pulito
  → Nessuna connessione persa ✅
  → Dati salvati correttamente ✅
  → Client possono reconnect ✅
```

**Quando serve:**
- ✅ Deployment in produzione (rolling updates)
- ✅ Kubernetes/Docker (gestione pod)
- ✅ Load balancer (rimozione da pool)
- ✅ Manutenzione server
- ✅ Auto-scaling (scale down)

**Fasi del graceful shutdown:**

```
Phase 1: Signal received
  ↓
Phase 2: Stop accepting new connections
  ├─ server.close() → no more accept()
  └─ Load balancer removes from pool
  ↓
Phase 3: Notify existing clients
  ├─ Broadcast "shutting down" message
  └─ Clients can finish or reconnect
  ↓
Phase 4: Wait for connections to close
  ├─ Monitor active connections
  ├─ Periodic logging
  └─ Timeout safety net
  ↓
Phase 5: Force close if timeout
  ├─ Destroy remaining sockets
  └─ Prevent hang indefinito
  ↓
Phase 6: Cleanup and exit
  ├─ Save state
  ├─ Close DB connections
  ├─ Log final stats
  └─ process.exit(0)
```

**Configurazione timeout:**
```javascript
shutdownTimeout: 30000  // 30 secondi

// Troppo breve (5s):
//   → Connessioni forzate prematuramente
//   → Dati potenzialmente persi

// Troppo lungo (5min):
//   → Deployment lenti
//   → Rolling update bloccati

// Giusto (30s):
//   → Tempo sufficiente per finire
//   → Deployment ragionevole
```

**Signals da gestire:**
- `SIGTERM`: Terminazione richiesta (default k8s, docker)
- `SIGINT`: Ctrl+C (sviluppo)
- `SIGHUP`: Reload config (opzionale)

### **Graceful Shutdown Implementation**

```javascript
class GracefulServer extends AdvancedTCPServer {
    constructor(options) {
        super(options);
        this.isShuttingDown = false;
        this.shutdownTimeout = options.shutdownTimeout || 30000;
        
        this.setupShutdownHandlers();
    }
    
    setupShutdownHandlers() {
        process.on('SIGTERM', () => this.gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => this.gracefulShutdown('SIGINT'));
    }
    
    async gracefulShutdown(signal) {
        if (this.isShuttingDown) {
            console.log('Shutdown già in corso...');
            return;
        }
        
        console.log(`\n📢 Ricevuto ${signal}, avvio graceful shutdown...`);
        this.isShuttingDown = true;
        
        // Emit shutdown event
        this.emit('shuttingDown');
        
        // Stop accettare nuove connessioni
        this.server.close(() => {
            console.log('✅ Server non accetta più connessioni');
        });
        
        // Notifica ai client
        console.log(`📤 Notifica a ${this.connections.size} client...`);
        this.broadcast('Server shutting down. Please reconnect later.\n');
        
        // Attendi che i client finiscano
        const timeout = setTimeout(() => {
            console.log('⏰ Timeout raggiunto, forzo chiusura...');
            this.forceClose();
        }, this.shutdownTimeout);
        
        // Attendi chiusura naturale
        const interval = setInterval(() => {
            console.log(`⏳ Connessioni attive: ${this.connections.size}`);
            
            if (this.connections.size === 0) {
                clearInterval(interval);
                clearTimeout(timeout);
                console.log('✅ Tutte le connessioni chiuse');
                this.finalizeShutdown();
            }
        }, 1000);
    }
    
    forceClose() {
        console.log('🔨 Chiusura forzata di tutte le connessioni...');
        
        for (const [id, conn] of this.connections) {
            conn.socket.destroy();
        }
        
        this.finalizeShutdown();
    }
    
    finalizeShutdown() {
        console.log('📊 Statistiche finali:');
        console.log(this.getStats());
        
        console.log('👋 Shutdown completato');
        process.exit(0);
    }
}

// Uso
const server = new GracefulServer({ 
    port: 3000,
    shutdownTimeout: 10000 
});

server.on('shuttingDown', () => {
    console.log('Preparing for shutdown...');
    // Salva stato, chiudi database, etc.
});

server.start();
```

---

## **🔧 Middleware Pattern**

**Cos'è un middleware e perché usarlo**

Un **middleware** è una funzione che si inserisce nella catena di processing delle richieste.

**Pattern familiare da Express.js:**
```javascript
// Express middleware
app.use(logger);           // Log tutte le richieste
app.use(authenticate);     // Verifica auth
app.use(rateLimit);        // Limita rate
app.get('/api', handler);  // Infine, handler

// Stessa idea per TCP!
server.use(logger);        // Log tutte le connessioni
server.use(authenticate);  // Verifica auth
server.use(rateLimit);     // Limita rate
server.on('data', handler);// Infine, handler
```

**Vantaggi middleware:**

✅ **Separation of concerns**: Ogni middleware fa UNA cosa  
✅ **Reusability**: Riusa logger, auth, etc in progetti diversi  
✅ **Composability**: Combina middleware come LEGO  
✅ **Testability**: Testa ogni middleware isolato  
✅ **Maintainability**: Modifica/rimuovi senza toccare core logic

**Senza middleware:**
```javascript
server.on('connection', (socket) => {
    // Tutto mescolato insieme 😞
    console.log('Connection');           // Logging
    if (!checkAuth(socket)) return;      // Auth
    if (!checkRate(socket)) return;      // Rate limit
    if (isBlacklisted(socket)) return;   // Blacklist
    
    // Finalmente business logic...
    socket.on('data', handleData);
});
// Problemi:
// - Codice duplicato se hai più handler
// - Difficile testare
// - Difficile riutilizzare
```

**Con middleware:**
```javascript
server.use(logger);           // ✅ Separato
server.use(authenticate);     // ✅ Riusabile
server.use(rateLimit);        // ✅ Testabile
server.use(blacklist);        // ✅ Componibile

server.on('data', (connId, data) => {
    // Solo business logic! 😊
    handleData(data);
});
```

**Middleware chain:**
```
New Connection
     ↓
[Middleware 1: Logger]
     ↓ next()
[Middleware 2: Auth]
     ↓ next()
[Middleware 3: Rate Limit]
     ↓ next()
[Handler: Business Logic]

Se middleware chiama next() → continua
Se middleware NON chiama next() → STOP (es. rejected)
```

**Middleware tipici:**

| Middleware | Cosa fa | Quando usare |
|------------|---------|---------------|
| **Logger** | Log tutte connessioni/richieste | Sempre (debug/audit) |
| **Auth** | Verifica credenziali | Server con autenticazione |
| **Rate Limit** | Limita req/sec per client | Previeni abuse |
| **Blacklist** | Blocca IP bannati | Security |
| **Compression** | Comprimi dati | Risparmia bandwidth |
| **Encryption** | Cripta dati (se non TLS) | Security extra |
| **Metrics** | Registra metriche | Monitoring |

**Signature middleware:**
```javascript
function myMiddleware(connection, data, next) {
    // 1. Pre-processing
    console.log('Before');
    
    // 2. Modifica dati (opzionale)
    data.processed = true;
    
    // 3. Decisione:
    if (shouldContinue) {
        next();  // Continua alla prossima middleware
    } else {
        // STOP - non chiamare next()
        connection.socket.end('Rejected\n');
    }
    
    // 4. Post-processing (dopo next)
    console.log('After');
}
```

### **Middleware System**

```javascript
class MiddlewareServer extends AdvancedTCPServer {
    constructor(options) {
        super(options);
        this.middlewares = [];
    }
    
    use(middleware) {
        this.middlewares.push(middleware);
    }
    
    async handleConnection(socket) {
        const connId = ++this.connectionId;
        
        const context = {
            id: connId,
            socket: socket,
            remoteAddress: socket.remoteAddress,
            remotePort: socket.remotePort,
            connectedAt: Date.now(),
            data: {}
        };
        
        // Execute middleware chain
        let allowed = true;
        for (const middleware of this.middlewares) {
            const result = await middleware(context);
            if (result === false) {
                allowed = false;
                break;
            }
        }
        
        if (!allowed) {
            socket.end('Connection rejected\n');
            return;
        }
        
        // Continue normal handling
        super.handleConnection(socket);
    }
}

// Middleware examples

// IP Whitelist middleware
function ipWhitelist(allowedIPs) {
    return async (ctx) => {
        if (!allowedIPs.includes(ctx.remoteAddress)) {
            console.log(`❌ Rejected ${ctx.remoteAddress} - not in whitelist`);
            return false;
        }
        return true;
    };
}

// Rate limiting middleware
function rateLimit(maxPerMinute = 60) {
    const requests = new Map();
    
    return async (ctx) => {
        const ip = ctx.remoteAddress;
        const now = Date.now();
        
        if (!requests.has(ip)) {
            requests.set(ip, []);
        }
        
        const ipRequests = requests.get(ip);
        const oneMinuteAgo = now - 60000;
        
        // Cleanup old requests
        const recent = ipRequests.filter(ts => ts > oneMinuteAgo);
        requests.set(ip, recent);
        
        if (recent.length >= maxPerMinute) {
            console.log(`❌ Rate limit exceeded for ${ip}`);
            return false;
        }
        
        recent.push(now);
        return true;
    };
}

// Logging middleware
function logger() {
    return async (ctx) => {
        console.log(`📥 Connection from ${ctx.remoteAddress}:${ctx.remotePort}`);
        ctx.data.startTime = Date.now();
        return true;
    };
}

// Authentication middleware
function authenticate(validTokens) {
    return async (ctx) => {
        return new Promise((resolve) => {
            ctx.socket.write('AUTH: Enter token> ');
            
            ctx.socket.once('data', (data) => {
                const token = data.toString().trim();
                
                if (validTokens.includes(token)) {
                    ctx.data.authenticated = true;
                    ctx.socket.write('AUTH: Success\n');
                    resolve(true);
                } else {
                    ctx.socket.write('AUTH: Failed\n');
                    resolve(false);
                }
            });
            
            setTimeout(() => resolve(false), 5000);
        });
    };
}

// Uso
const server = new MiddlewareServer({ port: 3000 });

server.use(logger());
server.use(ipWhitelist(['127.0.0.1', '192.168.1.100']));
server.use(rateLimit(10));
server.use(authenticate(['token123', 'token456']));

server.start();
```

---

## **🏥 Health Checks**

**Perché servono gli health checks**

Gli health checks sono **essenziali** per deployment in produzione, specialmente con:
- **Load Balancer**: decidono a quale server mandare traffico
- **Kubernetes**: riavvia pod non healthy
- **Auto-scaling**: scale up/down basato su health
- **Monitoring**: alert quando server unhealthy

**Problema senza health checks:**
```
Load Balancer → Server 1 (OK)      ← Riceve traffico ✅
             → Server 2 (CRASHED!) ← Riceve traffico ❌
             → Server 3 (SLOW)     ← Riceve traffico ❌

Utenti: "Il sito non funziona!" (50% falliscono)
```

**Soluzione con health checks:**
```
Load Balancer → Server 1 (healthy)   ← Riceve traffico ✅
             ✗ Server 2 (unhealthy) ← Rimosso dal pool
             ✗ Server 3 (unhealthy) ← Rimosso dal pool

Utenti: "Il sito funziona!" (100% vanno su server healthy)
```

**Cosa controllare:**

| Check | Cosa verifica | Threshold tipico |
|-------|---------------|------------------|
| **Connections** | Carico server | <90% max connections |
| **Memory** | Heap usage | <80% heap |
| **CPU** | CPU usage | <80% CPU |
| **Errors** | Error rate | <10% errori |
| **Response Time** | Latency | <500ms avg |
| **Database** | DB connectivity | Ping OK |

**Stati possibili:**

```
starting  → Server in fase di startup, non pronto
    ↓
running   → Server operativo, check in corso
    ↓
healthy   → Tutti i check passati ✅
    ↓
unhealthy → Uno o più check falliti ❌
    ↓
shutdown  → Server in graceful shutdown
```

**Pattern tipico:**

1. **Startup**: `status = 'starting'`
2. **Primo check**: Dopo 1-2s, verifica tutto OK
3. **Running**: `status = 'running'`, check periodici (ogni 30s)
4. **Healthy**: Tutti check OK → `status = 'healthy'` (HTTP 200)
5. **Unhealthy**: Check falliscono → `status = 'unhealthy'` (HTTP 503)

**Load Balancer integration:**
```
Load Balancer
  ↓ HTTP GET /health ogni 10s
Server risponde:
  - 200 OK → Healthy, manda traffico
  - 503 Service Unavailable → Unhealthy, rimuovi dal pool
  - Timeout → Dead, rimuovi dal pool
```

**Esempio response:**
```json
{
  "status": "healthy",
  "lastCheck": 1701234567890,
  "results": {
    "connections": {
      "healthy": true,
      "message": "45/100 connections (45.0%)"
    },
    "memory": {
      "healthy": true,
      "message": "Heap: 128.45/256.00 MB"
    },
    "errors": {
      "healthy": false,
      "message": "Error rate: 12.50%"
    }
  }
}
```

Se anche UN check è unhealthy → `status = 'unhealthy'` → Server rimosso dal load balancer.

### **Health Check System**

```javascript
class HealthyServer extends AdvancedTCPServer {
    constructor(options) {
        super(options);
        
        this.health = {
            status: 'starting',
            checks: {},
            lastCheck: null
        };
        
        this.healthCheckInterval = options.healthCheckInterval || 30000;
        
        this.registerHealthChecks();
        this.startHealthChecks();
    }
    
    registerHealthChecks() {
        this.addHealthCheck('connections', () => {
            const current = this.connections.size;
            const max = this.options.maxConnections;
            const usage = (current / max) * 100;
            
            return {
                healthy: usage < 90,
                message: `${current}/${max} connections (${usage.toFixed(1)}%)`,
                details: { current, max, usage }
            };
        });
        
        this.addHealthCheck('memory', () => {
            const usage = process.memoryUsage();
            const heapUsedMB = usage.heapUsed / 1024 / 1024;
            const heapTotalMB = usage.heapTotal / 1024 / 1024;
            const heapUsagePercent = (heapUsedMB / heapTotalMB) * 100;
            
            return {
                healthy: heapUsagePercent < 80,
                message: `Heap: ${heapUsedMB.toFixed(2)}/${heapTotalMB.toFixed(2)} MB`,
                details: { heapUsedMB, heapTotalMB, heapUsagePercent }
            };
        });
        
        this.addHealthCheck('errors', () => {
            const errorRate = this.stats.errors / this.stats.connectionsTotal;
            
            return {
                healthy: errorRate < 0.1,
                message: `Error rate: ${(errorRate * 100).toFixed(2)}%`,
                details: { errors: this.stats.errors, total: this.stats.connectionsTotal }
            };
        });
    }
    
    addHealthCheck(name, check) {
        this.health.checks[name] = check;
    }
    
    async runHealthChecks() {
        const results = {};
        let allHealthy = true;
        
        for (const [name, check] of Object.entries(this.health.checks)) {
            try {
                results[name] = await check();
                if (!results[name].healthy) {
                    allHealthy = false;
                }
            } catch (err) {
                results[name] = {
                    healthy: false,
                    message: `Check failed: ${err.message}`,
                    error: err.message
                };
                allHealthy = false;
            }
        }
        
        this.health.status = allHealthy ? 'healthy' : 'unhealthy';
        this.health.lastCheck = Date.now();
        this.health.results = results;
        
        this.emit('healthCheck', this.health);
        
        return this.health;
    }
    
    startHealthChecks() {
        setInterval(() => {
            this.runHealthChecks();
        }, this.healthCheckInterval);
        
        // Initial check
        setTimeout(() => {
            this.runHealthChecks().then(() => {
                this.health.status = 'running';
            });
        }, 1000);
    }
    
    getHealth() {
        return this.health;
    }
}

// Health check HTTP endpoint
const http = require('http');

function createHealthEndpoint(tcpServer, port = 8080) {
    const healthServer = http.createServer((req, res) => {
        if (req.url === '/health') {
            const health = tcpServer.getHealth();
            const statusCode = health.status === 'healthy' ? 200 : 503;
            
            res.writeHead(statusCode, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(health, null, 2));
        } else {
            res.writeHead(404);
            res.end('Not Found');
        }
    });
    
    healthServer.listen(port, () => {
        console.log(`Health endpoint: http://localhost:${port}/health`);
    });
    
    return healthServer;
}

// Uso
const server = new HealthyServer({ 
    port: 3000,
    healthCheckInterval: 10000
});

server.on('healthCheck', (health) => {
    console.log(`Health status: ${health.status}`);
    if (health.status === 'unhealthy') {
        console.warn('⚠️ Unhealthy checks:', 
            Object.entries(health.results)
                .filter(([_, r]) => !r.healthy)
                .map(([name]) => name)
        );
    }
});

server.start();

createHealthEndpoint(server, 8080);
```

---

## **🎓 Riepilogo**

**Server Avanzato:**
- Custom class con EventEmitter
- Connection management con limiti
- Statistics in tempo reale
- Graceful shutdown con timeout

**Best Practices:**
- ✅ Limitare connessioni per IP
- ✅ Implementare health checks
- ✅ Monitorare metriche
- ✅ Middleware per cross-cutting concerns
- ✅ Graceful shutdown sempre
- ✅ Error handling robusto
- ✅ Resource cleanup

---

**Prossima Guida**: [04-TCP_Client_Avanzato.md](./04-TCP_Client_Avanzato.md) - Client TCP avanzati
