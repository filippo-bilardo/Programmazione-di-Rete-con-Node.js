/**
 * UDP Performance Test - Benchmark Latency e Throughput
 * 
 * Caratteristiche:
 * - Misura latency (RTT)
 * - Misura throughput
 * - Rileva packet loss
 * - Genera statistiche dettagliate
 * 
 * Uso Server: node 10-udp-performance-test.js server
 * Uso Client: node 10-udp-performance-test.js client [num_packets] [packet_size]
 */

const dgram = require('dgram');

const PORT = 41239;

class PerformanceServer {
    constructor(port) {
        this.port = port;
        this.socket = dgram.createSocket('udp4');
        this.stats = {
            received: 0,
            bytes: 0,
            startTime: null
        };
    }
    
    start() {
        this.socket.on('message', (msg, rinfo) => {
            if (this.stats.startTime === null) {
                this.stats.startTime = Date.now();
            }
            
            this.stats.received++;
            this.stats.bytes += msg.length;
            
            // Echo immediato
            this.socket.send(msg, rinfo.port, rinfo.address);
        });
        
        this.socket.on('listening', () => {
            console.log(`✅ Performance Server in ascolto su porta ${this.port}`);
            console.log('⏳ In attesa di client...\n');
        });
        
        this.socket.bind(this.port);
    }
}

class PerformanceClient {
    constructor(host, port, numPackets, packetSize) {
        this.host = host;
        this.port = port;
        this.numPackets = numPackets;
        this.packetSize = packetSize;
        this.socket = dgram.createSocket('udp4');
        
        this.sent = 0;
        this.received = 0;
        this.latencies = [];
        this.startTime = null;
        this.pendingPackets = new Map();
    }
    
    async run() {
        this.setupHandlers();
        
        console.log(`🚀 UDP Performance Test`);
        console.log(`📊 Packets: ${this.numPackets}`);
        console.log(`📦 Size: ${this.packetSize} bytes`);
        console.log(`🎯 Target: ${this.host}:${this.port}\n`);
        
        this.startTime = Date.now();
        
        // Invia tutti i packet
        for (let i = 0; i < this.numPackets; i++) {
            await this.sendPacket(i);
            
            // Progress ogni 100 packets
            if ((i + 1) % 100 === 0) {
                console.log(`📤 Inviati ${i + 1}/${this.numPackets} packets`);
            }
        }
        
        console.log(`\n✅ Invio completato, in attesa risposte...\n`);
        
        // Attendi tutte le risposte (con timeout)
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        this.showResults();
        this.socket.close();
    }
    
    setupHandlers() {
        this.socket.on('message', (msg, rinfo) => {
            const data = JSON.parse(msg.toString());
            const sentTime = this.pendingPackets.get(data.id);
            
            if (sentTime) {
                const rtt = Date.now() - sentTime;
                this.latencies.push(rtt);
                this.received++;
                this.pendingPackets.delete(data.id);
            }
        });
    }
    
    sendPacket(id) {
        return new Promise((resolve) => {
            const data = {
                id: id,
                timestamp: Date.now(),
                payload: 'x'.repeat(this.packetSize - 50) // Padding
            };
            
            const buffer = Buffer.from(JSON.stringify(data));
            this.pendingPackets.set(id, Date.now());
            
            this.socket.send(buffer, this.port, this.host, (err) => {
                if (err) {
                    console.error(`❌ Errore invio packet ${id}:`, err.message);
                }
                this.sent++;
                resolve();
            });
        });
    }
    
    showResults() {
        const duration = (Date.now() - this.startTime) / 1000;
        const lost = this.sent - this.received;
        const lossRate = (lost / this.sent * 100).toFixed(2);
        
        // Calcola statistiche latency
        const avgLatency = this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length;
        const minLatency = Math.min(...this.latencies);
        const maxLatency = Math.max(...this.latencies);
        
        // Percentili
        const sorted = this.latencies.sort((a, b) => a - b);
        const p50 = sorted[Math.floor(sorted.length * 0.50)];
        const p95 = sorted[Math.floor(sorted.length * 0.95)];
        const p99 = sorted[Math.floor(sorted.length * 0.99)];
        
        // Throughput
        const totalBytes = this.sent * this.packetSize;
        const throughputMBps = (totalBytes / duration / 1024 / 1024).toFixed(2);
        const packetsPerSec = (this.sent / duration).toFixed(2);
        
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📊 RISULTATI PERFORMANCE TEST');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        
        console.log('📦 Packets:');
        console.log(`   Inviati:   ${this.sent}`);
        console.log(`   Ricevuti:  ${this.received}`);
        console.log(`   Persi:     ${lost} (${lossRate}%)\n`);
        
        console.log('⏱️  Latency (RTT):');
        console.log(`   Min:       ${minLatency.toFixed(2)} ms`);
        console.log(`   Avg:       ${avgLatency.toFixed(2)} ms`);
        console.log(`   Max:       ${maxLatency.toFixed(2)} ms`);
        console.log(`   P50:       ${p50.toFixed(2)} ms`);
        console.log(`   P95:       ${p95.toFixed(2)} ms`);
        console.log(`   P99:       ${p99.toFixed(2)} ms\n`);
        
        console.log('📈 Throughput:');
        console.log(`   Durata:    ${duration.toFixed(2)} s`);
        console.log(`   Rate:      ${packetsPerSec} packets/s`);
        console.log(`   Bandwidth: ${throughputMBps} MB/s`);
        
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }
}

// Main
const mode = process.argv[2];

if (mode === 'server') {
    const server = new PerformanceServer(PORT);
    server.start();
    
    process.on('SIGINT', () => {
        const duration = (Date.now() - server.stats.startTime) / 1000;
        const throughput = (server.stats.bytes / duration / 1024 / 1024).toFixed(2);
        const packetsPerSec = (server.stats.received / duration).toFixed(2);
        
        console.log('\n\n📊 Statistiche Server:');
        console.log(`   Packets ricevuti: ${server.stats.received}`);
        console.log(`   Bytes ricevuti: ${server.stats.bytes}`);
        console.log(`   Durata: ${duration.toFixed(2)} s`);
        console.log(`   Rate: ${packetsPerSec} packets/s`);
        console.log(`   Throughput: ${throughput} MB/s`);
        
        server.socket.close();
        process.exit(0);
    });
    
} else if (mode === 'client') {
    const numPackets = parseInt(process.argv[3]) || 1000;
    const packetSize = parseInt(process.argv[4]) || 512;
    
    const client = new PerformanceClient('localhost', PORT, numPackets, packetSize);
    client.run();
    
} else {
    console.log('Uso:');
    console.log('  Server: node 10-udp-performance-test.js server');
    console.log('  Client: node 10-udp-performance-test.js client [num_packets] [packet_size]');
    console.log('\nEsempio:');
    console.log('  node 10-udp-performance-test.js client 1000 512');
    process.exit(1);
}
