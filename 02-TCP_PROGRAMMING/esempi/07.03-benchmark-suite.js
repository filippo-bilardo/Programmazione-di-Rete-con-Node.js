/**
 * 07.03 - Performance Benchmark Suite
 * 
 * Suite completa di benchmark per testare performance TCP.
 * Misura throughput, latency, concurrent connections, memory usage.
 * 
 * Metriche:
 *   - Throughput (MB/s)
 *   - Latency (p50, p95, p99)
 *   - Concurrent connections
 *   - Memory usage
 *   - CPU usage
 */

const net = require('net');
const os = require('os');

// Benchmark Server
class BenchmarkServer {
    constructor(port = 3403) {
        this.port = port;
        this.server = null;
        
        this.stats = {
            connections: 0,
            activeConnections: 0,
            peakConnections: 0,
            bytesReceived: 0,
            bytesSent: 0,
            messagesReceived: 0,
            messagesSent: 0,
            startTime: Date.now()
        };
    }
    
    start() {
        this.server = net.createServer((socket) => {
            this.stats.connections++;
            this.stats.activeConnections++;
            
            if (this.stats.activeConnections > this.stats.peakConnections) {
                this.stats.peakConnections = this.stats.activeConnections;
            }
            
            socket.setNoDelay(true); // Low latency
            
            let buffer = '';
            
            socket.on('data', (data) => {
                this.stats.bytesReceived += data.length;
                
                buffer += data.toString();
                
                let newlineIdx;
                while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
                    const line = buffer.substring(0, newlineIdx);
                    buffer = buffer.substring(newlineIdx + 1);
                    
                    if (line.length > 0) {
                        this.stats.messagesReceived++;
                        
                        // Echo back
                        const response = line + '\n';
                        socket.write(response);
                        
                        this.stats.messagesSent++;
                        this.stats.bytesSent += response.length;
                    }
                }
            });
            
            socket.on('close', () => {
                this.stats.activeConnections--;
            });
            
            socket.on('error', (err) => {
                console.error('Socket error:', err.message);
            });
        });
        
        this.server.listen(this.port, () => {
            console.log(`✅ Benchmark Server avviato su porta ${this.port}\n`);
        });
    }
    
    getStats() {
        const uptime = (Date.now() - this.stats.startTime) / 1000;
        
        return {
            ...this.stats,
            uptime: uptime.toFixed(2),
            throughputRx: (this.stats.bytesReceived / 1024 / 1024 / uptime).toFixed(2),
            throughputTx: (this.stats.bytesSent / 1024 / 1024 / uptime).toFixed(2),
            messagesPerSec: (this.stats.messagesReceived / uptime).toFixed(2)
        };
    }
    
    reset() {
        this.stats = {
            connections: 0,
            activeConnections: this.stats.activeConnections,
            peakConnections: this.stats.peakConnections,
            bytesReceived: 0,
            bytesSent: 0,
            messagesReceived: 0,
            messagesSent: 0,
            startTime: Date.now()
        };
    }
    
    stop() {
        return new Promise((resolve) => {
            if (this.server) {
                this.server.close(resolve);
            } else {
                resolve();
            }
        });
    }
}

// Benchmark Client
class BenchmarkClient {
    constructor(host, port) {
        this.host = host;
        this.port = port;
        this.socket = null;
        this.connected = false;
        
        this.latencies = [];
        this.pendingRequests = new Map();
        
        this.stats = {
            requestsSent: 0,
            responsesReceived: 0,
            bytesSent: 0,
            bytesReceived: 0
        };
    }
    
    async connect() {
        return new Promise((resolve, reject) => {
            this.socket = net.connect({ host: this.host, port: this.port });
            
            this.socket.setNoDelay(true);
            
            this.socket.on('connect', () => {
                this.connected = true;
                this.setupHandlers();
                resolve();
            });
            
            this.socket.on('error', reject);
        });
    }
    
    setupHandlers() {
        let buffer = '';
        
        this.socket.on('data', (data) => {
            this.stats.bytesReceived += data.length;
            
            buffer += data.toString();
            
            let newlineIdx;
            while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
                const line = buffer.substring(0, newlineIdx);
                buffer = buffer.substring(newlineIdx + 1);
                
                this.handleResponse(line);
            }
        });
        
