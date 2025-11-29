/**
 * 06.01 - Connection Pool Management
 * 
 * Implementazione avanzata di connection pooling con health checks,
 * circuit breaker e retry logic.
 * 
 * Features:
 *   - Min/max connections
 *   - Health monitoring
 *   - Circuit breaker pattern
 *   - Connection reuse
 *   - Timeout handling
 */

const net = require('net');
const EventEmitter = require('events');

// Stati del circuit breaker
const CircuitState = {
    CLOSED: 'CLOSED',     // Normale
    OPEN: 'OPEN',         // Troppi errori, block richieste
    HALF_OPEN: 'HALF_OPEN' // Test se ripristinato
};

class ConnectionPoolAdvanced extends EventEmitter {
    constructor(config) {
        super();
        
        this.config = {
            host: 'localhost',
            port: 3000,
            minSize: 2,
            maxSize: 10,
            acquireTimeout: 5000,
            idleTimeout: 60000,
            validateOnBorrow: true,
            validateInterval: 30000,
            maxRetries: 3,
            retryDelay: 1000,
            // Circuit breaker
            circuitBreakerThreshold: 5,
            circuitBreakerTimeout: 30000,
            circuitBreakerResetTimeout: 60000,
            ...config
        };
        
        this.connections = [];
        this.available = [];
        this.pending = [];
        
        // Statistics
        this.stats = {
            created: 0,
            destroyed: 0,
            acquired: 0,
            released: 0,
            timeouts: 0,
            errors: 0,
            validationFailures: 0
        };
        
        // Circuit breaker
        this.circuitState = CircuitState.CLOSED;
        this.circuitErrors = 0;
        this.circuitOpenTime = null;
        
        // Health check timer
        this.healthCheckTimer = null;
        
        this.initialize();
    }
    
    async initialize() {
        console.log(`🔧 Inizializzazione pool avanzato`);
        console.log(`   Min: ${this.config.minSize}, Max: ${this.config.maxSize}`);
        console.log(`   Circuit breaker: ${this.config.circuitBreakerThreshold} errori\n`);
        
        // Crea connessioni minime
        for (let i = 0; i < this.config.minSize; i++) {
            try {
                await this.createConnection();
            } catch (err) {
                console.error(`❌ Errore creazione connessione iniziale:`, err.message);
            }
        }
        
        // Avvia health checks
        this.startHealthChecks();
        
        console.log(`✅ Pool inizializzato con ${this.available.length} connessioni\n`);
    }
    
    async createConnection(retries = 0) {
        return new Promise((resolve, reject) => {
            const socket = net.connect({
                host: this.config.host,
                port: this.config.port,
                timeout: 5000
            });
            
            const connId = ++this.stats.created;
            
            const connection = {
                id: connId,
                socket: socket,
                createdAt: Date.now(),
                lastUsed: Date.now(),
                lastValidated: Date.now(),
                inUse: false,
                healthy: false,
                requestCount: 0,
                errorCount: 0
            };
            
            socket.on('connect', () => {
                connection.healthy = true;
                console.log(`✅ [${connId}] Connessione creata`);
                
                this.connections.push(connection);
                this.available.push(connection);
                
                // Reset circuit breaker su connessione riuscita
                if (this.circuitState === CircuitState.HALF_OPEN) {
                    this.closeCircuit();
                }
                
                resolve(connection);
            });
            
            socket.on('error', (err) => {
                console.error(`❌ [${connId}] Errore:`, err.message);
                connection.errorCount++;
                this.stats.errors++;
                
                this.recordCircuitError();
                
                // Retry
                if (retries < this.config.maxRetries) {
                    console.log(`⏳ [${connId}] Retry ${retries + 1}/${this.config.maxRetries}...`);
                    setTimeout(() => {
                        this.createConnection(retries + 1)
                            .then(resolve)
                            .catch(reject);
                    }, this.config.retryDelay * (retries + 1));
                } else {
                    reject(err);
                }
            });
            
            socket.on('close', () => {
                this.removeConnection(connection);
            });
        });
    }
    
