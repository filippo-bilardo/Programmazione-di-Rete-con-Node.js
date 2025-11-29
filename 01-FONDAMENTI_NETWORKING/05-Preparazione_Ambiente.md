# 1.5 Preparazione Ambiente di Sviluppo

## Indice
- [Setup Node.js e npm](#setup-nodejs-e-npm)
- [IDE e Strumenti Consigliati](#ide-e-strumenti-consigliati)
- [Porte e Firewall Configuration](#porte-e-firewall-configuration)
- [Testing Tools](#testing-tools)
- [Debugging Network Applications](#debugging-network-applications)
- [Network Troubleshooting](#network-troubleshooting)
- [Package Utili](#package-utili)
- [Best Practices per lo Sviluppo](#best-practices-per-lo-sviluppo)

---

## Setup Node.js e npm

### Installazione Node.js

#### Windows

1. **Download** da [nodejs.org](https://nodejs.org)
2. Esegui installer (`.msi`)
3. Verifica installazione:

```cmd
node --version
npm --version
```

#### macOS

**Homebrew** (consigliato):

```bash
brew install node
```

**Oppure** download da [nodejs.org](https://nodejs.org)

#### Linux

**Ubuntu/Debian**:

```bash
# Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**Fedora/RHEL**:

```bash
sudo dnf install nodejs
```

**Arch Linux**:

```bash
sudo pacman -S nodejs npm
```

### Verificare Installazione

```bash
node --version     # v20.x.x
npm --version      # 10.x.x

# Test Node.js REPL
node
> console.log('Hello Node.js')
> .exit
```

### npm (Node Package Manager)

**Configurazione base**:

```bash
# Imposta directory globale (opzionale)
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'

# Aggiungi a PATH (~/.bashrc or ~/.zshrc)
export PATH=~/.npm-global/bin:$PATH

# Verifica
npm config get prefix
```

### nvm (Node Version Manager)

Per gestire multiple versioni Node.js:

**Installazione**:

```bash
# Linux/macOS
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Verifica
nvm --version
```

**Uso**:

```bash
# Installa versione specifica
nvm install 20
nvm install 18

# Usa versione
nvm use 20

# Lista versioni installate
nvm list

# Imposta default
nvm alias default 20
```

---

## IDE e Strumenti Consigliati

### Visual Studio Code

**Download**: [code.visualstudio.com](https://code.visualstudio.com)

#### Estensioni Consigliate

```bash
# JavaScript/Node.js
code --install-extension dbaeumer.vscode-eslint
code --install-extension esbenp.prettier-vscode
code --install-extension christian-kohler.npm-intellisense

# Networking
code --install-extension rangav.vscode-thunder-client  # REST client
code --install-extension humao.rest-client

# Debugging
code --install-extension ms-vscode.js-debug-nightly
```

#### Configurazione VSCode

`.vscode/settings.json`:

```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "javascript.suggest.autoImports": true,
  "javascript.updateImportsOnFileMove.enabled": "always"
}
```

#### Launch Configuration

`.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Launch Server",
      "program": "${workspaceFolder}/server.js"
    },
    {
      "type": "node",
      "request": "attach",
      "name": "Attach to Process",
      "port": 9229
    }
  ]
}
```

### Altre IDE

- **WebStorm** (JetBrains) - IDE commerciale potente
- **Sublime Text** - Editor leggero
- **Vim/Neovim** - Per puristi della CLI

---

## Porte e Firewall Configuration

### Porte per Sviluppo

**Porte comuni**:

```
3000-3999  → Sviluppo locale (Node.js, React, etc.)
8000-8999  → Server di test
4000-4999  → API development
5000-5999  → Alternative dev ports
```

### Verificare Porte Disponibili

#### Linux/macOS

```bash
# Verifica porta in uso
sudo lsof -i :8080

# Oppure
netstat -tuln | grep 8080

# Trova processo su porta
sudo lsof -i :8080 | grep LISTEN
```

#### Windows

```cmd
# Verifica porta
netstat -ano | findstr :8080

# Trova processo
tasklist /FI "PID eq 1234"
```

### Liberare Porta

#### Linux/macOS

```bash
# Trova PID
sudo lsof -i :8080

# Kill processo
sudo kill -9 <PID>
```

#### Windows

```cmd
# Trova PID
netstat -ano | findstr :8080

# Kill processo
taskkill /PID <PID> /F
```

### Firewall Configuration

#### Linux (ufw)

```bash
# Abilita firewall
sudo ufw enable

# Consenti porta specifica
sudo ufw allow 8080/tcp

# Consenti range porte
sudo ufw allow 3000:3999/tcp

# Status
sudo ufw status
```

#### macOS (pf)

```bash
# Disabilita firewall per sviluppo (non production!)
sudo pfctl -d

# Oppure configura /etc/pf.conf
```

#### Windows Firewall

```powershell
# PowerShell (Run as Administrator)
New-NetFirewallRule -DisplayName "Node.js Dev" -Direction Inbound -Protocol TCP -LocalPort 3000-3999 -Action Allow
```

---

## Testing Tools

### netcat (nc)

**Swiss army knife** per networking.

#### Installazione

```bash
# Linux
sudo apt-get install netcat  # Debian/Ubuntu
sudo dnf install nc          # Fedora

# macOS (preinstallato)
which nc  # /usr/bin/nc

# Windows
# Download da: https://nmap.org/ncat/
```

#### Uso

```bash
# Test server TCP
nc localhost 8080

# Invia messaggio e chiudi
echo "Hello" | nc localhost 8080

# UDP
nc -u localhost 8080

# Listen mode (crea server temporaneo)
nc -l 8080

# Transfer file
# Server
nc -l 8080 > received_file.txt
# Client
nc localhost 8080 < file.txt

# Port scan
nc -zv localhost 8000-8100
```

### telnet

**Test connessioni TCP**.

```bash
# Installazione (se mancante)
sudo apt-get install telnet  # Linux
brew install telnet          # macOS

# Uso
telnet localhost 8080

# Test HTTP
telnet example.com 80
GET / HTTP/1.1
Host: example.com
[press Enter twice]
```

### curl

**HTTP client CLI**.

```bash
# GET request
curl http://localhost:8080

# POST request
curl -X POST http://localhost:8080/api/data \
  -H "Content-Type: application/json" \
  -d '{"key":"value"}'

# Verbose output
curl -v http://localhost:8080

# Follow redirects
curl -L http://example.com

# Save response
curl -o output.txt http://localhost:8080
```

### ss (socket statistics)

**Linux** (moderno sostituto di `netstat`):

```bash
# Tutte le connessioni TCP
ss -ta

# Solo listening
ss -tl

# Con numeri porta
ss -tln

# Filtra porta
ss -tln sport = :8080

# Con processi
sudo ss -tlnp
```

### Wireshark

**Packet analyzer** (GUI).

**Installazione**:

```bash
# Linux
sudo apt-get install wireshark

# macOS
brew install --cask wireshark

# Windows: Download da wireshark.org
```

**Uso base**:

1. Seleziona interfaccia (es: `lo` per localhost)
2. Filtra: `tcp.port == 8080`
3. Start capture
4. Analizza pacchetti

### tcpdump

**Packet analyzer** (CLI).

```bash
# Capture su interfaccia
sudo tcpdump -i lo

# Filtra porta
sudo tcpdump -i lo port 8080

# Filtra TCP
sudo tcpdump -i lo tcp

# Salva in file
sudo tcpdump -i lo -w capture.pcap

# Leggi da file
tcpdump -r capture.pcap

# Verboso
sudo tcpdump -i lo -vvv port 8080
```

---

## Debugging Network Applications

### Node.js Debugger

#### Chrome DevTools

```bash
# Avvia con inspector
node --inspect server.js

# Oppure
node --inspect-brk server.js  # Pausa all'inizio
```

Poi apri Chrome:

```
chrome://inspect
```

#### VSCode Debugger

1. Imposta breakpoint (click su numero linea)
2. Premi F5 (Start Debugging)
3. Usa controls: Step over (F10), Step into (F11), etc.

### Logging

#### console.log

```javascript
const net = require('net');

const server = net.createServer((socket) => {
    console.log('[DEBUG] Client connected:', socket.remoteAddress);
    
    socket.on('data', (data) => {
        console.log('[DATA]', data.toString());
    });
    
    socket.on('close', () => {
        console.log('[DEBUG] Client disconnected');
    });
});

server.listen(8080, () => {
    console.log('[INFO] Server listening on port 8080');
});
```

#### debug module

```bash
# Installa
npm install debug
```

```javascript
const debug = require('debug');

const logServer = debug('app:server');
const logClient = debug('app:client');
const logData = debug('app:data');

logServer('Server started');
logClient('Client connected');
logData('Received: %o', data);
```

**Attiva debug**:

```bash
# Tutti i log
DEBUG=* node server.js

# Solo server
DEBUG=app:server node server.js

# Multiple
DEBUG=app:server,app:client node server.js
```

### winston (Advanced Logging)

```bash
npm install winston
```

```javascript
const winston = require('winston');

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' }),
        new winston.transports.Console({
            format: winston.format.simple()
        })
    ]
});

logger.info('Server started on port 8080');
logger.error('Connection failed', { error: err.message });
```

---

## Network Troubleshooting

### Checklist Debugging

#### 1. Verifica Server Running

```bash
# Porta in ascolto?
sudo lsof -i :8080

# Processo attivo?
ps aux | grep node
```

#### 2. Verifica Connettività

```bash
# Ping host
ping localhost

# Test porta TCP
nc -zv localhost 8080

# Telnet
telnet localhost 8080
```

#### 3. Verifica Firewall

```bash
# Linux
sudo ufw status

# Disabilita temporaneamente (solo per test!)
sudo ufw disable
```

#### 4. Verifica DNS

```bash
# Risoluzione nome
nslookup example.com

# Oppure
dig example.com

# Traceroute
traceroute example.com
```

#### 5. Capture Packets

```bash
# tcpdump
sudo tcpdump -i lo -vvv port 8080

# Wireshark
# Filtra: tcp.port == 8080
```

### Errori Comuni

#### EADDRINUSE

```javascript
// Problema: Porta già in uso

// Soluzione 1: Cambia porta
server.listen(8081);

// Soluzione 2: Kill processo esistente
// lsof -i :8080 | grep node | awk '{print $2}' | xargs kill

// Soluzione 3: Gestisci errore
server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error('Port in use, trying next...');
        server.listen(8081);
    }
});
```

#### ECONNREFUSED

```javascript
// Problema: Server non in ascolto

