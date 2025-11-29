/**
 * 07.02 - TCP_NODELAY and Nagle's Algorithm
 * 
 * Comparazione dell'impatto di TCP_NODELAY (disabilita Nagle's algorithm).
 * Dimostra quando usare TCP_NODELAY per low-latency applications.
 * 
 * Nagle's Algorithm:
 *   - Accumula piccoli pacchetti prima di inviarli
 *   - Riduce overhead di rete
 *   - Aumenta latenza
 * 
 * TCP_NODELAY:
 *   - Invia immediatamente i dati
 *   - Riduce latenza
 *   - Può aumentare numero di pacchetti
 */

const net = require('net');

// Server per testing TCP_NODELAY
class LatencyTestServer {
    constructor(port = 3401, useNoDelay = true) {
        this.port = port;
        this.server = null;
        this.useNoDelay = useNoDelay;
        
        this.stats = {
            connections: 0,
            messages: 0,
            totalLatency: 0,
            minLatency: Infinity,
            maxLatency: 0
        };
    }
    
    start() {
        this.server = net.createServer((socket) => {
            const connId = ++this.stats.connections;
            
            // Configura TCP_NODELAY
            socket.setNoDelay(this.useNoDelay);
            
            console.log(`📥 [${connId}] Client connesso (NoDelay: ${this.useNoDelay})`);
            
            socket.write(`Server TCP_NODELAY: ${this.useNoDelay}\n\n`);
            
            let buffer = '';
            
            socket.on('data', (data) => {
                buffer += data.toString();
                
                let newlineIdx;
                while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
                    const line = buffer.substring(0, newlineIdx);
                    buffer = buffer.substring(newlineIdx + 1);
                    
                    // Echo back immediatamente con timestamp
                    const response = `${Date.now()}:${line}\n`;
                    socket.write(response);
                    
                    this.stats.messages++;
                }
            });
            
            socket.on('close', () => {
                console.log(`👋 [${connId}] Disconnesso (${this.stats.messages} messages)`);
            });
            
            socket.on('error', (err) => {
                console.error(`❌ [${connId}] Errore:`, err.message);
            });
        });
        
        this.server.listen(this.port, () => {
            console.log('='.repeat(60));
            console.log(`✅ Latency Test Server su porta ${this.port}`);
            console.log('='.repeat(60));
            console.log(`TCP_NODELAY: ${this.useNoDelay}`);
            console.log('='.repeat(60) + '\n');
        });
    }
    
    getStats() {
        return { ...this.stats };
    }
    
    stop() {
        if (this.server) {
            this.server.close(() => {
                console.log('✅ Server chiuso');
            });
        }
    }
}

// Client per latency testing
class LatencyTestClient {
    constructor(host, port, useNoDelay = true) {
        this.host = host;
        this.port = port;
        this.socket = null;
        this.useNoDelay = useNoDelay;
        
        this.latencies = [];
        this.pendingRequests = new Map();
    }
    
    async connect() {
        return new Promise((resolve, reject) => {
            this.socket = net.connect({ host: this.host, port: this.port });
            
            this.socket.setNoDelay(this.useNoDelay);
            
            this.socket.on('connect', () => {
                console.log(`✅ Connesso (TCP_NODELAY: ${this.useNoDelay})`);
                this.setupHandlers();
                resolve();
            });
            
            this.socket.on('error', reject);
        });
    }
    
    setupHandlers() {
        let buffer = '';
        
        this.socket.on('data', (data) => {
            buffer += data.toString();
            
            let newlineIdx;
            while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
                const line = buffer.substring(0, newlineIdx);
                buffer = buffer.substring(newlineIdx + 1);
                
                this.handleResponse(line);
            }
        });
    }
    
    handleResponse(line) {
        if (!line.includes(':')) return;
        
        const [serverTimestamp, requestId] = line.split(':');
        const now = Date.now();
        
        const pending = this.pendingRequests.get(requestId);
        
        if (pending) {
            const latency = now - pending.startTime;
            this.latencies.push(latency);
            
            this.pendingRequests.delete(requestId);
            pending.resolve(latency);
        }
    }
    
    async sendRequest(message) {
        return new Promise((resolve, reject) => {
            const requestId = `${Date.now()}-${Math.random()}`;
            const startTime = Date.now();
            
            this.pendingRequests.set(requestId, { startTime, resolve, reject });
            
            this.socket.write(`${requestId}\n`);
            
            setTimeout(() => {
                if (this.pendingRequests.has(requestId)) {
                    this.pendingRequests.delete(requestId);
                    reject(new Error('Timeout'));
                }
            }, 5000);
        });
    }
    
    getStats() {
        if (this.latencies.length === 0) {
            return {
                count: 0,
                avg: 0,
                min: 0,
                max: 0,
                p50: 0,
                p95: 0,
                p99: 0
            };
        }
        
        const sorted = this.latencies.slice().sort((a, b) => a - b);
        
        return {
            count: sorted.length,
            avg: (sorted.reduce((a, b) => a + b, 0) / sorted.length).toFixed(2),
            min: sorted[0],
            max: sorted[sorted.length - 1],
            p50: sorted[Math.floor(sorted.length * 0.5)],
            p95: sorted[Math.floor(sorted.length * 0.95)],
            p99: sorted[Math.floor(sorted.length * 0.99)]
        };
    }
    
    disconnect() {
        if (this.socket) {
            this.socket.end();
        }
    }
}