    removeConnection(connection) {
        const idx = this.connections.indexOf(connection);
        if (idx !== -1) {
            this.connections.splice(idx, 1);
        }
        
        const availIdx = this.available.indexOf(connection);
        if (availIdx !== -1) {
            this.available.splice(availIdx, 1);
        }
        
        this.stats.destroyed++;
        console.log(`🗑️  [${connection.id}] Connessione rimossa`);
        
        // Mantieni minimo
        if (this.available.length < this.config.minSize) {
            this.createConnection().catch(err => {
                console.error('❌ Errore creazione connessione sostitutiva:', err.message);
            });
        }
    }
    
    async validateConnection(connection) {
        return new Promise((resolve) => {
            if (connection.socket.destroyed) {
                resolve(false);
                return;
            }
            
            // Ping-pong test
            const timeout = setTimeout(() => {
                resolve(false);
            }, 2000);
            
            const testHandler = () => {
                clearTimeout(timeout);
                connection.socket.removeListener('data', testHandler);
                resolve(true);
            };
            
            connection.socket.once('data', testHandler);
            connection.socket.write('ping\n', (err) => {
                if (err) {
                    clearTimeout(timeout);
                    resolve(false);
                }
            });
        });
    }
    
    async acquire() {
        // Circuit breaker check
        if (this.circuitState === CircuitState.OPEN) {
            // Verifica se è ora di provare half-open
            if (Date.now() - this.circuitOpenTime > this.config.circuitBreakerTimeout) {
                this.halfOpenCircuit();
            } else {
                throw new Error('Circuit breaker is OPEN');
            }
        }
        
        return new Promise(async (resolve, reject) => {
            // Cerca connessione disponibile
            while (this.available.length > 0) {
                const connection = this.available.shift();
                
                // Valida se richiesto
                if (this.config.validateOnBorrow) {
                    const isValid = await this.validateConnection(connection);
                    
                    if (!isValid) {
                        console.log(`⚠️  [${connection.id}] Validazione fallita`);
                        this.stats.validationFailures++;
                        connection.socket.destroy();
                        continue;
                    }
                }
                
                connection.inUse = true;
                connection.lastUsed = Date.now();
                connection.requestCount++;
                this.stats.acquired++;
                
                console.log(`📤 [${connection.id}] Acquired (available: ${this.available.length})`);
                return resolve(connection);
            }
            
            // Crea nuova connessione se sotto il massimo
            if (this.connections.length < this.config.maxSize) {
                try {
                    const connection = await this.createConnection();
                    this.available.shift(); // Rimuovi da available
                    connection.inUse = true;
                    connection.requestCount++;
                    this.stats.acquired++;
                    
                    console.log(`📤 [${connection.id}] Acquired new connection`);
                    return resolve(connection);
                } catch (err) {
                    return reject(err);
                }
            }
            
            // Metti in coda
            console.log(`⏳ Nessuna connessione disponibile, in coda...`);
            
            const timeout = setTimeout(() => {
                const idx = this.pending.indexOf(request);
                if (idx !== -1) {
                    this.pending.splice(idx, 1);
                }
                this.stats.timeouts++;
                reject(new Error('Acquire timeout'));
            }, this.config.acquireTimeout);
            
            const request = { resolve, reject, timeout };
            this.pending.push(request);
        });
    }
    
    release(connection) {
        if (!connection || !connection.inUse) {
            return;
        }
        
        connection.inUse = false;
        connection.lastUsed = Date.now();
        this.stats.released++;
        
        // Processa pending
        if (this.pending.length > 0) {
            const request = this.pending.shift();
            clearTimeout(request.timeout);
            
            connection.inUse = true;
            connection.requestCount++;
            this.stats.acquired++;
            
            console.log(`📤 [${connection.id}] Reused for pending request`);
            request.resolve(connection);
        } else {
            this.available.push(connection);
            console.log(`📥 [${connection.id}] Released (available: ${this.available.length})`);
        }
    }
    
