# Domande di Autovalutazione - Modulo 1: Fondamenti di Networking

## Introduzione

Questo documento contiene domande per verificare la comprensione dei concetti del Modulo 1. Le domande sono suddivise per argomento e includono:

- ✅ **Domande teoriche** (a risposta multipla e aperta)
- ✅ **Domande pratiche** (esercizi di coding)
- ✅ **Domande di troubleshooting** (risoluzione problemi)

Le risposte si trovano alla fine del documento.

---

## 1. Modello OSI e TCP/IP

### Domande a Risposta Multipla

**Q1.1** A quale livello del modello OSI opera il protocollo TCP?
- A) Application (7)
- B) Presentation (6)
- C) Transport (4)
- D) Network (3)

**Q1.2** Quanti livelli ha il modello TCP/IP?
- A) 7
- B) 5
- C) 4
- D) 3

**Q1.3** Quale protocollo NON opera al livello Application del modello TCP/IP?
- A) HTTP
- B) FTP
- C) IP
- D) DNS

**Q1.4** Il three-way handshake avviene a quale livello OSI?
- A) Application
- B) Transport
- C) Network
- D) Data Link

### Domande Aperte

**Q1.5** Spiega la differenza principale tra il modello OSI e il modello TCP/IP.

**Q1.6** Perché il modello a livelli è importante nell'architettura di rete?

**Q1.7** Qual è il ruolo del livello Transport nel modello TCP/IP?

---

## 2. Protocolli di Rete

### Domande a Risposta Multipla

**Q2.1** Quale caratteristica NON appartiene a TCP?
- A) Connection-oriented
- B) Reliable delivery
- C) Low latency
- D) Flow control

**Q2.2** UDP è principalmente utilizzato per:
- A) File transfer
- B) Email
- C) Real-time gaming
- D) Web browsing

**Q2.3** Quanti bit ha un indirizzo IPv4?
- A) 16
- B) 32
- C) 64
- D) 128

**Q2.4** Quale porta è standard per HTTPS?
- A) 80
- B) 443
- C) 8080
- D) 8443

**Q2.5** Il protocollo DNS utilizza principalmente:
- A) TCP
- B) UDP
- C) ICMP
- D) ARP

### Domande Aperte

**Q2.6** Elenca 3 vantaggi di TCP rispetto a UDP.

**Q2.7** In quali scenari sceglieresti UDP invece di TCP?

**Q2.8** Spiega la differenza tra IPv4 e IPv6.

---

## 3. Architetture di Rete

### Domande a Risposta Multipla

**Q3.1** Nell'architettura Client-Server, chi inizia la comunicazione?
- A) Server
- B) Client
- C) Entrambi simultaneamente
- D) Dipende dal protocollo

**Q3.2** Quale NON è un vantaggio dell'architettura P2P?
- A) Scalabilità
- B) Resilienza
- C) Sicurezza centralizzata
- D) Costo ridotto

**Q3.3** Nel pattern Request-Response, cosa accade dopo che il client invia una request?
- A) Il server risponde immediatamente
- B) Il server elabora e poi risponde
- C) Il client invia un'altra request
- D) La connessione si chiude

**Q3.4** BitTorrent è un esempio di architettura:
- A) Client-Server
- B) Peer-to-Peer
- C) Hybrid P2P
- D) Centralized

### Domande Aperte

**Q3.5** Confronta vantaggi e svantaggi dell'architettura Client-Server vs P2P.

**Q3.6** Cos'è un'architettura Hybrid P2P? Fornisci un esempio.

**Q3.7** Descrivi il pattern Request-Response e le sue varianti (Long Polling, Streaming).

---

## 4. Concetti TCP/IP

### Domande a Risposta Multipla

**Q4.1** Quanti passaggi ha il three-way handshake TCP?
- A) 2
- B) 3
- C) 4
- D) 5

**Q4.2** Nel three-way handshake, il client invia prima:
- A) ACK
- B) SYN
- C) SYN-ACK
- D) FIN

