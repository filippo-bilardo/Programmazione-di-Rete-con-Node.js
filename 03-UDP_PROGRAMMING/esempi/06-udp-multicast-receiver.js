/**
 * UDP Multicast Receiver - Subscriber
 * 
 * Caratteristiche:
 * - Si iscrive a gruppo multicast
 * - Riceve stream dati
 * - Calcola statistiche ricezione
 * 
 * Uso: node 06-udp-multicast-receiver.js
 */

const dgram = require('dgram');

const receiver = dgram.createSocket({ type: 'udp4', reuseAddr: true });

// Configurazione multicast
const MULTICAST_ADDRESS = '239.255.0.1';
const MULTICAST_PORT = 41236;

// Statistiche
const stats = {
    received: 0,
    lastId: -1,
    lost: 0,
    startTime: null
};

receiver.on('message', (msg, rinfo) => {
    try {
        const data = JSON.parse(msg.toString());
        
        // Prima ricezione
        if (stats.startTime === null) {
            stats.startTime = Date.now();
        }
        
        // Rileva packet loss (gap negli ID)
        if (stats.lastId !== -1 && data.id !== stats.lastId + 1) {
            const lost = data.id - stats.lastId - 1;
            stats.lost += lost;
            console.log(`⚠️  Packet loss rilevato: ${lost} messaggi persi`);
        }
        
        stats.received++;
        stats.lastId = data.id;
        
        // Visualizza dati
        console.log(`📥 [${data.id}] T=${data.temperature}°C H=${data.humidity}% P=${data.pressure}hPa`);
        
    } catch (err) {
        console.error('❌ Errore parsing messaggio:', err.message);
    }
});

receiver.on('listening', () => {
    const address = receiver.address();
    
    // Iscriviti al gruppo multicast
    receiver.addMembership(MULTICAST_ADDRESS);
    
    console.log(`✅ Multicast Receiver in ascolto su ${address.address}:${address.port}`);
    console.log(`📡 Iscritto al gruppo: ${MULTICAST_ADDRESS}`);
    console.log(`\nRicezione dati...\n`);
});

receiver.on('error', (err) => {
    console.error('❌ Errore:', err);
    receiver.close();
});

receiver.bind(MULTICAST_PORT);

// Graceful shutdown con statistiche
process.on('SIGINT', () => {
    const duration = (Date.now() - stats.startTime) / 1000;
    const rate = (stats.received / duration).toFixed(2);
    const lossRate = ((stats.lost / (stats.received + stats.lost)) * 100).toFixed(2);
    
    console.log('\n\n⏹️  Arresto receiver...');
    console.log(`\n📊 Statistiche:`);
    console.log(`   Messaggi ricevuti: ${stats.received}`);
    console.log(`   Messaggi persi: ${stats.lost}`);
    console.log(`   Loss rate: ${lossRate}%`);
    console.log(`   Durata: ${duration.toFixed(2)}s`);
    console.log(`   Rate: ${rate} msg/s`);
    
    receiver.close();
    process.exit(0);
});
