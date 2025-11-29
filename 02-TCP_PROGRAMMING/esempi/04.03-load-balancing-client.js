/**
 * 04.03 - Load Balancing Client
 * 
 * Client che distribuisce le richieste tra multiple istanze di server.
 * Dimostra strategie di load balancing: round-robin, least-connections, random.
 * 
 * Utilizzo:
 *   node 04.03-load-balancing-client.js
 * 
 * Prerequisito:
 *   Avvia più server su porte diverse:
 *   - node 01.01-echo-server.js (porta 3000)
 *   - PORT=3001 node 01.01-echo-server.js
 *   - PORT=3002 node 01.01-echo-server.js
 */

const net = require('net');

// Configurazione server backend
const BACKENDS = [
    { host: 'localhost', port: 3000, name: 'Server-1' },
    { host: 'localhost', port: 3001, name: 'Server-2' },
    { host: 'localhost', port: 3002, name: 'Server-3' }
];

// Strategia di bilanciamento
const STRATEGY = process.argv[2] || 'round-robin'; // round-robin, least-connections, random, weighted

// Statistiche per backend
const backendStats = new Map();
BACKENDS.forEach((backend, idx) => {
    backendStats.set(idx, {
        ...backend,
        requests: 0,
        activeConnections: 0,
        errors: 0,
        totalResponseTime: 0,
        available: true,
        weight: idx === 0 ? 3 : (idx === 1 ? 2 : 1) // Pesi per weighted strategy
    });
});

// Stato per round-robin
let currentIndex = 0;

// Seleziona backend
function selectBackend() {
    const available = Array.from(backendStats.entries())
        .filter(([_, stats]) => stats.available);
    
    if (available.length === 0) {
        throw new Error('Nessun backend disponibile');
    }
    
    let selectedIdx;
    
    switch (STRATEGY) {
        case 'round-robin':
            // Round-robin: cicla tra i server disponibili
            selectedIdx = currentIndex % available.length;
            currentIndex = (currentIndex + 1) % available.length;
            return available[selectedIdx][0];
        
        case 'least-connections':
            // Least connections: sceglie il server con meno connessioni attive
            available.sort((a, b) => a[1].activeConnections - b[1].activeConnections);
            return available[0][0];
        
        case 'random':
            // Random: sceglie casualmente
            return available[Math.floor(Math.random() * available.length)][0];
        
        case 'weighted':
            // Weighted: sceglie in base ai pesi
            const totalWeight = available.reduce((sum, [_, stats]) => sum + stats.weight, 0);
            let random = Math.random() * totalWeight;
            
            for (const [idx, stats] of available) {
                random -= stats.weight;
                if (random <= 0) {
                    return idx;
                }
            }
            return available[0][0];
        
        default:
            return available[0][0];
    }
}

// Invia richiesta a backend
async function sendRequest(message) {
    const backendIdx = selectBackend();
    const stats = backendStats.get(backendIdx);
    const backend = BACKENDS[backendIdx];
    
    const startTime = Date.now();
    stats.requests++;
    stats.activeConnections++;
    
    console.log(`📤 [${backend.name}] Sending: "${message}" (connections: ${stats.activeConnections})`);
    
    return new Promise((resolve, reject) => {
        const client = net.connect({
            host: backend.host,
            port: backend.port,
            timeout: 5000
        });
        
        let response = '';
        
        client.on('connect', () => {
            client.write(message + '\n');
        });
        
        client.on('data', (data) => {
            response += data.toString();
            
            // Assumiamo risposta completa con \n
            if (response.includes('\n')) {
                const responseTime = Date.now() - startTime;
                stats.totalResponseTime += responseTime;
                stats.activeConnections--;
                
                console.log(`📥 [${backend.name}] Response: "${response.trim()}" (${responseTime}ms)`);
                
                client.end();
                resolve({ backend: backend.name, response: response.trim(), responseTime });
            }
        });
        
        client.on('error', (err) => {
            stats.errors++;
            stats.activeConnections--;
            
            console.error(`❌ [${backend.name}] Error: ${err.message}`);
            
            // Marca backend come non disponibile
            if (err.code === 'ECONNREFUSED') {
                stats.available = false;
                console.log(`⚠️  [${backend.name}] Marcato come non disponibile`);
                
                // Riprova dopo 10 secondi
                setTimeout(() => {
                    stats.available = true;
                    console.log(`✅ [${backend.name}] Marcato come disponibile`);
                }, 10000);
            }
            
            reject(err);
        });
        
        client.on('timeout', () => {
            console.error(`⏰ [${backend.name}] Timeout`);
            client.destroy();
            stats.activeConnections--;
        });
    });
}