// Benchmark
async function benchmark() {
    console.log('='.repeat(60));
    console.log('TCP_NODELAY LATENCY BENCHMARK');
    console.log('='.repeat(60) + '\n');
    
    const iterations = 1000;
    
    // Test 1: Con TCP_NODELAY (low latency)
    console.log('📝 Test 1: TCP_NODELAY = true (low latency)\n');
    
    const server1 = new LatencyTestServer(3401, true);
    server1.start();
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const client1 = new LatencyTestClient('localhost', 3401, true);
    await client1.connect();
    
    console.log(`Sending ${iterations} requests...\n`);
    
    for (let i = 0; i < iterations; i++) {
        try {
            await client1.sendRequest('test');
            
            if ((i + 1) % 100 === 0) {
                process.stdout.write(`Progress: ${i + 1}/${iterations}\r`);
            }
        } catch (err) {
            console.error('Error:', err.message);
        }
    }
    
    console.log();
    
    const stats1 = client1.getStats();
    console.log('\nResults (TCP_NODELAY = true):');
    console.log(`  Requests: ${stats1.count}`);
    console.log(`  Avg latency: ${stats1.avg}ms`);
    console.log(`  Min latency: ${stats1.min}ms`);
    console.log(`  Max latency: ${stats1.max}ms`);
    console.log(`  P50: ${stats1.p50}ms`);
    console.log(`  P95: ${stats1.p95}ms`);
    console.log(`  P99: ${stats1.p99}ms\n`);
    
    client1.disconnect();
    server1.stop();
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test 2: Senza TCP_NODELAY (Nagle enabled)
    console.log('📝 Test 2: TCP_NODELAY = false (Nagle enabled)\n');
    
    const server2 = new LatencyTestServer(3402, false);
    server2.start();
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const client2 = new LatencyTestClient('localhost', 3402, false);
    await client2.connect();
    
    console.log(`Sending ${iterations} requests...\n`);
    
    for (let i = 0; i < iterations; i++) {
        try {
            await client2.sendRequest('test');
            
            if ((i + 1) % 100 === 0) {
                process.stdout.write(`Progress: ${i + 1}/${iterations}\r`);
            }
        } catch (err) {
            console.error('Error:', err.message);
        }
    }
    
    console.log();
    
    const stats2 = client2.getStats();
    console.log('\nResults (TCP_NODELAY = false):');
    console.log(`  Requests: ${stats2.count}`);
    console.log(`  Avg latency: ${stats2.avg}ms`);
    console.log(`  Min latency: ${stats2.min}ms`);
    console.log(`  Max latency: ${stats2.max}ms`);
    console.log(`  P50: ${stats2.p50}ms`);
    console.log(`  P95: ${stats2.p95}ms`);
    console.log(`  P99: ${stats2.p99}ms\n`);
    
    client2.disconnect();
    server2.stop();
    
    // Confronto
    console.log('='.repeat(60));
    console.log('COMPARISON');
    console.log('='.repeat(60));
    console.log(`Avg latency improvement: ${((stats2.avg - stats1.avg) / stats2.avg * 100).toFixed(2)}%`);
    console.log(`P95 latency improvement: ${((stats2.p95 - stats1.p95) / stats2.p95 * 100).toFixed(2)}%`);
    console.log('='.repeat(60));
    console.log('\n💡 Recommendations:');
    console.log('  - Use TCP_NODELAY for real-time/low-latency apps');
    console.log('  - Use Nagle (no TCP_NODELAY) for bulk transfers');
    console.log('  - Consider application requirements\n');
}

// Main
if (require.main === module) {
    const mode = process.argv[2];
    
    if (mode === 'server-nodelay') {
        const server = new LatencyTestServer(3401, true);
        server.start();
        
        process.on('SIGINT', () => {
            console.log('\n\n🛑 Shutdown...');
            server.stop();
            process.exit(0);
        });
    } else if (mode === 'server-nagle') {
        const server = new LatencyTestServer(3402, false);
        server.start();
        
        process.on('SIGINT', () => {
            console.log('\n\n🛑 Shutdown...');
            server.stop();
            process.exit(0);
        });
    } else {
        benchmark().catch(console.error);
    }
}
