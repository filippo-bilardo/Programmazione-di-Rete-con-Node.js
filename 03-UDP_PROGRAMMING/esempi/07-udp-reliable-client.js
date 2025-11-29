/**
 * UDP Reliable Client - Con ACK e Retry
 * 
 * Caratteristiche:
 * - Invia messaggi con sequence number
 * - Attende ACK dal server
 * - Retry automatico se no ACK
 * - Exponential backoff
 * 
 * Uso: node 07-udp-reliable-client.js
 */

const dgram = require('dgram');

class ReliableUDPClient {
    constructor(host, port) {
        this.host = host;
        this.port = port;
        this.socket = dgram.createSocket('udp4');
        this.sequenceNumber = 0;
        this.pendingMessages = new Map();
        
        this.config = {
            maxRetries: 3,
            baseTimeout: 1000,  // 1 secondo
            maxTimeout: 8000    // 8 secondi
        };
        
        this.setupHandlers();
    }
    
    setupHandlers() {
        this.socket.on('message', (msg, rinfo) => {
            try {
                const response = JSON.parse(msg.toString());
                this.handleAck(response);
            } catch (err) {
                console.error('❌ Errore parsing ACK:', err.message);
            }
        });
        
        this.socket.on('error', (err) => {
            console.error('❌ Errore socket:', err);
        });
    }
    
    handleAck(response) {
        if (response.type === 'ACK') {
            const pending = this.pendingMessages.get(response.seq);
            
            if (pending) {
                clearTimeout(pending.timeoutId);
                this.pendingMessages.delete(response.seq);
                
                const rtt = Date.now() - pending.sentAt;
                console.log(`✅ ACK ricevuto per seq=${response.seq} (RTT: ${rtt}ms)`);
            }
        }
    }
    
    send(data) {
        return new Promise((resolve, reject) => {
            const seq = this.sequenceNumber++;
            
            const message = {
                type: 'DATA',
                seq: seq,
                timestamp: Date.now(),
                data: data
            };
            
            const pending = {
                message: message,
                retries: 0,
                sentAt: null,
                timeoutId: null,
                resolve: resolve,
                reject: reject
            };
            
            this.pendingMessages.set(seq, pending);
            this.sendMessage(seq);
        });
    }
    
    sendMessage(seq) {
        const pending = this.pendingMessages.get(seq);
        
        if (!pending) return;
        
        pending.sentAt = Date.now();
        
        const buffer = Buffer.from(JSON.stringify(pending.message));
        
        this.socket.send(buffer, this.port, this.host, (err) => {
            if (err) {
                console.error(`❌ Errore invio seq=${seq}:`, err.message);
                this.handleRetry(seq);
                return;
            }
            
            console.log(`📤 Inviato seq=${seq} retry=${pending.retries}`);
            
            // Exponential backoff
            const timeout = Math.min(
                this.config.baseTimeout * Math.pow(2, pending.retries),
                this.config.maxTimeout
            );
            
            pending.timeoutId = setTimeout(() => {
                this.handleRetry(seq);
            }, timeout);
        });
    }
    
    handleRetry(seq) {
        const pending = this.pendingMessages.get(seq);
        
        if (!pending) return;
        
        pending.retries++;
        
        if (pending.retries >= this.config.maxRetries) {
            console.error(`❌ Max retry raggiunto per seq=${seq}`);
            this.pendingMessages.delete(seq);
            pending.reject(new Error(`Timeout dopo ${pending.retries} tentativi`));
            return;
        }
        
        console.log(`⚠️  Timeout seq=${seq}, retry ${pending.retries}/${this.config.maxRetries}`);
        this.sendMessage(seq);
    }
    
    close() {
        this.socket.close();
    }
}

// Test client
async function main() {
    const client = new ReliableUDPClient('localhost', 41237);
    
    console.log('🚀 Reliable UDP Client avviato\n');
    
    try {
        // Invia 5 messaggi
        for (let i = 0; i < 5; i++) {
            const data = `Message ${i + 1}`;
            console.log(`\n📝 Invio: "${data}"`);
            
            await client.send(data);
            
            // Pausa tra invii
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        console.log('\n✅ Tutti i messaggi inviati con successo');
        
    } catch (err) {
        console.error('\n❌ Errore:', err.message);
    } finally {
        setTimeout(() => {
            client.close();
            console.log('\n🛑 Client chiuso');
        }, 1000);
    }
}

main();
