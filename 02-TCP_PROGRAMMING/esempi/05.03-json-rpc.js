/**
 * 05.03 - Simple JSON-RPC Implementation
 * 
 * Implementazione semplificata di JSON-RPC 2.0 su TCP.
 * Dimostra come costruire un sistema RPC completo.
 * 
 * Supporta:
 *   - Richieste con ID
 *   - Notifiche (senza risposta)
 *   - Batch requests
 *   - Error handling
 */

const net = require('net');
const crypto = require('crypto');

// ===== JSON-RPC PROTOCOL =====
class JSONRPC {
    static VERSION = '2.0';
    
    static createRequest(method, params, id = null) {
        const request = {
            jsonrpc: JSONRPC.VERSION,
            method: method,
            params: params
        };
        
        // Se id è null, è una notifica (no response)
        if (id !== null) {
            request.id = id;
        }
        
        return JSON.stringify(request) + '\n';
    }
    
    static createResponse(id, result, error = null) {
        const response = {
            jsonrpc: JSONRPC.VERSION,
            id: id
        };
        
        if (error) {
            response.error = {
                code: error.code || -32603,
                message: error.message || 'Internal error',
                data: error.data
            };
        } else {
            response.result = result;
        }
        
        return JSON.stringify(response) + '\n';
    }
    
    static createError(code, message, data = null) {
        return { code, message, data };
    }
    
    static ERRORS = {
        PARSE_ERROR: { code: -32700, message: 'Parse error' },
        INVALID_REQUEST: { code: -32600, message: 'Invalid Request' },
        METHOD_NOT_FOUND: { code: -32601, message: 'Method not found' },
        INVALID_PARAMS: { code: -32602, message: 'Invalid params' },
        INTERNAL_ERROR: { code: -32603, message: 'Internal error' }
    };
}

// ===== RPC SERVER =====
class RPCServer {
    constructor(port = 3202) {
        this.port = port;
        this.server = null;
        this.methods = new Map();
        
        // Registra metodi di esempio
        this.registerDefaultMethods();
    }
    
    registerDefaultMethods() {
        // Metodi matematici
        this.register('add', (params) => {
            if (typeof params.a !== 'number' || typeof params.b !== 'number') {
                throw JSONRPC.ERRORS.INVALID_PARAMS;
            }
            return params.a + params.b;
        });
        
        this.register('subtract', (params) => {
            if (typeof params.a !== 'number' || typeof params.b !== 'number') {
                throw JSONRPC.ERRORS.INVALID_PARAMS;
            }
            return params.a - params.b;
        });
        
        this.register('multiply', (params) => {
            if (typeof params.a !== 'number' || typeof params.b !== 'number') {
                throw JSONRPC.ERRORS.INVALID_PARAMS;
            }
            return params.a * params.b;
        });
        
        // Metodi stringa
        this.register('concat', (params) => {
            if (!Array.isArray(params.strings)) {
                throw JSONRPC.ERRORS.INVALID_PARAMS;
            }
            return params.strings.join('');
        });
        
        this.register('reverse', (params) => {
            if (typeof params.text !== 'string') {
                throw JSONRPC.ERRORS.INVALID_PARAMS;
            }
            return params.text.split('').reverse().join('');
        });
        
        // Metodo con delay (async)
        this.register('delayed_echo', async (params) => {
            const delay = params.delay || 1000;
            await new Promise(resolve => setTimeout(resolve, delay));
            return params.message;
        });
        
        // Metodo list (lista metodi disponibili)
        this.register('system.listMethods', () => {
            return Array.from(this.methods.keys());
        });
        
        // Notifica log (non ritorna risultato)
        this.register('log', (params) => {
            console.log(`📝 [LOG] ${params.level || 'INFO'}: ${params.message}`);
            // Le notifiche non ritornano risultato
        });
    }
    
    register(name, handler) {
        this.methods.set(name, handler);
        console.log(`✅ Registered method: ${name}`);
    }
    
