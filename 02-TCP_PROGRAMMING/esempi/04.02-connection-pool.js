/**
 * 04.02 - Connection Pool Client
 * 
 * Client con connection pooling per riutilizzare connessioni TCP.
 * Dimostra gestione efficiente di multiple richieste su connessioni persistenti.
 * 
 * Utilizzo:
 *   node 04.02-connection-pool.js
 * 
 * Prerequisito:
 *   Avvia il server: node 01.01-echo-server.js
 */

const net = require('net');
const EventEmitter = require('events');

// Configurazione pool
const POOL_CONFIG = {
    host: 'localhost',
    port: 3000,
    minConnections: 2,
    maxConnections: 5,
    acquireTimeout: 5000,
    idleTimeout: 60000,
    connectionTimeout: 5000
};

// Connection Pool
class ConnectionPool extends EventEmitter {
    constructor(config) {
        super();
        this.config = { ...POOL_CONFIG, ...config };
        this.connections = [];
        this.availableConnections = [];
        this.pendingRequests = [];
        this.stats = {
            created: 0,
            acquired: 0,
            released: 0,
            destroyed: 0,
            timeouts: 0
        };
        
        // Inizializza pool
        this.initialize();
    }
    
    async initialize() {
        console.log(`🔧 Inizializzazione pool (min: ${this.config.minConnections}, max: ${this.config.maxConnections})`);
        
        for (let i = 0; i < this.config.minConnections; i++) {
            await this.createConnection();
        }
        
        console.log(`✅ Pool inizializzato con ${this.availableConnections.length} connessioni\n`);
    }
    
    async createConnection() {
        return new Promise((resolve, reject) => {
            console.log(`🔌 Creazione nuova connessione...`);
            
            const socket = net.connect({
                host: this.config.host,
                port: this.config.port,
                timeout: this.config.connectionTimeout
            });
            
            const connection = {
                id: ++this.stats.created,
                socket: socket,
                inUse: false,
                createdAt: Date.now(),
                lastUsed: Date.now(),
                requestCount: 0,
                idleTimer: null
            };
            
            socket.on('connect', () => {
                console.log(`✅ Connessione ${connection.id} creata`);
                
                this.connections.push(connection);
                this.availableConnections.push(connection);
                
                // Setup idle timeout
                this.resetIdleTimer(connection);
                
                resolve(connection);
            });
            
            socket.on('error', (err) => {
                console.error(`❌ Errore connessione ${connection.id}:`, err.message);
                this.removeConnection(connection);
                reject(err);
            });
            
            socket.on('close', () => {
                console.log(`👋 Connessione ${connection.id} chiusa`);
                this.removeConnection(connection);
            });
        });
    }
    
    removeConnection(connection) {
        // Rimuovi da pool
        const idx = this.connections.indexOf(connection);
        if (idx !== -1) {
            this.connections.splice(idx, 1);
        }
        
        const availableIdx = this.availableConnections.indexOf(connection);
        if (availableIdx !== -1) {
            this.availableConnections.splice(availableIdx, 1);
        }
        
        if (connection.idleTimer) {
            clearTimeout(connection.idleTimer);
        }
        
        this.stats.destroyed++;
    }
    
    resetIdleTimer(connection) {
        if (connection.idleTimer) {
            clearTimeout(connection.idleTimer);
        }
        
        connection.idleTimer = setTimeout(() => {
            if (!connection.inUse && this.availableConnections.length > this.config.minConnections) {
                console.log(`⏰ Connessione ${connection.id} idle timeout, chiusura...`);
                connection.socket.end();
            }
        }, this.config.idleTimeout);
    }
    
    async acquire() {
        return new Promise(async (resolve, reject) => {
            // Cerca connessione disponibile
            if (this.availableConnections.length > 0) {
                const connection = this.availableConnections.shift();
                connection.inUse = true;
                connection.lastUsed = Date.now();
                connection.requestCount++;
                this.stats.acquired++;
                
                console.log(`📤 Acquired connection ${connection.id} (available: ${this.availableConnections.length})`);
                
                return resolve(connection);
            }
            
            // Crea nuova connessione se possibile
            if (this.connections.length < this.config.maxConnections) {
                try {
                    const connection = await this.createConnection();
                    this.availableConnections.shift(); // Rimuovi da available
                    connection.inUse = true;
                    connection.lastUsed = Date.now();
                    connection.requestCount++;
                    this.stats.acquired++;
                    
                    console.log(`📤 Acquired new connection ${connection.id}`);
                    return resolve(connection);
                } catch (err) {
                    return reject(err);
                }
            }
            
            // Metti in coda
            console.log(`⏳ Nessuna connessione disponibile, in coda...`);
            
            const timeout = setTimeout(() => {
                const idx = this.pendingRequests.indexOf(pending);
                if (idx !== -1) {
                    this.pendingRequests.splice(idx, 1);
                }
                this.stats.timeouts++;
                reject(new Error('Acquire timeout'));
            }, this.config.acquireTimeout);
            
            const pending = { resolve, reject, timeout };
            this.pendingRequests.push(pending);
        });
    }
    