**Q4.3** Il Flow Control in TCP previene:
- A) Congestione di rete
- B) Overflow del buffer del receiver
- C) Packet loss
- D) DNS failures

**Q4.4** La Congestion Window (CWND) è gestita da:
- A) Client
- B) Server
- C) Sender
- D) Router

**Q4.5** Quale range di porte è "Well-Known"?
- A) 0-1023
- B) 1024-49151
- C) 49152-65535
- D) 1-65535

### Domande Aperte

**Q4.6** Spiega il three-way handshake passo per passo.

**Q4.7** Come funziona il meccanismo di ritrasmissione in TCP?

**Q4.8** Qual è la differenza tra Flow Control e Congestion Control?

**Q4.9** Spiega la differenza tra localhost (127.0.0.1) e 0.0.0.0.

---

## 5. Socket Programming

### Domande a Risposta Multipla

**Q5.1** Un socket è identificato da:
- A) Solo IP address
- B) Solo Port number
- C) Protocol, IP, Port
- D) Solo Protocol

**Q5.2** SOCK_STREAM corrisponde a:
- A) UDP
- B) TCP
- C) ICMP
- D) HTTP

**Q5.3** Nel lifecycle di un socket TCP client, dopo CONNECTING viene:
- A) CLOSED
- B) LISTENING
- C) CONNECTED
- D) ACTIVE

**Q5.4** Blocking I/O significa:
- A) Thread continua l'esecuzione
- B) Thread si blocca in attesa
- C) Socket si chiude
- D) Errore di connessione

**Q5.5** Node.js utilizza quale tipo di I/O?
- A) Blocking
- B) Non-blocking
- C) Sincrono
- D) Multiplex

### Domande Aperte

**Q5.6** Spiega la differenza tra Stream Socket e Datagram Socket.

**Q5.7** Descrivi il lifecycle completo di un socket TCP server.

**Q5.8** Perché Node.js può gestire migliaia di connessioni simultanee con un solo thread?

**Q5.9** Quali sono i principali eventi di un socket in Node.js?

---

## 6. Modulo NET di Node.js

### Domande a Risposta Multipla

**Q6.1** Il modulo `net` di Node.js gestisce:
- A) Solo TCP
- B) Solo UDP
- C) TCP e UDP
- D) HTTP

**Q6.2** Un socket TCP in Node.js è uno:
- A) Readable Stream
- B) Writable Stream
- C) Duplex Stream
- D) Transform Stream

**Q6.3** L'evento 'data' di un socket riceve:
- A) String
- B) Buffer
- C) Object
- D) Array

**Q6.4** `socket.write()` ritorna false quando:
- A) Socket chiuso
- B) Buffer pieno
- C) Errore di rete
- D) Timeout

**Q6.5** Per gestire UDP in Node.js si usa il modulo:
- A) net
- B) dgram
- C) udp
- D) socket

### Domande Aperte

**Q6.6** Spiega come funziona l'architettura event-driven di Node.js.

**Q6.7** Cosa sono i Buffer in Node.js e perché sono importanti?

**Q6.8** Come si gestisce il backpressure in uno stream?

---

## 7. Error Handling

### Domande a Risposta Multipla

**Q7.1** L'errore ECONNREFUSED indica:
- A) Porta già in uso
- B) Server non raggiungibile
- C) Timeout
- D) DNS failure

**Q7.2** L'errore EADDRINUSE indica:
- A) Porta già in uso
- B) Indirizzo IP non valido
- C) Connessione rifiutata
- D) Timeout

**Q7.3** L'errore ETIMEDOUT indica:
- A) Server occupato
- B) Timeout connessione
- C) Porta chiusa
- D) DNS lento

**Q7.4** Il pattern Circuit Breaker serve per:
- A) Chiudere connessioni
- B) Proteggere da failure cascading
- C) Criptare dati
- D) Load balancing

### Domande Aperte

**Q7.5** Perché è importante gestire sempre l'evento 'error' sui socket?

**Q7.6** Spiega il pattern Circuit Breaker.

**Q7.7** Come implementeresti una retry logic con exponential backoff?

