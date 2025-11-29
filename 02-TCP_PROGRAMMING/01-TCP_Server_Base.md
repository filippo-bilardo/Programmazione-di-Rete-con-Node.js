# **🖥️ TCP Server Base - Fondamenti**

## **📑 Indice**
1. [Introduzione](#introduzione)
2. [Creazione Server TCP Semplice](#creazione-server-tcp-semplice)
3. [Eventi del Server](#eventi-del-server)
4. [Gestione Connessioni](#gestione-connessioni)
5. [Error Handling](#error-handling)
6. [Invio e Ricezione Dati](#invio-e-ricezione-dati)
7. [Esempi Completi](#esempi-completi)

---

## **🎯 Introduzione**

Un **TCP Server** è un programma che:
- ✅ **Ascolta** su una porta specifica
- ✅ **Accetta** connessioni in entrata
- ✅ **Comunica** con i client connessi
- ✅ **Gestisce** multiple connessioni simultanee

**Caratteristiche TCP:**
- 🔒 **Affidabile**: garanzia di consegna
- 📦 **Ordinato**: dati arrivano nell'ordine corretto
- 🔄 **Connection-oriented**: handshake three-way
- 🚦 **Flow control**: gestione velocità trasmissione

---

## **🚀 Creazione Server TCP Semplice**

### **Concetti Fondamentali**

Prima di creare un server, è importante capire **come funziona** un TCP server in Node.js:

1. **Event Loop**: Node.js usa un modello **single-threaded** con event loop. Il server può gestire migliaia di connessioni simultanee senza creare un thread per ognuna.

2. **Callback per connessione**: Quando un client si connette, Node.js chiama automaticamente la funzione callback passata a `createServer()`. Questa riceve un oggetto `socket` che rappresenta la connessione con quel client.

3. **Socket come Stream**: Ogni socket è uno **stream duplex** (bidirezionale), quindi può sia leggere che scrivere dati. È anche un **EventEmitter**, quindi possiamo ascoltare eventi come `data`, `end`, `error`.

4. **Non-blocking I/O**: Tutte le operazioni sono **asincrone**. Quando scrivi `socket.write()`, i dati vengono messi in un buffer e inviati quando possibile, senza bloccare l'esecuzione.

**Perché è importante?** Capire questi concetti ti aiuta a scrivere server efficienti che non si bloccano e gestiscono bene il carico.

---

### **Server Minimale**

Questo è l'esempio più semplice di server TCP funzionante. Vediamo **cosa fa ogni parte**:

```javascript
const net = require('net');

// 1. Crea il server TCP
// La callback viene chiamata per OGNI nuova connessione
const server = net.createServer((socket) => {
    // Questo codice viene eseguito ogni volta che un client si connette
    console.log('Client connesso');
    
    // 2. Invia un messaggio di benvenuto al client
    // socket.write() invia dati al client attraverso la connessione TCP
    socket.write('Benvenuto al server TCP!\n');
    
    // 3. Ascolta l'evento 'data' - viene emesso quando arrivano dati dal client
    // Il parametro 'data' è un Buffer contenente i byte ricevuti
    socket.on('data', (data) => {
        console.log('Ricevuto:', data.toString());
        socket.write(data); // Echo: rimanda indietro gli stessi dati
    });
    
    // 4. Ascolta l'evento 'end' - il client ha chiuso la connessione (FIN)
    // Questo è diverso da 'close': 'end' significa che il client ha terminato
    // l'invio dati, ma potrebbe ancora ricevere
    socket.on('end', () => {
        console.log('Client disconnesso');
    });
});

// 5. Avvia il server sulla porta 3000
// Dopo questo, il server inizia ad ascoltare connessioni TCP sulla porta 3000
server.listen(3000, () => {
    // Questa callback viene chiamata quando il server è effettivamente pronto
    console.log('Server in ascolto sulla porta 3000');
});
```

**💡 Cosa succede dietro le quinte?**

1. **Binding**: `server.listen(3000)` chiede al sistema operativo di riservare la porta 3000 per questo processo
2. **Listening**: Il SO inizia ad accettare connessioni TCP su quella porta
3. **Three-way handshake**: Quando un client si connette, avviene automaticamente il handshake SYN→SYN-ACK→ACK
4. **Callback invocation**: Node.js chiama la callback passandole un socket già connesso
5. **Event handling**: Registriamo listener per gestire data, end, error, ecc.

**⚠️ Note importanti:**

- Il server può gestire **multiple connessioni simultanee**. Ogni connessione ha il suo socket indipendente.
- Gli eventi sono **asincroni**: `socket.write()` non blocca, i dati vengono bufferizzati e inviati quando possibile.
- Sempre gestire l'evento `error` altrimenti il processo può crashare!

---

### **Test con Netcat**

Netcat (`nc`) è uno strumento perfetto per testare server TCP senza scrivere un client:

```bash
# In un terminale: avvia il server
node server.js

# In un altro terminale: connetti con netcat
nc localhost 3000
# Digita qualcosa e premi Enter
# Il server risponderà con l'echo
```

**Cosa osservare:**
- Quando ti connetti, vedi "Client connesso" nel terminale del server
- Ogni messaggio che invii appare nel log del server
- Il messaggio ti viene rimandato indietro (echo)
- Premi Ctrl+C per disconnetterti

---

### **Server con Configurazione Completa**

Questo esempio mostra **tutte le opzioni** disponibili per un server TCP professionale. Vediamo **quando e perché** usarle:

**Opzioni di configurazione:**

| Opzione | Cosa fa | Quando usarla |
|---------|---------|---------------|
| `host` | IP su cui ascoltare | `0.0.0.0` = tutte le interfacce, `127.0.0.1` = solo localhost |
| `port` | Porta TCP | Usa 3000+ per sviluppo, 80/443 richiedono root |
| `backlog` | Dimensione coda pending | Default 511, aumenta per alto traffico |
| `exclusive` | Porta esclusiva | `false` permette port reuse con cluster |
| `allowHalfOpen` | Gestione FIN unidirezionale | `false` chiude subito quando client fa FIN |
| `pauseOnConnect` | Pausa automatica | `false` inizia a ricevere dati subito |

```javascript
const net = require('net');

const config = {
    host: '0.0.0.0',  // Ascolta su tutte le interfacce (locale + rete)
    port: 3000,
    backlog: 128,     // Quante connessioni possono aspettare in coda
    exclusive: false  // Permette port reuse (importante per cluster)
};

const server = net.createServer({
    // allowHalfOpen: false significa "se il client fa FIN, chiudi subito entrambe le direzioni"
    // Se true, potresti continuare a inviare dati anche dopo che il client ha fatto FIN
    allowHalfOpen: false,
    
    // pauseOnConnect: false significa "inizia a ricevere dati immediatamente"
    // Se true, devi chiamare socket.resume() manualmente
    pauseOnConnect: false
}, (socket) => {
    handleConnection(socket);
});

server.listen(config, () => {
    const addr = server.address();
    console.log(`Server in ascolto su ${addr.address}:${addr.port}`);
});

function handleConnection(socket) {
    console.log(`Nuova connessione da ${socket.remoteAddress}:${socket.remotePort}`);
    
    socket.write('Benvenuto!\n');
    
    socket.on('data', (data) => {
        socket.write(`Echo: ${data}`);
    });
}
```

---

## **📡 Eventi del Server**

**Comprendere gli eventi del server**

Gli eventi del server sono il meccanismo principale per **monitorare lo stato del server** e reagire a situazioni come errori, nuove connessioni o chiusura.

**IMPORTANTE:** Ogni evento ha uno scopo specifico. Non registrare tutti gli eventi "just in case" - usa solo quelli necessari per evitare overhead inutile.

**Lifecycle tipico di un server:**
```
1. server.listen() → evento 'listening'
2. Client si connette → evento 'connection' (per OGNI client)
3. server.close() → evento 'close' (quando tutte le conn sono chiuse)
4. Qualsiasi momento → evento 'error' (se qualcosa va storto)
```

| Evento | Quando si attiva | Cosa fare | Obbligatorio? |
|--------|------------------|-----------|---------------|
| `listening` | Server pronto ad accettare connessioni | Log, inizializzazioni post-startup | No |
| `connection` | Nuovo client connesso | Setup handler per il socket | Automatico via callback |
| `close` | Server completamente chiuso | Cleanup risorse, log finale | No |
| `error` | Errore del server (binding, etc) | Logging, retry logic, exit | **SÌ** |

### **Eventi Principali**

```javascript
const server = net.createServer();

// 1. 'listening' - Server pronto ad accettare connessioni
server.on('listening', () => {
    const addr = server.address();
    console.log(`✅ Server listening on ${addr.address}:${addr.port}`);
});

// 2. 'connection' - Nuova connessione accettata
server.on('connection', (socket) => {
    console.log('📥 Nuova connessione');
    console.log(`   Remote: ${socket.remoteAddress}:${socket.remotePort}`);
    console.log(`   Local: ${socket.localAddress}:${socket.localPort}`);
});

// 3. 'close' - Server chiuso
server.on('close', () => {
    console.log('🔴 Server chiuso');
});

// 4. 'error' - Errore del server
server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error('❌ Porta già in uso');
    } else if (err.code === 'EACCES') {
        console.error('❌ Permessi insufficienti');
    } else {
        console.error('❌ Errore server:', err);
    }
});

server.listen(3000);
```

### **Lifecycle Completo**

```javascript
const net = require('net');

class SimpleServer {
    constructor(port) {
        this.port = port;
        this.server = net.createServer(this.handleConnection.bind(this));
        this.connections = new Set();
        this.setupEvents();
    }
    
    setupEvents() {
        this.server.on('listening', () => {
            console.log(`[LISTENING] Port ${this.port}`);
        });
        
        this.server.on('connection', (socket) => {
            console.log(`[CONNECTION] ${socket.remoteAddress}:${socket.remotePort}`);
            this.connections.add(socket);
            
            socket.on('close', () => {
                this.connections.delete(socket);
                console.log(`[DISCONNECT] Connessioni attive: ${this.connections.size}`);
            });
        });
        
        this.server.on('close', () => {
            console.log('[CLOSE] Server terminato');
        });
        
        this.server.on('error', (err) => {
            console.error('[ERROR]', err.message);
        });
    }
    
    handleConnection(socket) {
        socket.write('Benvenuto!\n');
        
        socket.on('data', (data) => {
            socket.write(`Echo: ${data}`);
        });
    }
    
    start() {
        this.server.listen(this.port);
    }
    
    stop() {
        console.log('Chiusura server...');
        
        // Chiudi tutte le connessioni
        for (const socket of this.connections) {
            socket.end();
        }
        
        // Chiudi il server
        this.server.close(() => {
            console.log('Server chiuso');
        });
    }
}

// Uso
const server = new SimpleServer(3000);
server.start();

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nRicevuto SIGINT, chiusura graceful...');
    server.stop();
});
```

---

## **🔌 Gestione Connessioni**

**Socket events vs Server events**

Gli eventi del **socket** sono diversi dagli eventi del **server**:
- Il **server** ha UN set di eventi per l'intero server
- Ogni **socket** ha il SUO set di eventi indipendente (uno per ogni connessione)

**Ciclo di vita tipico di un socket:**
```
┌─────────────────────────────────────────┐
│  1. 'connection' - Socket creato        │
│  2. 'data' → 'data' → 'data' ...       │ ← Comunicazione
│  3. 'end' - Una parte chiude (FIN)     │
│  4. 'close' - Socket completamente      │
│             chiuso (entrambe direzioni) │
│                                         │
│  In qualsiasi momento:                  │
│  'error' → salta direttamente a 'close' │
└─────────────────────────────────────────┘
```

**Event Loop e gestione connessioni:**
```
┌─────────────────────────────────────────┐
│  Server Event Loop (Single Thread)     │
├─────────────────────────────────────────┤
│  Socket 1: [data] → processing          │
│  Socket 2: [waiting...]                 │
│  Socket 3: [data] → processing          │
│  Socket 4: [error] → cleanup            │
└─────────────────────────────────────────┘
```

Node.js gestisce migliaia di connessioni su un **singolo thread** grazie all'Event Loop. Ogni socket emette eventi quando succede qualcosa, e il tuo codice reagisce.

### **Eventi del Socket**

```javascript
server.on('connection', (socket) => {
    console.log('Nuova connessione');
    
    // 1. 'data' - Dati ricevuti
    socket.on('data', (data) => {
        console.log('Ricevuto:', data.length, 'bytes');
    });
    
    // 2. 'end' - Client ha chiuso la connessione (FIN)
    socket.on('end', () => {
        console.log('Client ha chiuso la connessione');
    });
    
    // 3. 'close' - Socket completamente chiuso
    socket.on('close', (hadError) => {
        if (hadError) {
            console.log('Socket chiuso con errore');
        } else {
            console.log('Socket chiuso normalmente');
        }
    });
    
    // 4. 'error' - Errore sul socket
    socket.on('error', (err) => {
        console.error('Errore socket:', err.message);
    });
    
    // 5. 'timeout' - Timeout di inattività
    socket.setTimeout(30000); // 30 secondi
    socket.on('timeout', () => {
        console.log('Timeout! Chiusura connessione...');
        socket.end('Timeout\n');
    });
    
    // 6. 'drain' - Buffer di scrittura svuotato
    socket.on('drain', () => {
        console.log('Buffer svuotato, posso scrivere ancora');
    });
});
```

### **Informazioni sulla Connessione**

```javascript
server.on('connection', (socket) => {
    // Informazioni remote (client)
    console.log('Remote address:', socket.remoteAddress);
    console.log('Remote port:', socket.remotePort);
    console.log('Remote family:', socket.remoteFamily); // IPv4 o IPv6
    
    // Informazioni locali (server)
    console.log('Local address:', socket.localAddress);
    console.log('Local port:', socket.localPort);
    
    // Stato della connessione
    console.log('Bytes scritti:', socket.bytesWritten);
    console.log('Bytes letti:', socket.bytesRead);
    console.log('Connessione distrutta?', socket.destroyed);
    console.log('Connessione pendente?', socket.pending);
    
    // Configurazione socket
    console.log('Keep-Alive:', socket.keepAlive);
    console.log('No Delay (Nagle):', socket.noDelay);
    console.log('Timeout:', socket.timeout);
});
```

### **Tracciamento Connessioni**

```javascript
class ConnectionTracker {
    constructor() {
        this.connections = new Map();
        this.nextId = 1;
    }
    
    add(socket) {
        const id = this.nextId++;
        const info = {
            id: id,
            socket: socket,
            connectedAt: new Date(),
            remoteAddress: socket.remoteAddress,
            remotePort: socket.remotePort,
            bytesRead: 0,
            bytesWritten: 0
        };
        
        this.connections.set(id, info);
        
        socket.on('data', (data) => {
            info.bytesRead += data.length;
        });
        
        socket.on('close', () => {
            info.bytesWritten = socket.bytesWritten;
            info.disconnectedAt = new Date();
            
            // Log finale
            const duration = info.disconnectedAt - info.connectedAt;
            console.log(`[${id}] Disconnesso dopo ${duration}ms`);
            console.log(`[${id}] Bytes: ↓${info.bytesRead} ↑${info.bytesWritten}`);
            
            this.connections.delete(id);
        });
        
        return id;
    }
    
    list() {
        return Array.from(this.connections.values()).map(c => ({
            id: c.id,
            address: `${c.remoteAddress}:${c.remotePort}`,
            duration: Date.now() - c.connectedAt.getTime(),
            bytesRead: c.bytesRead,
            bytesWritten: c.socket.bytesWritten
        }));
    }
    
    count() {
        return this.connections.size;
    }
}

// Uso
const tracker = new ConnectionTracker();

const server = net.createServer((socket) => {
    const connectionId = tracker.add(socket);
    console.log(`[${connectionId}] Nuova connessione`);
    
    socket.write(`Your connection ID: ${connectionId}\n`);
});

server.listen(3000);

// Statistiche ogni 10 secondi
setInterval(() => {
    console.log('\n=== Connessioni Attive ===');
    console.log(tracker.list());
    console.log(`Totale: ${tracker.count()}\n`);
}, 10000);
```

---

## **⚠️ Error Handling**

**La gestione errori è CRITICA**

In Node.js, un errore non gestito su uno stream causa il **crash dell'intero processo** con `uncaughtException`.

**Errori comuni e come gestirli:**

| Errore | Significato | Quando accade | Soluzione |
|--------|-------------|---------------|----------|
| `EADDRINUSE` | Porta già in uso | Altro processo usa la porta | Cambia porta o termina processo esistente |
| `EACCES` | Permessi insufficienti | Porte < 1024 senza root | Usa porta > 1024 o esegui come root ⚠️ |
| `ECONNRESET` | Connessione resettata | Client chiude improvvisamente | È normale, fai cleanup |
| `EPIPE` | Broken pipe | Scrivi su socket chiuso | Verifica `socket.writable` prima |
| `ETIMEDOUT` | Timeout | Nessuna risposta in tempo | Retry con backoff esponenziale |

**💡 BEST PRACTICE: Due livelli di error handling**

```
┌─────────────────────────────────────────┐
│          Server Error Handler           │  ← Errori globali (porta, binding)
├─────────────────────────────────────────┤
│  Socket 1 Error Handler ──┐            │
│  Socket 2 Error Handler ──┼─── Per     │  ← Errori per connessione
│  Socket 3 Error Handler ──┘    socket  │
└─────────────────────────────────────────┘
```

**Sempre avere:**
1. ✅ Error handler sul **server** (per errori di binding/ascolto)
2. ✅ Error handler su **ogni socket** (per errori di connessione)

Senza questi, il tuo processo **CRASHERÀ** alla prima connessione problematica!

### **Gestione Errori Base**

```javascript
const server = net.createServer((socket) => {
    // Error handler per il socket
    socket.on('error', (err) => {
        if (err.code === 'ECONNRESET') {
            console.log('Connessione resettata dal client');
        } else if (err.code === 'EPIPE') {
            console.log('Broken pipe - client disconnesso');
        } else if (err.code === 'ETIMEDOUT') {
            console.log('Timeout connessione');
        } else {
            console.error('Errore socket:', err);
        }
    });
    
    socket.on('data', (data) => {
        try {
            // Processa dati
            const message = data.toString();
            socket.write(`Ricevuto: ${message}`);
        } catch (err) {
            console.error('Errore processing:', err);
            socket.write('Errore nel processare il messaggio\n');
        }
    });
});

// Error handler per il server
server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error('❌ Porta già in uso');
        process.exit(1);
    } else if (err.code === 'EACCES') {
        console.error('❌ Permessi insufficienti per la porta');
        process.exit(1);
    } else {
        console.error('❌ Errore server:', err);
    }
});

server.listen(3000);
```

### **Error Handler Avanzato**

```javascript
class SafeServer {
    constructor(port) {
        this.port = port;
        this.server = net.createServer();
        this.setupErrorHandlers();
    }
    
    setupErrorHandlers() {
        // Error handler server
        this.server.on('error', this.handleServerError.bind(this));
        
        // Error handler connessioni
        this.server.on('connection', (socket) => {
            socket.on('error', (err) => this.handleSocketError(err, socket));
            
            // Setup safe handlers
            this.setupSafeHandlers(socket);
        });
    }
    
    handleServerError(err) {
        console.error('❌ Server Error:', err.code);
        
        const errorMap = {
            'EADDRINUSE': () => {
                console.error('Porta già in uso. Ritento tra 5 secondi...');
                setTimeout(() => this.start(), 5000);
            },
            'EACCES': () => {
                console.error('Permessi insufficienti');
                process.exit(1);
            },
            'ENOTFOUND': () => {
                console.error('Host non trovato');
                process.exit(1);
            }
        };
        
        const handler = errorMap[err.code];
        if (handler) {
            handler();
        } else {
            console.error('Errore sconosciuto:', err);
            process.exit(1);
        }
    }
    
    handleSocketError(err, socket) {
        console.error('⚠️ Socket Error:', err.code);
        
        const nonFatalErrors = ['ECONNRESET', 'EPIPE', 'ETIMEDOUT'];
        
        if (nonFatalErrors.includes(err.code)) {
            console.log('Errore non fatale, continuo...');
            socket.destroy(); // Cleanup
        } else {
            console.error('Errore fatale socket:', err);
            socket.destroy();
        }
    }
    
    setupSafeHandlers(socket) {
        socket.on('data', (data) => {
            try {
                this.handleData(data, socket);
            } catch (err) {
                console.error('Errore handling data:', err);
                socket.write('Internal server error\n');
            }
        });
    }
    
    handleData(data, socket) {
        // Processing sicuro dei dati
        const message = data.toString().trim();
        socket.write(`Echo: ${message}\n`);
    }
    
    start() {
        this.server.listen(this.port, () => {
            console.log(`✅ Server avviato sulla porta ${this.port}`);
        });
    }
}

// Uso
const server = new SafeServer(3000);
server.start();
```

---

## **📨 Invio e Ricezione Dati**

**Come funzionano lettura e scrittura su socket TCP**

I socket TCP sono **stream bidirezionali** - puoi leggere E scrivere contemporaneamente.

**Scrittura (Server → Client):**
```
Tuo codice: socket.write('data')
     ↓
Buffer Node.js (memoria)
     ↓
Buffer TCP Kernel
     ↓
Rete (pacchetti TCP)
     ↓
Client riceve
```

**Lettura (Client → Server):**
```
Client invia
     ↓
Rete (pacchetti TCP)
     ↓
Buffer TCP Kernel
     ↓
Buffer Node.js
     ↓
Evento 'data' nel tuo codice
```

**⚠️ IMPORTANTE: Backpressure**

Quando scrivi troppo velocemente, il buffer si riempie:
```javascript
const canContinue = socket.write('data');
if (!canContinue) {
    // Buffer pieno! Devi aspettare 'drain'
}
```

Ignorare backpressure causa **memory leak** (buffer cresce indefinitamente).

**💡 Stream TCP non sono message-based**

```
Invii:  'MSG1' 'MSG2' 'MSG3'
Ricevi: 'MSG1MS' 'G2MSG3'  ← Chunk boundaries arbitrari!
```

Devi implementare un **framing protocol** (vedi Guida 05).

### **Scrittura Dati**

```javascript
server.on('connection', (socket) => {
    // Metodo 1: socket.write()
    socket.write('Hello Client\n');
    socket.write(Buffer.from('Binary data'));
    
    // Metodo 2: socket.write() con callback
    socket.write('Message', 'utf8', () => {
        console.log('Dati scritti con successo');
    });
    
    // Metodo 3: socket.end() - scrive e chiude
    socket.end('Goodbye\n');
    
    // Check se posso scrivere
    if (socket.writable) {
        const canContinue = socket.write('Big data chunk');
        
        if (!canContinue) {
            console.log('Buffer pieno, aspetto drain event');
            socket.once('drain', () => {
                console.log('Buffer svuotato, posso continuare');
            });
        }
    }
});
```

### **Lettura Dati**

```javascript
server.on('connection', (socket) => {
    // Metodo 1: event 'data'
    socket.on('data', (chunk) => {
        console.log('Ricevuto chunk:', chunk.length, 'bytes');
        console.log('Contenuto:', chunk.toString());
    });
    
    // Metodo 2: encoding automatico
    socket.setEncoding('utf8');
    socket.on('data', (str) => {
        console.log('String ricevuta:', str);
    });
    
    // Metodo 3: buffering manuale
    let buffer = '';
    socket.on('data', (chunk) => {
        buffer += chunk.toString();
        
        // Processa messaggi completi (terminati da \n)
        let lines = buffer.split('\n');
        buffer = lines.pop(); // Mantieni l'ultimo pezzo incompleto
        
        for (const line of lines) {
            console.log('Messaggio completo:', line);
            handleMessage(line, socket);
        }
    });
});

function handleMessage(message, socket) {
    socket.write(`Processato: ${message}\n`);
}
```

### **Stream e Piping**

```javascript
const fs = require('fs');

server.on('connection', (socket) => {
    // Invia file al client
    const fileStream = fs.createReadStream('large-file.txt');
    fileStream.pipe(socket);
    
    fileStream.on('end', () => {
        console.log('File inviato completamente');
        socket.end();
    });
    
    fileStream.on('error', (err) => {
        console.error('Errore lettura file:', err);
        socket.end('Error\n');
    });
});

// Server che salva dati in file
server.on('connection', (socket) => {
    const writeStream = fs.createWriteStream('received-data.txt');
    
    socket.pipe(writeStream);
    
    writeStream.on('finish', () => {
        console.log('Dati salvati su file');
        socket.end('Data saved\n');
    });
});
```

---

## **📝 Esempi Completi**

**Scopo degli esempi**

Ora che hai visto i concetti fondamentali, vediamo **esempi completi e funzionanti** che combinano tutto ciò che abbiamo imparato.

Ogni esempio è:
- ✅ **Completo** - puoi copiarlo e eseguirlo immediatamente
- ✅ **Commentato** - ogni parte è spiegata
- ✅ **Pratico** - risolve un problema reale
- ✅ **Testabile** - include istruzioni per il test

### **Esempio 1: Echo Server**

**Cosa fa:** Rimanda indietro tutto ciò che riceve (classico per testing)  
**Quando usarlo:** Testing connessioni, debug protocolli, apprendimento  
**Concetti dimostrati:** Gestione base connessioni, eventi data/end/error

```javascript
const net = require('net');

const server = net.createServer((socket) => {
    console.log(`[${socket.remoteAddress}:${socket.remotePort}] Connesso`);
    
    socket.write('Benvenuto al Echo Server!\n');
    socket.write('Digita qualcosa e riceverai l\'echo\n\n');
    
    socket.on('data', (data) => {
        const message = data.toString().trim();
        console.log(`[${socket.remotePort}] Ricevuto: ${message}`);
        
        // Echo back
        socket.write(`ECHO: ${message}\n`);
    });
    
    socket.on('end', () => {
        console.log(`[${socket.remotePort}] Disconnesso`);
    });
    
    socket.on('error', (err) => {
        console.error(`[${socket.remotePort}] Errore:`, err.message);
    });
});

server.listen(3000, () => {
    console.log('Echo Server in ascolto sulla porta 3000');
    console.log('Test con: nc localhost 3000');
});

server.on('error', (err) => {
    console.error('Errore server:', err);
    process.exit(1);
});
```

**💡 Nota implementativa:**
- Usa `socket.write()` per inviare ogni messaggio
- L'evento `data` riceve Buffer, convertilo con `.toString()`
- Gestisci sempre `end` e `error` per cleanup
- `socket.remotePort` identifica univocamente il client

### **Esempio 2: Time Server**

**Cosa fa:** Invia l'ora corrente ogni secondo a ogni client connesso  
**Quando usarlo:** Streaming dati periodici, monitoring, feed real-time  
**Concetti dimostrati:** setInterval per socket, cleanup con clearInterval

```javascript
const net = require('net');

const server = net.createServer((socket) => {
    console.log('Client connesso');
    
    // Invia l'ora corrente ogni secondo
    const interval = setInterval(() => {
        const time = new Date().toISOString();
        socket.write(`${time}\n`);
    }, 1000);
    
    socket.on('end', () => {
        clearInterval(interval);
        console.log('Client disconnesso');
    });
    
    socket.on('error', (err) => {
        clearInterval(interval);
        console.error('Errore:', err.message);
    });
});

server.listen(3000, () => {
    console.log('Time Server in ascolto sulla porta 3000');
});
```

**💡 Nota implementativa:**
- **IMPORTANTE:** Usa `setInterval()` per inviare dati periodicamente
- **CRITICO:** Ferma l'interval con `clearInterval()` quando il client disconnette
- Senza `clearInterval()` avrai un **memory leak** (interval continua per sempre!)
- Gestisci sia `end` che `error` per cleanup completo

**Test:**
```bash
nc localhost 3000
# Vedrai l'ora aggiornarsi ogni secondo
# Premi Ctrl+C per disconnettere
```

### **Esempio 3: Chat Server Semplice**

**Cosa fa:** Chat multi-client dove ogni messaggio è broadcast a tutti  
**Quando usarlo:** Chat rooms, notifiche broadcast, collaborative tools  
**Concetti dimostrati:** Tracking connessioni multiple, broadcast pattern, gestione Set

```javascript
const net = require('net');

class SimpleChatServer {
    constructor(port) {
        this.port = port;
        this.clients = new Set();
        this.server = net.createServer(this.handleConnection.bind(this));
    }
    
    handleConnection(socket) {
        const clientName = `${socket.remoteAddress}:${socket.remotePort}`;
        console.log(`${clientName} connesso`);
        
        this.clients.add(socket);
        
        // Notifica agli altri
        this.broadcast(`${clientName} si è unito alla chat\n`, socket);
        
        socket.write(`Benvenuto! Sei ${clientName}\n`);
        socket.write(`Ci sono ${this.clients.size - 1} altri utenti online\n\n`);
        
        socket.on('data', (data) => {
            const message = data.toString().trim();
            console.log(`${clientName}: ${message}`);
            
            // Broadcast a tutti tranne mittente
            this.broadcast(`[${clientName}]: ${message}\n`, socket);
        });
        
        socket.on('end', () => {
            this.clients.delete(socket);
            console.log(`${clientName} disconnesso`);
            this.broadcast(`${clientName} ha lasciato la chat\n`, socket);
        });
        
        socket.on('error', (err) => {
            console.error(`${clientName} errore:`, err.message);
            this.clients.delete(socket);
        });
    }
    
    broadcast(message, sender) {
        for (const client of this.clients) {
            if (client !== sender && !client.destroyed) {
                client.write(message);
            }
        }
    }
    
    start() {
        this.server.listen(this.port, () => {
            console.log(`Chat Server in ascolto sulla porta ${this.port}`);
            console.log('Connetti con: nc localhost', this.port);
        });
    }
}

// Avvia chat server
const chatServer = new SimpleChatServer(3000);
chatServer.start();
```

**💡 Note implementative:**

**Pattern: Tracking connessioni con Set**
```javascript
this.clients = new Set();  // ← Mantiene lista di socket attivi
this.clients.add(socket);   // Aggiungi quando connette
this.clients.delete(socket); // Rimuovi quando disconnette
```

**Pattern: Broadcast selettivo**
```javascript
for (const client of this.clients) {
    if (client !== sender && !client.destroyed) {  // ← Escludi mittente e socket chiusi
        client.write(message);
    }
}
```

**Perché controllare `!client.destroyed`?**  
Un socket può chiudersi tra quando lo aggiungi al Set e quando fai broadcast.  
Scrivere su socket distrutto causa errore!

**Test della chat:**
```bash
# Terminale 1
nc localhost 3000
# Terminale 2  
nc localhost 3000
# Terminale 3
nc localhost 3000

# Ora scrivi in uno qualsiasi - vedrai il messaggio negli altri!
```

---

## **🎓 Riepilogo**

**Creazione Server:**
- `net.createServer()` per creare il server
- `server.listen(port)` per avviare
- Handler per nuove connessioni

**Eventi Server:**
- `listening` - Server pronto
- `connection` - Nuova connessione
- `close` - Server chiuso
- `error` - Errore del server

**Eventi Socket:**
- `data` - Dati ricevuti
- `end` - Connessione chiusa dal client
- `close` - Socket completamente chiuso
- `error` - Errore sul socket
- `timeout` - Timeout inattività
- `drain` - Buffer svuotato

**Best Practices:**
- ✅ Sempre gestire errori (`error` events)
- ✅ Tracciare connessioni attive
- ✅ Implementare graceful shutdown
- ✅ Configurare timeout appropriati
- ✅ Validare input dai client
- ✅ Limitare dimensione messaggi

---

**Prossima Guida**: [02-TCP_Client_Base.md](./02-TCP_Client_Base.md) - Client TCP fondamentali