        this.socket.on('close', () => {
            this.connected = false;
        });
    }
    
    handleResponse(line) {
        const pending = this.pendingRequests.get(line);
        
        if (pending) {
            const latency = Date.now() - pending.startTime;
            this.latencies.push(latency);
            
            this.pendingRequests.delete(line);
            this.stats.responsesReceived++;
            
            pending.resolve(latency);
        }
    }
    
    async sendRequest(message) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            
            this.pendingRequests.set(message, { startTime, resolve, reject });
            
            const data = message + '\n';
            this.socket.write(data);
            
            this.stats.requestsSent++;
            this.stats.bytesSent += data.length;
            
            setTimeout(() => {
                if (this.pendingRequests.has(message)) {
                    this.pendingRequests.delete(message);
                    reject(new Error('Timeout'));
                }
            }, 10000);
        });
    }
    
    getLatencyStats() {
        if (this.latencies.length === 0) {
            return null;
        }
        
        const sorted = this.latencies.slice().sort((a, b) => a - b);
        
        return {
            count: sorted.length,
            min: sorted[0],
            max: sorted[sorted.length - 1],
            avg: (sorted.reduce((a, b) => a + b, 0) / sorted.length).toFixed(2),
            p50: sorted[Math.floor(sorted.length * 0.50)],
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

// Benchmark Suite
class BenchmarkSuite {
    async runAll() {
        console.log('='.repeat(60));
        console.log('TCP PERFORMANCE BENCHMARK SUITE');
        console.log('='.repeat(60) + '\n');
        
        await this.throughputBenchmark();
        await this.latencyBenchmark();
        await this.concurrentConnectionsBenchmark();
        
        console.log('='.repeat(60));
        console.log('✅ ALL BENCHMARKS COMPLETED');
        console.log('='.repeat(60) + '\n');
    }
    
    async throughputBenchmark() {
        console.log('📝 Test 1: THROUGHPUT BENCHMARK\n');
        
        const server = new BenchmarkServer(3403);
        server.start();
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const client = new BenchmarkClient('localhost', 3403);
        await client.connect();
        
        const messageSize = 1024; // 1KB
        const duration = 10000; // 10 secondi
        const message = 'X'.repeat(messageSize);
        
        console.log(`Message size: ${messageSize} bytes`);
        console.log(`Duration: ${duration / 1000}s`);
        console.log('Running...\n');
        
        const startTime = Date.now();
        let count = 0;
        
        while (Date.now() - startTime < duration) {
            try {
                await client.sendRequest(message);
                count++;
            } catch (err) {
                break;
            }
        }
        
        const elapsed = (Date.now() - startTime) / 1000;
        const serverStats = server.getStats();
        
        console.log('Results:');
        console.log(`  Requests: ${count}`);
        console.log(`  Elapsed: ${elapsed.toFixed(2)}s`);
        console.log(`  Requests/sec: ${(count / elapsed).toFixed(2)}`);
        console.log(`  Throughput RX: ${serverStats.throughputRx} MB/s`);
        console.log(`  Throughput TX: ${serverStats.throughputTx} MB/s`);
        console.log(`  Total bytes RX: ${(serverStats.bytesReceived / 1024 / 1024).toFixed(2)} MB`);
        console.log(`  Total bytes TX: ${(serverStats.bytesSent / 1024 / 1024).toFixed(2)} MB\n`);
        
        client.disconnect();
        await server.stop();
        
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    async latencyBenchmark() {
        console.log('📝 Test 2: LATENCY BENCHMARK\n');
        
        const server = new BenchmarkServer(3404);
        server.start();
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const client = new BenchmarkClient('localhost', 3404);
        await client.connect();
        
        const iterations = 1000;
        
        console.log(`Iterations: ${iterations}`);
        console.log('Running...\n');
        
        for (let i = 0; i < iterations; i++) {
            try {
                await client.sendRequest(`request-${i}`);
                
                if ((i + 1) % 100 === 0) {
                    process.stdout.write(`Progress: ${i + 1}/${iterations}\r`);
                }
            } catch (err) {
                console.error('Error:', err.message);
            }
        }
        
        console.log();
        
        const latencyStats = client.getLatencyStats();
        
        console.log('\nResults:');
        console.log(`  Count: ${latencyStats.count}`);
        console.log(`  Min: ${latencyStats.min}ms`);
        console.log(`  Max: ${latencyStats.max}ms`);
        console.log(`  Avg: ${latencyStats.avg}ms`);
        console.log(`  P50 (median): ${latencyStats.p50}ms`);
        console.log(`  P95: ${latencyStats.p95}ms`);
        console.log(`  P99: ${latencyStats.p99}ms\n`);
        
        client.disconnect();
        await server.stop();
        
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    async concurrentConnectionsBenchmark() {
        console.log('📝 Test 3: CONCURRENT CONNECTIONS BENCHMARK\n');
        
        const server = new BenchmarkServer(3405);
        server.start();
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const numClients = 100;
        const requestsPerClient = 10;
        
        console.log(`Concurrent clients: ${numClients}`);
        console.log(`Requests per client: ${requestsPerClient}`);
        console.log('Running...\n');
        
        const clients = [];
        const results = [];
        
        // Crea tutti i client
        for (let i = 0; i < numClients; i++) {
            const client = new BenchmarkClient('localhost', 3405);
            clients.push(client);
        }
        
        // Connetti tutti
        const startConnect = Date.now();
        await Promise.all(clients.map(c => c.connect()));
        const connectTime = Date.now() - startConnect;
        
        console.log(`All clients connected in ${connectTime}ms\n`);
        
        // Invia richieste in parallelo
        const startRequests = Date.now();
        
        const promises = clients.map(async (client, idx) => {
            const clientResults = [];
            
            for (let i = 0; i < requestsPerClient; i++) {
                try {
                    const latency = await client.sendRequest(`client-${idx}-request-${i}`);
                    clientResults.push(latency);
                } catch (err) {
                    // Ignore
                }
            }
            
            return clientResults;
        });
        
        const allResults = await Promise.all(promises);
        const requestTime = Date.now() - startRequests;
        
        // Aggregate latencies
        const allLatencies = allResults.flat().sort((a, b) => a - b);
        
        const serverStats = server.getStats();
        
        console.log('Results:');
        console.log(`  Clients: ${numClients}`);
        console.log(`  Total requests: ${allLatencies.length}`);
        console.log(`  Connection time: ${connectTime}ms`);
        console.log(`  Request time: ${(requestTime / 1000).toFixed(2)}s`);
        console.log(`  Requests/sec: ${(allLatencies.length / (requestTime / 1000)).toFixed(2)}`);
        console.log(`  Peak connections: ${serverStats.peakConnections}`);
        console.log('\nLatency:');
        console.log(`  Min: ${allLatencies[0]}ms`);
        console.log(`  Max: ${allLatencies[allLatencies.length - 1]}ms`);
        console.log(`  Avg: ${(allLatencies.reduce((a, b) => a + b, 0) / allLatencies.length).toFixed(2)}ms`);
        console.log(`  P95: ${allLatencies[Math.floor(allLatencies.length * 0.95)]}ms`);
        console.log(`  P99: ${allLatencies[Math.floor(allLatencies.length * 0.99)]}ms\n`);
        
        // Memory usage
        const mem = process.memoryUsage();
        console.log('Memory:');
        console.log(`  RSS: ${(mem.rss / 1024 / 1024).toFixed(2)} MB`);
        console.log(`  Heap Used: ${(mem.heapUsed / 1024 / 1024).toFixed(2)} MB\n`);
        
        // Disconnetti tutti
        clients.forEach(c => c.disconnect());
        await server.stop();
        
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
}

// Main
if (require.main === module) {
    const mode = process.argv[2];
    
    if (mode === 'server') {
        const server = new BenchmarkServer(3403);
        server.start();
        
        setInterval(() => {
            const stats = server.getStats();
            console.log('\n📊 Stats:');
            console.log(`  Active: ${stats.activeConnections}, Peak: ${stats.peakConnections}`);
            console.log(`  Throughput: ${stats.throughputRx} MB/s RX, ${stats.throughputTx} MB/s TX`);
            console.log(`  Messages: ${stats.messagesPerSec} msg/s`);
        }, 5000);
        
        process.on('SIGINT', async () => {
            console.log('\n\n🛑 Shutdown...');
            await server.stop();
            process.exit(0);
        });
    } else {
        const suite = new BenchmarkSuite();
        suite.runAll()
            .then(() => process.exit(0))
            .catch(err => {
                console.error('❌ Benchmark failed:', err);
                process.exit(1);
            });
    }
}
