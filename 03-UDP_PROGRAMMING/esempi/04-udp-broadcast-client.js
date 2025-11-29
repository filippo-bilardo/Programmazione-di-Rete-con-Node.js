/**
 * UDP Broadcast Client - Service Discovery
 * 
 * Caratteristiche:
 * - Invia richiesta broadcast
 * - Riceve risposte da multiple server
 * - Timeout per terminare discovery
 * 
 * Uso: node 04-udp-broadcast-client.js
 */

const dgram = require('dgram');

const client = dgram.createSocket('udp4');
const BROADCAST_PORT = 41235;
const BROADCAST_ADDRESS = '255.255.255.255';
const TIMEOUT = 3000; // 3 secondi per ricevere risposte

const discoveredServices = [];

client.on('message', (msg, rinfo) => {
    try {
        const serviceInfo = JSON.parse(msg.toString());
        
        console.log(`\n📥 Servizio scoperto da ${rinfo.address}:${rinfo.port}`);
        console.log(`   Nome: ${serviceInfo.name}`);
        console.log(`   Versione: ${serviceInfo.version}`);
        console.log(`   Hostname: ${serviceInfo.hostname}`);
        console.log(`   Interfacce:`, serviceInfo.interfaces);
        
        discoveredServices.push({
            ...serviceInfo,
            responder: rinfo.address,
            responderPort: rinfo.port
        });
    } catch (err) {
        console.error('❌ Errore parsing risposta:', err.message);
    }
});

client.on('error', (err) => {
    console.error('❌ Errore:', err);
    client.close();
});

// Bind e abilita broadcast
client.bind(() => {
    client.setBroadcast(true);
    
    console.log('📡 Invio richiesta broadcast...');
    console.log(`   Indirizzo: ${BROADCAST_ADDRESS}:${BROADCAST_PORT}`);
    console.log(`   Attesa risposte per ${TIMEOUT}ms...\n`);
    
    // Invia richiesta DISCOVER
    const message = Buffer.from('DISCOVER');
    client.send(message, BROADCAST_PORT, BROADCAST_ADDRESS, (err) => {
        if (err) {
            console.error('❌ Errore invio broadcast:', err);
            client.close();
            return;
        }
        
        console.log('✅ Richiesta broadcast inviata');
    });
    
    // Timeout: termina discovery
    setTimeout(() => {
        console.log('\n⏰ Timeout discovery');
        console.log(`\n📊 Totale servizi scoperti: ${discoveredServices.length}`);
        
        if (discoveredServices.length > 0) {
            console.log('\nElenco servizi:');
            discoveredServices.forEach((service, index) => {
                console.log(`\n${index + 1}. ${service.name}`);
                console.log(`   Responder: ${service.responder}:${service.responderPort}`);
                console.log(`   Hostname: ${service.hostname}`);
            });
        } else {
            console.log('\n⚠️  Nessun servizio trovato');
        }
        
        client.close();
    }, TIMEOUT);
});
