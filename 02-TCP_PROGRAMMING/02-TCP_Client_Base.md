# **💻 TCP Client Base - Fondamenti**

## **📑 Indice**
1. [Introduzione](#introduzione)
2. [Creazione Client TCP](#creazione-client-tcp)
3. [Connessione a Server](#connessione-a-server)
4. [Eventi del Client](#eventi-del-client)
5. [Invio e Ricezione Dati](#invio-e-ricezione-dati)
6. [Error Handling](#error-handling)
7. [Esempi Completi](#esempi-completi)

---

## **🎯 Introduzione**

**TCP Client**

Un **TCP Client** è un programma che:
- 🔌 **Si connette** a un server TCP esistente (comportamento ATTIVO)
- 📤 **Invia** dati al server
- 📥 **Riceve** risposte dal server
- 🔄 **Gestisce** la connessione (riconnessioni, timeout, errori)

**Differenze chiave Server vs Client:**

┌──────────────┬────────────────┬────────────────┐
│ Aspetto      │ Server         │ Client         │
├──────────────┼────────────────┼────────────────┤
│ Inizia       │ listen()       │ connect()      │
│ Comportamento│ Passivo (wait) │ Attivo (reach) │
│ Connessioni  │ Multiple (N)   │ Singola (1)    │
│ Evento init  │ 'connection'   │ 'connect'      │
│ Port binding │ Richiesto      │ Automatico     │
│ Retry        │ Non applicabile│ Spesso needed  │
└──────────────┴────────────────┴────────────────┘

**Il client deve:**
1. ✅ Sapere **DOVE** connettersi (host + port)
2. ✅ Gestire **FALLIMENTO** della connessione (server offline, rete down)
3. ✅ Gestire **DISCONNESSIONI** impreviste (server crash, rete instabile)
4. ✅ Implementare **RETRY logic** (opzionale ma raccomandato per produzione)

**Caratteristiche TCP:**
- ✅ **Connection-oriented**: Handshake prima di inviare dati
- ✅ **Affidabile**: Ritrasmissione automatica pacchetti persi
- ✅ **Ordinato**: Dati arrivano nell'ordine corretto
- ✅ **Bidirezionale (full-duplex)**: Leggi e scrivi contemporaneamente
- ✅ **Stream-based**: Niente message boundaries (vedi framing Guida 05)

---

## **🚀 Creazione Client TCP**

**Come funziona la connessione client**

```
Client (tuo codice)           Server (remoto)
      │                            │
      │  1. SYN                    │
      ├───────────────────────────>│  (Voglio connettermi)
      │                            │
      │  2. SYN-ACK                │
      │<───────────────────────────┤  (OK, connettiti)
      │                            │
      │  3. ACK                    │
      ├───────────────────────────>│  (Ricevuto)
      │                            │
   [CONNECTED]  ← Evento 'connect' 
      │                            │
   Ora puoi inviare/ricevere dati
```

Questo è il **TCP three-way handshake** - avviene automaticamente quando chiami `connect()`.

**Timing degli eventi:**
```
net.connect()  → Inizio handshake (non bloccante)
     ↓
  Attesa...
     ↓
'connect' event → Handshake completato, connessione pronta
     ↓
'ready' event   → Socket pronto per I/O (di solito subito dopo 'connect')
```

### **Client Minimale**

```javascript
const net = require('net');

// 1. Crea connessione al server - NON è bloccante!
//    Ritorna immediatamente, handshake avviene in background
const client = net.connect({ port: 3000, host: 'localhost' }, () => {
    // 2. Callback eseguito quando connessione è STABILITA (dopo handshake)
    console.log('Connesso al server!');
    
    // 3. Ora puoi inviare dati al server
    client.write('Hello Server!\n');
});

// 4. Evento 'data' - ricevi dati DAL server
//    Può essere chiamato multiple volte per lo stesso messaggio (streaming!)
client.on('data', (data) => {
    console.log('Ricevuto:', data.toString());
});

// 5. Evento 'end' - server ha chiuso la connessione (FIN inviato dal server)
client.on('end', () => {
    console.log('Disconnesso dal server');
});

// 6. Evento 'error' - SEMPRE gestire! Altrimenti il processo crasha
client.on('error', (err) => {
    console.error('Errore:', err.message);
});
```

**💡 Cosa succede dietro le quinte:**

1. `net.connect()` ritorna **immediatamente** (non-blocking)
2. Node.js inizia TCP handshake in background
3. Se handshake OK → callback eseguito + evento 'connect'
4. Se handshake FAIL → evento 'error'
5. Dati possono arrivare in chunk multipli → più eventi 'data'

**⚠️ ATTENZIONE:**
- NON fare `client.write()` prima che 'connect' sia emesso!
- Dati scritti prima della connessione vanno **persi**
- Sempre aspettare callback o evento 'connect'

### **Client con Configurazione Completa**

**Opzioni disponibili:**

| Opzione | Tipo | Default | Quando usarla |
|---------|------|---------|---------------|
| `host` | string | 'localhost' | Indirizzo del server |
| `port` | number | Obbligatorio | Porta del server |
| `localAddress` | string | undefined | Per binding su IP specifico |
| `localPort` | number | undefined | Per binding su porta specifica (raro) |
| `family` | number | 0 (auto) | 4=IPv4, 6=IPv6, 0=entrambi |
| `timeout` | number | undefined | Timeout connessione (ms) |

**💡 Note:**
- `localAddress`/`localPort` raramente necessari (solo multi-homed hosts)
- `family` lascia a 0 per auto-detection (DNS può ritornare IPv4 o IPv6)
- `timeout` importante per evitare hang infiniti

```javascript
const net = require('net');

const options = {
    host: 'localhost',
    port: 3000,
    localAddress: undefined,  // Indirizzo locale (opzionale)
    localPort: undefined,     // Porta locale (opzionale)
    family: 4,                // 4 = IPv4, 6 = IPv6
    timeout: 5000             // Timeout connessione (ms)
};

const client = net.connect(options);

client.on('connect', () => {
    console.log('✅ Connessione stabilita');
    console.log('Local:', client.localAddress, ':', client.localPort);
    console.log('Remote:', client.remoteAddress, ':', client.remotePort);
});

client.on('ready', () => {
    console.log('✅ Socket pronto per I/O');
    client.write('Hello Server!\n');
});

client.on('timeout', () => {
    console.log('⏰ Timeout connessione');
    client.end();
});

client.on('error', (err) => {
    console.error('❌ Errore:', err.message);
});
```

### **Metodi Alternativi di Creazione**

```javascript
// Metodo 1: net.connect()
const client1 = net.connect(3000, 'localhost', () => {
    console.log('Connesso!');
});

// Metodo 2: net.connect() con options
const client2 = net.connect({
    port: 3000,
    host: 'localhost'
}, () => {
    console.log('Connesso!');
});

// Metodo 3: net.createConnection() (alias)
const client3 = net.createConnection(3000, 'localhost');

// Metodo 4: new net.Socket()
const client4 = new net.Socket();
client4.connect(3000, 'localhost', () => {
    console.log('Connesso!');
});
```

---

## **🔌 Connessione a Server**

**Pattern di connessione comuni**

La connessione TCP può fallire per molte ragioni:
- ❌ Server offline o unreachable
- ❌ Firewall blocca connessione
- ❌ DNS non risolve hostname
- ❌ Network timeout
- ❌ Porta sbagliata

Devi gestire questi scenari con pattern appropriati.

### **Connessione Sincrona Base**

```javascript
const net = require('net');

function connectToServer(host, port) {
    const client = net.connect({ host, port });
    
    client.on('connect', () => {
        console.log(`✅ Connesso a ${host}:${port}`);
    });
    
    client.on('error', (err) => {
        console.error(`❌ Errore connessione: ${err.message}`);
    });
    
    return client;
}

// Uso
const client = connectToServer('localhost', 3000);
client.write('Hello!\n');
```

### **Connessione con Promise**

**Perché usare Promise?**

I callback sono scomodi per gestire errori e timeout. Le Promise rendono il codice più leggibile e permettono `async/await`.

**Pattern:**
```
Callbacks (old):              Promise (modern):
  connect(host, (err, client) =>    await connect(host)
    if (err) handle             try/catch naturale
    else use client             codice lineare
  )
```

```javascript
function connectAsync(host, port, timeout = 5000) {
    return new Promise((resolve, reject) => {
        const client = net.connect({ host, port });
        
        const timer = setTimeout(() => {
            client.destroy();
            reject(new Error('Connection timeout'));
        }, timeout);
        
        client.once('connect', () => {
            clearTimeout(timer);
            console.log(`✅ Connesso a ${host}:${port}`);
            resolve(client);
        });
        
        client.once('error', (err) => {
            clearTimeout(timer);
            reject(err);
        });
    });
}

// Uso con async/await
async function main() {
    try {
        const client = await connectAsync('localhost', 3000, 3000);
        client.write('Hello from async client!\n');
        
        client.on('data', (data) => {
            console.log('Received:', data.toString());
        });
        
    } catch (err) {
        console.error('Failed to connect:', err.message);
    }
}

main();
```

### **Connessione con Retry**

**Auto-reconnection - ESSENZIALE per client produttivi**

Senza retry, ogni piccolo problema di rete causa perdita permanente della connessione.

**Exponential Backoff - Perché è importante:**

```
Senza backoff (sempre delay fisso 1s):
  Tentativo 1: 1s → fallisce
  Tentativo 2: 1s → fallisce  
  Tentativo 3: 1s → fallisce
  Tentativo 4: 1s → fallisce
  → Spam il server!

Con exponential backoff:
  Tentativo 1: 1s → fallisce
  Tentativo 2: 2s → fallisce
  Tentativo 3: 4s → fallisce
  Tentativo 4: 8s → fallisce
  Tentativo 5: 16s → successo!
  → Riduce carico sul server
```

**FORMULA:** `delay = initialDelay * (backoffMultiplier ^ retries)`  
**Esempio:** 1000ms * (2 ^ 3) = 8000ms (8 secondi)

**MAX_DELAY** previene attese troppo lunghe (es. max 30s)

```javascript
class RetryClient {
    constructor(host, port, maxRetries = 3) {
        this.host = host;
        this.port = port;
        this.maxRetries = maxRetries;
        this.retryDelay = 2000; // 2 secondi
    }
    
    async connect() {
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                console.log(`Tentativo ${attempt}/${this.maxRetries}...`);
                const client = await this.attemptConnect();
                console.log('✅ Connesso!');
                return client;
                
            } catch (err) {
                console.error(`❌ Tentativo ${attempt} fallito: ${err.message}`);
                
                if (attempt < this.maxRetries) {
                    console.log(`Riprovo tra ${this.retryDelay}ms...`);
                    await this.sleep(this.retryDelay);
                }
            }
        }
        
        throw new Error('Max retries raggiunto');
    }
    
    attemptConnect() {
        return new Promise((resolve, reject) => {
            const client = net.connect({
                host: this.host,
                port: this.port,
                timeout: 3000
            });
            
            client.once('connect', () => resolve(client));
            client.once('error', reject);
            client.once('timeout', () => {
                client.destroy();
                reject(new Error('Timeout'));
            });
        });
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Uso
async function main() {
    const retryClient = new RetryClient('localhost', 3000, 5);
    
    try {
        const client = await retryClient.connect();
        client.write('Connected after retries!\n');
    } catch (err) {
        console.error('Impossibile connettersi:', err.message);
    }
}

main();
```

---

## **📡 Eventi del Client**

**Eventi del client socket**

Il client ha eventi simili al server, ma con alcune differenze chiave.

**Lifecycle tipico:**
```
1. connect() chiamato
   ↓
2. 'lookup' - DNS resolution (se hostname)
   ↓
3. 'connect' - TCP handshake completato
   ↓
4. 'ready' - Socket pronto per I/O
   ↓
5. 'data' → 'data' → 'data' ... (comunicazione)
   ↓
6. 'end' - Server chiude (FIN ricevuto)
   ↓
7. 'close' - Socket completamente chiuso

In qualsiasi momento:
- 'error' - Errore (poi salta a 'close')
- 'timeout' - Nessuna attività per N ms
```

**Eventi client vs server:**

| Evento | Client | Server |
|--------|--------|--------|
| Connessione | `connect` | `connection` |
| Lookup DNS | `lookup` ✅ | ❌ |
| Ready | `ready` ✅ | `ready` ✅ |
| Timeout | `timeout` ✅ | `timeout` ✅ |

### **Eventi Principali**

```javascript
const client = net.connect({ port: 3000, host: 'localhost' });

// 1. 'connect' - Connessione stabilita
client.on('connect', () => {
    console.log('✅ Connesso');
    console.log('Local:', `${client.localAddress}:${client.localPort}`);
    console.log('Remote:', `${client.remoteAddress}:${client.remotePort}`);
});

// 2. 'ready' - Socket pronto per I/O
client.on('ready', () => {
    console.log('✅ Ready per comunicare');
});

// 3. 'data' - Dati ricevuti
client.on('data', (data) => {
    console.log('📥 Ricevuto:', data.toString());
});

// 4. 'end' - Server ha chiuso la connessione
client.on('end', () => {
    console.log('🔴 Server ha chiuso la connessione');
});

// 5. 'close' - Socket completamente chiuso
client.on('close', (hadError) => {
    if (hadError) {
        console.log('❌ Chiuso con errore');
    } else {
        console.log('✅ Chiuso normalmente');
    }
});

// 6. 'error' - Errore di connessione/comunicazione
client.on('error', (err) => {
    console.error('❌ Errore:', err.code, err.message);
});

// 7. 'timeout' - Timeout di inattività
client.setTimeout(10000); // 10 secondi
client.on('timeout', () => {
    console.log('⏰ Timeout! Chiudo connessione...');
    client.end();
});

// 8. 'drain' - Buffer di scrittura svuotato
client.on('drain', () => {
    console.log('✅ Buffer svuotato, posso scrivere ancora');
});
```

### **Lifecycle Completo**

```javascript
class ClientLifecycle {
    constructor(host, port) {
        this.host = host;
        this.port = port;
        this.client = null;
    }
    
    connect() {
        console.log('[CONNECTING] Connessione in corso...');
        
        this.client = net.connect({ 
            host: this.host, 
            port: this.port 
        });
        
        this.setupEvents();
    }
    
    setupEvents() {
        this.client.on('lookup', (err, address, family, host) => {
            console.log('[LOOKUP] DNS resolve:', address);
        });
        
        this.client.on('connect', () => {
            console.log('[CONNECTED] ✅');
            this.onConnected();
        });
        
        this.client.on('ready', () => {
            console.log('[READY] Socket pronto');
        });
        
        this.client.on('data', (data) => {
            console.log('[DATA] Ricevuto:', data.length, 'bytes');
            this.onData(data);
        });
        
        this.client.on('drain', () => {
            console.log('[DRAIN] Buffer svuotato');
        });
        
        this.client.on('end', () => {
            console.log('[END] Server chiuso connessione');
        });
        
        this.client.on('close', (hadError) => {
            console.log('[CLOSE] Socket chiuso', hadError ? 'con errore' : '');
        });
        
        this.client.on('error', (err) => {
            console.error('[ERROR]', err.code, err.message);
        });
        
        this.client.on('timeout', () => {
            console.log('[TIMEOUT] Inattività');
            this.client.end();
        });
    }
    
    onConnected() {
        this.client.write('Hello Server!\n');
    }
    
    onData(data) {
        console.log('Message:', data.toString());
    }
    
    disconnect() {
        console.log('[DISCONNECTING] Chiusura...');
        this.client.end();
    }
}

// Uso
const client = new ClientLifecycle('localhost', 3000);
client.connect();

setTimeout(() => client.disconnect(), 5000);
```

---

## **📨 Invio e Ricezione Dati**

**Client vs Server - stessa API per I/O**

L'invio e ricezione dati funziona **esattamente come nel server**:
- Usa `socket.write()` per inviare
- Usa evento `data` per ricevere
- Gestisci backpressure con `drain`
- Socket è uno stream bidirezionale

**💡 Differenza chiave:** Il client tipicamente:
1. Si connette
2. Invia richiesta
3. Aspetta risposta
4. Chiude o manda altra richiesta

Il server invece:
1. Aspetta connessione
2. Riceve richiesta
3. Invia risposta
4. Aspetta altra richiesta o client disconnette

### **Invio Dati**

```javascript
const client = net.connect({ port: 3000, host: 'localhost' }, () => {
    // Metodo 1: write() base
    client.write('Hello\n');
    
    // Metodo 2: write() con encoding
    client.write('Hello', 'utf8');
    
    // Metodo 3: write() con callback
    client.write('Hello\n', (err) => {
        if (err) {
            console.error('Errore scrittura:', err);
        } else {
            console.log('Dati inviati con successo');
        }
    });
    
    // Metodo 4: write() con Buffer
    const buffer = Buffer.from('Binary data');
    client.write(buffer);
    
    // Metodo 5: end() - invia e chiude
    client.end('Last message\n');
});
```

### **Gestione Backpressure**

```javascript
client.on('connect', () => {
    // Invia molti dati
    for (let i = 0; i < 1000000; i++) {
        const canContinue = client.write(`Message ${i}\n`);
        
        if (!canContinue) {
            console.log('Buffer pieno! Aspetto drain event...');
            
            client.once('drain', () => {
                console.log('Buffer svuotato, continuo...');
            });
            
            break;
        }
    }
});
```

### **Invio Messaggi Strutturati**

```javascript
class MessageSender {
    constructor(client) {
        this.client = client;
    }
    
    sendJSON(obj) {
        const json = JSON.stringify(obj);
        this.client.write(json + '\n');
    }
    
    sendMessage(type, data) {
        const message = {
            type: type,
            timestamp: Date.now(),
            data: data
        };
        this.sendJSON(message);
    }
    
    async sendWithAck(data, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const messageId = Date.now();
            
            const message = {
                id: messageId,
                data: data
            };
            
            const timer = setTimeout(() => {
                this.client.removeListener('data', handler);
                reject(new Error('ACK timeout'));
            }, timeout);
            
            const handler = (received) => {
                try {
                    const response = JSON.parse(received.toString());
                    if (response.ack === messageId) {
                        clearTimeout(timer);
                        this.client.removeListener('data', handler);
                        resolve(response);
                    }
                } catch (err) {
                    // Non è il nostro ACK, ignora
                }
            };
            
            this.client.on('data', handler);
            this.sendJSON(message);
        });
    }
}

// Uso
client.on('connect', () => {
    const sender = new MessageSender(client);
    
    sender.sendMessage('greeting', 'Hello Server!');
    sender.sendMessage('query', { id: 123 });
    
    // Con ACK
    sender.sendWithAck({ command: 'get_status' })
        .then(response => console.log('ACK ricevuto:', response))
        .catch(err => console.error('ACK timeout:', err));
});
```

### **Ricezione Dati**

```javascript
const client = net.connect({ port: 3000, host: 'localhost' });

// Metodo 1: event 'data' base
client.on('data', (chunk) => {
    console.log('Chunk ricevuto:', chunk.length, 'bytes');
    console.log('Contenuto:', chunk.toString());
});

// Metodo 2: con encoding
client.setEncoding('utf8');
client.on('data', (str) => {
    console.log('String:', str);
});

// Metodo 3: buffering per messaggi completi
let buffer = '';
client.on('data', (chunk) => {
    buffer += chunk.toString();
    
    // Processa messaggi line-delimited
    let lines = buffer.split('\n');
    buffer = lines.pop(); // Mantieni l'ultimo pezzo
    
    for (const line of lines) {
        if (line.trim()) {
            handleMessage(line);
        }
    }
});

function handleMessage(message) {
    try {
        const obj = JSON.parse(message);
        console.log('Message:', obj);
    } catch (err) {
        console.log('Text message:', message);
    }
}

// Metodo 4: receiver class
class MessageReceiver {
    constructor(client, delimiter = '\n') {
        this.client = client;
        this.delimiter = delimiter;
        this.buffer = '';
        
        this.client.on('data', this.onData.bind(this));
    }
    
    onData(chunk) {
        this.buffer += chunk.toString();
        
        let messages = this.buffer.split(this.delimiter);
        this.buffer = messages.pop();
        
        for (const message of messages) {
            if (message.trim()) {
                this.onMessage(message);
            }
        }
    }
    
    onMessage(message) {
        console.log('Complete message:', message);
        
        try {
            const obj = JSON.parse(message);
            this.onJSON(obj);
        } catch (err) {
            this.onText(message);
        }
    }
    
    onJSON(obj) {
        console.log('JSON:', obj);
    }
    
    onText(text) {
        console.log('Text:', text);
    }
}

// Uso
const receiver = new MessageReceiver(client);
```

---

## **⚠️ Error Handling**

**Errori client - diversi dal server**

Il client ha **errori di connessione** che il server non ha:
- `ECONNREFUSED` - Server non accetta connessioni (porta chiusa)
- `ENOTFOUND` - Host non trovato (DNS fail)
- `ETIMEDOUT` - Connessione timeout (firewall, network down)
- `EHOSTUNREACH` - Host non raggiungibile (routing problem)

**Classificazione errori:**

| Errore | Tipo | Retry? | Azione |
|--------|------|--------|--------|
| `ECONNREFUSED` | Fatale | Sì (dopo delay) | Server offline |
| `ENOTFOUND` | Fatale | No | DNS error, controlla hostname |
| `ETIMEDOUT` | Transiente | Sì | Network issue, retry |
| `ECONNRESET` | Transiente | Sì | Server crash, reconnect |
| `EPIPE` | Non-fatale | No | Cleanup, già disconnesso |
| `EHOSTUNREACH` | Transiente | Sì | Routing issue |

**Strategy:**
- **Fatali + retry OK** → Exponential backoff
- **Fatali + no retry** → Fail immediatamente
- **Transienti** → Sempre retry con backoff
- **Non-fatali** → Log e continua

### **Errori Comuni**

```javascript
client.on('error', (err) => {
    switch (err.code) {
        case 'ECONNREFUSED':
            console.error('❌ Connessione rifiutata - server non in ascolto');
            break;
            
        case 'ENOTFOUND':
            console.error('❌ Host non trovato');
            break;
            
        case 'ETIMEDOUT':
            console.error('❌ Timeout connessione');
            break;
            
        case 'ECONNRESET':
            console.error('❌ Connessione resettata dal server');
            break;
            
        case 'EPIPE':
            console.error('❌ Broken pipe - server disconnesso');
            break;
            
        case 'EHOSTUNREACH':
            console.error('❌ Host non raggiungibile');
            break;
            
        default:
            console.error('❌ Errore:', err.code, err.message);
    }
});
```

### **Safe Client Wrapper**

```javascript
class SafeClient {
    constructor(host, port) {
        this.host = host;
        this.port = port;
        this.client = null;
        this.connected = false;
    }
    
    connect() {
        return new Promise((resolve, reject) => {
            this.client = net.connect({ 
                host: this.host, 
                port: this.port,
                timeout: 5000
            });
            
            this.setupErrorHandlers();
            
            this.client.once('connect', () => {
                this.connected = true;
                console.log('✅ Connesso');
                resolve();
            });
            
            this.client.once('error', (err) => {
                this.connected = false;
                reject(err);
            });
        });
    }
    
    setupErrorHandlers() {
        this.client.on('error', (err) => {
            this.handleError(err);
        });
        
        this.client.on('close', () => {
            this.connected = false;
            console.log('Connessione chiusa');
        });
        
        this.client.on('timeout', () => {
            console.log('Timeout! Chiudo...');
            this.disconnect();
        });
    }
    
    handleError(err) {
        console.error('Errore client:', err.code);
        
        const fatalErrors = ['ECONNREFUSED', 'ENOTFOUND', 'EHOSTUNREACH'];
        
        if (fatalErrors.includes(err.code)) {
            console.error('Errore fatale, chiudo...');
            this.disconnect();
        }
    }
    
    send(data) {
        if (!this.connected) {
            throw new Error('Non connesso');
        }
        
        try {
            this.client.write(data);
        } catch (err) {
            console.error('Errore invio:', err);
            throw err;
        }
    }
    
    disconnect() {
        if (this.client) {
            this.client.end();
            this.connected = false;
        }
    }
}

// Uso
async function main() {
    const client = new SafeClient('localhost', 3000);
    
    try {
        await client.connect();
        client.send('Hello!\n');
        
        setTimeout(() => client.disconnect(), 2000);
        
    } catch (err) {
        console.error('Failed:', err.message);
    }
}

main();
```

---

## **📝 Esempi Completi**

**Client pratici e funzionanti**

Ogni esempio dimostra pattern reali che userai in produzione.

### **Esempio 1: Echo Client Interattivo**

**Cosa fa:** Client interattivo che legge da stdin e invia al server  
**Quando usarlo:** Testing manuale, debug, tool CLI  
**Concetti dimostrati:** readline integration, input/output user-friendly

```javascript
const net = require('net');
const readline = require('readline');

const client = net.connect({ port: 3000, host: 'localhost' }, () => {
    console.log('✅ Connesso all\'Echo Server');
    console.log('Digita messaggi (Ctrl+C per uscire):\n');
});

// Setup readline per input utente
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '> '
});

rl.prompt();

// Invia input al server
rl.on('line', (line) => {
    if (line.trim()) {
        client.write(line + '\n');
    }
    rl.prompt();
});

// Ricevi echo dal server
client.on('data', (data) => {
    process.stdout.write('\r\x1b[K'); // Clear line
    console.log('Server:', data.toString().trim());
    rl.prompt();
});

// Gestione chiusura
client.on('end', () => {
    console.log('\nServer ha chiuso la connessione');
    rl.close();
    process.exit(0);
});

client.on('error', (err) => {
    console.error('\nErrore:', err.message);
    rl.close();
    process.exit(1);
});

// Ctrl+C handler
rl.on('SIGINT', () => {
    console.log('\nChiusura...');
    client.end();
    rl.close();
    process.exit(0);
});
```

### **Esempio 2: HTTP Client Semplice**

```javascript
const net = require('net');

function httpGet(host, port, path) {
    return new Promise((resolve, reject) => {
        const client = net.connect({ host, port });
        
        client.on('connect', () => {
            // Invia HTTP request
            const request = [
                `GET ${path} HTTP/1.1`,
                `Host: ${host}`,
                'Connection: close',
                '',
                ''
            ].join('\r\n');
            
            client.write(request);
        });
        
        let response = '';
        
        client.on('data', (chunk) => {
            response += chunk.toString();
        });
        
        client.on('end', () => {
            resolve(response);
        });
        
        client.on('error', reject);
    });
}

// Uso
httpGet('example.com', 80, '/')
    .then(response => {
        console.log('Response:\n');
        console.log(response);
    })
    .catch(err => {
        console.error('Error:', err.message);
    });
```

### **Esempio 3: Chat Client**

```javascript
const net = require('net');
const readline = require('readline');

class ChatClient {
    constructor(host, port) {
        this.host = host;
        this.port = port;
        this.client = null;
        this.rl = null;
    }
    
    connect() {
        this.client = net.connect({ 
            host: this.host, 
            port: this.port 
        });
        
        this.client.on('connect', () => {
            console.log('✅ Connesso alla chat');
            this.setupReadline();
        });
        
        this.client.on('data', (data) => {
            // Clear current line and show message
            process.stdout.write('\r\x1b[K');
            console.log(data.toString().trim());
            if (this.rl) this.rl.prompt();
        });
        
        this.client.on('end', () => {
            console.log('\n❌ Disconnesso dalla chat');
            this.cleanup();
        });
        
        this.client.on('error', (err) => {
            console.error('❌ Errore:', err.message);
            this.cleanup();
        });
    }
    
    setupReadline() {
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: '> '
        });
        
        this.rl.prompt();
        
        this.rl.on('line', (line) => {
            if (line.trim()) {
                this.client.write(line + '\n');
            }
            this.rl.prompt();
        });
        
        this.rl.on('SIGINT', () => {
            console.log('\nUscita...');
            this.disconnect();
        });
    }
    
    disconnect() {
        if (this.client) {
            this.client.end();
        }
        this.cleanup();
    }
    
    cleanup() {
        if (this.rl) {
            this.rl.close();
        }
        process.exit(0);
    }
}

// Uso
const client = new ChatClient('localhost', 3000);
client.connect();
```

---

## **🎓 Riepilogo**

**Creazione Client:**
- `net.connect()` o `net.createConnection()`
- Callback per evento 'connect'
- Gestione eventi e errori

**Connessione:**
- Opzioni: host, port, timeout, family
- Promise-based per async/await
- Retry logic per robustezza

**Eventi Client:**
- `connect` - Connessione stabilita
- `ready` - Socket pronto
- `data` - Dati ricevuti
- `end` - Server chiuso
- `close` - Socket chiuso
- `error` - Errori
- `timeout` - Timeout

**Best Practices:**
- ✅ Gestire tutti gli errori
- ✅ Implementare timeout
- ✅ Buffering per messaggi completi
- ✅ Backpressure handling (drain event)
- ✅ Graceful disconnect
- ✅ Retry logic per resilienza

---

**Prossima Guida**: [03-TCP_Server_Avanzato.md](./03-TCP_Server_Avanzato.md) - Server TCP avanzati