---

## 8. Domande Pratiche di Coding

### Esercizio 1: Echo Server

**Q8.1** Scrivi un server TCP che:
- Ascolta sulla porta 3000
- Accetta connessioni multiple
- Fa echo di tutto ciò che riceve
- Gestisce gli errori

<details>
<summary>Suggerimento</summary>

```javascript
const net = require('net');

const server = net.createServer((socket) => {
    // Implementa qui
});

server.listen(3000);
```
</details>

### Esercizio 2: Client con Retry

**Q8.2** Scrivi un client TCP che:
- Si connette a localhost:3000
- Riprova fino a 5 volte in caso di errore
- Usa exponential backoff (1s, 2s, 4s, 8s, 16s)
- Invia un messaggio dopo la connessione

### Esercizio 3: UDP Echo

**Q8.3** Scrivi un server UDP echo che:
- Ascolta sulla porta 4000
- Riceve datagram
- Rimanda lo stesso datagram al mittente

### Esercizio 4: Event Logger

**Q8.4** Scrivi un server che logga tutti gli eventi del socket:
- connect
- data
- end
- close
- error
- timeout

### Esercizio 5: Buffer Management

**Q8.5** Scrivi codice che:
- Crea un buffer da una stringa "Hello World"
- Converte il buffer in hex
- Legge i primi 5 byte
- Li converte in stringa

---

## 9. Troubleshooting

### Scenario 1

**Q9.1** Il tuo server non si avvia e ottieni l'errore:
```
Error: listen EADDRINUSE: address already in use :::8080
```

Cosa fai per risolvere?

### Scenario 2

**Q9.2** Il client ottiene l'errore:
```
Error: connect ECONNREFUSED 127.0.0.1:3000
```

Quali sono le possibili cause?

### Scenario 3

**Q9.3** Il server riceve dati ma non riesce a inviarli. Socket.write() ritorna false. Cosa sta succedendo?

### Scenario 4

**Q9.4** Hai un server che funziona su localhost ma non è raggiungibile dalla rete. Qual è il problema probabile?

### Scenario 5

**Q9.5** Usando Wireshark, vedi il SYN ma non il SYN-ACK. Cosa significa?

---

## 10. Tools e Environment

### Domande a Risposta Multipla

**Q10.1** Quale comando verifica se una porta è in uso su Linux?
- A) `port status 8080`
- B) `netstat -tuln | grep 8080`
- C) `check-port 8080`
- D) `port-scan 8080`

**Q10.2** netcat (nc) può essere usato per:
- A) Solo test TCP
- B) Solo test UDP
- C) Entrambi TCP e UDP
- D) Solo HTTP

**Q10.3** Per catturare pacchetti su porta 8080 con tcpdump:
- A) `tcpdump 8080`
- B) `tcpdump -p 8080`
- C) `tcpdump port 8080`
- D) `tcpdump --port 8080`

**Q10.4** nodemon serve per:
- A) Monitorare connessioni
- B) Auto-restart su modifiche file
- C) Debug applicazioni
- D) Test performance

### Domande Aperte

**Q10.5** Elenca 3 modi per testare un server TCP senza scrivere codice.

**Q10.6** Come useresti Wireshark per debug di una connessione TCP?

**Q10.7** Qual è la differenza tra `lsof` e `netstat`?

---

## Risposte

<details>
<summary>Clicca per vedere le risposte</summary>

### 1. Modello OSI e TCP/IP

**Q1.1:** C) Transport (4)  
**Q1.2:** C) 4  
**Q1.3:** C) IP (è al livello Internet/Network)  
**Q1.4:** B) Transport

**Q1.5:** Il modello OSI ha 7 livelli ed è più un framework teorico/didattico. Il modello TCP/IP ha 4 livelli ed è il modello pratico usato su Internet.

**Q1.6:** Permette separazione delle responsabilità, modularità, facilita lo sviluppo e il troubleshooting isolando i problemi a specifici livelli.

