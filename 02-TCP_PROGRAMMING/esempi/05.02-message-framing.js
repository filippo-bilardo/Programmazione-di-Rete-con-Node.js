/**
 * 05.02 - Message Framing with Length-Prefix
 * 
 * Implementazione di message framing con prefisso di lunghezza.
 * Dimostra come gestire messaggi di dimensione variabile sul socket TCP.
 * 
 * Protocollo: [4 bytes length][message bytes]
 */

const net = require('net');

// ===== FRAMING UTILITIES =====
class MessageFraming {
    static encode(message) {
        const buffer = Buffer.from(message, 'utf-8');
        const length = buffer.length;
        
        // Crea buffer con length prefix (4 bytes)
        const frame = Buffer.allocUnsafe(4 + length);
        frame.writeUInt32BE(length, 0);
        buffer.copy(frame, 4);
        
        return frame;
    }
    
    static createDecoder() {
        let buffer = Buffer.alloc(0);
        
        return {
            push(data) {
                buffer = Buffer.concat([buffer, data]);
            },
            
            *read() {
                while (buffer.length >= 4) {
                    // Leggi lunghezza
                    const length = buffer.readUInt32BE(0);
                    
                    // Verifica se abbiamo il messaggio completo
                    if (buffer.length >= 4 + length) {
                        const message = buffer.slice(4, 4 + length).toString('utf-8');
                        buffer = buffer.slice(4 + length);
                        yield message;
                    } else {
                        // Messaggio incompleto
                        break;
                    }
                }
            }
        };
    }
}

// ===== SERVER =====
class FramingServer {
    constructor(port = 3201) {
        this.port = port;
        this.server = null;
        this.stats = {
            connections: 0,
            messagesReceived: 0,
            messagesSent: 0,
            bytesReceived: 0,
            bytesSent: 0
        };
    }
    
    start() {
        this.server = net.createServer((socket) => {
            const connId = ++this.stats.connections;
            const decoder = MessageFraming.createDecoder();
            
            console.log(`📥 [${connId}] Client connesso`);
            
            socket.on('data', (data) => {
                this.stats.bytesReceived += data.length;
                
                // Aggiungi dati al decoder
                decoder.push(data);
                
                // Leggi messaggi completi
                for (const message of decoder.read()) {
                    this.stats.messagesReceived++;
                    console.log(`📨 [${connId}] Received (${message.length} chars): "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`);
                    
                    // Echo back
                    const response = `Echo: ${message}`;
                    const frame = MessageFraming.encode(response);
                    
                    socket.write(frame);
                    this.stats.messagesSent++;
                    this.stats.bytesSent += frame.length;
                }
            });
            
            socket.on('close', () => {
                console.log(`👋 [${connId}] Client disconnesso`);
            });
            
            socket.on('error', (err) => {
                console.error(`❌ [${connId}] Errore:`, err.message);
            });
        });
        
        this.server.listen(this.port, () => {
            console.log(`✅ Framing Server avviato su porta ${this.port}\n`);
        });
    }
    
    getStats() {
        return { ...this.stats };
    }
    
    stop() {
        if (this.server) {
            this.server.close(() => {
                console.log('✅ Server chiuso');
            });
        }
    }
}

// ===== CLIENT =====
class FramingClient {
    constructor(host = 'localhost', port = 3201) {
        this.host = host;
        this.port = port;
        this.socket = null;
        this.decoder = null;
        this.messageCallback = null;
    }
    
    connect() {
        return new Promise((resolve, reject) => {
            console.log(`🔌 Connessione a ${this.host}:${this.port}...`);
            
            this.socket = net.connect({
                host: this.host,
                port: this.port
            });
            
            this.decoder = MessageFraming.createDecoder();
            
            this.socket.on('connect', () => {
                console.log('✅ Connesso!\n');
                this.setupHandlers();
                resolve();
            });
            
            this.socket.on('error', (err) => {
                console.error('❌ Errore:', err.message);
                reject(err);
            });
        });
    }
    
    setupHandlers() {
        this.socket.on('data', (data) => {
            this.decoder.push(data);
            
            for (const message of this.decoder.read()) {
                if (this.messageCallback) {
                    this.messageCallback(message);
                }
            }
        });
        
        this.socket.on('close', () => {
            console.log('\n👋 Connessione chiusa');
        });
    }
    
    onMessage(callback) {
        this.messageCallback = callback;
    }
    
    send(message) {
        const frame = MessageFraming.encode(message);
        this.socket.write(frame);
        console.log(`📤 Sent (${message.length} chars): "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`);
    }
    
    disconnect() {
        if (this.socket) {
            this.socket.end();
        }
    }
}

