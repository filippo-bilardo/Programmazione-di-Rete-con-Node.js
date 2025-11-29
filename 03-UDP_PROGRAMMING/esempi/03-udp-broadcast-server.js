/**
 * UDP Broadcast Server - Service Discovery
 * 
 * Caratteristiche:
 * - Risponde a richieste broadcast
 * - Implementa service discovery
 * - Gestisce multiple richieste
 * 
 * Uso: node 03-udp-broadcast-server.js
 */

const dgram = require('dgram');
const os = require('os');

const server = dgram.createSocket('udp4');
const PORT = 41235;

// Informazioni sul servizio
const SERVICE_INFO = {
    name: 'UDP Example Service',
    version: '1.0.0',
    timestamp: Date.now(),
    hostname: os.hostname(),
    interfaces: getNetworkInterfaces()
};

// Ottieni interfacce di rete
function getNetworkInterfaces() {
    const interfaces = os.networkInterfaces();
    const addresses = [];
    
    for (const name in interfaces) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                addresses.push({
                    name: name,
                    address: iface.address
                });
            }
        }
    }
    
    return addresses;
}

server.on('message', (msg, rinfo) => {
    const request = msg.toString().trim();
    
    console.log(`📥 Richiesta discovery da ${rinfo.address}:${rinfo.port}`);
    console.log(`   Messaggio: "${request}"`);
    
    if (request === 'DISCOVER') {
        // Risposta con info servizio
        const response = JSON.stringify(SERVICE_INFO);
        const buffer = Buffer.from(response);
        
        server.send(buffer, rinfo.port, rinfo.address, (err) => {
            if (err) {
                console.error('❌ Errore invio risposta:', err);
            } else {
                console.log(`📤 Info servizio inviata a ${rinfo.address}:${rinfo.port}`);
            }
        });
    } else {
        console.log(`⚠️  Richiesta non riconosciuta: "${request}"`);
    }
});

server.on('listening', () => {
    const address = server.address();
    
    // Abilita broadcast
    server.setBroadcast(true);
    
    console.log(`✅ Broadcast Server in ascolto su ${address.address}:${address.port}`);
    console.log(`📡 Broadcast abilitato`);
    console.log(`\nInfo servizio:`);
    console.log(JSON.stringify(SERVICE_INFO, null, 2));
});

server.on('error', (err) => {
    console.error('❌ Errore server:', err);
    server.close();
});

server.bind(PORT);

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n⏹️  Chiusura server...');
    server.close();
    process.exit(0);
});