**Q1.7:** Fornisce comunicazione end-to-end affidabile (TCP) o non affidabile (UDP) tra applicazioni, gestendo segmentazione, riassemblaggio, flow control, error checking.

---

### 2. Protocolli di Rete

**Q2.1:** C) Low latency (TCP ha maggior latency per affidabilità)  
**Q2.2:** C) Real-time gaming  
**Q2.3:** B) 32  
**Q2.4:** B) 443  
**Q2.5:** B) UDP (principalmente, anche se può usare TCP)

**Q2.6:** 
1. Consegna garantita dei dati
2. Dati arrivano nell'ordine corretto
3. Flow control e congestion control

**Q2.7:** Streaming video/audio, gaming online, VoIP, IoT sensors - casi dove velocità è più importante dell'affidabilità e qualche perdita di dati è accettabile.

**Q2.8:** IPv4 usa indirizzi a 32 bit (~4.3 miliardi), formato decimale. IPv6 usa 128 bit (340 undecillion indirizzi), formato esadecimale, include IPSec nativo, no NAT necessario.

---

### 3. Architetture di Rete

**Q3.1:** B) Client  
**Q3.2:** C) Sicurezza centralizzata  
**Q3.3:** B) Il server elabora e poi risponde  
**Q3.4:** B) Peer-to-Peer

**Q3.5:**
- **Client-Server**: Pro: centralizzazione, sicurezza, facile manutenzione. Contro: single point of failure, costi server, bottleneck.
- **P2P**: Pro: scalabilità, resilienza, costi bassi. Contro: complessità, sicurezza difficile, consistenza dati.

**Q3.6:** Usa server centralizzato per discovery/login ma comunicazione diretta P2P tra peer. Esempio: vecchia architettura Skype.

**Q3.7:** Client invia request, server elabora e risponde. Varianti: Long Polling (server trattiene request fino a evento), Streaming (server invia risposta in chunk progressivi).

---

### 4. Concetti TCP/IP

**Q4.1:** B) 3  
**Q4.2:** B) SYN  
**Q4.3:** B) Overflow del buffer del receiver  
**Q4.4:** C) Sender  
**Q4.5:** A) 0-1023

**Q4.6:**
1. Client → Server: SYN (SEQ=x)
2. Server → Client: SYN-ACK (SEQ=y, ACK=x+1)
3. Client → Server: ACK (ACK=y+1)
Connessione ESTABLISHED

**Q4.7:** TCP numera ogni byte, receiver conferma con ACK. Se sender non riceve ACK entro timeout, ritrasmette automaticamente il segmento.

**Q4.8:** Flow Control previene sender da inviare troppo veloce per receiver (gestisce buffer receiver). Congestion Control previene sovraccarico della rete (gestisce congestione di rete).

**Q4.9:** localhost (127.0.0.1) è loopback, traffico non esce dalla macchina. 0.0.0.0 significa "tutte le interfacce", il server accetta connessioni da qualsiasi interfaccia di rete.

---

### 5. Socket Programming

**Q5.1:** C) Protocol, IP, Port  
**Q5.2:** B) TCP  
**Q5.3:** C) CONNECTED  
**Q5.4:** B) Thread si blocca in attesa  
**Q5.5:** B) Non-blocking

**Q5.6:** Stream Socket (TCP): connection-oriented, reliable, ordered. Datagram Socket (UDP): connectionless, unreliable, veloce.

**Q5.7:** CLOSED → socket() → CREATED → bind() → BOUND → listen() → LISTENING → accept() → NEW CLIENT → handle client → loop back to LISTENING

**Q5.8:** Usa non-blocking I/O e event loop. Nessun thread si blocca in attesa. OS notifica quando I/O è pronto, callback vengono eseguiti solo quando necessario.

**Q5.9:** connect, data, drain, end, close, error, timeout

---

### 6. Modulo NET

**Q6.1:** A) Solo TCP  
**Q6.2:** C) Duplex Stream  
**Q6.3:** B) Buffer  
**Q6.4:** B) Buffer pieno  
**Q6.5:** B) dgram