// ===== DEMO =====
async function demo() {
    console.log('='.repeat(60));
    console.log('MESSAGE FRAMING DEMO (Length-Prefix Protocol)');
    console.log('='.repeat(60));
    console.log('Protocollo: [4 bytes length][message bytes]\n');
    
    // Avvia server
    const server = new FramingServer(3201);
    server.start();
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Avvia client
    const client = new FramingClient('localhost', 3201);
    
    client.onMessage((message) => {
        console.log(`📥 Received (${message.length} chars): "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"\n`);
    });
    
    await client.connect();
    
    // Test 1: Messaggi brevi
    console.log('📝 Test 1: Messaggi brevi\n');
    
    client.send('Hello');
    await new Promise(resolve => setTimeout(resolve, 500));
    
    client.send('World');
    await new Promise(resolve => setTimeout(resolve, 500));
    
    client.send('This is a short message');
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Test 2: Messaggio lungo
    console.log('\n📝 Test 2: Messaggio lungo\n');
    
    const longMessage = 'A'.repeat(1000);
    client.send(longMessage);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test 3: Unicode e caratteri speciali
    console.log('\n📝 Test 3: Unicode e caratteri speciali\n');
    
    client.send('Hello 世界 🌍');
    await new Promise(resolve => setTimeout(resolve, 500));
    
    client.send('{"type":"json","value":123}');
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Test 4: Burst di messaggi
    console.log('\n📝 Test 4: Burst di messaggi (10 messaggi velocemente)\n');
    
    for (let i = 1; i <= 10; i++) {
        client.send(`Burst message ${i}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test 5: Messaggio molto grande
    console.log('\n📝 Test 5: Messaggio molto grande (10KB)\n');
    
    const bigMessage = 'X'.repeat(10000);
    client.send(bigMessage);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Statistiche
    console.log('\n' + '='.repeat(60));
    console.log('📊 SERVER STATISTICS');
    console.log('='.repeat(60));
    const stats = server.getStats();
    console.log(`Connections: ${stats.connections}`);
    console.log(`Messages RX: ${stats.messagesReceived}`);
    console.log(`Messages TX: ${stats.messagesSent}`);
    console.log(`Bytes RX: ${stats.bytesReceived} (${(stats.bytesReceived / 1024).toFixed(2)} KB)`);
    console.log(`Bytes TX: ${stats.bytesSent} (${(stats.bytesSent / 1024).toFixed(2)} KB)`);
    console.log('='.repeat(60) + '\n');
    
    // Test 6: Verifica framing con raw bytes
    console.log('📝 Test 6: Verifica framing\n');
    
    const testMessage = 'Test';
    const frame = MessageFraming.encode(testMessage);
    
    console.log(`Message: "${testMessage}"`);
    console.log(`Length: ${testMessage.length} bytes`);
    console.log(`Frame length: ${frame.length} bytes (4 header + ${testMessage.length} body)`);
    console.log(`Frame hex: ${frame.toString('hex')}`);
    console.log(`  Header (length): ${frame.readUInt32BE(0)}`);
    console.log(`  Body: "${frame.slice(4).toString('utf-8')}"\n`);
    
    // Chiudi
    console.log('👋 Chiusura...');
    client.disconnect();
    
    setTimeout(() => {
        server.stop();
        process.exit(0);
    }, 1000);
}

// Avvia
if (require.main === module) {
    const mode = process.argv[2];
    
    if (mode === 'server') {
        const server = new FramingServer(3201);
        server.start();
        
        // Report periodico
        setInterval(() => {
            const stats = server.getStats();
            console.log(`\n📊 Stats: ${stats.messagesReceived} RX, ${stats.messagesSent} TX, ${(stats.bytesReceived / 1024).toFixed(2)} KB RX`);
        }, 10000);
        
        process.on('SIGINT', () => {
            console.log('\n\n🛑 Shutdown...');
            const stats = server.getStats();
            console.log('📊 Final stats:', stats);
            server.stop();
            process.exit(0);
        });
    } else if (mode === 'client') {
        (async () => {
            const client = new FramingClient('localhost', 3201);
            
            client.onMessage((message) => {
                console.log(`📥 ${message}\n`);
            });
            
            await client.connect();
            
            const readline = require('readline');
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout,
                prompt: '> '
            });
            
            console.log('💡 Digita messaggi da inviare (exit per uscire)\n');
            rl.prompt();
            
            rl.on('line', (line) => {
                if (line.trim() === 'exit') {
                    client.disconnect();
                    rl.close();
                    return;
                }
                
                client.send(line);
            });
        })();
    } else {
        demo().catch(console.error);
    }
}
