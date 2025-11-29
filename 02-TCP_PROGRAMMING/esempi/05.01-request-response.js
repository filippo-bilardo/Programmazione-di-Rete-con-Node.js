/**
 * 05.01 - Request-Response Pattern
 * 
 * Implementazione del pattern Request-Response con ID per il matching.
 * Dimostra come gestire richieste asincrone con risposte identificate.
 * 
 * Server e client separati per testing.
 */

const net = require('net');
const crypto = require('crypto');

// ===== SERVER =====
class RequestResponseServer {
    constructor(port = 3200) {
        this.port = port;
        this.server = null;
    }
    
    start() {
        this.server = net.createServer((socket) => {
            console.log(`📥 Client connesso: ${socket.remoteAddress}:${socket.remotePort}`);
            
            let buffer = '';
            
            socket.on('data', (data) => {
                buffer += data.toString();
                
                // Processa messaggi completi (terminati con \n)
                let newlineIdx;
                while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
                    const message = buffer.substring(0, newlineIdx);
                    buffer = buffer.substring(newlineIdx + 1);
                    
                    this.handleRequest(socket, message);
                }
            });
            
            socket.on('close', () => {
                console.log(`👋 Client disconnesso`);
            });
            
            socket.on('error', (err) => {
                console.error('❌ Errore socket:', err.message);
            });
        });
        
        this.server.listen(this.port, () => {
            console.log(`✅ Server avviato su porta ${this.port}\n`);
        });
    }
    
    handleRequest(socket, message) {
        try {
            const request = JSON.parse(message);
            console.log(`📨 Request: ${request.id} - ${request.method}(${JSON.stringify(request.params)})`);
            
            // Simula elaborazione
            setTimeout(() => {
                let result;
                
                switch (request.method) {
                    case 'add':
                        result = request.params.a + request.params.b;
                        break;
                    
                    case 'multiply':
                        result = request.params.a * request.params.b;
                        break;
                    
                    case 'uppercase':
                        result = request.params.text.toUpperCase();
                        break;
                    
                    case 'reverse':
                        result = request.params.text.split('').reverse().join('');
                        break;
                    
                    default:
                        const response = {
                            id: request.id,
                            error: `Unknown method: ${request.method}`
                        };
                        console.log(`❌ Response: ${request.id} - Error`);
                        socket.write(JSON.stringify(response) + '\n');
                        return;
                }
                
                const response = {
                    id: request.id,
                    result: result
                };
                
                console.log(`✅ Response: ${request.id} - ${JSON.stringify(result)}`);
                socket.write(JSON.stringify(response) + '\n');
                
            }, Math.random() * 1000); // Random delay 0-1s
            
        } catch (err) {
            console.error('❌ Errore parsing request:', err.message);
        }
    }
    
    stop() {
        if (this.server) {
            this.server.close(() => {
                console.log('✅ Server chiuso');
            });
        }
    }
}

// ===== CLIENT =====
class RequestResponseClient {
    constructor(host = 'localhost', port = 3200) {
        this.host = host;
        this.port = port;
        this.socket = null;
        this.pendingRequests = new Map();
        this.buffer = '';
    }
    
    connect() {
        return new Promise((resolve, reject) => {
            console.log(`🔌 Connessione a ${this.host}:${this.port}...`);
            
            this.socket = net.connect({
                host: this.host,
                port: this.port
            });
            
            this.socket.on('connect', () => {
                console.log('✅ Connesso!\n');
                this.setupHandlers();
                resolve();
            });
            
            this.socket.on('error', (err) => {
                console.error('❌ Errore connessione:', err.message);
                reject(err);
            });
        });
    }
    
    setupHandlers() {
        this.socket.on('data', (data) => {
            this.buffer += data.toString();
            
            // Processa risposte complete
            let newlineIdx;
            while ((newlineIdx = this.buffer.indexOf('\n')) !== -1) {
                const message = this.buffer.substring(0, newlineIdx);
                this.buffer = this.buffer.substring(newlineIdx + 1);
                
                this.handleResponse(message);
            }
        });
        
        this.socket.on('close', () => {
            console.log('\n👋 Connessione chiusa');
            
            // Rigetta tutte le richieste pending
            for (const [id, pending] of this.pendingRequests) {
                pending.reject(new Error('Connection closed'));
            }
            this.pendingRequests.clear();
        });
    }
    
    handleResponse(message) {
        try {
            const response = JSON.parse(message);
            const pending = this.pendingRequests.get(response.id);
            
            if (pending) {
                this.pendingRequests.delete(response.id);
                
                if (response.error) {
                    pending.reject(new Error(response.error));
                } else {
                    pending.resolve(response.result);
                }
            }
        } catch (err) {
            console.error('❌ Errore parsing response:', err.message);
        }
    }
    