    async handleRequest(request) {
        try {
            // Valida request
            if (!request.jsonrpc || request.jsonrpc !== '2.0') {
                return JSONRPC.createResponse(
                    request.id || null,
                    null,
                    JSONRPC.ERRORS.INVALID_REQUEST
                );
            }
            
            if (!request.method || typeof request.method !== 'string') {
                return JSONRPC.createResponse(
                    request.id || null,
                    null,
                    JSONRPC.ERRORS.INVALID_REQUEST
                );
            }
            
            // Cerca metodo
            const handler = this.methods.get(request.method);
            if (!handler) {
                return JSONRPC.createResponse(
                    request.id || null,
                    null,
                    { ...JSONRPC.ERRORS.METHOD_NOT_FOUND, data: request.method }
                );
            }
            
            // Esegui metodo
            try {
                const result = await handler(request.params || {});
                
                // Se ha ID, ritorna risposta (altrimenti è notifica)
                if ('id' in request) {
                    return JSONRPC.createResponse(request.id, result);
                }
                
                return null; // Notifica, no response
                
            } catch (err) {
                // Se ha ID, ritorna errore
                if ('id' in request) {
                    return JSONRPC.createResponse(
                        request.id,
                        null,
                        err.code ? err : { code: -32603, message: err.message }
                    );
                }
                return null;
            }
            
        } catch (err) {
            return JSONRPC.createResponse(
                null,
                null,
                JSONRPC.ERRORS.INTERNAL_ERROR
            );
        }
    }
    
    start() {
        this.server = net.createServer((socket) => {
            console.log(`\n📥 Client connesso: ${socket.remoteAddress}:${socket.remotePort}`);
            
            let buffer = '';
            
            socket.on('data', async (data) => {
                buffer += data.toString();
                
                let newlineIdx;
                while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
                    const line = buffer.substring(0, newlineIdx);
                    buffer = buffer.substring(newlineIdx + 1);
                    
                    try {
                        const request = JSON.parse(line);
                        const isNotification = !('id' in request);
                        
                        console.log(`📨 Request: ${request.method}${isNotification ? ' [NOTIFICATION]' : ''}`);
                        
                        const response = await this.handleRequest(request);
                        
                        if (response) {
                            socket.write(response);
                        }
                    } catch (err) {
                        console.error('❌ Parse error:', err.message);
                        const response = JSONRPC.createResponse(
                            null,
                            null,
                            JSONRPC.ERRORS.PARSE_ERROR
                        );
                        socket.write(response);
                    }
                }
            });
            
            socket.on('close', () => {
                console.log('👋 Client disconnesso\n');
            });
            
            socket.on('error', (err) => {
                console.error('❌ Socket error:', err.message);
            });
        });
        
        this.server.listen(this.port, () => {
            console.log('='.repeat(60));
            console.log(`✅ JSON-RPC Server avviato su porta ${this.port}`);
            console.log('='.repeat(60));
            console.log(`Metodi registrati: ${this.methods.size}\n`);
        });
    }
    
    stop() {
        if (this.server) {
            this.server.close(() => {
                console.log('✅ Server chiuso');
            });
        }
    }
}

// ===== RPC CLIENT =====
class RPCClient {
    constructor(host = 'localhost', port = 3202) {
        this.host = host;
        this.port = port;
        this.socket = null;
        this.pendingRequests = new Map();
        this.buffer = '';
        this.requestCounter = 0;
    }
    
    connect() {
        return new Promise((resolve, reject) => {
            this.socket = net.connect({ host: this.host, port: this.port });
            
            this.socket.on('connect', () => {
                console.log('✅ Connesso al server RPC\n');
                this.setupHandlers();
                resolve();
            });
            
            this.socket.on('error', reject);
        });
    }
    
    setupHandlers() {
        this.socket.on('data', (data) => {
            this.buffer += data.toString();
            
            let newlineIdx;
            while ((newlineIdx = this.buffer.indexOf('\n')) !== -1) {
                const line = this.buffer.substring(0, newlineIdx);
                this.buffer = this.buffer.substring(newlineIdx + 1);
                
                try {
                    const response = JSON.parse(line);
                    this.handleResponse(response);
                } catch (err) {
                    console.error('❌ Parse error:', err.message);
                }
            }
        });
        
        this.socket.on('close', () => {
            console.log('\n👋 Disconnesso');
            
            for (const [id, pending] of this.pendingRequests) {
                pending.reject(new Error('Connection closed'));
            }
            this.pendingRequests.clear();
        });
    }
    
