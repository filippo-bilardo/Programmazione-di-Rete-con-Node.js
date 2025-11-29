/**
 * 07.01 - Buffer Pooling for Performance
 * 
 * Implementazione di buffer pooling per ridurre allocazioni e garbage collection.
 * Dimostra ottimizzazione della memoria per high-throughput applications.
 * 
 * Features:
 *   - Buffer pool con riuso
 *   - Statistiche allocazioni
 *   - Memory monitoring
 *   - Performance comparison
 */

const net = require('net');

// Buffer Pool
class BufferPool {
    constructor(bufferSize = 8192, maxPoolSize = 100) {
        this.bufferSize = bufferSize;
        this.maxPoolSize = maxPoolSize;
        this.pool = [];
        
        this.stats = {
            allocations: 0,
            reuses: 0,
            returned: 0,
            poolHitRate: 0
        };
        
        // Pre-allocate alcuni buffer
        for (let i = 0; i < Math.min(10, maxPoolSize); i++) {
            this.pool.push(Buffer.allocUnsafe(bufferSize));
        }
    }
    
    acquire() {
        if (this.pool.length > 0) {
            this.stats.reuses++;
            const buffer = this.pool.pop();
            buffer.fill(0); // Clear buffer
            return buffer;
        }
        
        this.stats.allocations++;
        return Buffer.allocUnsafe(this.bufferSize);
    }
    
    release(buffer) {
        if (this.pool.length < this.maxPoolSize) {
            this.pool.push(buffer);
            this.stats.returned++;
        }
    }
    
    getStats() {
        const total = this.stats.allocations + this.stats.reuses;
        this.stats.poolHitRate = total > 0 
            ? ((this.stats.reuses / total) * 100).toFixed(2)
            : 0;
        
        return {
            ...this.stats,
            poolSize: this.pool.length,
            maxPoolSize: this.maxPoolSize
        };
    }
    
    clear() {
        this.pool = [];
    }
}

// Server ottimizzato con buffer pooling
class OptimizedServer {
    constructor(port = 3400, usePooling = true) {
        this.port = port;
        this.server = null;
        this.usePooling = usePooling;
        this.bufferPool = usePooling ? new BufferPool(8192, 100) : null;
        
        this.stats = {
            connections: 0,
            bytesReceived: 0,
            bytesSent: 0,
            messagesProcessed: 0
        };
    }
    
    start() {
        this.server = net.createServer((socket) => {
            const connId = ++this.stats.connections;
            let totalReceived = 0;
            let totalSent = 0;
            
            console.log(`📥 [${connId}] Client connesso${this.usePooling ? ' (buffer pooling enabled)' : ''}`);
            
            socket.write(`Server mode: ${this.usePooling ? 'OPTIMIZED (buffer pooling)' : 'STANDARD'}\n`);
            socket.write('Commands:\n');
            socket.write('  data <size>  - Send test data of <size> bytes\n');
            socket.write('  stats        - Show server stats\n');
            socket.write('  memory       - Show memory usage\n');
            socket.write('  quit         - Disconnect\n\n');
            
            let commandBuffer = '';
            
            socket.on('data', (data) => {
                this.stats.bytesReceived += data.length;
                totalReceived += data.length;
                
                // Parse comandi
                commandBuffer += data.toString();
                
                let newlineIdx;
                while ((newlineIdx = commandBuffer.indexOf('\n')) !== -1) {
                    const line = commandBuffer.substring(0, newlineIdx).trim();
                    commandBuffer = commandBuffer.substring(newlineIdx + 1);
                    
                    if (line.length > 0) {
                        this.handleCommand(socket, connId, line);
                    }
                }
            });
            
            socket.on('close', () => {
                console.log(`👋 [${connId}] Disconnesso (RX: ${totalReceived} bytes, TX: ${totalSent} bytes)`);
            });
            
            socket.on('error', (err) => {
                console.error(`❌ [${connId}] Errore:`, err.message);
            });
        });
        
        this.server.listen(this.port, () => {
            console.log('='.repeat(60));
            console.log(`✅ ${this.usePooling ? 'OPTIMIZED' : 'STANDARD'} Server avviato su porta ${this.port}`);
            console.log('='.repeat(60));
            console.log(`Buffer pooling: ${this.usePooling ? 'ENABLED' : 'DISABLED'}`);
            console.log('='.repeat(60) + '\n');
        });
    }
    
    handleCommand(socket, connId, command) {
        const [cmd, ...args] = command.split(' ');
        
        switch (cmd.toLowerCase()) {
            case 'data':
                const size = parseInt(args[0]) || 1024;
                this.sendTestData(socket, connId, size);
                break;
            
            case 'stats':
                this.sendStats(socket);
                break;
            
            case 'memory':
                this.sendMemoryInfo(socket);
                break;
            
            case 'quit':
                socket.write('Goodbye!\n');
                socket.end();
                break;
            
            default:
                socket.write(`Unknown command: ${cmd}\n`);
        }
    }
    
    sendTestData(socket, connId, size) {
        console.log(`📤 [${connId}] Sending ${size} bytes...`);
        
        let buffer;
        
        if (this.usePooling) {
            buffer = this.bufferPool.acquire();
            
            // Se il buffer è più piccolo della richiesta, alloca uno nuovo
            if (buffer.length < size) {
                buffer = Buffer.allocUnsafe(size);
            }
        } else {
            buffer = Buffer.allocUnsafe(size);
        }
        
        // Riempi con dati di test
        for (let i = 0; i < size; i++) {
            buffer[i] = (i % 256);
        }
        
        const dataToSend = buffer.slice(0, size);
        
        socket.write(dataToSend, () => {
            this.stats.bytesSent += size;
            this.stats.messagesProcessed++;
            
            if (this.usePooling && buffer.length === this.bufferPool.bufferSize) {
                this.bufferPool.release(buffer);
            }
            
            socket.write(`\n✅ Sent ${size} bytes\n\n`);
        });
    }
    