    async request(method, params) {
        return new Promise((resolve, reject) => {
            const id = crypto.randomBytes(8).toString('hex');
            
            const request = {
                id: id,
                method: method,
                params: params
            };
            
            // Salva pending request
            this.pendingRequests.set(id, { resolve, reject });
            
            // Timeout
            setTimeout(() => {
                if (this.pendingRequests.has(id)) {
                    this.pendingRequests.delete(id);
                    reject(new Error('Request timeout'));
                }
            }, 10000);
            
            // Invia request
            console.log(`📤 Request [${id}]: ${method}(${JSON.stringify(params)})`);
            this.socket.write(JSON.stringify(request) + '\n');
        });
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
    console.log('REQUEST-RESPONSE PATTERN DEMO');
    console.log('='.repeat(60) + '\n');
    
    // Avvia server
    const server = new RequestResponseServer(3200);
    server.start();
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Avvia client
    const client = new RequestResponseClient('localhost', 3200);
    await client.connect();
    
    // Test 1: Richieste sequenziali
    console.log('📝 Test 1: Richieste sequenziali\n');
    
    try {
        const result1 = await client.request('add', { a: 5, b: 3 });
        console.log(`✅ add(5, 3) = ${result1}\n`);
        
        const result2 = await client.request('multiply', { a: 4, b: 7 });
        console.log(`✅ multiply(4, 7) = ${result2}\n`);
        
        const result3 = await client.request('uppercase', { text: 'hello' });
        console.log(`✅ uppercase('hello') = ${result3}\n`);
        
        const result4 = await client.request('reverse', { text: 'world' });
        console.log(`✅ reverse('world') = ${result4}\n`);
    } catch (err) {
        console.error('❌ Errore:', err.message);
    }
    
    // Test 2: Richieste parallele
    console.log('📝 Test 2: Richieste parallele\n');
    
    try {
        const results = await Promise.all([
            client.request('add', { a: 10, b: 20 }),
            client.request('multiply', { a: 3, b: 4 }),
            client.request('uppercase', { text: 'parallel' }),
            client.request('reverse', { text: 'testing' })
        ]);
        
        console.log('✅ Risultati paralleli:');
        console.log(`  add(10, 20) = ${results[0]}`);
        console.log(`  multiply(3, 4) = ${results[1]}`);
        console.log(`  uppercase('parallel') = ${results[2]}`);
        console.log(`  reverse('testing') = ${results[3]}\n`);
    } catch (err) {
        console.error('❌ Errore:', err.message);
    }
    
    // Test 3: Metodo non esistente
    console.log('📝 Test 3: Metodo non esistente\n');
    
    try {
        await client.request('unknown', { foo: 'bar' });
    } catch (err) {
        console.log(`✅ Errore gestito correttamente: ${err.message}\n`);
    }
    
    // Statistiche
    console.log('='.repeat(60));
    console.log('📊 STATISTICHE');
    console.log('='.repeat(60));
    console.log(`Richieste pending: ${client.pendingRequests.size}`);
    console.log('='.repeat(60) + '\n');
    
    // Chiudi
    console.log('👋 Chiusura...');
    client.disconnect();
    
    setTimeout(() => {
        server.stop();
        process.exit(0);
    }, 1000);
}

// Avvia demo o modalità standalone
if (require.main === module) {
    const mode = process.argv[2];
    
    if (mode === 'server') {
        const server = new RequestResponseServer(3200);
        server.start();
        
        process.on('SIGINT', () => {
            console.log('\n\n🛑 Shutdown...');
            server.stop();
            process.exit(0);
        });
    } else if (mode === 'client') {
        (async () => {
            const client = new RequestResponseClient('localhost', 3200);
            await client.connect();
            
            // Test interattivo
            const readline = require('readline');
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });
            
            console.log('💡 Comandi disponibili:');
            console.log('  add <a> <b>');
            console.log('  multiply <a> <b>');
            console.log('  uppercase <text>');
            console.log('  reverse <text>');
            console.log('  exit\n');
            
            rl.on('line', async (line) => {
                const [cmd, ...args] = line.trim().split(' ');
                
                if (cmd === 'exit') {
                    client.disconnect();
                    rl.close();
                    return;
                }
                
                try {
                    let params;
                    switch (cmd) {
                        case 'add':
                        case 'multiply':
                            params = { a: parseInt(args[0]), b: parseInt(args[1]) };
                            break;
                        case 'uppercase':
                        case 'reverse':
                            params = { text: args.join(' ') };
                            break;
                        default:
                            console.log('❌ Comando sconosciuto');
                            return;
                    }
                    
                    const result = await client.request(cmd, params);
                    console.log(`✅ Result: ${result}\n`);
                } catch (err) {
                    console.error('❌ Errore:', err.message, '\n');
                }
            });
        })();
    } else {
        demo().catch(console.error);
    }
}