// Verifica:
// 1. Server running?
// 2. Porta corretta?
// 3. Host corretto?

// Soluzione: Retry logic
function connectWithRetry(retries = 5) {
    const socket = net.connect({ port: 8080 });
    
    socket.on('error', (err) => {
        if (err.code === 'ECONNREFUSED' && retries > 0) {
            console.log(`Retry... (${retries} left)`);
            setTimeout(() => connectWithRetry(retries - 1), 1000);
        }
    });
}
```

---

## Package Utili

### dotenv (Environment Variables)

```bash
npm install dotenv
```

**`.env`**:

```
PORT=8080
HOST=localhost
LOG_LEVEL=debug
```

**`server.js`**:

```javascript
require('dotenv').config();

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';

console.log(`Server on ${HOST}:${PORT}`);
```

### nodemon (Auto-restart)

```bash
npm install -g nodemon
```

**Uso**:

```bash
# Invece di
node server.js

# Usa
nodemon server.js

# Con watch su file specifici
nodemon --watch src server.js
```

**`nodemon.json`**:

```json
{
  "watch": ["src"],
  "ext": "js,json",
  "ignore": ["node_modules"],
  "exec": "node server.js"
}
```

### pm2 (Process Manager)

```bash
npm install -g pm2
```

**Uso**:

```bash
# Start
pm2 start server.js