    sendStats(socket) {
        const stats = {
            ...this.stats
        };
        
        if (this.usePooling) {
            Object.assign(stats, this.bufferPool.getStats());
        }
        
        socket.write('\n' + '='.repeat(50) + '\n');
        socket.write('SERVER STATISTICS\n');
        socket.write('='.repeat(50) + '\n');
        socket.write(`Mode: ${this.usePooling ? 'OPTIMIZED' : 'STANDARD'}\n`);
        socket.write(`Connections: ${stats.connections}\n`);
        socket.write(`Bytes RX: ${stats.bytesReceived} (${(stats.bytesReceived / 1024 / 1024).toFixed(2)} MB)\n`);
        socket.write(`Bytes TX: ${stats.bytesSent} (${(stats.bytesSent / 1024 / 1024).toFixed(2)} MB)\n`);
        socket.write(`Messages: ${stats.messagesProcessed}\n`);
        
        if (this.usePooling) {
            socket.write('\nBUFFER POOL:\n');
            socket.write(`  Allocations: ${stats.allocations}\n`);
            socket.write(`  Reuses: ${stats.reuses}\n`);
            socket.write(`  Returned: ${stats.returned}\n`);
            socket.write(`  Pool size: ${stats.poolSize}/${stats.maxPoolSize}\n`);
            socket.write(`  Hit rate: ${stats.poolHitRate}%\n`);
        }
        
        socket.write('='.repeat(50) + '\n\n');
    }
    
    sendMemoryInfo(socket) {
        const mem = process.memoryUsage();
        
        socket.write('\n' + '='.repeat(50) + '\n');
        socket.write('MEMORY USAGE\n');
        socket.write('='.repeat(50) + '\n');
        socket.write(`RSS: ${(mem.rss / 1024 / 1024).toFixed(2)} MB\n`);
        socket.write(`Heap Total: ${(mem.heapTotal / 1024 / 1024).toFixed(2)} MB\n`);
        socket.write(`Heap Used: ${(mem.heapUsed / 1024 / 1024).toFixed(2)} MB\n`);
        socket.write(`External: ${(mem.external / 1024 / 1024).toFixed(2)} MB\n`);
        socket.write('='.repeat(50) + '\n\n');
    }
    
    stop() {
        if (this.server) {
            this.server.close(() => {
                console.log('✅ Server chiuso');
            });
        }
    }
}

// Benchmark
async function benchmark() {
    console.log('='.repeat(60));
    console.log('BUFFER POOLING BENCHMARK');
    console.log('='.repeat(60) + '\n');
    
    const iterations = 10000;
    const bufferSize = 8192;
    
    // Test 1: Senza pooling
    console.log('📝 Test 1: Standard allocation (no pooling)');
    
    const start1 = Date.now();
    const mem1Start = process.memoryUsage();
    
    for (let i = 0; i < iterations; i++) {
        const buffer = Buffer.allocUnsafe(bufferSize);
        buffer.fill(0);
    }
    
    const time1 = Date.now() - start1;
    const mem1End = process.memoryUsage();
    
    console.log(`  Time: ${time1}ms`);
    console.log(`  Heap delta: ${((mem1End.heapUsed - mem1Start.heapUsed) / 1024 / 1024).toFixed(2)} MB\n`);
    
    // Force GC se disponibile
    if (global.gc) {
        global.gc();
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Test 2: Con pooling
    console.log('📝 Test 2: Buffer pooling');
    
    const pool = new BufferPool(bufferSize, 100);
    
    const start2 = Date.now();
    const mem2Start = process.memoryUsage();
    
    for (let i = 0; i < iterations; i++) {
        const buffer = pool.acquire();
        buffer.fill(0);
        pool.release(buffer);
    }
    
    const time2 = Date.now() - start2;
    const mem2End = process.memoryUsage();
    
    console.log(`  Time: ${time2}ms`);
    console.log(`  Heap delta: ${((mem2End.heapUsed - mem2Start.heapUsed) / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  Pool stats:`, pool.getStats());
    
    // Risultati
    console.log('\n' + '='.repeat(60));
    console.log('RESULTS');
    console.log('='.repeat(60));
    console.log(`Speedup: ${(time1 / time2).toFixed(2)}x faster with pooling`);
    console.log(`Pool hit rate: ${pool.getStats().poolHitRate}%`);
    console.log('='.repeat(60) + '\n');
}

// Main
if (require.main === module) {
    const mode = process.argv[2];
    
    if (mode === 'benchmark') {
        benchmark().catch(console.error);
    } else if (mode === 'standard') {
        const server = new OptimizedServer(3400, false);
        server.start();
        
        process.on('SIGINT', () => {
            console.log('\n\n🛑 Shutdown...');
            server.stop();
            process.exit(0);
        });
    } else {
        // Default: optimized
        const server = new OptimizedServer(3400, true);
        server.start();
        
        setInterval(() => {
            const stats = server.bufferPool ? server.bufferPool.getStats() : {};
            console.log(`\n📊 Pool: ${stats.poolSize || 0} buffers, Hit rate: ${stats.poolHitRate || 0}%`);
        }, 30000);
        
        process.on('SIGINT', () => {
            console.log('\n\n🛑 Shutdown...');
            if (server.bufferPool) {
                console.log('📊 Final pool stats:', server.bufferPool.getStats());
            }
            server.stop();
            process.exit(0);
        });
    }
}