    release(connection) {
        if (!connection || !connection.inUse) {
            return;
        }
        
        connection.inUse = false;
        connection.lastUsed = Date.now();
        this.stats.released++;
        
        // Processa pending request
        if (this.pendingRequests.length > 0) {
            const pending = this.pendingRequests.shift();
            clearTimeout(pending.timeout);
            
            connection.inUse = true;
            connection.requestCount++;
            this.stats.acquired++;
            
            console.log(`📤 Reused connection ${connection.id} for pending request`);
            pending.resolve(connection);
        } else {
            this.availableConnections.push(connection);
            this.resetIdleTimer(connection);
            
            console.log(`📥 Released connection ${connection.id} (available: ${this.availableConnections.length})`);
        }
    }
    
    async sendRequest(message) {
        let connection = null;
        
        try {
            connection = await this.acquire();
            
            return new Promise((resolve, reject) => {
                let response = '';
                
                const dataHandler = (data) => {
                    response += data.toString();
                    
                    // Assumiamo che la risposta termini con \n
                    if (response.includes('\n')) {
                        connection.socket.removeListener('data', dataHandler);
                        resolve(response.trim());
                    }
                };
                
                connection.socket.on('data', dataHandler);
                
                connection.socket.write(message + '\n', (err) => {
                    if (err) {
                        connection.socket.removeListener('data', dataHandler);
                        reject(err);
                    }
                });
                
                // Timeout risposta
                setTimeout(() => {
                    connection.socket.removeListener('data', dataHandler);
                    reject(new Error('Response timeout'));
                }, 5000);
            });
        } finally {
            if (connection) {
                this.release(connection);
            }
        }
    }
    
    getStats() {
        return {
            ...this.stats,
            total: this.connections.length,
            available: this.availableConnections.length,
            inUse: this.connections.filter(c => c.inUse).length,
            pending: this.pendingRequests.length
        };
    }
    
    async close() {
        console.log('\n🛑 Chiusura pool...');
        
        for (const connection of this.connections) {
            if (connection.idleTimer) {
                clearTimeout(connection.idleTimer);
            }
            if (!connection.socket.destroyed) {
                connection.socket.end();
            }
        }
        
        this.connections = [];
        this.availableConnections = [];
        
        console.log('✅ Pool chiuso');
    }
}

// Demo
async function demo() {
    console.log('='.repeat(60));
    console.log('CONNECTION POOL DEMO');
    console.log('='.repeat(60) + '\n');
    
    const pool = new ConnectionPool(POOL_CONFIG);
    
    // Attendi inizializzazione
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test 1: Richieste sequenziali
    console.log('📝 Test 1: Richieste sequenziali\n');
    for (let i = 1; i <= 3; i++) {
        try {
            const response = await pool.sendRequest(`Message ${i}`);
            console.log(`✅ Response: ${response}\n`);
        } catch (err) {
            console.error(`❌ Error:`, err.message);
        }
    }
    
    console.log(`\n📊 Stats dopo test 1:`, pool.getStats(), '\n');
    
    // Test 2: Richieste parallele
    console.log('📝 Test 2: Richieste parallele (10 richieste)\n');
    
    const requests = [];
    for (let i = 1; i <= 10; i++) {
        requests.push(
            pool.sendRequest(`Parallel ${i}`)
                .then(response => console.log(`✅ [${i}] ${response}`))
                .catch(err => console.error(`❌ [${i}]`, err.message))
        );
    }
    
    await Promise.all(requests);
    
    console.log(`\n📊 Stats dopo test 2:`, pool.getStats(), '\n');
    
    // Test 3: Attendi idle timeout
    console.log('📝 Test 3: Attendi idle timeout (10s)...\n');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    console.log(`📊 Stats dopo idle:`, pool.getStats(), '\n');
    
    // Chiudi pool
    await pool.close();
}

// Esegui demo
demo().catch(console.error);

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\n🛑 Interruzione...');
    process.exit(0);
});
