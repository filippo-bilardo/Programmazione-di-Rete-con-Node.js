# Esempi UDP Programming - Modulo 3

Esempi pratici per le guide del Modulo 3 UDP Programming.

## 📋 Indice Esempi

### **Base (Guide 01-03)**

1. **01-udp-echo-server.js** - Server echo UDP base
   - Riceve datagram
   - Rimanda echo al mittente
   - Eventi UDP base

2. **02-udp-echo-client.js** - Client echo UDP base
   - Invia messaggio
   - Riceve risposta
   - Gestione timeout

3. **03-udp-broadcast-server.js** - Service Discovery Server
   - Risponde a broadcast
   - Invia info servizio
   - Multiple client

4. **04-udp-broadcast-client.js** - Service Discovery Client
   - Invia richiesta broadcast
   - Riceve da multiple server
   - Timeout discovery

### **Multicast (Guida 04)**

5. **05-udp-multicast-sender.js** - Multicast Sender
   - Stream dati a gruppo
   - Simula sensori
   - Multiple subscriber

6. **06-udp-multicast-receiver.js** - Multicast Receiver
   - Subscribe a gruppo
   - Riceve stream
   - Statistiche packet loss

### **Affidabilità (Guida 04)**

7. **07-udp-reliable-client.js** - Client con ACK e Retry
   - Sequence numbers
   - Attesa ACK
   - Exponential backoff
   - Retry automatico

8. **08-udp-reliable-server.js** - Server con ACK
   - Invia ACK
   - Rileva duplicati
   - Gestisce out-of-order

### **Avanzati (Guide 05-06)**

9. **09-udp-file-transfer.js** - File Transfer UDP
   - Chunking file
   - Reassembly
   - Checksum verification
   - Packet loss detection

10. **10-udp-performance-test.js** - Performance Benchmark
    - Latency (RTT)
    - Throughput
    - Packet loss rate
    - Percentili (P50, P95, P99)

## 🚀 Come Usare

### Esempio 1: Echo Base

**Terminal 1 (Server):**
```bash
node 01-udp-echo-server.js
```

**Terminal 2 (Client):**
```bash
node 02-udp-echo-client.js "Hello UDP!"
```

### Esempio 2: Service Discovery

**Terminal 1 (Server):**
```bash
node 03-udp-broadcast-server.js
```

**Terminal 2 (Client):**
```bash
node 04-udp-broadcast-client.js
```

### Esempio 3: Multicast Streaming

**Terminal 1 (Sender):**
```bash
node 05-udp-multicast-sender.js 1000  # Ogni 1000ms
```

**Terminal 2-N (Receivers):**
```bash
node 06-udp-multicast-receiver.js
node 06-udp-multicast-receiver.js  # Più receivers contemporaneamente
```

### Esempio 4: UDP Affidabile

**Terminal 1 (Server):**
```bash
node 08-udp-reliable-server.js
```

**Terminal 2 (Client):**
```bash
node 07-udp-reliable-client.js
```

### Esempio 5: File Transfer

**Terminal 1 (Receiver):**
```bash
node 09-udp-file-transfer.js receive
```

**Terminal 2 (Sender):**
```bash
node 09-udp-file-transfer.js send README.md
```

### Esempio 6: Performance Test

**Terminal 1 (Server):**
```bash
node 10-udp-performance-test.js server
```

**Terminal 2 (Client):**
```bash
# Test con 1000 packets di 512 bytes
node 10-udp-performance-test.js client 1000 512

# Test con 10000 packets di 1024 bytes
node 10-udp-performance-test.js client 10000 1024
```

## 📊 Cosa Dimostrano

### Concetti Base
- ✅ Datagram-based communication
- ✅ Connectionless nature
- ✅ Fire-and-forget vs Request-Response
- ✅ Eventi UDP (message, listening, error, close)

### Broadcast & Multicast
- ✅ Service discovery pattern
- ✅ One-to-many communication
- ✅ Group membership (multicast)
- ✅ Packet loss in streaming

### Affidabilità
- ✅ Sequence numbers
- ✅ ACK/NACK pattern
- ✅ Retry logic
- ✅ Exponential backoff
- ✅ Duplicate detection
- ✅ Out-of-order handling

### Performance
- ✅ Latency measurement (RTT)
- ✅ Throughput calculation
- ✅ Packet loss rate
- ✅ Percentili statistici
- ✅ Chunking grandi dati
- ✅ Checksum verification

## 🔧 Requisiti

- Node.js 14+
- Nessuna dipendenza esterna (solo moduli built-in)
- Network access per broadcast/multicast

## 📝 Note

### Broadcast
- Richiede permessi per inviare a `255.255.255.255`
- Alcuni firewall possono bloccare
- Limitato alla rete locale (LAN)

### Multicast
- Range indirizzi: `224.0.0.0` - `239.255.255.255`
- Richiede routing multicast configurato
- TTL determina hop massimi

### Performance
- Packet loss simulabile con `tc` (Linux):
  ```bash
  sudo tc qdisc add dev lo root netem loss 10%  # 10% loss
  sudo tc qdisc del dev lo root                 # Remove
  ```

## 🎯 Esercizi Consigliati

1. **Modifica Echo Server**: Aggiungi counter messaggi per client
2. **Broadcast Enhaced**: Aggiungi timeout per rimozione server morti
3. **Multicast Stats**: Calcola jitter oltre a packet loss
4. **Reliable Protocol**: Aggiungi window-based flow control
5. **File Transfer**: Aggiungi compressione con zlib
6. **Performance**: Aggiungi test con traffic patterns diversi

## 📚 Collegamenti Guide

- **Guida 01**: UDP Fundamentals → Esempi 01-02
- **Guida 02**: UDP Server → Esempi 01, 03, 05, 08
- **Guida 03**: UDP Client → Esempi 02, 04, 06, 07
- **Guida 04**: UDP Avanzato → Esempi 03-08
- **Guida 05**: Performance → Esempi 09-10
- **Guida 06**: Protocol Design → Tutti gli esempi

## 🐛 Troubleshooting

**Porta già in uso:**
```bash
# Trova processo su porta
lsof -i :41234
# Oppure cambia PORT nella configurazione esempio
```

**Firewall blocca UDP:**
```bash
# Linux (ufw)
sudo ufw allow 41234/udp

# macOS
# System Preferences → Security & Privacy → Firewall Options
```

**Broadcast non funziona:**
- Verifica permessi di rete
- Usa indirizzo broadcast specifico: `192.168.1.255`
- Controlla configurazione firewall

**Multicast non funziona:**
- Verifica routing multicast: `ip route show`
- Testa su localhost prima: `127.0.0.1`
- Alcuni switch bloccano multicast di default