    handleResponse(response) {
        const pending = this.pendingRequests.get(response.id);
        
        if (pending) {
            this.pendingRequests.delete(response.id);
            
            if (response.error) {
                pending.reject(new Error(`[${response.error.code}] ${response.error.message}`));
            } else {
                pending.resolve(response.result);
            }
        }
    }
    
    async call(method, params = {}) {
        return new Promise((resolve, reject) => {
            const id = ++this.requestCounter;
            const request = JSONRPC.createRequest(method, params, id);
            
            this.pendingRequests.set(id, { resolve, reject });
            
            setTimeout(() => {
                if (this.pendingRequests.has(id)) {
                    this.pendingRequests.delete(id);
                    reject(new Error('Request timeout'));
                }
            }, 10000);
            
            this.socket.write(request);
        });
    }
    
    notify(method, params = {}) {
        const request = JSONRPC.createRequest(method, params, null);
        this.socket.write(request);
    }
    
    disconnect() {
        if (this.socket) {
            this.socket.end();
        }
    }
}

// ===== DEMO =====
async function demo() {
    console.log('='.repeat(60));
    console.log('JSON-RPC 2.0 IMPLEMENTATION DEMO');
    console.log('='.repeat(60) + '\n');
    
    // Server
    const server = new RPCServer(3202);
    server.start();
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Client
    const client = new RPCClient('localhost', 3202);
    await client.connect();
    
    // Test 1: Chiamate semplici
    console.log('📝 Test 1: Chiamate semplici\n');
    
    const sum = await client.call('add', { a: 5, b: 3 });
    console.log(`✅ add(5, 3) = ${sum}\n`);
    
    const diff = await client.call('subtract', { a: 10, b: 4 });
    console.log(`✅ subtract(10, 4) = ${diff}\n`);
    
    const product = await client.call('multiply', { a: 6, b: 7 });
    console.log(`✅ multiply(6, 7) = ${product}\n`);
    
    // Test 2: Metodi stringa
    console.log('📝 Test 2: Metodi stringa\n');
    
    const concat = await client.call('concat', { strings: ['Hello', ' ', 'World'] });
    console.log(`✅ concat(['Hello', ' ', 'World']) = "${concat}"\n`);
    
    const reverse = await client.call('reverse', { text: 'abcdef' });
    console.log(`✅ reverse('abcdef') = "${reverse}"\n`);
    
    // Test 3: Notifiche
    console.log('📝 Test 3: Notifiche (no response)\n');
    
    client.notify('log', { level: 'INFO', message: 'Test notification 1' });
    client.notify('log', { level: 'WARN', message: 'Test notification 2' });
    
    await new Promise(resolve => setTimeout(resolve, 500));
    console.log();
    
    // Test 4: Lista metodi
    console.log('📝 Test 4: Lista metodi disponibili\n');
    
    const methods = await client.call('system.listMethods');
    console.log('✅ Metodi disponibili:');
    methods.forEach(m => console.log(`  - ${m}`));
    console.log();
    
    // Test 5: Chiamate parallele
    console.log('📝 Test 5: Chiamate parallele\n');
    
    const [r1, r2, r3] = await Promise.all([
        client.call('add', { a: 1, b: 2 }),
        client.call('multiply', { a: 3, b: 4 }),
        client.call('reverse', { text: 'parallel' })
    ]);
    
    console.log(`✅ Risultati paralleli: ${r1}, ${r2}, "${r3}"\n`);
    
    // Test 6: Errori
    console.log('📝 Test 6: Gestione errori\n');
    
    try {
        await client.call('nonexistent', {});
    } catch (err) {
        console.log(`✅ Errore gestito: ${err.message}\n`);
    }
    
    try {
        await client.call('add', { a: 'not', b: 'numbers' });
    } catch (err) {
        console.log(`✅ Errore parametri: ${err.message}\n`);
    }
    
    // Test 7: Async method
    console.log('📝 Test 7: Metodo asincrono\n');
    
    console.log('Chiamata delayed_echo (1s delay)...');
    const delayed = await client.call('delayed_echo', { message: 'Delayed!', delay: 1000 });
    console.log(`✅ Risposta: "${delayed}"\n`);
    
    // Chiudi
    console.log('👋 Chiusura...');
    client.disconnect();
    
    setTimeout(() => {
        server.stop();
        process.exit(0);
    }, 1000);
}

// Avvia
if (require.main === module) {
    demo().catch(console.error);
}
