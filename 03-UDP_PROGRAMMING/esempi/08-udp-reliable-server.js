/**
 * UDP Reliable Server - Con ACK
 * 
 * Caratteristiche:
 * - Riceve messaggi con sequence number
 * - Invia ACK per conferma
 * - Rileva duplicati
 * - Gestisce ordine messaggi
 * 
 * Uso: node 08-udp-reliable-server.js
 */

const dgram = require('dgram');

class ReliableUDPServer {
    constructor(port) {
        this.port = port;
        this.socket = dgram.createSocket('udp4');
        this.receivedSequences = new Map(); // client -> Set(seq)
        
        this.stats = {
            received: 0,
            duplicates: 0,
            outOfOrder: 0
        };
        
        this.setupHandlers();
    }
    
    setupHandlers() {
        this.socket.on('message', (msg, rinfo) => {
            try {
                const message = JSON.parse(msg.toString());
                this.handleMessage(message, rinfo);
            } catch (err) {
                console.error('❌ Errore parsing messaggio:', err.message);
            }
        });
        
        this.socket.on('listening', () => {
            const address = this.socket.address();
            console.log(`✅ Reliable UDP Server in ascolto su ${address.address}:${address.port}\n`);
        });
        
        this.socket.on('error', (err) => {
            console.error('❌ Errore server:', err);
            this.socket.close();
        });
    }
    
    handleMessage(message, rinfo) {
        if (message.type !== 'DATA') return;
        
        const clientId = `${rinfo.address}:${rinfo.port}`;
        const seq = message.seq;
        
        // Inizializza set per client
        if (!this.receivedSequences.has(clientId)) {
            this.receivedSequences.set(clientId, new Set());
        }
        
        const clientSeqs = this.receivedSequences.get(clientId);
        
        // Rileva duplicato
        if (clientSeqs.has(seq)) {
            this.stats.duplicates++;
            console.log(`⚠️  Duplicato: seq=${seq} da ${clientId}`);
        } else {
            // Nuovo messaggio
            clientSeqs.add(seq);
            this.stats.received++;
            
            // Rileva out-of-order
            const maxSeq = Math.max(...clientSeqs);
            if (seq < maxSeq) {
                this.stats.outOfOrder++;
                console.log(`⚠️  Out-of-order: seq=${seq} (max=${maxSeq})`);
            }
            
            console.log(`📥 Ricevuto seq=${seq} da ${clientId}`);
            console.log(`   Dati: "${message.data}"`);
        }
        
        // Invia sempre ACK (anche per duplicati)
        this.sendAck(seq, rinfo);
    }
    
    sendAck(seq, rinfo) {
        const ack = {
            type: 'ACK',
            seq: seq,
            timestamp: Date.now()
        };
        
        const buffer = Buffer.from(JSON.stringify(ack));
        
        this.socket.send(buffer, rinfo.port, rinfo.address, (err) => {
            if (err) {
                console.error(`❌ Errore invio ACK seq=${seq}:`, err.message);
            } else {
                console.log(`📤 ACK inviato per seq=${seq}\n`);
            }
        });
    }
    
    start() {
        this.socket.bind(this.port);
    }
    
    close() {
        console.log('\n📊 Statistiche finali:');
        console.log(`   Messaggi ricevuti: ${this.stats.received}`);
        console.log(`   Duplicati: ${this.stats.duplicates}`);
        console.log(`   Out-of-order: ${this.stats.outOfOrder}`);
        
        this.socket.close();
    }
}

// Avvia server
const server = new ReliableUDPServer(41237);
server.start();

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\n⏹️  Arresto server...');
    server.close();
    console.log('🛑 Server chiuso');
    process.exit(0);
});