# Start con nome
pm2 start server.js --name "my-server"

# Lista processi
pm2 list

# Logs
pm2 logs

# Restart
pm2 restart my-server

# Stop
pm2 stop my-server

# Monitor
pm2 monit
```

---

## Best Practices per lo Sviluppo

### 1. Project Structure

```
my-network-app/
├── src/
│   ├── server.js
│   ├── client.js
│   ├── utils/
│   │   ├── logger.js
│   │   └── config.js
│   └── handlers/
│       ├── connection.js
│       └── data.js
├── tests/
│   ├── server.test.js
│   └── client.test.js
├── logs/
│   ├── error.log
│   └── combined.log
├── .env
├── .gitignore
├── package.json
└── README.md
```

### 2. package.json

```json
{
  "name": "my-network-app",
  "version": "1.0.0",
  "description": "Network application",
  "main": "src/server.js",
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js",
    "test": "jest",
    "lint": "eslint src/"
  },
  "dependencies": {
    "dotenv": "^16.0.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.0",
    "eslint": "^8.0.0",
    "jest": "^29.0.0"
  }
}
```

### 3. .gitignore

```
node_modules/
npm-debug.log
.env
.DS_Store
logs/*.log
*.swp
```

### 4. ESLint Configuration

```bash
npm install --save-dev eslint
npx eslint --init
```

**`.eslintrc.json`**:

```json
{
  "env": {
    "node": true,
    "es2021": true
  },
  "extends": "eslint:recommended",
  "parserOptions": {
    "ecmaVersion": 12
  },
  "rules": {
    "no-console": "off",
    "no-unused-vars": "warn"
  }
}
```

### 5. Error Handling

```javascript
// ✅ GOOD: Gestisci sempre errori
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

const server = net.createServer((socket) => {
    socket.on('error', (err) => {
        console.error('Socket error:', err.message);
    });
});

server.on('error', (err) => {
    console.error('Server error:', err.message);
});
```

### 6. Graceful Shutdown

```javascript
function gracefulShutdown(server) {
    console.log('Shutting down gracefully...');
    
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
    
    // Force close after 10 seconds
    setTimeout(() => {
        console.error('Forcing shutdown');
        process.exit(1);
    }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown(server));
process.on('SIGINT', () => gracefulShutdown(server));
```

---

## Riepilogo

In questa guida abbiamo coperto:

✅ **Setup Node.js**: Installazione e configurazione  
✅ **IDE**: VSCode e configurazione  
✅ **Firewall**: Gestione porte e firewall  
✅ **Testing Tools**: nc, telnet, curl, wireshark  
✅ **Debugging**: DevTools, logging, troubleshooting  
✅ **Package Utili**: dotenv, nodemon, pm2  
✅ **Best Practices**: Struttura progetto, error handling  

Ora hai un ambiente completo per sviluppare applicazioni di rete con Node.js!

---

## Prossimi Passi

Hai completato il **Modulo 1: FONDAMENTI DI NETWORKING**! 

Ora sei pronto per:

📖 **Modulo 2:** [TCP Programming](../02-TCP_PROGRAMMING/01-TCP_Server_Base.md)

Inizieremo a scrivere veri server e client TCP!
