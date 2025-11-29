/**
 * UDP File Transfer - Con Chunking e Reassembly
 * 
 * Caratteristiche:
 * - Split file in chunk
 * - Invia chunk con metadati
 * - Riassembla file ricevuto
 * - Gestisce packet loss
 * 
 * Uso Sender: node 09-udp-file-transfer.js send <file>
 * Uso Receiver: node 09-udp-file-transfer.js receive
 */

const dgram = require('dgram');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CHUNK_SIZE = 1024; // 1KB per chunk
const PORT = 41238;

class UDPFileSender {
    constructor(filePath, host, port) {
        this.filePath = filePath;
        this.host = host;
        this.port = port;
        this.socket = dgram.createSocket('udp4');
    }
    
    async send() {
        const fileBuffer = fs.readFileSync(this.filePath);
        const fileName = path.basename(this.filePath);
        const fileSize = fileBuffer.length;
        const totalChunks = Math.ceil(fileSize / CHUNK_SIZE);
        const checksum = crypto.createHash('md5').update(fileBuffer).digest('hex');
        
        console.log(`📄 File: ${fileName}`);
        console.log(`📊 Dimensione: ${fileSize} bytes`);
        console.log(`📦 Chunk: ${totalChunks} (${CHUNK_SIZE} bytes/chunk)`);
        console.log(`🔐 Checksum: ${checksum}\n`);
        
        // Invia metadata
        const metadata = {
            type: 'METADATA',
            fileName: fileName,
            fileSize: fileSize,
            totalChunks: totalChunks,
            chunkSize: CHUNK_SIZE,
            checksum: checksum
        };
        
        await this.sendPacket(metadata);
        console.log('✅ Metadata inviati\n');
        
        // Pausa per dare tempo al receiver di prepararsi
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Invia chunk
        for (let i = 0; i < totalChunks; i++) {
            const start = i * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, fileSize);
            const chunkData = fileBuffer.slice(start, end);
            
            const packet = {
                type: 'CHUNK',
                chunkId: i,
                totalChunks: totalChunks,
                data: chunkData.toString('base64')
            };
            
            await this.sendPacket(packet);
            
            const progress = ((i + 1) / totalChunks * 100).toFixed(1);
            console.log(`📤 Chunk ${i + 1}/${totalChunks} inviato (${progress}%)`);
            
            // Piccola pausa per non saturare
            await new Promise(resolve => setTimeout(resolve, 10));
        }
        
        // Invia END
        await this.sendPacket({ type: 'END' });
        console.log('\n✅ Trasferimento completato');
        
        this.socket.close();
    }
    
    sendPacket(data) {
        return new Promise((resolve, reject) => {
            const buffer = Buffer.from(JSON.stringify(data));
            
            this.socket.send(buffer, this.port, this.host, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }
}

class UDPFileReceiver {
    constructor(port) {
        this.port = port;
        this.socket = dgram.createSocket('udp4');
        this.chunks = new Map();
        this.metadata = null;
    }
    
    start() {
        this.socket.on('message', (msg, rinfo) => {
            try {
                const packet = JSON.parse(msg.toString());
                this.handlePacket(packet);
            } catch (err) {
                console.error('❌ Errore parsing packet:', err.message);
            }
        });
        
        this.socket.on('listening', () => {
            const address = this.socket.address();
            console.log(`✅ File Receiver in ascolto su ${address.address}:${address.port}`);
            console.log('⏳ In attesa di file...\n');
        });
        
        this.socket.bind(this.port);
    }
    
    handlePacket(packet) {
        switch (packet.type) {
            case 'METADATA':
                this.handleMetadata(packet);
                break;
            case 'CHUNK':
                this.handleChunk(packet);
                break;
            case 'END':
                this.handleEnd();
                break;
        }
    }
    
    handleMetadata(metadata) {
        this.metadata = metadata;
        console.log(`📄 File in arrivo: ${metadata.fileName}`);
        console.log(`📊 Dimensione: ${metadata.fileSize} bytes`);
        console.log(`📦 Chunk attesi: ${metadata.totalChunks}\n`);
    }
    
    handleChunk(packet) {
        this.chunks.set(packet.chunkId, packet.data);
        
        const received = this.chunks.size;
        const progress = (received / packet.totalChunks * 100).toFixed(1);
        
        console.log(`📥 Chunk ${received}/${packet.totalChunks} ricevuto (${progress}%)`);
    }
    
    handleEnd() {
        console.log('\n🔧 Riassemblaggio file...');
        
        if (!this.metadata) {
            console.error('❌ Metadata mancanti');
            return;
        }
        
        // Verifica chunk ricevuti
        const missing = [];
        for (let i = 0; i < this.metadata.totalChunks; i++) {
            if (!this.chunks.has(i)) {
                missing.push(i);
            }
        }
        
        if (missing.length > 0) {
            console.error(`❌ Chunk mancanti: ${missing.join(', ')}`);
            console.error(`   Loss rate: ${(missing.length / this.metadata.totalChunks * 100).toFixed(2)}%`);
            return;
        }
        
        // Riassembla file
        const buffers = [];
        for (let i = 0; i < this.metadata.totalChunks; i++) {
            const chunkData = this.chunks.get(i);
            buffers.push(Buffer.from(chunkData, 'base64'));
        }
        
        const fileBuffer = Buffer.concat(buffers);
        
        // Verifica checksum
        const checksum = crypto.createHash('md5').update(fileBuffer).digest('hex');
        
        if (checksum !== this.metadata.checksum) {
            console.error('❌ Checksum non corrisponde!');
            console.error(`   Atteso: ${this.metadata.checksum}`);
            console.error(`   Ricevuto: ${checksum}`);
            return;
        }
        
        // Salva file
        const outputPath = `received_${this.metadata.fileName}`;
        fs.writeFileSync(outputPath, fileBuffer);
        
        console.log(`✅ File salvato: ${outputPath}`);
        console.log(`🔐 Checksum verificato: ${checksum}`);
        console.log(`📊 Dimensione: ${fileBuffer.length} bytes`);
        
        this.socket.close();
        process.exit(0);
    }
}

// Main
const mode = process.argv[2];

if (mode === 'send') {
    const filePath = process.argv[3];
    
    if (!filePath) {
        console.error('Uso: node 09-udp-file-transfer.js send <file>');
        process.exit(1);
    }
    
    if (!fs.existsSync(filePath)) {
        console.error(`❌ File non trovato: ${filePath}`);
        process.exit(1);
    }
    
    const sender = new UDPFileSender(filePath, 'localhost', PORT);
    sender.send().catch(console.error);
    
} else if (mode === 'receive') {
    const receiver = new UDPFileReceiver(PORT);
    receiver.start();
    
} else {
    console.log('Uso:');
    console.log('  Sender:   node 09-udp-file-transfer.js send <file>');
    console.log('  Receiver: node 09-udp-file-transfer.js receive');
    process.exit(1);
}
