# 1.3 Concetti Base di TCP/IP

## Indice
- [Three-Way Handshake](#three-way-handshake)
- [Reliable Data Transfer](#reliable-data-transfer)
- [Flow Control e Congestion Control](#flow-control-e-congestion-control)
- [Port e Binding](#port-e-binding)
- [IPv4 vs IPv6](#ipv4-vs-ipv6)
- [Localhost e Network Interfaces](#localhost-e-network-interfaces)

---

## Three-Way Handshake

### Cos'è

Il **Three-Way Handshake** è il processo con cui TCP stabilisce una connessione tra client e server.

### Il Processo

```
CLIENT                               SERVER
  │                                     │
  │────── (1) SYN ─────────────────────>│
  │     SEQ=x                           │
  │                                     │
  │<───── (2) SYN-ACK ──────────────────│
  │     SEQ=y, ACK=x+1                  │
  │                                     │
  │────── (3) ACK ─────────────────────>│
  │     ACK=y+1                         │
  │                                     │
  │═══════ CONNECTION ESTABLISHED ══════│
```

### Passo per Passo

#### 1. SYN (Synchronize)

**Client → Server**

- Client invia un pacchetto **SYN** con un numero di sequenza iniziale (`SEQ=x`)
- Indica la volontà di stabilire una connessione
- Il client entra nello stato **SYN_SENT**

```
Flags: SYN
SEQ: 1000 (random initial sequence number)
```

#### 2. SYN-ACK (Synchronize-Acknowledge)

**Server → Client**

- Server risponde con **SYN-ACK**
- Conferma di aver ricevuto il SYN (`ACK=x+1`)
- Invia il proprio numero di sequenza iniziale (`SEQ=y`)
- Il server entra nello stato **SYN_RECEIVED**

```
Flags: SYN, ACK
SEQ: 2000 (server's initial sequence number)
ACK: 1001 (client's SEQ + 1)
```

#### 3. ACK (Acknowledge)

**Client → Server**

- Client conferma di aver ricevuto il SYN-ACK (`ACK=y+1`)
- Connessione ora **ESTABLISHED** su entrambi i lati
- Ora possono scambiarsi dati

```
Flags: ACK
SEQ: 1001
ACK: 2001 (server's SEQ + 1)
```

### Stati TCP

```
CLIENT                  SERVER

CLOSED                  CLOSED
  │                       │
  │ (1) SYN               │
  └────────────────────>  │
SYN_SENT                LISTEN
  │                       │
  │ (2) SYN-ACK           │
  │  <────────────────────┘
  │                   SYN_RCVD
  │ (3) ACK               │
  └────────────────────>  │
ESTABLISHED         ESTABLISHED
```

### Perché 3-Way?

1. **Sincronizzazione**: Entrambi concordano su numeri di sequenza
2. **Bidirezionale**: Ogni parte conferma la capacità di ricevere
3. **Affidabilità**: Conferma che entrambi sono pronti

### In Node.js

```javascript
const net = require('net');

const client = net.connect({ port: 8080 });

// Il 3-way handshake avviene automaticamente
client.on('connect', () => {
    // Qui la connessione è ESTABLISHED
    console.log('✅ Connesso! (3-way handshake completato)');
});
```

---

## Reliable Data Transfer

TCP garantisce **consegna affidabile e ordinata** dei dati.

### Come Funziona

```
SENDER                          RECEIVER
  │                               │
  │──── Segment #1 (SEQ=100) ────>│
  │                               │
  │<──── ACK=101 ─────────────────│
  │                               │
  │──── Segment #2 (SEQ=101) ────>│
  │                               │
  │<──── ACK=102 ─────────────────│
  │                               │
  │──── Segment #3 (SEQ=102) ────>│
  │                               │  (packet lost)
  │                               │
  │  (timeout)                    │
  │                               │
  │──── Segment #3 (SEQ=102) ────>│  (retransmit)
  │                               │
  │<──── ACK=103 ─────────────────│
```

### Meccanismi di Affidabilità

#### 1. Sequence Numbers

Ogni byte ha un numero di sequenza:

```
Data: "Hello World" (11 bytes)
SEQ: 1000

Bytes:  H   e   l   l   o       W   o   r   l   d
SEQ:   1000 1001 1002 ... 1010
```

#### 2. Acknowledgments (ACK)

Il ricevitore conferma i dati ricevuti:

```
Sent:     SEQ=1000, 100 bytes
Received: ACK=1100 (next expected byte)
```

#### 3. Retransmission

Se non riceve ACK entro un timeout, ritrasmette:

```javascript
// TCP gestisce automaticamente la ritrasmissione
socket.write('Important data');
// Se il pacchetto si perde, TCP lo ritrasmette automaticamente
// L'applicazione non deve gestirlo
```

#### 4. Checksum

Ogni segmento ha un checksum per rilevare errori:

```
Header: [..., Checksum: 0x1A2B, ...]

Se checksum non corrisponde → Scarta pacchetto
→ Timeout → Ritrasmissione
```

### Ordering

TCP garantisce che i dati arrivino **nell'ordine corretto**:

```
Sent:     Packet 1, 2, 3, 4
Network:  Packet 1, 4, 2, 3 (disordinati)
Received: Packet 1, 2, 3, 4 (riordinati da TCP)
```

### In Node.js

```javascript
// TCP garantisce ordine e affidabilità
socket.write('Message 1\n');
socket.write('Message 2\n');
socket.write('Message 3\n');

// Il ricevitore riceverà i messaggi nell'ordine corretto
// Non serve gestire ritrasmissione o riordinamento
```

---

## Flow Control e Congestion Control

### Flow Control

**Flow Control** previene che il sender invii troppi dati troppo velocemente per il receiver.

#### Sliding Window

TCP usa una **finestra scorrevole** (sliding window):

```
SENDER                                  RECEIVER

Window Size = 4 (può inviare 4 segmenti)

Send: [1][2][3][4] ────────────────>  Receive: [1][2][3][4]
                                       Window full, buffer 4 segments

     <─────────────────────────────  ACK=1, Window=3
                                       (ho consumato 1, ho spazio per 3)

Send: [5][6][7] ───────────────────>  Receive: [5][6][7]

     <─────────────────────────────  ACK=4, Window=4
                                       (consumati tutti, spazio per 4)
```

#### Receive Window (RWND)

Il receiver annuncia quanto spazio ha nel buffer:

```
TCP Header: [... RWND=65535 bytes ...]
                    │
                    └─> "Posso ricevere altri 65535 bytes"
```

#### Zero Window

Se il buffer del receiver è pieno:

```
SENDER                          RECEIVER

Send: Data ──────────────────>  Buffer FULL
     <────────────────────────  ACK, Window=0 (stop sending)

(sender stops sending)

     <────────────────────────  Window Update, Window=8192
                                 (buffer freed, can send again)

Send: Data ──────────────────>  OK
```

### Congestion Control

**Congestion Control** previene sovraccarico della rete.

#### Algoritmi TCP

##### 1. Slow Start

Inizia lentamente e aumenta esponenzialmente:

```
Round 1: Send 1 segment
Round 2: Send 2 segments (2^1)
Round 3: Send 4 segments (2^2)
Round 4: Send 8 segments (2^3)
...
```

##### 2. Congestion Avoidance

Dopo una soglia, aumenta linearmente:

```
Before threshold: Exponential growth (1, 2, 4, 8, 16)
After threshold:  Linear growth (16, 17, 18, 19, 20)
```

##### 3. Fast Retransmit / Fast Recovery

Se rileva perdita di pacchetti:

```
ACK: 100, 101, 102, 102, 102, 102  (duplicate ACKs)
      │    │    │    └─ Packet 103 lost, waiting for it

→ Fast Retransmit: Ritrasmetti subito senza aspettare timeout
→ Fast Recovery: Riduce window ma non torna a Slow Start
```

#### Congestion Window (CWND)

Il sender mantiene una finestra di congestione:

```
Effective Window = min(RWND, CWND)
                     │      │
                     │      └─ Congestion Window (network)
                     └─ Receive Window (receiver)
```

### In Node.js - Flow Control e Backpressure in TCP

Questo codice dimostra come TCP gestisce automaticamente il **controllo di flusso** (flow control) e il **backpressure** in Node.js.

#### 1. Flow Control Automatico
```javascript
socket.on('data', (chunk) => {
    processData(chunk); // operazione bloccante
});
```

**Cosa succede dietro le quinte:**
- TCP usa la **receive window** per comunicare al sender quanti dati può inviare
- Se `processData()` è lenta, il buffer del socket si riempie
- TCP riduce automaticamente la receive window, rallentando il mittente
- Il sender non invierà più dati di quanti il receiver possa gestire

**Gotcha importante:** Se `processData()` è veramente lento, il buffer potrebbe riempirsi completamente, causando perdita di dati o timeout.

#### 2. Backpressure Handling
```javascript
socket.write(bigData, () => {
    console.log('Data sent (flow control handled by TCP)');
});
```

**Come funziona:**
- `socket.write()` ritorna `true` se i dati sono stati bufferizzati con successo
- Ritorna `false` se il buffer interno è pieno (backpressure!)
- Il callback viene eseguito quando i dati sono stati **effettivamente inviati** sulla rete

#### Esempio Migliorato con Gestione Esplicita del Backpressure

````javascript
const net = require('net');

// SERVER: Gestione ricezione con flow control
const server = net.createServer((socket) => {
    console.log('Client connesso');
    
    socket.on('data', (chunk) => {
        console.log(`Ricevuti ${chunk.length} bytes`);
        
        // Simulazione elaborazione lenta
        processDataSlowly(chunk).then(() => {
            console.log('Elaborazione completata');
            // TCP ha già gestito il flow control automaticamente
        });
    });
});

// CLIENT: Gestione invio con backpressure esplicito
const client = net.createConnection({ port: 3000 }, () => {
    console.log('Connesso al server');
    
    const bigData = Buffer.alloc(1024 * 1024); // 1MB di dati
    
    // Controlla il valore di ritorno per gestire il backpressure
    const canContinue = client.write(bigData, (err) => {
        if (err) {
            console.error('Errore invio:', err);
        } else {
            console.log('Dati inviati (TCP ha gestito il flow control)');
        }
    });
    
    if (!canContinue) {
        console.log('Buffer pieno! Aspetto il drain event...');
        
        // Aspetta che il buffer si svuoti prima di inviare altri dati
        client.once('drain', () => {
            console.log('Buffer svuotato, posso inviare altri dati');
        });
    }
});

// Funzione helper
async function processDataSlowly(data) {
    return new Promise(resolve => {
        setTimeout(() => {
            // Elaborazione simulata
            resolve();
        }, 1000);
    });
}

server.listen(3000, () => {
    console.log('Server in ascolto sulla porta 3000');
});
````

#### Best Practices

**✅ Fai:**
- Monitora il valore di ritorno di `socket.write()`
- Ascolta l'evento `'drain'` quando il buffer è pieno
- Usa stream con `.pipe()` che gestisce automaticamente il backpressure

**❌ Evita:**
- Ignorare il backpressure e continuare a scrivere dati
- Operazioni sincrone molto lente nei data handler
- Bufferizzare troppi dati in memoria

#### Analogia

Pensa a TCP come un **sistema di consegna pacchi intelligente**:
- Il **camion** (sender) ha una capacità limitata
- Il **magazzino** (receiver) ha spazio limitato
- Se il magazzino è pieno, il camion rallenta automaticamente le consegne
- Quando c'è spazio, il camion riprende a pieno ritmo

```javascript
// TCP gestisce automaticamente flow e congestion control

socket.on('data', (chunk) => {
    // Se elaborazione è lenta, TCP rallenta automaticamente il sender
    processData(chunk); // blocking operation
    
    // TCP aggiusta receive window automaticamente
});

// Backpressure handling
socket.write(bigData, () => {
    console.log('Data sent (flow control handled by TCP)');
});
```

---

## Port e Binding

### Cos'è una Porta

Una **porta** è un numero (0-65535) che identifica un'applicazione su un host.

```
Host: 192.168.1.100
Port: 8080

Socket: 192.168.1.100:8080
```

### Tipi di Porte

| Range | Tipo | Descrizione |
|-------|------|-------------|
| **0-1023** | Well-Known | Porte standard (HTTP=80, HTTPS=443, SSH=22) |
| **1024-49151** | Registered | Registrate per applicazioni specifiche |
| **49152-65535** | Dynamic/Private | Porte effimere, assegnate automaticamente |

### Porte Comuni

| Porta | Protocollo | Servizio |
|-------|------------|----------|
| 20, 21 | FTP | File Transfer |
| 22 | SSH | Secure Shell |
| 23 | Telnet | Remote Login |
| 25 | SMTP | Email Sending |
| 53 | DNS | Domain Name System |
| 80 | HTTP | Web |
| 110 | POP3 | Email Retrieval |
| 143 | IMAP | Email Access |
| 443 | HTTPS | Secure Web |
| 3306 | MySQL | Database |
| 5432 | PostgreSQL | Database |
| 6379 | Redis | Cache |
| 27017 | MongoDB | Database |

### Binding in Node.js

#### Server Binding

```javascript
const net = require('net');

const server = net.createServer();

// Bind a porta specifica
server.listen(8080, 'localhost', () => {
    console.log('Server in ascolto su localhost:8080');
});

// Bind a tutte le interfacce
server.listen(8080, '0.0.0.0', () => {
    console.log('Server in ascolto su 0.0.0.0:8080');
});

// Bind a porta random
server.listen(0, () => {
    const port = server.address().port;
    console.log(`Server in ascolto su porta ${port}`);
});
```

#### Client Binding

```javascript
// Client normalmente usa porta effimera automatica
const client = net.connect({ port: 8080, host: 'localhost' });

// Ma puoi specificare porta locale
const client2 = net.connect({
    port: 8080,           // porta remota
    host: 'localhost',    // host remoto
    localPort: 9000,      // porta locale (raro)
    localAddress: '192.168.1.100'  // interfaccia locale
});
```

### Errori Comuni

#### EADDRINUSE

Porta già in uso:

```javascript
server.listen(8080);

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error('Porta 8080 già in uso');
    }
});
```

#### EACCES

Permesso negato (porte < 1024 richiedono root):

```javascript
// Su Linux, richiede sudo
server.listen(80, (err) => {
    if (err && err.code === 'EACCES') {
        console.error('Permesso negato per porta 80');
    }
});
```

---

## IPv4 vs IPv6

### IPv4

**Internet Protocol version 4**

#### Formato

```
192.168.1.100

- 4 ottetti separati da punti
- Ogni ottetto: 0-255
- 32 bit totali (2^32 = ~4.3 miliardi indirizzi)
```

#### Classi

| Classe | Range | Uso |
|--------|-------|-----|
| A | 0.0.0.0 - 127.255.255.255 | Reti molto grandi |
| B | 128.0.0.0 - 191.255.255.255 | Reti medie |
| C | 192.0.0.0 - 223.255.255.255 | Reti piccole |
| D | 224.0.0.0 - 239.255.255.255 | Multicast |
| E | 240.0.0.0 - 255.255.255.255 | Riservato |

#### Indirizzi Speciali

```
127.0.0.1       Localhost (loopback)
0.0.0.0         Tutte le interfacce
192.168.x.x     Private (LAN)
10.x.x.x        Private (LAN)
172.16-31.x.x   Private (LAN)
255.255.255.255 Broadcast
```

### IPv6

**Internet Protocol version 6**

#### Formato

```
2001:0db8:85a3:0000:0000:8a2e:0370:7334

- 8 gruppi di 4 cifre esadecimali
- Separati da due punti
- 128 bit totali (2^128 = 340 undecillion indirizzi)
```

#### Abbreviazioni

```
Originale:  2001:0db8:0000:0000:0000:0000:0000:0001
Abbreviato: 2001:db8::1

Regole:
1. Ometti zeri iniziali: 0db8 → db8
2. Sostituisci sequenze di zeri con ::: 0:0:0 → ::
```

#### Indirizzi Speciali

```
::1             Localhost (loopback)
::              Unspecified (equivalente a 0.0.0.0)
fe80::/10       Link-local (equivalente a 192.168.x.x)
ff00::/8        Multicast
```

### Confronto

| Caratteristica | IPv4 | IPv6 |
|----------------|------|------|
| **Lunghezza indirizzo** | 32 bit | 128 bit |
| **Numero indirizzi** | ~4.3 miliardi | 340 undecillion |
| **Formato** | Decimale (192.168.1.1) | Esadecimale (2001:db8::1) |
| **NAT** | Necessario | Non necessario |
| **Broadcast** | Sì | No (solo multicast) |
| **IPSec** | Opzionale | Obbligatorio |

### In Node.js

```javascript
const net = require('net');

// IPv4
const server4 = net.createServer();
server4.listen(8080, '0.0.0.0'); // IPv4

// IPv6
const server6 = net.createServer();
server6.listen(8080, '::'); // IPv6

// Dual stack (IPv4 + IPv6)
const server = net.createServer();
server.listen(8080, '::', () => {
    console.log('Server listening on IPv4 and IPv6');
});

// Client IPv4
const client4 = net.connect({ port: 8080, host: '192.168.1.100' });

// Client IPv6
const client6 = net.connect({ port: 8080, host: '2001:db8::1' });

// Client localhost IPv4
const client = net.connect({ port: 8080, host: 'localhost' });
// Node.js preferisce IPv6 se disponibile: ::1
// altrimenti usa IPv4: 127.0.0.1
```

---

## Localhost e Network Interfaces

### Localhost

**Localhost** è un nome che punta all'interfaccia di loopback locale.

#### Indirizzi Localhost

```
IPv4: 127.0.0.1
IPv6: ::1

Hostname: localhost
```

#### Caratteristiche

- ✅ Traffico non esce dalla macchina
- ✅ Sempre disponibile
- ✅ Utile per testing
- ✅ Sicuro (non accessibile da rete)

#### In Node.js

```javascript
// Bind solo su localhost
server.listen(8080, 'localhost'); // Solo connessioni locali

// Equivalente a
server.listen(8080, '127.0.0.1'); // IPv4 localhost
// oppure
server.listen(8080, '::1');       // IPv6 localhost
```

### Network Interfaces

Una **network interface** è un punto di connessione a una rete.

#### Tipi di Interfacce

```
eth0, en0     Ethernet (cablata)
wlan0, wlp3s0 Wi-Fi (wireless)
lo            Loopback (localhost)
docker0       Docker network
tun0, tap0    VPN
```

#### Visualizzare Interfacce

```bash
# Linux/Mac
ifconfig
ip addr

# Windows
ipconfig
```

#### Esempio Output

```
lo (Loopback)
    inet 127.0.0.1
    inet6 ::1

eth0 (Ethernet)
    inet 192.168.1.100
    inet6 fe80::1234:5678:90ab:cdef
    
wlan0 (Wi-Fi)
    inet 10.0.0.50
```

### Binding a Interfacce

#### 0.0.0.0 (IPv4)

Bind a **tutte le interfacce**:

```javascript
server.listen(8080, '0.0.0.0', () => {
    console.log('Server accessibile da:');
    console.log('- localhost (127.0.0.1)');
    console.log('- LAN (192.168.1.100)');
    console.log('- Wi-Fi (10.0.0.50)');
    console.log('- qualsiasi altra interfaccia');
});
```

#### :: (IPv6)

Bind a tutte le interfacce IPv6:

```javascript
server.listen(8080, '::');
```

#### Interfaccia Specifica

Bind a una sola interfaccia:

```javascript
// Solo Ethernet
server.listen(8080, '192.168.1.100');

// Solo Wi-Fi
server.listen(8080, '10.0.0.50');

// Solo localhost
server.listen(8080, '127.0.0.1');
```

### Ottenere Interfacce in Node.js

```javascript
const os = require('os');

const interfaces = os.networkInterfaces();

console.log('Network Interfaces:\n');

for (const [name, configs] of Object.entries(interfaces)) {
    console.log(`${name}:`);
    
    for (const config of configs) {
        if (config.family === 'IPv4') {
            console.log(`  IPv4: ${config.address}`);
        } else if (config.family === 'IPv6') {
            console.log(`  IPv6: ${config.address}`);
        }
    }
    
    console.log();
}

// Output esempio:
// lo:
//   IPv4: 127.0.0.1
//   IPv6: ::1
//
// eth0:
//   IPv4: 192.168.1.100
//   IPv6: fe80::1234:5678:90ab:cdef
```

---

## Riepilogo

In questa guida abbiamo esplorato:

✅ **Three-Way Handshake**: Stabilimento connessione TCP  
✅ **Reliable Transfer**: Meccanismi di affidabilità TCP  
✅ **Flow/Congestion Control**: Gestione flusso dati  
✅ **Port e Binding**: Porte e come fare binding  
✅ **IPv4 vs IPv6**: Differenze tra protocolli IP  
✅ **Localhost e Interfaces**: Interfacce di rete  

Questi concetti sono fondamentali per comprendere come funziona TCP/IP sotto il cofano.

---

## Prossimi Passi

Nella prossima guida approfondiremo il **Socket Programming**, esplorando lifecycle, I/O e pattern di gestione errori.

📖 **Prossima guida:** [1.4 Socket Programming](./04-Socket_Programming.md)