**Q6.6:** Single-threaded event loop. Operazioni I/O sono asincrone e non-blocking. Quando I/O completa, callback viene inserito nella coda eventi. Event loop processa callbacks sequenzialmente.

**Q6.7:** Buffer sono array di byte per gestire dati binari. JavaScript non gestisce bene dati binari, Buffer fornisce API efficiente per lavorare con byte raw, essenziale per networking.

**Q6.8:** Controllare valore ritorno di write(). Se false, buffer pieno, fermare scrittura. Ascoltare evento 'drain', ripartire quando buffer svuotato.

---

### 7. Error Handling

**Q7.1:** B) Server non raggiungibile  
**Q7.2:** A) Porta già in uso  
**Q7.3:** B) Timeout connessione  
**Q7.4:** B) Proteggere da failure cascading

**Q7.5:** Senza handler, errore non gestito causa crash applicazione (uncaught exception). Sempre necessario per robustezza.

**Q7.6:** Monitora failure. Dopo soglia, apre circuito (blocca richieste). Dopo timeout, prova riconnessione (half-open). Se successo, chiude circuito. Previene cascading failures.

**Q7.7:**
```javascript
async function retry(fn, retries = 5, delay = 1000) {
    for (let i = 0; i < retries; i++) {
        try {
            return await fn();
        } catch (err) {
            if (i === retries - 1) throw err;
            await new Promise(r => setTimeout(r, delay * Math.pow(2, i)));
        }
    }
}
```

---

### 8. Domande Pratiche

**Q8.1:**
```javascript
const net = require('net');

const server = net.createServer((socket) => {
    console.log('Client connected');
    
    socket.on('data', (data) => {
        socket.write(data); // echo
    });
    
    socket.on('error', (err) => {
        console.error('Socket error:', err.message);
    });
    
    socket.on('close', () => {
        console.log('Client disconnected');
    });
});

server.on('error', (err) => {
    console.error('Server error:', err.message);
});

server.listen(3000, () => {
    console.log('Server listening on port 3000');
});
```

**Q8.2:**
```javascript
const net = require('net');

async function connectWithRetry(maxRetries = 5) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            const socket = await new Promise((resolve, reject) => {
                const s = net.connect({ port: 3000 });
                s.once('connect', () => resolve(s));
                s.once('error', reject);
            });
            
            console.log('Connected!');
            socket.write('Hello\n');
            return socket;
        } catch (err) {
            console.log(`Attempt ${i + 1} failed: ${err.message}`);
            if (i < maxRetries - 1) {
                const delay = 1000 * Math.pow(2, i);
                console.log(`Waiting ${delay}ms...`);
                await new Promise(r => setTimeout(r, delay));
            }
        }
    }
    throw new Error('Max retries reached');
}

connectWithRetry().catch(console.error);
```

**Q8.3:**
```javascript
const dgram = require('dgram');

const server = dgram.createSocket('udp4');

server.on('message', (msg, rinfo) => {
    console.log(`Received from ${rinfo.address}:${rinfo.port}`);
    server.send(msg, rinfo.port, rinfo.address);
});

server.on('error', (err) => {
    console.error('Error:', err.message);
});

server.bind(4000, () => {
    console.log('UDP server listening on port 4000');
});
```

**Q8.4:**
```javascript
const net = require('net');

const server = net.createServer((socket) => {
    console.log('[connect] Client connected');
    
    socket.on('data', (data) => {
        console.log('[data]', data.toString());
    });
    
    socket.on('end', () => {
        console.log('[end] Client initiated close');
    });
    
    socket.on('close', (hadError) => {
        console.log('[close] Socket closed, error:', hadError);
    });
    
    socket.on('error', (err) => {
        console.log('[error]', err.message);
    });
    
    socket.on('timeout', () => {
        console.log('[timeout] Socket timeout');
    });
    
    socket.setTimeout(30000);
});

server.listen(3000);
```

**Q8.5:**
```javascript
// Crea buffer
const buf = Buffer.from('Hello World');

// Converti in hex
const hex = buf.toString('hex');
console.log('Hex:', hex);

// Primi 5 byte
const first5 = buf.slice(0, 5);

// Converti in stringa
const str = first5.toString();
console.log('String:', str); // 'Hello'
```

