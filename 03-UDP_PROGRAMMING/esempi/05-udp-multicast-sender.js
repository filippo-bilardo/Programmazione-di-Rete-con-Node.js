/**
 * UDP Multicast Sender - Streaming Dati
 * 
 * Caratteristiche:
 * - Invia dati a gruppo multicast
 * - Simula stream di dati (sensori, metriche)
 * - Multiple subscriber possono ricevere
 * 
 * Uso: node 05-udp-multicast-sender.js [intervallo_ms]
 */

const dgram = require('dgram');

const sender = dgram.createSocket('udp4');

// Configurazione multicast
const MULTICAST_ADDRESS = '239.255.0.1';
const MULTICAST_PORT = 41236;
const INTERVAL = parseInt(process.argv[2]) || 1000; // Default 1 secondo

let messageCount = 0;

// Simula lettura sensore
function generateSensorData() {
    return {
        id: messageCount++,
        timestamp: Date.now(),
        sensor: 'TEMP-001',
        temperature: (20 + Math.random() * 10).toFixed(2),
        humidity: (40 + Math.random() * 30).toFixed(2),
        pressure: (1000 + Math.random() * 50).toFixed(2)
    };
}

// Invia dati periodicamente
function sendData() {
    const data = generateSensorData();
    const message = JSON.stringify(data);
    const buffer = Buffer.from(message);
    
    sender.send(buffer, MULTICAST_PORT, MULTICAST_ADDRESS, (err) => {
        if (err) {
            console.error('❌ Errore invio:', err);
        } else {
            console.log(`📤 [${data.id}] Inviato: T=${data.temperature}°C H=${data.humidity}% P=${data.pressure}hPa`);
        }
    });
}

sender.on('listening', () => {
    // Imposta TTL per multicast
    sender.setMulticastTTL(128);
    
    console.log(`✅ Multicast Sender avviato`);
    console.log(`📡 Gruppo: ${MULTICAST_ADDRESS}:${MULTICAST_PORT}`);
    console.log(`⏱️  Intervallo: ${INTERVAL}ms`);
    console.log(`\nInvio dati sensore...\n`);
    
    // Invia primo messaggio subito
    sendData();
    
    // Poi continua periodicamente
    const intervalId = setInterval(sendData, INTERVAL);
    
    // Cleanup
    process.on('SIGINT', () => {
        console.log('\n\n⏹️  Arresto sender...');
        clearInterval(intervalId);
        sender.close();
        console.log(`📊 Totale messaggi inviati: ${messageCount}`);
        process.exit(0);
    });
});

sender.on('error', (err) => {
    console.error('❌ Errore:', err);
    sender.close();
});

sender.bind();