// Stampa statistiche
function printStats() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 LOAD BALANCING STATISTICS');
    console.log('='.repeat(60));
    console.log(`Strategy: ${STRATEGY}\n`);
    
    let totalRequests = 0;
    let totalErrors = 0;
    
    for (const [idx, stats] of backendStats) {
        totalRequests += stats.requests;
        totalErrors += stats.errors;
        
        const avgResponseTime = stats.requests > 0 
            ? (stats.totalResponseTime / stats.requests).toFixed(2)
            : 0;
        
        const successRate = stats.requests > 0
            ? (((stats.requests - stats.errors) / stats.requests) * 100).toFixed(1)
            : 0;
        
        console.log(`${stats.name}:`);
        console.log(`  Status: ${stats.available ? '✅ Available' : '❌ Unavailable'}`);
        console.log(`  Requests: ${stats.requests} (${((stats.requests / (totalRequests || 1)) * 100).toFixed(1)}%)`);
        console.log(`  Active: ${stats.activeConnections}`);
        console.log(`  Errors: ${stats.errors}`);
        console.log(`  Success Rate: ${successRate}%`);
        console.log(`  Avg Response: ${avgResponseTime}ms`);
        if (STRATEGY === 'weighted') {
            console.log(`  Weight: ${stats.weight}`);
        }
        console.log();
    }
    
    console.log(`Total Requests: ${totalRequests}`);
    console.log(`Total Errors: ${totalErrors}`);
    console.log('='.repeat(60) + '\n');
}

// Demo
async function demo() {
    console.log('='.repeat(60));
    console.log('LOAD BALANCING CLIENT');
    console.log('='.repeat(60));
    console.log(`Strategy: ${STRATEGY}`);
    console.log(`Backends: ${BACKENDS.length}`);
    BACKENDS.forEach((b, i) => {
        const stats = backendStats.get(i);
        console.log(`  [${i}] ${b.name}: ${b.host}:${b.port}${STRATEGY === 'weighted' ? ` (weight: ${stats.weight})` : ''}`);
    });
    console.log('='.repeat(60) + '\n');
    
    console.log('💡 Avvia i server con:');
    console.log('   Terminal 1: node 01.01-echo-server.js');
    console.log('   Terminal 2: PORT=3001 node 01.01-echo-server.js');
    console.log('   Terminal 3: PORT=3002 node 01.01-echo-server.js\n');
    
    console.log('⏳ Attendo 3 secondi prima di iniziare...\n');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Test 1: Richieste sequenziali
    console.log('📝 Test 1: 10 richieste sequenziali\n');
    
    for (let i = 1; i <= 10; i++) {
        try {
            await sendRequest(`Request ${i}`);
            await new Promise(resolve => setTimeout(resolve, 500));
        } catch (err) {
            console.error(`❌ Request ${i} failed:`, err.message);
        }
    }
    
    printStats();
    
    // Test 2: Richieste parallele
    console.log('📝 Test 2: 15 richieste parallele\n');
    
    const requests = [];
    for (let i = 1; i <= 15; i++) {
        requests.push(
            sendRequest(`Parallel ${i}`)
                .catch(err => console.error(`❌ Parallel ${i} failed:`, err.message))
        );
    }
    
    await Promise.all(requests);
    
    printStats();
    
    // Test 3: Burst con ritardo
    console.log('📝 Test 3: 20 richieste con burst\n');
    
    for (let i = 1; i <= 20; i++) {
        sendRequest(`Burst ${i}`).catch(err => {});
        
        // Piccolo ritardo casuale
        await new Promise(resolve => setTimeout(resolve, Math.random() * 200));
    }
    
    // Attendi completamento
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    printStats();
    
    console.log('✅ Demo completata\n');
}

// Esegui demo
demo().catch(err => {
    console.error('❌ Demo fallita:', err);
    process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\n🛑 Interruzione...');
    printStats();
    process.exit(0);
});