---

### 9. Troubleshooting

**Q9.1:**
1. Trova processo: `lsof -i :8080`
2. Kill processo: `kill -9 <PID>`
3. Oppure cambia porta nel codice
4. Oppure gestisci errore e usa porta alternativa

**Q9.2:**
- Server non è avviato
- Server su porta diversa
- Server su host diverso
- Firewall blocca connessione
- Server ha crashato

**Q9.3:**
Buffer di scrittura è pieno (backpressure). Soluzione:
- Fermare scrittura
- Aspettare evento 'drain'
- Riprendere scrittura quando buffer svuotato

**Q9.4:**
Server probabilmente in ascolto su localhost (127.0.0.1) invece di 0.0.0.0. Cambia bind address a 0.0.0.0 o interfaccia specifica.

**Q9.5:**
Server non risponde al SYN. Possibili cause:
- Server non in ascolto
- Firewall blocca pacchetti
- Server sovraccarico
- Rete down

---

### 10. Tools e Environment

**Q10.1:** B) `netstat -tuln | grep 8080`  
**Q10.2:** C) Entrambi TCP e UDP  
**Q10.3:** C) `tcpdump port 8080`  
**Q10.4:** B) Auto-restart su modifiche file

**Q10.5:**
1. `nc localhost 8080` (netcat)
2. `telnet localhost 8080`
3. `curl http://localhost:8080`

**Q10.6:**
1. Filtra per porta: `tcp.port == 8080`
2. Segui stream TCP: tasto destro → Follow TCP Stream
3. Verifica handshake (SYN, SYN-ACK, ACK)
4. Controlla flag TCP, sequence numbers, ACKs
5. Identifica retransmission, packet loss

**Q10.7:**
- `lsof`: List Open Files, mostra file descriptor aperti (inclusi socket) per processo
- `netstat`: Network Statistics, mostra connessioni di rete, routing table, statistiche interfacce

</details>

---

## Progetti Suggeriti

Per consolidare le conoscenze:

1. **Echo Server Completo**: TCP echo con logging, error handling, graceful shutdown
2. **Chat Multi-Client**: Server chat con room, comandi, broadcast
3. **File Transfer**: Client/server per trasferimento file con progress bar
4. **UDP Ping-Pong**: Misura latency tra client e server UDP
5. **Port Scanner**: Scansiona range porte per trovare servizi aperti
6. **Proxy TCP**: Proxy semplice che inoltra traffico TCP
7. **Load Balancer**: Distribuisce richieste su multiple backend

---

## Risorse Aggiuntive

### Documentazione
- [Node.js net module](https://nodejs.org/api/net.html)
- [Node.js dgram module](https://nodejs.org/api/dgram.html)
- [RFC 793 - TCP](https://tools.ietf.org/html/rfc793)
- [RFC 768 - UDP](https://tools.ietf.org/html/rfc768)

### Tools Online
- [Wireshark Tutorial](https://www.wireshark.org/docs/)
- [tcpdump Examples](https://danielmiessler.com/study/tcpdump/)
- [netcat Guide](https://nc110.sourceforge.io/)

### Libri Consigliati
- "TCP/IP Illustrated" - W. Richard Stevens
- "Computer Networking: A Top-Down Approach" - Kurose & Ross
- "Node.js Design Patterns" - Mario Casciaro

---

## Valutazione

### Punteggio

- **Principiante**: 0-40% risposte corrette
- **Intermedio**: 41-70% risposte corrette
- **Avanzato**: 71-90% risposte corrette
- **Esperto**: 91-100% risposte corrette

### Prossimi Passi

Se hai ottenuto:
- **< 70%**: Rivedi le guide, fai più pratica con gli esempi
- **70-90%**: Sei pronto per il Modulo 2 (TCP Programming)
- **> 90%**: Ottimo! Procedi con sicurezza ai moduli avanzati

Buono studio! 📚
