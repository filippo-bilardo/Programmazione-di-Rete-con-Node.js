# **🎨 UDP Protocol Design - Progettare Protocolli Custom**

## **📑 Indice**
1. [Introduzione](#introduzione)
2. [Protocol Design Principles](#protocol-design-principles)
3. [Binary Protocol Design](#binary-protocol-design)
4. [Reliable UDP Protocols](#reliable-udp-protocols)
5. [Streaming over UDP](#streaming-over-udp)
6. [Real-Time Applications](#real-time-applications)
7. [Gaming Protocols](#gaming-protocols)
8. [Esempi Completi](#esempi-completi)

---

## **🎯 Introduzione**

**Creare il tuo protocollo UDP: Quando e come**

Progettare un protocollo UDP custom richiede:
- 📦 **Message Format**: come strutturare i dati (binary vs JSON vs...)
- 🔒 **Reliability**: quando/come garantire delivery (ACK/NACK, FEC...)
- ⚡ **Performance**: minimizzare overhead (header size, parsing...)
- 🔐 **Security**: proteggere da attacchi (replay, amplification...)
- 🔄 **Versioning**: supportare evoluzione (backward compatibility)

**Quando creare un protocollo custom?**

| Scenario | Usa Custom UDP | Usa Standard |
|----------|----------------|--------------|
| Gaming (state sync) | ✅ Custom | ❌ TCP troppo lento |
| Video streaming | ❌ WebRTC | QUIC già ottimizzato |
| IoT telemetry | ✅ Custom | Overhead JSON/HTTP eccessivo |
| File transfer | ❌ TCP/HTTP | Affidabilità built-in |
| VoIP | ❌ SIP/RTP | Standard consolidati |
| Distributed gaming | ✅ Custom | Controllo fine-grained |

**Principio guida:**
```
Se esiste standard maturo → Usa quello
Se requisiti unici → Design custom

Ma ricorda:
  - Custom = Devi implementare TUTTO
  - Custom = Devi debuggare TUTTO
  - Custom = Devi testare TUTTO
```

**Quando creare un protocollo custom?**
- ✅ Requisiti specifici (gaming, streaming, IoT)
- ✅ Performance critiche (controllo fine overhead)
- ✅ Controllo totale su comportamento (trade-off custom)
- ❌ Protocolli standard già esistono (QUIC, WebRTC, MQTT...)

---

## **📐 Protocol Design Principles**

### **1. Keep It Simple**

```javascript
// ❌ BAD: Troppo complesso
const message = {
    header: {
        version: 1,
        type: 'DATA',
        subtype: 'SENSOR_READING',
        priority: 'HIGH',
        encryption: 'AES256',
        compression: 'GZIP',
        checksum: 'CRC32'
    },
    metadata: {
        timestamp: Date.now(),
        sender: 'device-123',
        receiver: 'server-456',
        sequence: 12345
    },
    payload: { /* ... */ }
};

// ✅ GOOD: Essenziale
const message = Buffer.allocUnsafe(16);
message.writeUInt8(0x01, 0);        // version
message.writeUInt8(0x02, 1);        // type
message.writeUInt32BE(seq, 2);      // sequence
message.writeUInt32BE(timestamp, 6); // timestamp
// ... payload follows
```

### **2. Version for Evolution**

```javascript
class ProtocolVersionManager {
    constructor() {
        this.handlers = new Map();
        
        // Registra handlers per versione
        this.handlers.set(1, this.handleV1.bind(this));
        this.handlers.set(2, this.handleV2.bind(this));
    }
    
    parse(buffer) {
        const version = buffer.readUInt8(0);
        const handler = this.handlers.get(version);
        
        if (!handler) {
            throw new Error(`Unsupported protocol version: ${version}`);
        }
        
        return handler(buffer);
    }
    
    handleV1(buffer) {
        // Protocol v1: simple header
        return {
            version: 1,
            type: buffer.readUInt8(1),
            seq: buffer.readUInt32BE(2),
            data: buffer.slice(6)
        };
    }
    
    handleV2(buffer) {
        // Protocol v2: aggiunge timestamp e flags
        return {
            version: 2,
            type: buffer.readUInt8(1),
            flags: buffer.readUInt8(2),
            seq: buffer.readUInt32BE(3),
            timestamp: buffer.readUInt32BE(7),
            data: buffer.slice(11)
        };
    }
}
```

### **3. Fixed vs Variable Length**

```javascript
// Fixed-length protocol (più veloce, ma può sprecare spazio)
class FixedLengthProtocol {
    static HEADER_SIZE = 32;
    static DATA_SIZE = 1024;
    static TOTAL_SIZE = 1056;
    
    static encode(type, seq, data) {
        const buffer = Buffer.allocUnsafe(this.TOTAL_SIZE);
        
        // Header (32 bytes)
        buffer.writeUInt8(1, 0);           // version
        buffer.writeUInt8(type, 1);        // type
        buffer.writeUInt32BE(seq, 2);      // sequence
        buffer.writeBigUInt64BE(BigInt(Date.now()), 6); // timestamp
        buffer.fill(0, 14, 32);            // reserved
        
        // Data (1024 bytes)
        const dataBuffer = Buffer.from(data);
        dataBuffer.copy(buffer, 32, 0, Math.min(dataBuffer.length, this.DATA_SIZE));
        
        return buffer;
    }
    
    static decode(buffer) {
        if (buffer.length !== this.TOTAL_SIZE) {
            throw new Error('Invalid packet size');
        }
        
        return {
            version: buffer.readUInt8(0),
            type: buffer.readUInt8(1),
            seq: buffer.readUInt32BE(2),
            timestamp: Number(buffer.readBigUInt64BE(6)),
            data: buffer.slice(32, 32 + this.DATA_SIZE)
        };
    }
}

// Variable-length protocol (più flessibile)
class VariableLengthProtocol {
    static MIN_HEADER_SIZE = 8;
    
    static encode(type, seq, data) {
        const dataBuffer = Buffer.from(data);
        const totalSize = this.MIN_HEADER_SIZE + dataBuffer.length;
        const buffer = Buffer.allocUnsafe(totalSize);
        
        // Header
        buffer.writeUInt8(1, 0);                    // version
        buffer.writeUInt8(type, 1);                 // type
        buffer.writeUInt32BE(seq, 2);               // sequence
        buffer.writeUInt16BE(dataBuffer.length, 6); // data length
        
        // Data
        dataBuffer.copy(buffer, this.MIN_HEADER_SIZE);
        
        return buffer;
    }
    
    static decode(buffer) {
        if (buffer.length < this.MIN_HEADER_SIZE) {
            throw new Error('Buffer too small');
        }
        
        const dataLength = buffer.readUInt16BE(6);
        
        if (buffer.length !== this.MIN_HEADER_SIZE + dataLength) {
            throw new Error('Invalid data length');
        }
        
        return {
            version: buffer.readUInt8(0),
            type: buffer.readUInt8(1),
            seq: buffer.readUInt32BE(2),
            dataLength: dataLength,
            data: buffer.slice(this.MIN_HEADER_SIZE)
        };
    }
}
```

---

## **🔧 Binary Protocol Design**

### **Efficient Header Format**

```javascript
/**
 * Custom Binary Protocol Header (16 bytes)
 * 
 * Byte 0: Version (4 bits) + Flags (4 bits)
 * Byte 1: Message Type
 * Bytes 2-3: Payload Length
 * Bytes 4-7: Sequence Number
 * Bytes 8-11: Timestamp
 * Bytes 12-15: Checksum (CRC32)
 */

class BinaryProtocol {
    // Message types
    static TYPE_DATA = 0x01;
    static TYPE_ACK = 0x02;
    static TYPE_NACK = 0x03;
    static TYPE_PING = 0x04;
    static TYPE_PONG = 0x05;
    
    // Flags
    static FLAG_COMPRESSED = 0x01;
    static FLAG_ENCRYPTED = 0x02;
    static FLAG_PRIORITY = 0x04;
    static FLAG_FRAGMENT = 0x08;
    
    static HEADER_SIZE = 16;
    
    static encode(type, seq, payload, flags = 0) {
        const payloadBuffer = Buffer.from(payload);
        const totalSize = this.HEADER_SIZE + payloadBuffer.length;
        const buffer = Buffer.allocUnsafe(totalSize);
        
        // Byte 0: version (4) + flags (4)
        const version = 1;
        buffer.writeUInt8((version << 4) | (flags & 0x0F), 0);
        
        // Byte 1: type
        buffer.writeUInt8(type, 1);
        
        // Bytes 2-3: payload length
        buffer.writeUInt16BE(payloadBuffer.length, 2);
        
        // Bytes 4-7: sequence
        buffer.writeUInt32BE(seq, 4);
        
        // Bytes 8-11: timestamp
        buffer.writeUInt32BE(Date.now() & 0xFFFFFFFF, 8);
        
        // Copy payload
        payloadBuffer.copy(buffer, this.HEADER_SIZE);
        
        // Bytes 12-15: checksum (CRC32 di tutto)
        const crc = this.calculateCRC32(buffer.slice(0, totalSize - 4));
        buffer.writeUInt32BE(crc, 12);
        
        return buffer;
    }
    
    static decode(buffer) {
        if (buffer.length < this.HEADER_SIZE) {
            throw new Error('Buffer too small');
        }
        
        // Parse header
        const versionAndFlags = buffer.readUInt8(0);
        const version = versionAndFlags >> 4;
        const flags = versionAndFlags & 0x0F;
        const type = buffer.readUInt8(1);
        const payloadLength = buffer.readUInt16BE(2);
        const seq = buffer.readUInt32BE(4);
        const timestamp = buffer.readUInt32BE(8);
        const checksum = buffer.readUInt32BE(12);
        
        // Verify length
        if (buffer.length !== this.HEADER_SIZE + payloadLength) {
            throw new Error('Invalid payload length');
        }
        
        // Verify checksum
        const calculatedCRC = this.calculateCRC32(
            buffer.slice(0, buffer.length - 4)
        );
        if (calculatedCRC !== checksum) {
            throw new Error('Checksum mismatch');
        }
        
        return {
            version,
            flags,
            type,
            seq,
            timestamp,
            payload: buffer.slice(this.HEADER_SIZE),
            isCompressed: (flags & this.FLAG_COMPRESSED) !== 0,
            isEncrypted: (flags & this.FLAG_ENCRYPTED) !== 0,
            isPriority: (flags & this.FLAG_PRIORITY) !== 0,
            isFragment: (flags & this.FLAG_FRAGMENT) !== 0
        };
    }
    
    static calculateCRC32(buffer) {
        // CRC32 semplificato (usa libreria 'crc-32' in produzione)
        let crc = 0xFFFFFFFF;
        
        for (let i = 0; i < buffer.length; i++) {
            const byte = buffer[i];
            crc = crc ^ byte;
            
            for (let j = 0; j < 8; j++) {
                if (crc & 1) {
                    crc = (crc >>> 1) ^ 0xEDB88320;
                } else {
                    crc = crc >>> 1;
                }
            }
        }
        
        return (crc ^ 0xFFFFFFFF) >>> 0;
    }
}

// Uso
const payload = JSON.stringify({ sensor: 'temp', value: 23.5 });
const packet = BinaryProtocol.encode(
    BinaryProtocol.TYPE_DATA,
    12345,
    payload,
    BinaryProtocol.FLAG_COMPRESSED | BinaryProtocol.FLAG_PRIORITY
);

console.log('Packet size:', packet.length);
console.log('Header:', packet.slice(0, 16));

const decoded = BinaryProtocol.decode(packet);
console.log('Decoded:', decoded);
```

### **Type-Length-Value (TLV) Format**

```javascript
class TLVProtocol {
    static encode(fields) {
        const buffers = [];
        
        for (const [type, value] of Object.entries(fields)) {
            const typeBuffer = Buffer.allocUnsafe(1);
            typeBuffer.writeUInt8(parseInt(type), 0);
            
            let valueBuffer;
            if (typeof value === 'string') {
                valueBuffer = Buffer.from(value, 'utf8');
            } else if (typeof value === 'number') {
                valueBuffer = Buffer.allocUnsafe(4);
                valueBuffer.writeUInt32BE(value, 0);
            } else if (Buffer.isBuffer(value)) {
                valueBuffer = value;
            } else {
                valueBuffer = Buffer.from(JSON.stringify(value));
            }
            
            const lengthBuffer = Buffer.allocUnsafe(2);
            lengthBuffer.writeUInt16BE(valueBuffer.length, 0);
            
            buffers.push(typeBuffer, lengthBuffer, valueBuffer);
        }
        
        return Buffer.concat(buffers);
    }
    
    static decode(buffer) {
        const fields = {};
        let offset = 0;
        
        while (offset < buffer.length) {
            if (offset + 3 > buffer.length) break;
            
            const type = buffer.readUInt8(offset);
            const length = buffer.readUInt16BE(offset + 1);
            
            if (offset + 3 + length > buffer.length) break;
            
            const value = buffer.slice(offset + 3, offset + 3 + length);
            fields[type] = value;
            
            offset += 3 + length;
        }
        
        return fields;
    }
}

// Uso
const message = TLVProtocol.encode({
    1: 'username',              // Type 1: string
    2: 12345,                   // Type 2: number
    3: Buffer.from([0x01, 0x02]) // Type 3: binary
});

const decoded = TLVProtocol.decode(message);
console.log('Type 1:', decoded[1].toString());
console.log('Type 2:', decoded[2].readUInt32BE(0));
```

---

## **🔄 Reliable UDP Protocols**

### **RUDP - Reliable UDP Implementation**

```javascript
class RUDP {
    constructor(socket) {
        this.socket = socket;
        this.sendBuffer = new Map(); // seq -> { data, timer, attempts }
        this.recvBuffer = new Map(); // seq -> data
        this.nextSeq = 0;
        this.expectedSeq = 0;
        this.maxRetries = 5;
        this.timeout = 1000;
        
        this.setupHandlers();
    }
    
    setupHandlers() {
        this.socket.on('message', (msg, rinfo) => {
            const packet = BinaryProtocol.decode(msg);
            
            if (packet.type === BinaryProtocol.TYPE_DATA) {
                this.handleData(packet, rinfo);
            } else if (packet.type === BinaryProtocol.TYPE_ACK) {
                this.handleAck(packet);
            } else if (packet.type === BinaryProtocol.TYPE_NACK) {
                this.handleNack(packet);
            }
        });
    }
    
    // Invia con reliability
    async send(data, port, host) {
        const seq = this.nextSeq++;
        const packet = BinaryProtocol.encode(
            BinaryProtocol.TYPE_DATA,
            seq,
            data
        );
        
        return new Promise((resolve, reject) => {
            let attempts = 0;
            
            const sendAttempt = () => {
                attempts++;
                
                if (attempts > this.maxRetries) {
                    this.sendBuffer.delete(seq);
                    reject(new Error(`Max retries exceeded for seq ${seq}`));
                    return;
                }
                
                console.log(`Sending seq ${seq}, attempt ${attempts}`);
                this.socket.send(packet, port, host);
                
                const timer = setTimeout(() => {
                    console.log(`Timeout for seq ${seq}, retrying...`);
                    sendAttempt();
                }, this.timeout);
                
                this.sendBuffer.set(seq, {
                    data: packet,
                    timer,
                    attempts,
                    port,
                    host,
                    resolve,
                    reject
                });
            };
            
            sendAttempt();
        });
    }
    
    handleAck(packet) {
        const seq = packet.seq;
        
        if (this.sendBuffer.has(seq)) {
            const { timer, resolve } = this.sendBuffer.get(seq);
            clearTimeout(timer);
            this.sendBuffer.delete(seq);
            resolve();
            console.log(`ACK received for seq ${seq}`);
        }
    }
    
    handleNack(packet) {
        const seq = packet.seq;
        
        if (this.sendBuffer.has(seq)) {
            const entry = this.sendBuffer.get(seq);
            clearTimeout(entry.timer);
            
            console.log(`NACK received for seq ${seq}, retrying immediately`);
            
            // Retry immediately
            const timer = setTimeout(() => {
                const { data, port, host } = entry;
                this.socket.send(data, port, host);
            }, 0);
            
            entry.timer = timer;
            entry.attempts++;
        }
    }
    
    handleData(packet, rinfo) {
        const seq = packet.seq;
        
        if (seq === this.expectedSeq) {
            // In-order delivery
            this.deliverData(packet.payload);
            this.expectedSeq++;
            
            // Deliver buffered packets
            while (this.recvBuffer.has(this.expectedSeq)) {
                const bufferedData = this.recvBuffer.get(this.expectedSeq);
                this.deliverData(bufferedData);
                this.recvBuffer.delete(this.expectedSeq);
                this.expectedSeq++;
            }
            
            // Send ACK
            this.sendAck(seq, rinfo);
        } else if (seq > this.expectedSeq) {
            // Out-of-order: buffer
            console.log(`Buffering seq ${seq} (expected ${this.expectedSeq})`);
            this.recvBuffer.set(seq, packet.payload);
            this.sendAck(seq, rinfo);
        } else {
            // Duplicate or old packet
            console.log(`Ignoring duplicate seq ${seq}`);
            this.sendAck(seq, rinfo); // ACK anyway
        }
    }
    
    sendAck(seq, rinfo) {
        const ack = BinaryProtocol.encode(
            BinaryProtocol.TYPE_ACK,
            seq,
            ''
        );
        this.socket.send(ack, rinfo.port, rinfo.address);
    }
    
    sendNack(seq, rinfo) {
        const nack = BinaryProtocol.encode(
            BinaryProtocol.TYPE_NACK,
            seq,
            ''
        );
        this.socket.send(nack, rinfo.port, rinfo.address);
    }
    
    deliverData(data) {
        console.log('Delivering data:', data.toString());
        // Emit event o callback
        this.onData && this.onData(data);
    }
}

// Uso
const socket = dgram.createSocket('udp4');
const rudp = new RUDP(socket);

rudp.onData = (data) => {
    console.log('Application received:', data.toString());
};

socket.bind(41234);

// Send reliable
async function sendReliable() {
    for (let i = 0; i < 10; i++) {
        try {
            await rudp.send(`Message ${i}`, 41234, 'localhost');
            console.log(`Message ${i} delivered`);
        } catch (err) {
            console.error(`Failed to deliver message ${i}:`, err);
        }
    }
}

sendReliable();
```

---

## **🎬 Streaming over UDP**

### **Chunk-based Streaming Protocol**

```javascript
class UDPStreamingProtocol {
    constructor(chunkSize = 1400) { // MTU-safe
        this.socket = dgram.createSocket('udp4');
        this.chunkSize = chunkSize;
        this.streamId = 0;
    }
    
    // Send stream
    async sendStream(data, port, host, onProgress) {
        const streamId = this.streamId++;
        const totalChunks = Math.ceil(data.length / this.chunkSize);
        
        console.log(`Streaming ${data.length} bytes in ${totalChunks} chunks`);
        
        for (let i = 0; i < totalChunks; i++) {
            const start = i * this.chunkSize;
            const end = Math.min(start + this.chunkSize, data.length);
            const chunk = data.slice(start, end);
            
            const packet = this.encodeChunk(streamId, i, totalChunks, chunk);
            
            await this.sendPacket(packet, port, host);
            
            if (onProgress) {
                onProgress(i + 1, totalChunks);
            }
            
            // Rate limiting
            await this.sleep(10);
        }
        
        console.log('Stream sent');
    }
    
    encodeChunk(streamId, chunkIndex, totalChunks, data) {
        const header = Buffer.allocUnsafe(12);
        header.writeUInt32BE(streamId, 0);
        header.writeUInt32BE(chunkIndex, 4);
        header.writeUInt32BE(totalChunks, 8);
        
        return Buffer.concat([header, data]);
    }
    
    decodeChunk(buffer) {
        return {
            streamId: buffer.readUInt32BE(0),
            chunkIndex: buffer.readUInt32BE(4),
            totalChunks: buffer.readUInt32BE(8),
            data: buffer.slice(12)
        };
    }
    
    sendPacket(packet, port, host) {
        return new Promise((resolve) => {
            this.socket.send(packet, port, host, () => resolve());
        });
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

class UDPStreamReceiver {
    constructor() {
        this.socket = dgram.createSocket('udp4');
        this.streams = new Map(); // streamId -> { chunks, received, total }
        this.protocol = new UDPStreamingProtocol();
    }
    
    start(port) {
        this.socket.on('message', (msg, rinfo) => {
            const chunk = this.protocol.decodeChunk(msg);
            this.handleChunk(chunk);
        });
        
        this.socket.bind(port);
        console.log(`Stream receiver on port ${port}`);
    }
    
    handleChunk(chunk) {
        const { streamId, chunkIndex, totalChunks, data } = chunk;
        
        if (!this.streams.has(streamId)) {
            this.streams.set(streamId, {
                chunks: new Array(totalChunks),
                received: 0,
                total: totalChunks
            });
        }
        
        const stream = this.streams.get(streamId);
        
        if (!stream.chunks[chunkIndex]) {
            stream.chunks[chunkIndex] = data;
            stream.received++;
            
            console.log(`Stream ${streamId}: ${stream.received}/${stream.total} chunks`);
            
            if (stream.received === stream.total) {
                this.completeStream(streamId, stream);
            }
        }
    }
    
    completeStream(streamId, stream) {
        const fullData = Buffer.concat(stream.chunks);
        console.log(`Stream ${streamId} complete: ${fullData.length} bytes`);
        
        this.onStreamComplete && this.onStreamComplete(streamId, fullData);
        this.streams.delete(streamId);
    }
}

// Uso
const sender = new UDPStreamingProtocol();
const receiver = new UDPStreamReceiver();

receiver.onStreamComplete = (streamId, data) => {
    console.log('Received stream:', data.toString().substring(0, 100));
};

receiver.start(41234);

// Send large data
const largeData = Buffer.alloc(100000, 'x');
sender.sendStream(largeData, 41234, 'localhost', (current, total) => {
    const progress = ((current / total) * 100).toFixed(1);
    process.stdout.write(`\rProgress: ${progress}%`);
});
```

---

## **🎮 Gaming Protocols**

### **Client-Server Game Protocol**

```javascript
class GameProtocol {
    // Message types
    static PLAYER_MOVE = 0x10;
    static PLAYER_SHOOT = 0x11;
    static GAME_STATE = 0x20;
    static ENTITY_UPDATE = 0x21;
    static PING = 0x30;
    static PONG = 0x31;
    
    // Encode player input
    static encodePlayerMove(playerId, x, y, rotation, timestamp) {
        const buffer = Buffer.allocUnsafe(19);
        buffer.writeUInt8(this.PLAYER_MOVE, 0);
        buffer.writeUInt32BE(playerId, 1);
        buffer.writeFloatBE(x, 5);
        buffer.writeFloatBE(y, 9);
        buffer.writeFloatBE(rotation, 13);
        buffer.writeUInt16BE(timestamp & 0xFFFF, 17);
        return buffer;
    }
    
    static decodePlayerMove(buffer) {
        return {
            type: buffer.readUInt8(0),
            playerId: buffer.readUInt32BE(1),
            x: buffer.readFloatBE(5),
            y: buffer.readFloatBE(9),
            rotation: buffer.readFloatBE(13),
            timestamp: buffer.readUInt16BE(17)
        };
    }
    
    // Encode game state (snapshot)
    static encodeGameState(tick, entities) {
        const entityBuffers = entities.map(e => {
            const buf = Buffer.allocUnsafe(21);
            buf.writeUInt32BE(e.id, 0);
            buf.writeUInt8(e.type, 4);
            buf.writeFloatBE(e.x, 5);
            buf.writeFloatBE(e.y, 9);
            buf.writeFloatBE(e.rotation, 13);
            buf.writeFloatBE(e.velocity, 17);
            return buf;
        });
        
        const header = Buffer.allocUnsafe(6);
        header.writeUInt8(this.GAME_STATE, 0);
        header.writeUInt32BE(tick, 1);
        header.writeUInt8(entities.length, 5);
        
        return Buffer.concat([header, ...entityBuffers]);
    }
    
    static decodeGameState(buffer) {
        const type = buffer.readUInt8(0);
        const tick = buffer.readUInt32BE(1);
        const entityCount = buffer.readUInt8(5);
        
        const entities = [];
        let offset = 6;
        
        for (let i = 0; i < entityCount; i++) {
            entities.push({
                id: buffer.readUInt32BE(offset),
                type: buffer.readUInt8(offset + 4),
                x: buffer.readFloatBE(offset + 5),
                y: buffer.readFloatBE(offset + 9),
                rotation: buffer.readFloatBE(offset + 13),
                velocity: buffer.readFloatBE(offset + 17)
            });
            offset += 21;
        }
        
        return { type, tick, entities };
    }
}

class GameServer {
    constructor(port) {
        this.socket = dgram.createSocket('udp4');
        this.port = port;
        this.players = new Map();
        this.entities = [];
        this.tick = 0;
        this.tickRate = 20; // 20 updates/sec
    }
    
    start() {
        this.socket.on('message', (msg, rinfo) => {
            this.handleMessage(msg, rinfo);
        });
        
        this.socket.bind(this.port);
        
        // Game loop
        setInterval(() => {
            this.update();
            this.broadcastState();
        }, 1000 / this.tickRate);
        
        console.log(`Game server on port ${this.port}`);
    }
    
    handleMessage(msg, rinfo) {
        const type = msg.readUInt8(0);
        
        if (type === GameProtocol.PLAYER_MOVE) {
            const move = GameProtocol.decodePlayerMove(msg);
            this.handlePlayerMove(move, rinfo);
        }
    }
    
    handlePlayerMove(move, rinfo) {
        const clientId = `${rinfo.address}:${rinfo.port}`;
        
        if (!this.players.has(clientId)) {
            this.players.set(clientId, {
                id: move.playerId,
                address: rinfo.address,
                port: rinfo.port,
                x: move.x,
                y: move.y,
                rotation: move.rotation,
                lastUpdate: Date.now()
            });
        } else {
            const player = this.players.get(clientId);
            player.x = move.x;
            player.y = move.y;
            player.rotation = move.rotation;
            player.lastUpdate = Date.now();
        }
    }
    
    update() {
        this.tick++;
        
        // Update game logic
        // ... physics, collisions, etc ...
    }
    
    broadcastState() {
        // Build entity list
        const entities = Array.from(this.players.values()).map(p => ({
            id: p.id,
            type: 1, // player type
            x: p.x,
            y: p.y,
            rotation: p.rotation,
            velocity: 0
        }));
        
        const packet = GameProtocol.encodeGameState(this.tick, entities);
        
        // Send to all players
        for (const player of this.players.values()) {
            this.socket.send(packet, player.port, player.address);
        }
    }
}

class GameClient {
    constructor() {
        this.socket = dgram.createSocket('udp4');
        this.playerId = Math.floor(Math.random() * 1000000);
        this.x = 0;
        this.y = 0;
        this.rotation = 0;
        this.sendRate = 60; // 60 updates/sec
    }
    
    connect(serverPort, serverHost) {
        this.serverPort = serverPort;
        this.serverHost = serverHost;
        
        this.socket.on('message', (msg) => {
            this.handleMessage(msg);
        });
        
        this.socket.bind();
        
        // Send input loop
        setInterval(() => {
            this.sendInput();
        }, 1000 / this.sendRate);
        
        console.log('Client connected');
    }
    
    sendInput() {
        const packet = GameProtocol.encodePlayerMove(
            this.playerId,
            this.x,
            this.y,
            this.rotation,
            Date.now()
        );
        
        this.socket.send(packet, this.serverPort, this.serverHost);
    }
    
    handleMessage(msg) {
        const type = msg.readUInt8(0);
        
        if (type === GameProtocol.GAME_STATE) {
            const state = GameProtocol.decodeGameState(msg);
            this.updateWorld(state);
        }
    }
    
    updateWorld(state) {
        console.log(`Tick ${state.tick}: ${state.entities.length} entities`);
        
        // Interpolate/render
        // ... client-side prediction ...
    }
    
    move(dx, dy) {
        this.x += dx;
        this.y += dy;
    }
}

// Uso
const server = new GameServer(41234);
server.start();

const client = new GameClient();
client.connect(41234, 'localhost');

// Simulate player movement
setInterval(() => {
    client.move(Math.random() * 10 - 5, Math.random() * 10 - 5);
}, 100);
```

---

## **🎓 Riepilogo**

**Protocol Design:**
- Keep it simple
- Version for evolution
- Choose fixed vs variable length

**Binary Protocols:**
- Efficient headers (8-16 bytes)
- CRC/checksum for integrity
- TLV format per flessibilità

**Reliability:**
- RUDP: ACK/NACK + retransmission
- Selective repeat
- Duplicate detection

**Streaming:**
- Chunk-based transmission
- Rate limiting
- Progress tracking

**Gaming:**
- Client-server architecture
- Snapshot compression
- Client-side prediction
- Tick rate optimization

**Best Practices:**
- MTU awareness (1400 bytes safe)
- Network byte order (Big Endian)
- Versioning strategy
- Security considerations (encryption, auth)

---

**Guide Precedenti**:
- [01-UDP_Fundamentals.md](./01-UDP_Fundamentals.md)
- [02-UDP_Server.md](./02-UDP_Server.md)
- [03-UDP_Client.md](./03-UDP_Client.md)
- [04-UDP_Avanzato.md](./04-UDP_Avanzato.md)
- [05-UDP_Performance.md](./05-UDP_Performance.md)
