# 1.2 Il Modulo NET di Node.js

## Indice
- [Panoramica del Modulo NET](#panoramica-del-modulo-net)
- [Importazione e Setup](#importazione-e-setup)
- [Architettura Event-Driven](#architettura-event-driven)
- [Stream e Buffer in Node.js](#stream-e-buffer-in-nodejs)
- [Async/Await con Socket](#asyncawait-con-socket)
- [Promise-Based Networking](#promise-based-networking)

---

## Panoramica del Modulo NET

Il modulo **`net`** di Node.js fornisce un'API asincrona per creare **server e client TCP** (stream socket).

### Caratteristiche Principali

✅ **Asincrono e non-blocking**: Gestisce migliaia di connessioni simultanee  
✅ **Event-driven**: Basato su eventi per gestire I/O  
✅ **Stream-based**: Socket implementano Stream Duplex  
✅ **Buffer support**: Gestione nativa di dati binari  
✅ **Cross-platform**: Funziona su Windows, Linux, macOS  

### Cosa Puoi Fare

- ✨ Creare **server TCP** custom
- ✨ Implementare **client TCP** per connettersi a server remoti
- ✨ Gestire **connessioni multiple** simultaneamente
- ✨ Implementare **protocolli custom** su TCP
- ✨ Costruire **proxy**, **load balancer**, **chat server**, etc.

### Cosa NON Puoi Fare

- ❌ UDP (usa il modulo `dgram`)
- ❌ HTTP/HTTPS (usa i moduli `http`/`https`)
- ❌ WebSocket (usa librerie come `ws` o `socket.io`)
- ❌ TLS/SSL (usa il modulo `tls`)

---

## Importazione e Setup

### Import Base

```javascript
const net = require('net');
```

### Verifica Disponibilità

```javascript
const net = require('net');

console.log('Modulo net disponibile:', !!net);
console.log('Versione Node.js:', process.version);
```

### Server TCP Base

```javascript
const net = require('net');

const server = net.createServer((socket) => {
    console.log('Client connesso');
    
    socket.on('data', (data) => {
        console.log('Ricevuto:', data.toString());
    });
});

server.listen(8080, () => {
    console.log('Server in ascolto su porta 8080');
});
```

### Client TCP Base

```javascript
const net = require('net');

const client = net.connect({ port: 8080, host: 'localhost' });

client.on('connect', () => {
    console.log('Connesso al server');
    client.write('Hello Server!');
});

client.on('data', (data) => {
    console.log('Ricevuto:', data.toString());
});
```

---

## Architettura Event-Driven

Node.js utilizza un'architettura **event-driven** basata sul pattern **Observer**.

### Event Loop

```
┌───────────────────────────┐
│        Call Stack         │
│   (Codice Sincrono)       │
└───────────┬───────────────┘
            │
            ↓
┌───────────────────────────┐
│       Event Loop          │
│  (Single Thread)          │
└───────────┬───────────────┘
            │
            ├─> Timers (setTimeout, setInterval)
            │
            ├─> Pending I/O (network, file system)
            │
            ├─> Poll (check for new I/O events)
            │
            ├─> Check (setImmediate)
            │
            └─> Close callbacks (socket.on('close'))
```

### Eventi nei Socket

#### Server Events

```javascript
const server = net.createServer();

// Evento: Server inizia ad ascoltare
server.on('listening', () => {
    console.log('Server in ascolto');
});

// Evento: Nuova connessione ricevuta
server.on('connection', (socket) => {
    console.log('Nuova connessione');
});

// Evento: Server chiuso
server.on('close', () => {
    console.log('Server chiuso');
});

// Evento: Errore server
server.on('error', (err) => {
    console.error('Errore:', err);
});

server.listen(8080);
```

#### Socket Events (Client o Server)

```javascript
socket.on('connect', () => {
    // Client: connessione stabilita
    console.log('Connesso');
});

socket.on('data', (chunk) => {
    // Dati ricevuti
    console.log('Dati:', chunk.toString());
});

socket.on('drain', () => {
    // Buffer di scrittura svuotato
    console.log('Dati inviati');
});

socket.on('end', () => {
    // Altra parte ha chiuso la connessione
    console.log('Connessione terminata');
});

socket.on('close', (hadError) => {
    // Socket completamente chiuso
    console.log('Socket chiuso', hadError);
});

socket.on('error', (err) => {
    // Errore socket
    console.error('Errore:', err.message);
});

socket.on('timeout', () => {
    // Timeout inattività
    console.log('Timeout');
});
```

### Event Emitter Pattern

I socket ereditano da **EventEmitter**:

```javascript
const net = require('net');
const { EventEmitter } = require('events');

const socket = net.connect({ port: 8080 });

// socket è un EventEmitter
console.log(socket instanceof EventEmitter); // true

// Puoi aggiungere listener multipli
socket.on('data', handler1);
socket.on('data', handler2);

// Rimuovere listener
socket.removeListener('data', handler1);

// Listener una-tantum
socket.once('connect', () => {
    console.log('Connesso (eseguito una volta)');
});
```

### Non-Blocking I/O

```javascript
const net = require('net');

console.log('1 - Inizio');

const client = net.connect({ port: 8080 }, () => {
    console.log('3 - Connesso (callback asincrono)');
});

console.log('2 - Fine codice sincrono');

// Output:
// 1 - Inizio
// 2 - Fine codice sincrono
// 3 - Connesso (callback asincrono)
```

Il codice **non si blocca** in attesa della connessione. L'event loop gestisce l'I/O in modo asincrono.

---

## Stream e Buffer in Node.js

### Stream

Un **Socket TCP** in Node.js è uno **Stream Duplex** (può leggere e scrivere).

#### Tipi di Stream

| Tipo | Descrizione | Esempi |
|------|-------------|--------|
| **Readable** | Legge dati | `fs.createReadStream()`, socket (reading) |
| **Writable** | Scrive dati | `fs.createWriteStream()`, socket (writing) |
| **Duplex** | Legge e scrive | TCP socket, TLS socket |
| **Transform** | Trasforma dati | `zlib.createGzip()`, crypto streams |

#### Socket come Stream Duplex

```javascript
const net = require('net');

const socket = net.connect({ port: 8080 });

// Readable: Legge dati dal socket
socket.on('data', (chunk) => {
    console.log('Ricevuto:', chunk.toString());
});

// Writable: Scrive dati sul socket
socket.write('Hello\n');

// Pipe: Collega stream
const fs = require('fs');
const fileStream = fs.createReadStream('file.txt');
fileStream.pipe(socket); // Invia file al socket
```

#### Readable Stream Events

```javascript
socket.on('data', (chunk) => {
    // Dati disponibili
});

socket.on('end', () => {
    // Niente più dati
});

socket.on('readable', () => {
    // Dati disponibili da leggere con socket.read()
    let chunk;
    while ((chunk = socket.read()) !== null) {
        console.log('Chunk:', chunk.toString());
    }
});
```

#### Writable Stream Methods

```javascript
// Scrive dati
socket.write('Hello\n');

// Scrive dati e chiude
socket.end('Goodbye\n');

// Verifica se buffer è pieno
if (socket.write(bigData) === false) {
    // Buffer pieno, aspetta 'drain'
    socket.once('drain', () => {
        console.log('Posso scrivere ancora');
    });
}
```

#### Backpressure

Lo stream gestisce automaticamente il **backpressure** (pressione contraria quando il buffer si riempie):

```javascript
function writeMillionRecords(socket) {
    let i = 0;
    
    function write() {
        let ok = true;
        
        while (i < 1000000 && ok) {
            const data = `Record ${i}\n`;
            ok = socket.write(data);
            i++;
        }
        
        if (i < 1000000) {
            // Buffer pieno, aspetta drain
            socket.once('drain', write);
        } else {
            socket.end();
        }
    }
    
    write();
}
```

---

### Buffer

I **Buffer** sono array di byte per gestire dati binari.

#### Creazione Buffer

```javascript
// Da stringa
const buf1 = Buffer.from('Hello');

// Alloca buffer vuoto
const buf2 = Buffer.alloc(10);

// Alloca buffer non inizializzato (più veloce ma unsafe)
const buf3 = Buffer.allocUnsafe(10);

// Da array di byte
const buf4 = Buffer.from([0x48, 0x65, 0x6c, 0x6c, 0x6f]); // 'Hello'
```

#### Leggere Buffer

```javascript
const buf = Buffer.from('Hello World');

// Converti a stringa
console.log(buf.toString());        // 'Hello World'
console.log(buf.toString('hex'));   // '48656c6c6f20576f726c64'
console.log(buf.toString('base64')); // 'SGVsbG8gV29ybGQ='

// Accesso byte
console.log(buf[0]);      // 72 (codice ASCII 'H')
console.log(buf.length);  // 11

// Slice
const slice = buf.slice(0, 5);
console.log(slice.toString()); // 'Hello'
```

#### Scrivere Buffer

```javascript
const buf = Buffer.alloc(11);

// Scrivi stringa
buf.write('Hello World');

// Scrivi byte singolo
buf[0] = 0x48; // 'H'

// Scrivi numeri
buf.writeUInt32BE(12345, 0); // Scrive 32-bit big-endian
```

#### Buffer con Socket

```javascript
socket.on('data', (chunk) => {
    // chunk è un Buffer
    
    // Converti a stringa
    const text = chunk.toString('utf8');
    
    // Gestisci come binario
    const firstByte = chunk[0];
    
    // Concatena buffer
    const combined = Buffer.concat([chunk, Buffer.from(' World')]);
});

// Invia buffer
const data = Buffer.from('Binary data');
socket.write(data);
```

#### Encoding Supportati

```javascript
// Testo
buf.toString('utf8');
buf.toString('ascii');
buf.toString('utf16le');

// Binario
buf.toString('hex');
buf.toString('base64');
buf.toString('binary');
```

---

## Async/Await con Socket

Node.js supporta **async/await** per semplificare codice asincrono.

### Promisify Socket Operations

```javascript
const net = require('net');
const { promisify } = require('util');

async function connectToServer(host, port) {
    const socket = net.connect({ host, port });
    
    // Aspetta connessione
    await new Promise((resolve, reject) => {
        socket.once('connect', resolve);
        socket.once('error', reject);
    });
    
    console.log('Connesso!');
    return socket;
}

// Uso
(async () => {
    try {
        const socket = await connectToServer('localhost', 8080);
        socket.write('Hello\n');
    } catch (err) {
        console.error('Errore:', err.message);
    }
})();
```

### Request-Response Pattern

```javascript
async function sendRequest(socket, request) {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error('Timeout'));
        }, 5000);
        
        socket.once('data', (data) => {
            clearTimeout(timeout);
            resolve(data.toString());
        });
        
        socket.once('error', (err) => {
            clearTimeout(timeout);
            reject(err);
        });
        
        socket.write(request + '\n');
    });
}

// Uso
(async () => {
    const socket = await connectToServer('localhost', 8080);
    
    try {
        const response1 = await sendRequest(socket, 'GET /data');
        console.log('Risposta 1:', response1);
        
        const response2 = await sendRequest(socket, 'GET /status');
        console.log('Risposta 2:', response2);
    } catch (err) {
        console.error('Errore:', err.message);
    } finally {
        socket.end();
    }
})();
```

### Async Iterators

```javascript
const net = require('net');

async function* readLines(socket) {
    let buffer = '';
    
    for await (const chunk of socket) {
        buffer += chunk.toString();
        
        let newlineIdx;
        while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
            const line = buffer.substring(0, newlineIdx);
            buffer = buffer.substring(newlineIdx + 1);
            yield line;
        }
    }
    
    // Ultimo pezzo
    if (buffer.length > 0) {
        yield buffer;
    }
}

// Uso
(async () => {
    const socket = net.connect({ port: 8080 });
    
    for await (const line of readLines(socket)) {
        console.log('Linea:', line);
    }
})();
```

---

## Promise-Based Networking

### Wrapper Class con Promise

```javascript
class TcpClient {
    constructor(host, port) {
        this.host = host;
        this.port = port;
        this.socket = null;
    }
    
    async connect() {
        return new Promise((resolve, reject) => {
            this.socket = net.connect({ 
                host: this.host, 
                port: this.port 
            });
            
            this.socket.once('connect', () => {
                resolve();
            });
            
            this.socket.once('error', (err) => {
                reject(err);
            });
        });
    }
    
    async send(data) {
        return new Promise((resolve, reject) => {
            if (!this.socket || this.socket.destroyed) {
                return reject(new Error('Not connected'));
            }
            
            this.socket.write(data, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }
    
    async receive() {
        return new Promise((resolve, reject) => {
            if (!this.socket) {
                return reject(new Error('Not connected'));
            }
            
            const timeout = setTimeout(() => {
                reject(new Error('Receive timeout'));
            }, 5000);
            
            this.socket.once('data', (data) => {
                clearTimeout(timeout);
                resolve(data.toString());
            });
            
            this.socket.once('error', (err) => {
                clearTimeout(timeout);
                reject(err);
            });
        });
    }
    
    async close() {
        return new Promise((resolve) => {
            if (!this.socket) {
                return resolve();
            }
            
            this.socket.once('close', resolve);
            this.socket.end();
        });
    }
}

// Uso
(async () => {
    const client = new TcpClient('localhost', 8080);
    
    try {
        await client.connect();
        console.log('Connesso');
        
        await client.send('Hello Server\n');
        const response = await client.receive();
        console.log('Risposta:', response);
        
        await client.close();
        console.log('Disconnesso');
    } catch (err) {
        console.error('Errore:', err.message);
    }
})();
```

### Error Handling con Try-Catch

```javascript
async function handleClient(socket) {
    try {
        const request = await receiveRequest(socket);
        console.log('Request:', request);
        
        const response = await processRequest(request);
        
        await sendResponse(socket, response);
        console.log('Response inviata');
    } catch (err) {
        console.error('Errore gestione client:', err.message);
        
        // Invia errore al client
        try {
            await sendResponse(socket, { error: err.message });
        } catch (sendErr) {
            console.error('Errore invio errore:', sendErr.message);
        }
    } finally {
        socket.end();
    }
}
```

### Promise.all per Connessioni Multiple

```javascript
async function connectToMultipleServers(servers) {
    const connections = servers.map(({ host, port }) => {
        return connectToServer(host, port);
    });
    
    try {
        const sockets = await Promise.all(connections);
        console.log('Tutte le connessioni stabilite');
        return sockets;
    } catch (err) {
        console.error('Errore connessione multipla:', err.message);
        throw err;
    }
}

// Uso
(async () => {
    const servers = [
        { host: 'localhost', port: 8080 },
        { host: 'localhost', port: 8081 },
        { host: 'localhost', port: 8082 }
    ];
    
    try {
        const sockets = await connectToMultipleServers(servers);
        console.log('Connessioni:', sockets.length);
    } catch (err) {
        console.error('Errore:', err.message);
    }
})();
```

---

## Riepilogo

In questa guida abbiamo esplorato:

✅ **Modulo NET**: Panoramica e funzionalità  
✅ **Event-Driven**: Architettura basata su eventi  
✅ **Stream**: Socket come Stream Duplex  
✅ **Buffer**: Gestione dati binari  
✅ **Async/Await**: Codice asincrono moderno  
✅ **Promise**: Networking basato su Promise  

Questi concetti sono fondamentali per scrivere applicazioni di rete efficienti con Node.js.

---

## Prossimi Passi

Nella prossima guida approfondiremo i **Concetti Base di TCP/IP** per comprendere meglio come funziona il protocollo sottostante.

📖 **Prossima guida:** [1.3 Concetti Base di TCP/IP](./03-Concetti_Base_TCP_IP.md)
