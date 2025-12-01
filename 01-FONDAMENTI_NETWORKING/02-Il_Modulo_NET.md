# 1.2 Il modulo net di Node.js

## Indice
- [Panoramica del modulo net](#panoramica-del-modulo-net)
- [Importazione e Setup](#importazione-e-setup)
- [Architettura Event-Driven](#architettura-event-driven)
- [Stream e Buffer in Node.js](#stream-e-buffer-in-nodejs)
- [Async/Await con Socket](#asyncawait-con-socket)
- [Promise-Based Networking](#promise-based-networking)

---

## Panoramica del modulo net

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

**Teoria:** Un server TCP è un processo che rimane in ascolto su una porta specifica, pronto ad accettare connessioni da client remoti. Il modulo `net` di Node.js semplifica la creazione di server TCP utilizzando un'architettura event-driven.

```javascript
const net = require('net');

// createServer() crea un server TCP e accetta una callback
// che viene eseguita ogni volta che un nuovo client si connette
const server = net.createServer((socket) => {
    // socket: oggetto che rappresenta la connessione con il client
    console.log('Client connesso');
    console.log('Indirizzo client:', socket.remoteAddress);
    console.log('Porta client:', socket.remotePort);
    
    // L'evento 'data' viene emesso ogni volta che arrivano dati dal client
    socket.on('data', (data) => {
        // data è un Buffer contenente i byte ricevuti
        console.log('Ricevuto:', data.toString());
        
        // Possiamo rispondere al client scrivendo sul socket
        socket.write('Messaggio ricevuto!\n');
    });
    
    // Gestione disconnessione del client
    socket.on('end', () => {
        console.log('Client disconnesso');
    });
});

// listen() mette il server in ascolto sulla porta specificata
// La callback viene eseguita quando il server è pronto
server.listen(8080, () => {
    console.log('Server in ascolto su porta 8080');
    console.log('In attesa di connessioni...');
});
```

### Client TCP Base

**Teoria:** Un client TCP è un processo che inizia una connessione verso un server remoto. Deve specificare l'indirizzo IP (o hostname) e la porta del server a cui connettersi.

```javascript
const net = require('net');

// net.connect() crea un socket e inizia la connessione al server
// Parametri: { port: numero_porta, host: indirizzo_server }
const client = net.connect({ port: 8080, host: 'localhost' });

// L'evento 'connect' viene emesso quando la connessione è stabilita
client.on('connect', () => {
    console.log('Connesso al server');
    console.log('Indirizzo locale:', client.localAddress);
    console.log('Porta locale:', client.localPort);
    
    // Invio dati al server
    // write() scrive dati sul socket (li invia al server)
    client.write('Hello Server!');
});

// Ricezione dati dal server
client.on('data', (data) => {
    // data è un Buffer con i dati ricevuti dal server
    console.log('Ricevuto:', data.toString());
});

// Gestione errori di connessione
client.on('error', (err) => {
    console.error('Errore connessione:', err.message);
});

// Gestione chiusura connessione
client.on('close', () => {
    console.log('Connessione chiusa');
});
```

---

## Architettura Event-Driven

Node.js utilizza un'architettura **event-driven** basata sul pattern **Observer**.

### Event Loop

**Teoria:** L'Event Loop è il cuore di Node.js. È un meccanismo che permette a Node.js di eseguire operazioni non-blocking nonostante JavaScript sia single-threaded. L'Event Loop gestisce l'esecuzione del codice, la raccolta ed elaborazione di eventi, e l'esecuzione di task in coda.

**Come funziona:**
1. Il codice sincrono viene eseguito immediatamente (Call Stack)
2. Le operazioni asincrone (I/O, timer) vengono delegate al sistema operativo
3. Quando un'operazione asincrona è completata, la sua callback viene messa in coda
4. L'Event Loop preleva le callback dalla coda e le esegue quando il Call Stack è vuoto

```
┌───────────────────────────┐
│        Call Stack         │  ← Esecuzione codice sincrono
│   (Codice Sincrono)       │    (funzioni chiamate direttamente)
└───────────┬───────────────┘
            │
            ↓
┌───────────────────────────┐
│       Event Loop          │  ← Ciclo continuo che gestisce eventi
│  (Single Thread)          │    Node.js usa UN SOLO thread JavaScript
└───────────┬───────────────┘
            │
            ├─> Timers (setTimeout, setInterval)
            │   → Callback dei timer scaduti
            │
            ├─> Pending I/O (network, file system)
            │   → Callback delle operazioni I/O completate
            │
            ├─> Poll (check for new I/O events)
            │   → Controlla nuovi eventi I/O e li processa
            │
            ├─> Check (setImmediate)
            │   → Callback di setImmediate()
            │
            └─> Close callbacks (socket.on('close'))
                → Callback di chiusura (socket, file, etc.)
```

**Vantaggi:**
- ✅ Gestisce migliaia di connessioni simultanee con un solo thread
- ✅ Nessun overhead di context switching tra thread
- ✅ Uso efficiente della CPU

**Svantaggi:**
- ❌ Operazioni CPU-intensive bloccano l'Event Loop
- ❌ Necessità di worker threads per calcoli pesanti

### Eventi nei Socket

#### Server Events

**Teoria:** I server TCP emettono diversi eventi durante il loro ciclo di vita. Comprendere questi eventi è fondamentale per gestire correttamente le connessioni e gli errori.

```javascript
const server = net.createServer();

// EVENTO 'listening'
// Emesso quando il server inizia ad ascoltare sulla porta specificata
// È sicuro iniziare ad accettare connessioni dopo questo evento
server.on('listening', () => {
    console.log('Server in ascolto');
    const addr = server.address();
    console.log(`Porta: ${addr.port}, Famiglia: ${addr.family}`);
});

// EVENTO 'connection'
// Emesso ogni volta che un nuovo client si connette
// Riceve come parametro il socket della nuova connessione
server.on('connection', (socket) => {
    console.log('Nuova connessione');
    console.log(`Client: ${socket.remoteAddress}:${socket.remotePort}`);
    
    // Ogni socket va gestito con i suoi event handler
    socket.on('data', (data) => {
        console.log('Dati ricevuti:', data.toString());
    });
});

// EVENTO 'close'
// Emesso quando il server smette di accettare nuove connessioni
// Le connessioni esistenti rimangono attive
server.on('close', () => {
    console.log('Server chiuso');
    console.log('Non accetta più nuove connessioni');
});

// EVENTO 'error'
// Emesso quando si verifica un errore (es: porta già in uso)
// IMPORTANTE: se non gestito, l'applicazione si chiude
server.on('error', (err) => {
    console.error('Errore:', err.message);
    
    // Errore comune: porta già in uso
    if (err.code === 'EADDRINUSE') {
        console.error('La porta 8080 è già in uso');
        process.exit(1);
    }
});

// Avvia il server sulla porta 8080
server.listen(8080);
```

#### Socket Events (Client o Server)

**Teoria:** Ogni socket (sia lato client che server) emette eventi durante il suo ciclo di vita. La corretta gestione di questi eventi è essenziale per creare applicazioni di rete robuste.

```javascript
// EVENTO 'connect' (solo client)
// Emesso quando il client si connette con successo al server
// Solo i socket client emettono questo evento
socket.on('connect', () => {
    console.log('Connesso');
    console.log('Connessione stabilita con successo');
    // Ora è sicuro iniziare a inviare dati
    socket.write('Hello Server!');
});

// EVENTO 'data'
// Emesso quando arrivano dati dal socket
// chunk: Buffer contenente i dati ricevuti
socket.on('data', (chunk) => {
    console.log('Dati ricevuti:', chunk.toString());
    console.log('Dimensione:', chunk.length, 'bytes');
    
    // I dati possono arrivare frammentati!
    // TCP è uno stream, non garantisce che i dati arrivino
    // nello stesso modo in cui sono stati inviati
});

// EVENTO 'drain'
// Emesso quando il buffer di scrittura interno è svuotato
// Importante per gestire il backpressure (pressione contraria)
socket.on('drain', () => {
    console.log('Buffer svuotato, posso scrivere ancora');
    // Utile quando si inviano grandi quantità di dati
});

// EVENTO 'end'
// Emesso quando l'altra parte ha chiuso la connessione
// Il socket può ancora inviare dati (half-closed connection)
socket.on('end', () => {
    console.log('Altra parte ha chiuso la connessione');
    console.log('Posso ancora inviare dati');
    // Di solito si chiude anche questo lato
    socket.end();
});

// EVENTO 'close'
// Emesso quando il socket è completamente chiuso
// hadError: true se il socket si è chiuso a causa di un errore
socket.on('close', (hadError) => {
    console.log('Socket chiuso');
    if (hadError) {
        console.log('Chiusura dovuta a un errore');
    }
    // A questo punto il socket non può più essere usato
});

// EVENTO 'error'
// Emesso quando si verifica un errore
// IMPORTANTE: se non gestito, l'applicazione potrebbe crashare
socket.on('error', (err) => {
    console.error('Errore socket:', err.message);
    
    // Errori comuni:
    // ECONNREFUSED: connessione rifiutata (server non disponibile)
    // ETIMEDOUT: timeout di connessione
    // ECONNRESET: connessione resettata dall'altra parte
});

// EVENTO 'timeout'
// Emesso quando il socket rimane inattivo troppo a lungo
// Configurabile con socket.setTimeout(ms)
socket.on('timeout', () => {
    console.log('Timeout inattività');
    // Il timeout NON chiude automaticamente il socket
    // Devi chiuderlo manualmente se necessario
    socket.end();
});

// Configura timeout di 30 secondi
socket.setTimeout(30000);
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

**Teoria:** Node.js utilizza I/O non-bloccante, il che significa che le operazioni di rete non fermano l'esecuzione del codice. Questo è fondamentale per le prestazioni e la scalabilità.

**Differenza tra Blocking e Non-Blocking:**
- **Blocking I/O** (tradizionale): il programma si ferma e aspetta che l'operazione I/O sia completata
- **Non-Blocking I/O** (Node.js): il programma continua e viene notificato quando l'operazione è completata

```javascript
const net = require('net');

console.log('1 - Inizio');
console.log('Tento di connettermi...');

// net.connect() inizia la connessione ma NON aspetta che sia completata
// Ritorna immediatamente e registra una callback per quando sarà pronta
const client = net.connect({ port: 8080 }, () => {
    // Questa callback viene eseguita DOPO, quando la connessione è stabilita
    console.log('3 - Connesso (callback asincrono)');
    console.log('La connessione è ora attiva!');
});

// Questo codice viene eseguito PRIMA della callback sopra
// Node.js non aspetta la connessione!
console.log('2 - Fine codice sincrono');
console.log('Il programma continua mentre la connessione è in corso...');

// Output:
// 1 - Inizio
// Tento di connettermi...
// 2 - Fine codice sincrono
// Il programma continua mentre la connessione è in corso...
// 3 - Connesso (callback asincrono)
// La connessione è ora attiva!
```

**Spiegazione dell'esecuzione:**
1. Il codice sincrono viene eseguito in sequenza (righe 3-5)
2. `net.connect()` inizia la connessione in background
3. Il codice continua senza aspettare (righe 13-14)
4. Quando la connessione è pronta, l'Event Loop esegue la callback (righe 8-10)

**Vantaggi:**
- ✅ Il programma non si blocca mai
- ✅ Può gestire migliaia di connessioni contemporaneamente
- ✅ Uso efficiente delle risorse

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

**Teoria:** In Node.js, un socket TCP è uno **Stream Duplex**, cioè uno stream che può sia leggere che scrivere dati. Questo significa che eredita tutti i metodi e gli eventi degli stream Node.js.

**Cos'è uno Stream Duplex?**
- È contemporaneamente un **Readable Stream** (può leggere dati)
- E un **Writable Stream** (può scrivere dati)
- Le due direzioni sono indipendenti

```javascript
const net = require('net');

const socket = net.connect({ port: 8080 });

// --- PARTE READABLE (Lettura) ---
// Il socket può ricevere dati come un Readable Stream
socket.on('data', (chunk) => {
    // chunk è un Buffer con i dati ricevuti
    console.log('Ricevuto:', chunk.toString());
    console.log('Bytes ricevuti:', chunk.length);
});

// --- PARTE WRITABLE (Scrittura) ---
// Il socket può inviare dati come un Writable Stream
socket.write('Hello\n'); // Invia dati al server
socket.write('World\n'); // Invia altri dati

// --- PIPE: Collegamento tra Stream ---
// pipe() collega l'output di uno stream all'input di un altro
const fs = require('fs');
const fileStream = fs.createReadStream('file.txt');

// Legge file.txt e invia il contenuto al socket automaticamente
fileStream.pipe(socket);
// Equivalente a:
// fileStream.on('data', (chunk) => socket.write(chunk));

// Esempio: Salva dati ricevuti dal socket in un file
const outputFile = fs.createWriteStream('received.txt');
socket.pipe(outputFile); // Scrive tutto ciò che arriva dal socket nel file
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

**Teoria:** Il **backpressure** (pressione contraria) è un meccanismo che previene l'overflow della memoria quando si inviano dati più velocemente di quanto il destinatario possa riceverli.

**Problema:**
Se scrivi dati troppo velocemente sul socket, i dati vengono accumulati in un buffer interno. Se il buffer si riempie, rischi di saturare la memoria.

**Soluzione:**
Node.js fornisce un meccanismo di backpressure automatico:
- `socket.write()` ritorna `true` se il buffer ha spazio
- `socket.write()` ritorna `false` se il buffer è pieno
- L'evento `drain` viene emesso quando il buffer è di nuovo vuoto

```javascript
function writeMillionRecords(socket) {
    let i = 0;
    
    function write() {
        let ok = true; // Flag che indica se possiamo continuare a scrivere
        
        // Scrivi finché il buffer ha spazio E ci sono dati da inviare
        while (i < 1000000 && ok) {
            const data = `Record ${i}\n`;
            
            // write() ritorna false se il buffer è pieno
            ok = socket.write(data);
            i++;
            
            // Se ok è false, il buffer è pieno:
            // DOBBIAMO fermarci e aspettare l'evento 'drain'
        }
        
        if (i < 1000000) {
            // Ci sono ancora dati da inviare, ma il buffer è pieno
            console.log('Buffer pieno, aspetto drain...');
            
            // Aspetta che il buffer si svuoti
            socket.once('drain', () => {
                console.log('Buffer svuotato, riprendo...');
                write(); // Riprendi a scrivere
            });
        } else {
            // Tutti i dati sono stati inviati
            console.log('Tutti i record inviati!');
            socket.end();
        }
    }
    
    write(); // Inizia a scrivere
}

// Uso:
const socket = net.connect({ port: 8080 }, () => {
    console.log('Connesso, invio 1 milione di record...');
    writeMillionRecords(socket);
});

// Senza backpressure: RISCHIO DI MEMORY OVERFLOW!
// Con backpressure: Invio controllato, memoria sotto controllo
```

---

### Buffer

I **Buffer** sono array di byte per gestire dati binari.

#### Creazione Buffer

**Teoria:** Un **Buffer** è un'area di memoria che contiene una sequenza di byte. In Node.js, i Buffer sono utilizzati per gestire dati binari (immagini, file, dati di rete).

**Differenza tra Buffer e String:**
- **String**: sequenza di caratteri Unicode (testo)
- **Buffer**: sequenza di byte (dati binari)

```javascript
// --- METODO 1: Da stringa ---
// Crea un Buffer da una stringa usando encoding UTF-8 (default)
const buf1 = Buffer.from('Hello');
console.log(buf1); // <Buffer 48 65 6c 6c 6f>
// Ogni numero esadecimale rappresenta un byte (carattere ASCII)

// Specifica encoding diverso
const buf1b = Buffer.from('Ciao', 'utf8');
const buf1c = Buffer.from('48656c6c6f', 'hex'); // Da stringa esadecimale

// --- METODO 2: Alloca buffer vuoto (sicuro) ---
// Crea un buffer di 10 bytes inizializzati a zero
const buf2 = Buffer.alloc(10);
console.log(buf2); // <Buffer 00 00 00 00 00 00 00 00 00 00>
// SICURO: tutti i byte sono impostati a 0
// Usa questo metodo per buffer che verranno riempiti dopo

// Alloca buffer con valore iniziale specifico
const buf2b = Buffer.alloc(5, 'a'); // Riempie con 'a'
console.log(buf2b); // <Buffer 61 61 61 61 61>

// --- METODO 3: Alloca buffer non inizializzato (veloce ma unsafe) ---
// Crea un buffer di 10 bytes NON inizializzati
const buf3 = Buffer.allocUnsafe(10);
console.log(buf3); // <Buffer ?? ?? ?? ?? ?? ?? ?? ?? ?? ??>
// ATTENZIONE: contiene dati casuali dalla memoria!
// PIÙ VELOCE ma POTENZIALMENTE PERICOLOSO (leak di dati sensibili)
// Usa solo se riempirai subito tutti i byte

// --- METODO 4: Da array di byte ---
// Crea un buffer da un array di numeri (0-255)
const buf4 = Buffer.from([0x48, 0x65, 0x6c, 0x6c, 0x6f]);
console.log(buf4.toString()); // 'Hello'
// 0x48 = 72 decimal = 'H' in ASCII
// 0x65 = 101 decimal = 'e' in ASCII
// etc.

// Esempio pratico: creare un header di protocollo
const header = Buffer.from([0x01, 0x00, 0xFF, 0x10]); // 4 bytes
console.log(header); // <Buffer 01 00 ff 10>
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

**Teoria:** Quando lavori con socket TCP, i dati vengono sempre ricevuti come **Buffer**. Questo perché TCP trasporta byte, non stringhe. È tua responsabilità interpretare questi byte correttamente.

**Punti chiave:**
- I dati possono arrivare **frammentati** (un messaggio può arrivare in più chunk)
- I dati possono arrivare **concatenati** (più messaggi in un solo chunk)
- Devi gestire tu la **delimitazione** dei messaggi

```javascript
socket.on('data', (chunk) => {
    // chunk è SEMPRE un Buffer, mai una stringa
    console.log('Tipo:', chunk.constructor.name); // 'Buffer'
    console.log('Dimensione:', chunk.length, 'bytes');
    
    // --- INTERPRETARE COME TESTO ---
    // Converti il Buffer in stringa usando l'encoding appropriato
    const text = chunk.toString('utf8');
    console.log('Testo:', text);
    
    // --- GESTIRE COME DATI BINARI ---
    // Accedi ai singoli byte come array
    const firstByte = chunk[0];  // Primo byte (0-255)
    const secondByte = chunk[1]; // Secondo byte
    console.log('Primi 2 bytes:', firstByte, secondByte);
    
    // Esempio: leggi un numero intero a 32-bit big-endian
    if (chunk.length >= 4) {
        const number = chunk.readUInt32BE(0); // Legge 4 bytes dalla posizione 0
        console.log('Numero:', number);
    }
    
    // --- CONCATENARE BUFFER ---
    // ATTENZIONE: NON usare + per concatenare Buffer!
    // Usa Buffer.concat()
    const combined = Buffer.concat([chunk, Buffer.from(' World')]);
    console.log('Concatenato:', combined.toString());
    
    // --- PROBLEMA: MESSAGGI FRAMMENTATI ---
    // Se invii "Hello\nWorld\n", potrebbe arrivare in 2 chunk:
    // Chunk 1: "Hello\n"
    // Chunk 2: "World\n"
    // Oppure in 1 chunk: "Hello\nWorld\n"
    // Devi gestire tu la delimitazione!
});

// --- INVIARE DATI ---
// Puoi inviare sia Buffer che stringhe
const textData = 'Hello Server!\n';
socket.write(textData); // write() converte automaticamente in Buffer

// Per dati binari, usa Buffer esplicitamente
const binaryData = Buffer.from([0x01, 0x02, 0x03, 0x04]);
socket.write(binaryData);

// Invia numero intero come 4 bytes
const numberBuffer = Buffer.alloc(4);
numberBuffer.writeUInt32BE(12345, 0); // Scrive 12345 come big-endian
socket.write(numberBuffer);
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

**Teoria:** Le **Promise** sono un modo moderno per gestire operazioni asincrone in JavaScript. Con **async/await** possiamo scrivere codice asincrono che sembra sincrono, rendendolo più leggibile.

**Vantaggi di async/await:**
- ✅ Codice più lineare e facile da leggere
- ✅ Gestione errori con try/catch tradizionale
- ✅ Evita "callback hell" (callback annidate)
- ✅ Più facile debuggare

```javascript
const net = require('net');
const { promisify } = require('util');

/**
 * Connette a un server e ritorna il socket quando la connessione è stabilita
 * @param {string} host - Hostname o IP del server
 * @param {number} port - Porta del server
 * @returns {Promise<net.Socket>} Promise che risolve con il socket connesso
 */
async function connectToServer(host, port) {
    const socket = net.connect({ host, port });
    
    // Trasforma gli eventi del socket in una Promise
    // La Promise si risolve quando la connessione è stabilita
    // Si rigetta se c'è un errore
    await new Promise((resolve, reject) => {
        // once() invece di on() perché vogliamo ascoltare l'evento una sola volta
        socket.once('connect', () => {
            resolve(); // Connessione riuscita
        });
        socket.once('error', (err) => {
            reject(err); // Connessione fallita
        });
    });
    
    console.log('Connesso!');
    console.log(`Socket locale: ${socket.localAddress}:${socket.localPort}`);
    console.log(`Server remoto: ${socket.remoteAddress}:${socket.remotePort}`);
    
    return socket; // Ritorna il socket connesso
}

// --- USO CON ASYNC/AWAIT ---
// IIFE (Immediately Invoked Function Expression) per usare await al top-level
(async () => {
    try {
        // await aspetta che la Promise si risolva
        // Il codice si "ferma" qui fino a quando la connessione è stabilita
        console.log('Connessione in corso...');
        const socket = await connectToServer('localhost', 8080);
        
        // Questo codice viene eseguito DOPO che la connessione è stabilita
        console.log('Invio messaggio...');
        socket.write('Hello\n');
        
        // Aspetta risposta
        const response = await new Promise((resolve) => {
            socket.once('data', (data) => {
                resolve(data.toString());
            });
        });
        console.log('Risposta ricevuta:', response);
        
        socket.end();
    } catch (err) {
        // Tutti gli errori vengono catturati qui
        console.error('Errore:', err.message);
        
        // Errori comuni:
        if (err.code === 'ECONNREFUSED') {
            console.error('Server non disponibile');
        } else if (err.code === 'ETIMEDOUT') {
            console.error('Timeout di connessione');
        }
    }
})();
```

### Request-Response Pattern

**Teoria:** Il pattern **Request-Response** è uno dei modelli di comunicazione più comuni in rete. Il client invia una richiesta e aspetta la risposta del server. Con async/await possiamo implementare questo pattern in modo molto pulito.

**Caratteristiche:**
- ✅ Comunicazione sincrona (dal punto di vista logico)
- ✅ Facile da comprendere e debuggare
- ✅ Supporta timeout per evitare attese infinite
- ❌ Un socket può gestire una richiesta alla volta

```javascript
/**
 * Invia una richiesta al server e aspetta la risposta
 * @param {net.Socket} socket - Socket connesso al server
 * @param {string} request - Richiesta da inviare
 * @returns {Promise<string>} Promise che risolve con la risposta
 */
async function sendRequest(socket, request) {
    return new Promise((resolve, reject) => {
        // Imposta timeout di 5 secondi
        // Se non arriva risposta entro 5 secondi, rigetta la Promise
        const timeout = setTimeout(() => {
            reject(new Error('Timeout: il server non ha risposto entro 5 secondi'));
        }, 5000);
        
        // Ascolta per la risposta (una sola volta)
        socket.once('data', (data) => {
            clearTimeout(timeout); // Annulla il timeout
            resolve(data.toString()); // Ritorna la risposta
        });
        
        // Gestisce errori durante l'attesa
        socket.once('error', (err) => {
            clearTimeout(timeout); // Annulla il timeout
            reject(err);
        });
        
        // Invia la richiesta al server
        socket.write(request + '\n'); // Aggiunge newline come delimitatore
    });
}

// --- USO DEL PATTERN REQUEST-RESPONSE ---
(async () => {
    // Connetti al server (riusa la funzione creata prima)
    const socket = await connectToServer('localhost', 8080);
    
    try {
        // Richiesta 1: chiedi dati
        console.log('Invio prima richiesta...');
        const response1 = await sendRequest(socket, 'GET /data');
        console.log('Risposta 1:', response1);
        
        // Richiesta 2: chiedi stato
        console.log('Invio seconda richiesta...');
        const response2 = await sendRequest(socket, 'GET /status');
        console.log('Risposta 2:', response2);
        
        // Le richieste vengono eseguite in SEQUENZA
        // response2 viene ricevuto DOPO response1
    } catch (err) {
        console.error('Errore:', err.message);
        
        // Possibili errori:
        // - Timeout (server non risponde)
        // - Errore di rete
        // - Socket chiuso dal server
    } finally {
        // Chiudi sempre il socket quando hai finito
        socket.end();
        console.log('Socket chiuso');
    }
})();
```

### Async Iterators

**Teoria:** Gli **Async Iterator** sono un modo elegante per leggere stream di dati in modo asincrono usando la sintassi `for await...of`. Sono particolarmente utili per processare dati riga per riga o in chunk.

**Cos'è un Async Generator?**
- È una funzione che può essere "pausata" e "ripresa"
- Usa `yield` per emettere valori uno alla volta
- Si definisce con `async function*`
- Permette di iterare dati asincroni come se fossero un array

```javascript
const net = require('net');

/**
 * Async Generator che legge dati dal socket riga per riga
 * @param {net.Socket} socket - Socket da cui leggere
 * @yields {string} Una riga alla volta
 */
async function* readLines(socket) {
    let buffer = ''; // Accumula dati frammentati
    
    // for await...of itera automaticamente su ogni chunk di dati
    // Ogni volta che arriva un chunk, il loop riprende
    for await (const chunk of socket) {
        // Aggiungi il nuovo chunk al buffer
        buffer += chunk.toString();
        
        // Cerca tutte le righe complete (terminate da \n)
        let newlineIdx;
        while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
            // Estrai la riga completa (senza \n)
            const line = buffer.substring(0, newlineIdx);
            // Rimuovi la riga dal buffer
            buffer = buffer.substring(newlineIdx + 1);
            // Emetti la riga (yield la pausa e ritorna il valore)
            yield line;
        }
    }
    
    // Quando il socket si chiude, se c'è ancora qualcosa nel buffer
    // (ultima riga senza \n finale), emettila
    if (buffer.length > 0) {
        yield buffer;
    }
}

// --- USO DELL'ASYNC ITERATOR ---
(async () => {
    const socket = net.connect({ port: 8080 });
    
    console.log('Lettura righe dal socket...');
    
    // for await...of itera su ogni riga non appena disponibile
    for await (const line of readLines(socket)) {
        console.log('Linea ricevuta:', line);
        
        // Puoi processare ogni riga immediatamente
        // senza dover aspettare che arrivi tutto il messaggio
        
        // Esempio: parsing di un protocollo custom
        if (line.startsWith('COMMAND:')) {
            const command = line.substring(8);
            console.log('Comando ricevuto:', command);
        }
    }
    
    console.log('Stream terminato');
})();

// VANTAGGI:
// ✅ Gestione automatica della frammentazione
// ✅ Codice pulito e leggibile
// ✅ Memory-efficient (processa riga per riga)
// ✅ Backpressure automatico
```

---

## Promise-Based Networking

### Wrapper Class con Promise

**Teoria:** Creare una **classe wrapper** attorno al socket TCP rende il codice più organizzato e riutilizzabile. Incapsula tutta la logica di connessione, invio, ricezione e chiusura in un'unica classe facile da usare.

**Vantaggi di una classe wrapper:**
- ✅ API più pulita e intuitiva
- ✅ Riutilizzabile in tutto il progetto
- ✅ Gestione errori centralizzata
- ✅ Facile da testare
- ✅ Nasconde la complessità degli eventi

```javascript
/**
 * Classe che incapsula un client TCP con API basata su Promise
 */
class TcpClient {
    /**
     * Costruttore della classe
     * @param {string} host - Hostname o IP del server
     * @param {number} port - Porta del server
     */
    constructor(host, port) {
        this.host = host;
        this.port = port;
        this.socket = null; // Socket ancora non connesso
    }
    
    /**
     * Connette al server
     * @returns {Promise<void>} Promise che risolve quando connesso
     */
    async connect() {
        return new Promise((resolve, reject) => {
            // Crea il socket e inizia la connessione
            this.socket = net.connect({ 
                host: this.host, 
                port: this.port 
            });
            
            // Connessione riuscita
            this.socket.once('connect', () => {
                console.log(`Connesso a ${this.host}:${this.port}`);
                resolve();
            });
            
            // Connessione fallita
            this.socket.once('error', (err) => {
                console.error('Errore connessione:', err.message);
                reject(err);
            });
        });
    }
    
    /**
     * Invia dati al server
     * @param {string|Buffer} data - Dati da inviare
     * @returns {Promise<void>} Promise che risolve quando i dati sono inviati
     */
    async send(data) {
        return new Promise((resolve, reject) => {
            // Verifica che il socket sia connesso
            if (!this.socket || this.socket.destroyed) {
                return reject(new Error('Socket non connesso'));
            }
            
            // write() accetta una callback opzionale
            // che viene chiamata quando i dati sono scritti nel buffer
            this.socket.write(data, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }
    
    /**
     * Riceve dati dal server (aspetta fino a che arrivano dati)
     * @returns {Promise<string>} Promise che risolve con i dati ricevuti
     */
    async receive() {
        return new Promise((resolve, reject) => {
            if (!this.socket) {
                return reject(new Error('Socket non connesso'));
            }
            
            // Timeout di 5 secondi
            const timeout = setTimeout(() => {
                reject(new Error('Timeout ricezione: nessun dato ricevuto'));
            }, 5000);
            
            // Aspetta dati
            this.socket.once('data', (data) => {
                clearTimeout(timeout);
                resolve(data.toString());
            });
            
            // Gestisce errori
            this.socket.once('error', (err) => {
                clearTimeout(timeout);
                reject(err);
            });
        });
    }
    
    /**
     * Chiude la connessione
     * @returns {Promise<void>} Promise che risolve quando il socket è chiuso
     */
    async close() {
        return new Promise((resolve) => {
            // Se non c'è socket, risolvi immediatamente
            if (!this.socket) {
                return resolve();
            }
            
            // Aspetta che il socket sia completamente chiuso
            this.socket.once('close', () => {
                console.log('Socket chiuso');
                resolve();
            });
            
            // Chiudi il socket (invia FIN al server)
            this.socket.end();
        });
    }
}

// --- USO DELLA CLASSE WRAPPER ---
(async () => {
    // Crea un'istanza del client
    const client = new TcpClient('localhost', 8080);
    
    try {
        // Connetti al server
        await client.connect();
        console.log('✓ Connessione stabilita');
        
        // Invia un messaggio
        await client.send('Hello Server\n');
        console.log('✓ Messaggio inviato');
        
        // Ricevi la risposta
        const response = await client.receive();
        console.log('✓ Risposta ricevuta:', response);
        
        // Chiudi la connessione
        await client.close();
        console.log('✓ Disconnesso');
    } catch (err) {
        console.error('✗ Errore:', err.message);
    }
})();

// VANTAGGI:
// ✅ Codice molto più pulito
// ✅ Facile da usare
// ✅ Gestione errori semplificata
// ✅ Riutilizzabile
```

### Error Handling con Try-Catch

**Teoria:** Con async/await, la gestione degli errori diventa molto più semplice grazie al blocco **try-catch**. Possiamo gestire tutti gli errori asincroni come se fossero sincroni, rendendo il codice più leggibile e manutenibile.

**Pattern di gestione errori:**
- **try**: esegue il codice che potrebbe generare errori
- **catch**: cattura e gestisce gli errori
- **finally**: esegue codice di cleanup (sempre eseguito)

```javascript
/**
 * Gestisce la comunicazione con un client
 * Esempio di gestione errori robusta in un server TCP
 * @param {net.Socket} socket - Socket del client connesso
 */
async function handleClient(socket) {
    try {
        // --- FASE 1: Ricevi la richiesta ---
        console.log('In attesa di richiesta...');
        const request = await receiveRequest(socket);
        console.log('Richiesta ricevuta:', request);
        
        // --- FASE 2: Processa la richiesta ---
        // Questa funzione potrebbe lanciare errori (es: richiesta invalida)
        const response = await processRequest(request);
        
        // --- FASE 3: Invia la risposta ---
        await sendResponse(socket, response);
        console.log('✓ Risposta inviata con successo');
        
    } catch (err) {
        // GESTIONE ERRORI
        // Tutti gli errori delle fasi sopra vengono catturati qui
        console.error('✗ Errore durante la gestione del client:', err.message);
        
        // Tipi di errori che possono verificarsi:
        // - Errore di rete (socket chiuso improvvisamente)
        // - Timeout (client non invia dati)
        // - Errore di parsing (dati non validi)
        // - Errore di business logic (processRequest fallisce)
        
        // Tenta di inviare un messaggio di errore al client
        // Questo potrebbe fallire se il socket è chiuso
        try {
            await sendResponse(socket, { 
                error: true,
                message: err.message 
            });
            console.log('Messaggio di errore inviato al client');
        } catch (sendErr) {
            // Se non riusciamo a inviare l'errore, non c'è molto da fare
            console.error('Impossibile inviare errore al client:', sendErr.message);
        }
        
    } finally {
        // --- CLEANUP: Chiudi sempre il socket ---
        // Il blocco finally viene SEMPRE eseguito:
        // - dopo il try (se non ci sono errori)
        // - dopo il catch (se ci sono errori)
        // - anche se c'è un return nel try/catch
        
        console.log('Chiusura connessione...');
        socket.end();
        
        // Questo garantisce che il socket venga sempre chiuso
        // evitando memory leak e connessioni "zombie"
    }
}

// --- ESEMPIO DI FUNZIONI HELPER ---

/**
 * Riceve una richiesta dal socket con timeout
 */
async function receiveRequest(socket) {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error('Timeout: client non ha inviato dati'));
        }, 10000); // 10 secondi
        
        socket.once('data', (data) => {
            clearTimeout(timeout);
            resolve(data.toString());
        });
    });
}

/**
 * Processa la richiesta (business logic)
 */
async function processRequest(request) {
    // Simula processing
    if (!request || request.trim() === '') {
        throw new Error('Richiesta vuota');
    }
    
    // Parsing, validazione, elaborazione...
    return { status: 'ok', data: 'Processed' };
}

/**
 * Invia una risposta al socket
 */
async function sendResponse(socket, response) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(response) + '\n';
        socket.write(data, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

// VANTAGGI di try-catch-finally:
// ✅ Codice lineare e facile da leggere
// ✅ Gestione errori centralizzata
// ✅ Cleanup garantito con finally
// ✅ Facile debuggare
```

### Promise.all per Connessioni Multiple

**Teoria:** `Promise.all()` permette di eseguire **multiple operazioni asincrone in parallelo** e aspettare che tutte siano completate. È molto utile per connettersi a più server contemporaneamente, riducendo il tempo totale di connessione.

**Come funziona Promise.all:**
- Accetta un array di Promise
- Ritorna una nuova Promise che:
  - Si risolve quando TUTTE le Promise sono risolte
  - Si rigetta se ALMENO UNA Promise viene rigettata
- Le Promise vengono eseguite in parallelo (non in sequenza)

**Confronto:**
- **Sequenziale**: 3 server × 1 secondo = 3 secondi totali
- **Parallelo**: 3 server in parallelo = 1 secondo totale

```javascript
/**
 * Connette a più server contemporaneamente
 * @param {Array<{host: string, port: number}>} servers - Array di server
 * @returns {Promise<Array<net.Socket>>} Array di socket connessi
 */
async function connectToMultipleServers(servers) {
    // Crea un array di Promise, una per ogni server
    // map() trasforma ogni server in una Promise di connessione
    const connections = servers.map(({ host, port }) => {
        console.log(`Avvio connessione a ${host}:${port}...`);
        return connectToServer(host, port);
    });
    
    // connections è un array di Promise:
    // [Promise, Promise, Promise]
    
    console.log(`Tentativo di connessione a ${connections.length} server in parallelo...`);
    
    try {
        // Promise.all aspetta che TUTTE le Promise siano risolte
        // Se anche solo UNA fallisce, tutto fallisce
        const sockets = await Promise.all(connections);
        
        console.log('✓ Tutte le connessioni stabilite con successo');
        console.log(`  - ${sockets.length} socket connessi`);
        
        return sockets; // Array di socket connessi
        
    } catch (err) {
        // Se almeno una connessione fallisce, entriamo qui
        console.error('✗ Errore in almeno una connessione:', err.message);
        
        // IMPORTANTE: le connessioni riuscite rimangono aperte!
        // Dovresti chiuderle manualmente per evitare memory leak
        
        throw err; // Rilancia l'errore
    }
}

// --- USO PRATICO ---
(async () => {
    // Lista di server a cui connettersi
    const servers = [
        { host: 'localhost', port: 8080 },
        { host: 'localhost', port: 8081 },
        { host: 'localhost', port: 8082 }
    ];
    
    try {
        // Connetti a tutti in parallelo
        const startTime = Date.now();
        const sockets = await connectToMultipleServers(servers);
        const elapsed = Date.now() - startTime;
        
        console.log(`Tempo totale: ${elapsed}ms`);
        console.log('Socket connessi:', sockets.length);
        
        // Ora puoi usare tutti i socket
        for (let i = 0; i < sockets.length; i++) {
            await sockets[i].write(`Hello from client to server ${i}\n`);
        }
        
        // Chiudi tutte le connessioni
        for (const socket of sockets) {
            socket.end();
        }
        
    } catch (err) {
        console.error('Errore durante le connessioni:', err.message);
        
        // Possibili cause:
        // - Uno dei server non è raggiungibile
        // - Timeout di connessione
        // - Porta errata
    }
})();

// --- ALTERNATIVE ---

// Promise.allSettled: aspetta tutte le Promise, anche se alcune falliscono
async function connectToMultipleServersRobust(servers) {
    const connections = servers.map(({ host, port }) => 
        connectToServer(host, port)
    );
    
    // allSettled NON rigetta mai, ritorna sempre un array di risultati
    const results = await Promise.allSettled(connections);
    
    // Filtra solo le connessioni riuscite
    const sockets = results
        .filter(r => r.status === 'fulfilled')
        .map(r => r.value);
    
    // Log connessioni fallite
    const failed = results.filter(r => r.status === 'rejected');
    if (failed.length > 0) {
        console.log(`${failed.length} connessioni fallite`);
    }
    
    return sockets;
}

// VANTAGGI:
// ✅ Molto più veloce che connettere in sequenza
// ✅ Codice conciso
// ✅ Facile da capire
// ⚠️ Attenzione: se una fallisce, tutte falliscono (usa allSettled per alternative)
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