    startHealthChecks() {
        this.healthCheckTimer = setInterval(async () => {
            console.log(`\n🏥 Health check avviato...`);
            
            const toCheck = this.available.slice();
            
            for (const connection of toCheck) {
                const isHealthy = await this.validateConnection(connection);
                connection.lastValidated = Date.now();
                connection.healthy = isHealthy;
                
                if (!isHealthy) {
                    console.log(`❌ [${connection.id}] Health check fallito, rimozione...`);
                    connection.socket.destroy();
                }
            }
            
            console.log(`✅ Health check completato\n`);
        }, this.config.validateInterval);
    }
    
    recordCircuitError() {
        this.circuitErrors++;
        
        if (this.circuitErrors >= this.config.circuitBreakerThreshold) {
            this.openCircuit();
        }
    }
    
    openCircuit() {
        if (this.circuitState !== CircuitState.OPEN) {
            this.circuitState = CircuitState.OPEN;
            this.circuitOpenTime = Date.now();
            console.log(`\n🔴 CIRCUIT BREAKER APERTO (${this.circuitErrors} errori)\n`);
            
            this.emit('circuit-open');
        }
    }
    
    halfOpenCircuit() {
        this.circuitState = CircuitState.HALF_OPEN;
        console.log(`\n🟡 CIRCUIT BREAKER HALF-OPEN (test connessione)\n`);
        this.emit('circuit-half-open');
    }
    
    closeCircuit() {
        this.circuitState = CircuitState.CLOSED;
        this.circuitErrors = 0;
        this.circuitOpenTime = null;
        console.log(`\n🟢 CIRCUIT BREAKER CHIUSO (ripristinato)\n`);
        this.emit('circuit-closed');
    }
    
    getStats() {
        return {
            ...this.stats,
            total: this.connections.length,
            available: this.available.length,
            inUse: this.connections.filter(c => c.inUse).length,
            pending: this.pending.length,
            circuitState: this.circuitState,
            circuitErrors: this.circuitErrors
        };
    }
    
    async close() {
        console.log('\n🛑 Chiusura pool...');
        
        if (this.healthCheckTimer) {
            clearInterval(this.healthCheckTimer);
        }
        
        for (const connection of this.connections) {
            if (!connection.socket.destroyed) {
                connection.socket.end();
            }
        }
        
        console.log('✅ Pool chiuso');
    }
}

// ===== DEMO =====
async function demo() {
    console.log('='.repeat(60));
    console.log('ADVANCED CONNECTION POOL WITH CIRCUIT BREAKER');
    console.log('='.repeat(60) + '\n');
    
    const pool = new ConnectionPoolAdvanced({
        host: 'localhost',
        port: 3000,
        minSize: 2,
        maxSize: 5,
        validateOnBorrow: true,
        validateInterval: 15000,
        circuitBreakerThreshold: 3
    });
    
    // Eventi
    pool.on('circuit-open', () => {
        console.log('⚠️  EVENT: Circuit breaker aperto!');
    });
    
    pool.on('circuit-closed', () => {
        console.log('✅ EVENT: Circuit breaker chiuso!');
    });
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('📊 Stats iniziali:', pool.getStats(), '\n');
    
    // Test 1: Richieste normali
    console.log('📝 Test 1: 5 richieste normali\n');
    
    for (let i = 0; i < 5; i++) {
        try {
            const conn = await pool.acquire();
            await new Promise(resolve => setTimeout(resolve, 100));
            pool.release(conn);
        } catch (err) {
            console.error(`❌ Errore:`, err.message);
        }
    }
    
    console.log('\n📊 Stats dopo test 1:', pool.getStats(), '\n');
    
    // Attendi health check
    console.log('⏳ Attesa health check...\n');
    await new Promise(resolve => setTimeout(resolve, 16000));
    
    console.log('📊 Stats finali:', pool.getStats(), '\n');
    
    await pool.close();
}

if (require.main === module) {
    demo().catch(console.error);
}
