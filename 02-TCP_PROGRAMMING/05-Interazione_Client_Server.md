# **🔄 Interazione Client-Server**

## **📑 Indice**
1. [Introduzione](#introduzione)
2. [Request-Response Pattern](#request-response-pattern)
3. [Message Framing](#message-framing)
4. [Protocol Negotiation](#protocol-negotiation)
5. [Authentication](#authentication)
6. [Command Dispatcher](#command-dispatcher)
7. [RPC Pattern](#rpc-pattern)
8. [Pub/Sub Pattern](#pubsub-pattern)

---

## **🎯 Introduzione**

**Pattern di comunicazione client-server**

Finora abbiamo visto **COME** creare server e client. Ora vediamo **COME farli comunicare** in modo strutturato.

**Il problema fondamentale:**

TCP è uno **stream di bytes** senza struttura:
```
Client invia: "MSG1" "MSG2" "MSG3"
Server riceve: "MSG1MS" "G2MSG3"  ← Chunk boundaries arbitrari!

Come sapere dove finisce un messaggio e inizia il prossimo? 🤔
```

**Soluzioni (pattern):**

1. **Message Framing**: Delimitare messaggi
2. **Request-Response**: Associare risposte a richieste
3. **Protocol Negotiation**: Client e server concordano su formato
4. **Authentication**: Verificare identità
5. **Command Dispatcher**: Routing comandi a handler
6. **RPC**: Chiamare funzioni remote come fossero locali
7. **Pub/Sub**: Messaging asincrono

**Progressione naturale:**

```
Livello 1: Raw bytes
  Client: socket.write('hello')
  Server: socket.on('data', ...)
  → Senza struttura, difficile da gestire

Livello 2: Message Framing
  Client: sendMessage('hello')
  Server: onMessage(msg => ...)
  → Messaggi delimitati, ma nessuna semantica

Livello 3: Request-Response
  Client: request('getUser', {id: 1})
  Server: onRequest('getUser', handler)
  → Associazione richieste/risposte

Livello 4: RPC
  Client: server.getUser(1)  ← Sembra chiamata locale!
  Server: async getUser(id) { ... }
  → Astrazione completa
```

**Quando usare quale pattern:**

| Pattern | Quando | Esempio use case |
|---------|--------|------------------|
| **Request-Response** | Operazioni CRUD | API calls, DB queries |
| **Message Framing** | Base per altri pattern | Sempre necessario |
| **Protocol Negotiation** | Versioning | API v1 vs v2 |
| **Authentication** | Security | Login, token validation |
| **Command Dispatcher** | Multiple azioni | Chat commands, CLI |
| **RPC** | Chiamate remote semplici | Microservices |
| **Pub/Sub** | Broadcasting | Chat, notifications, events |

**Pattern fondamentali per l'interazione client-server:**
- 📨 **Request-Response**: richiesta → elaborazione → risposta (classico, come HTTP)
- 📦 **Message Framing**: delimitazione messaggi (risolve il problema dello stream)
- 🤝 **Protocol Negotiation**: negoziazione protocollo (versioning, compatibility)
- 🔐 **Authentication**: autenticazione e autorizzazione (security)
- 🎯 **Command Dispatcher**: routing comandi a handler specifici
- 📞 **RPC**: Remote Procedure Call (chiama funzioni remote)
- 📡 **Pub/Sub**: Publish/Subscribe (messaging asincrono)

💡 **Nota**: Questi pattern si combinano. Es: RPC usa Request-Response che usa Message Framing.

---

## **📨 Request-Response Pattern**

**Il pattern più comune nella comunicazione client-server**

**Come funziona:**
```
Client                             Server
  │                                  │
  ├── Request (id:1, cmd:getUser) ──>│
  │                                  ├── Process request
  │                                  ├── Query DB
  │                                  ├── Build response
  │<── Response (id:1, data:{...}) ──┤
  ├── Match response con request
  │
```

**Problema da risolvere:**

In TCP, puoi avere **multiple richieste concorrenti**:
```
Client invia:
  Request 1 (getUser, id:5)
  Request 2 (getPost, id:10)
  Request 3 (getComment, id:3)

Server risponde (ordine NON garantito!):
  Response per Request 3  ← Arriva prima!
  Response per Request 1
  Response per Request 2

Come associare la risposta alla richiesta corretta? 🤔
```

**Soluzione: Request ID**

```javascript
// Client assegna ID univoco
request = {
  id: 1,              ← ID univoco
  command: 'getUser',
  data: { userId: 5 }
}

// Server include lo stesso ID nella risposta
response = {
  id: 1,              ← Stesso ID!
  success: true,
  data: { name: 'John' }
}

// Client matcha response con pending request
pendingRequests.get(1).resolve(response)
```

**Pattern tipico:**

1. Client genera ID univoco (incrementale o UUID)
2. Client salva Promise in `pendingRequests[id]`
3. Client invia richiesta con ID
4. Server processa e risponde con stesso ID
5. Client riceve risposta, trova Promise per ID
6. Client resolve/reject Promise

**Vantaggi:**
- ✅ Multiple richieste concorrenti
- ✅ Risposte out-of-order OK
- ✅ Timeout per richiesta
- ✅ Facile debug (trace by ID)

### **Basic Request-Response**

```javascript
class RequestResponseServer {
    constructor(port) {
        this.port = port;
        this.server = null;
        this.handlers = new Map();
    }
    
    registerHandler(command, handler) {
        this.handlers.set(command, handler);
    }
    
    async handleRequest(request) {
        try {
            const { id, command, data } = JSON.parse(request);
            
            const handler = this.handlers.get(command);
            if (!handler) {
                return {
                    id,
                    success: false,
                    error: `Unknown command: ${command}`
                };
            }
            
            const result = await handler(data);
            
            return {
                id,
                success: true,
                data: result
            };
        } catch (err) {
            return {
                id: null,
                success: false,
                error: err.message
            };
        }
    }
    
    start() {
        this.server = require('net').createServer((socket) => {
            let buffer = '';
            
            socket.on('data', async (chunk) => {
                buffer += chunk.toString();
                
                // Process complete messages (newline delimited)
                const lines = buffer.split('\n');
                buffer = lines.pop(); // Keep incomplete line
                
                for (const line of lines) {
                    if (line.trim()) {
                        const response = await this.handleRequest(line);
                        socket.write(JSON.stringify(response) + '\n');
                    }
                }
            });
            
            socket.on('error', (err) => {
                console.error('Socket error:', err.message);
            });
        });
        
        return new Promise((resolve) => {
            this.server.listen(this.port, () => {
                console.log(`✅ Server listening on port ${this.port}`);
                resolve();
            });
        });
    }
}

// Uso server
const server = new RequestResponseServer(3000);

server.registerHandler('add', async ({ a, b }) => {
    return { result: a + b };
});

server.registerHandler('multiply', async ({ a, b }) => {
    return { result: a * b };
});

server.registerHandler('getUser', async ({ id }) => {
    // Simula database query
    await new Promise(r => setTimeout(r, 100));
    return { id, name: 'John Doe', email: 'john@example.com' };
});

server.start();

// Client
class RequestResponseClient {
    constructor(host, port) {
        this.host = host;
        this.port = port;
        this.socket = null;
        this.requestId = 0;
        this.pendingRequests = new Map();
        this.buffer = '';
    }
    
    connect() {
        return new Promise((resolve, reject) => {
            this.socket = require('net').connect({
                host: this.host,
                port: this.port
            });
            
            this.socket.on('connect', () => {
                this.setupHandlers();
                resolve();
            });
            
            this.socket.on('error', reject);
        });
    }
    
    setupHandlers() {
        this.socket.on('data', (chunk) => {
            this.buffer += chunk.toString();
            
            const lines = this.buffer.split('\n');
            this.buffer = lines.pop();
            
            for (const line of lines) {
                if (line.trim()) {
                    this.handleResponse(line);
                }
            }
        });
    }
    
    handleResponse(line) {
        try {
            const response = JSON.parse(line);
            const pending = this.pendingRequests.get(response.id);
            
            if (pending) {
                this.pendingRequests.delete(response.id);
                
                if (response.success) {
                    pending.resolve(response.data);
                } else {
                    pending.reject(new Error(response.error));
                }
            }
        } catch (err) {
            console.error('Failed to parse response:', err.message);
        }
    }
    
    request(command, data, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const id = ++this.requestId;
            
            const timer = setTimeout(() => {
                this.pendingRequests.delete(id);
                reject(new Error('Request timeout'));
            }, timeout);
            
            this.pendingRequests.set(id, {
                resolve: (data) => {
                    clearTimeout(timer);
                    resolve(data);
                },
                reject: (err) => {
                    clearTimeout(timer);
                    reject(err);
                }
            });
            
            const request = { id, command, data };
            this.socket.write(JSON.stringify(request) + '\n');
        });
    }
    
    disconnect() {
        if (this.socket) {
            this.socket.end();
        }
    }
}

// Uso client
const client = new RequestResponseClient('localhost', 3000);

await client.connect();

const result1 = await client.request('add', { a: 5, b: 3 });
console.log('5 + 3 =', result1.result);

const result2 = await client.request('multiply', { a: 4, b: 7 });
console.log('4 * 7 =', result2.result);

const user = await client.request('getUser', { id: 123 });
console.log('User:', user);

client.disconnect();
```

---

## **📦 Message Framing**

**Il problema dello stream TCP**

TCP è **STREAM-BASED**, non **MESSAGE-BASED**:

```
Client invia 3 messaggi:
  write('MSG1')
  write('MSG2')
  write('MSG3')

Server riceve in chunk arbitrari:
  'data' event → 'MSG1MS'
  'data' event → 'G2MSG3'

Come sapere dove finisce MSG1 e inizia MSG2? 🤔
```

**Tre approcci per delimitare messaggi:**

**1. Length-Prefixed** (più efficiente)
```
[4 bytes length][N bytes data]
[0x0000000A]["Hello World"]  ← 10 bytes

Pro: ✅ Efficiente, binario-safe
Contro: ❌ Complessità, richiede buffering
Quando: Dati binari, performance critica
```

**2. Delimiter-Based** (più semplice)
```
"MSG1\n" "MSG2\n" "MSG3\n"

Pro: ✅ Semplice, human-readable
Contro: ❌ Devi escape delimiter nei dati
Quando: Dati testuali, debug facile
```

**3. Fixed-Length** (più veloce)
```
Ogni messaggio ESATTAMENTE 1024 bytes

Pro: ✅ Velocissimo, parsing triviale
Contro: ❌ Spreco se dati piccoli, limite se grandi
Quando: Dati di dimensione nota (protocolli binari)
```

**Confronto:**

| Approccio | Complessità | Performance | Flessibilità | Use case |
|-----------|--------------|-------------|----------------|----------|
| Length-Prefix | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Produzione, binario |
| Delimiter | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | Testing, text-based |
| Fixed-Length | ⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ | Protocolli specifici |

### **Length-Prefixed Framing**

```javascript
class LengthPrefixedFraming {
    static encode(message) {
        const data = Buffer.from(message);
        const length = Buffer.allocUnsafe(4);
        length.writeUInt32BE(data.length, 0);
        
        return Buffer.concat([length, data]);
    }
    
    static decode(buffer) {
        const messages = [];
        let offset = 0;
        
        while (offset < buffer.length) {
            // Need at least 4 bytes for length
            if (buffer.length - offset < 4) {
                break;
            }
            
            const length = buffer.readUInt32BE(offset);
            offset += 4;
            
            // Need complete message
            if (buffer.length - offset < length) {
                offset -= 4; // Reset to before length
                break;
            }
            
            const message = buffer.slice(offset, offset + length);
            messages.push(message.toString());
            offset += length;
        }
        
        return {
            messages,
            remaining: buffer.slice(offset)
        };
    }
}

// Server con length-prefixed framing
class FramedServer {
    constructor(port) {
        this.port = port;
        this.server = null;
    }
    
    start() {
        this.server = require('net').createServer((socket) => {
            let buffer = Buffer.alloc(0);
            
            socket.on('data', (chunk) => {
                buffer = Buffer.concat([buffer, chunk]);
                
                const { messages, remaining } = LengthPrefixedFraming.decode(buffer);
                buffer = remaining;
                
                for (const message of messages) {
                    console.log('Received:', message);
                    
                    const response = `Echo: ${message}`;
                    socket.write(LengthPrefixedFraming.encode(response));
                }
            });
        });
        
        return new Promise((resolve) => {
            this.server.listen(this.port, resolve);
        });
    }
}

// Client
class FramedClient {
    constructor(host, port) {
        this.host = host;
        this.port = port;
        this.socket = null;
        this.buffer = Buffer.alloc(0);
    }
    
    connect() {
        return new Promise((resolve, reject) => {
            this.socket = require('net').connect({
                host: this.host,
                port: this.port
            });
            
            this.socket.on('connect', () => {
                this.setupHandlers();
                resolve();
            });
            
            this.socket.on('error', reject);
        });
    }
    
    setupHandlers() {
        this.socket.on('data', (chunk) => {
            this.buffer = Buffer.concat([this.buffer, chunk]);
            
            const { messages, remaining } = LengthPrefixedFraming.decode(this.buffer);
            this.buffer = remaining;
            
            for (const message of messages) {
                this.emit('message', message);
            }
        });
    }
    
    send(message) {
        this.socket.write(LengthPrefixedFraming.encode(message));
    }
}
```

### **Delimiter-Based Framing**

```javascript
class DelimiterFraming {
    constructor(delimiter = '\n') {
        this.delimiter = delimiter;
        this.buffer = '';
    }
    
    feed(data) {
        this.buffer += data.toString();
        
        const messages = [];
        const parts = this.buffer.split(this.delimiter);
        
        // Keep incomplete message
        this.buffer = parts.pop();
        
        return parts;
    }
    
    encode(message) {
        return message + this.delimiter;
    }
}
```

### **Fixed-Length Framing**

```javascript
class FixedLengthFraming {
    constructor(messageSize) {
        this.messageSize = messageSize;
        this.buffer = Buffer.alloc(0);
    }
    
    feed(chunk) {
        this.buffer = Buffer.concat([this.buffer, chunk]);
        
        const messages = [];
        
        while (this.buffer.length >= this.messageSize) {
            const message = this.buffer.slice(0, this.messageSize);
            messages.push(message);
            this.buffer = this.buffer.slice(this.messageSize);
        }
        
        return messages;
    }
    
    encode(message) {
        const buffer = Buffer.alloc(this.messageSize);
        const data = Buffer.from(message);
        
        data.copy(buffer, 0, 0, Math.min(data.length, this.messageSize));
        
        return buffer;
    }
}
```

---

## **🤝 Protocol Negotiation**

### **Version Negotiation**

```javascript
class ProtocolNegotiationServer {
    constructor(port) {
        this.port = port;
        this.supportedVersions = ['1.0', '1.1', '2.0'];
        this.server = null;
    }
    
    start() {
        this.server = require('net').createServer((socket) => {
            let negotiated = false;
            let protocolVersion = null;
            
            socket.on('data', (data) => {
                if (!negotiated) {
                    const clientVersion = data.toString().trim();
                    
                    if (this.supportedVersions.includes(clientVersion)) {
                        protocolVersion = clientVersion;
                        socket.write(`OK ${clientVersion}\n`);
                        negotiated = true;
                        console.log(`✅ Negotiated protocol: ${clientVersion}`);
                    } else {
                        socket.write(`ERROR Unsupported version. Supported: ${this.supportedVersions.join(', ')}\n`);
                        socket.end();
                    }
                } else {
                    // Handle normal protocol messages
                    this.handleMessage(socket, data, protocolVersion);
                }
            });
        });
        
        return new Promise((resolve) => {
            this.server.listen(this.port, resolve);
        });
    }
    
    handleMessage(socket, data, version) {
        const message = data.toString().trim();
        console.log(`[v${version}] Received:`, message);
        
        // Version-specific handling
        if (version === '2.0') {
            socket.write(JSON.stringify({ version, echo: message }) + '\n');
        } else {
            socket.write(`${message}\n`);
        }
    }
}

// Client
class ProtocolNegotiationClient {
    constructor(host, port, preferredVersion) {
        this.host = host;
        this.port = port;
        this.preferredVersion = preferredVersion;
        this.socket = null;
        this.negotiated = false;
        this.protocolVersion = null;
    }
    
    connect() {
        return new Promise((resolve, reject) => {
            this.socket = require('net').connect({
                host: this.host,
                port: this.port
            });
            
            this.socket.on('connect', () => {
                // Send preferred version
                this.socket.write(this.preferredVersion + '\n');
                
                this.socket.once('data', (data) => {
                    const response = data.toString().trim();
                    
                    if (response.startsWith('OK')) {
                        this.protocolVersion = response.split(' ')[1];
                        this.negotiated = true;
                        console.log(`✅ Using protocol: ${this.protocolVersion}`);
                        resolve();
                    } else {
                        reject(new Error(response));
                    }
                });
            });
            
            this.socket.on('error', reject);
        });
    }
    
    send(message) {
        if (!this.negotiated) {
            throw new Error('Protocol not negotiated');
        }
        
        this.socket.write(message + '\n');
    }
}

// Uso
const server = new ProtocolNegotiationServer(3000);
await server.start();

const client1 = new ProtocolNegotiationClient('localhost', 3000, '2.0');
await client1.connect();
client1.send('Hello v2.0');

const client2 = new ProtocolNegotiationClient('localhost', 3000, '1.0');
await client2.connect();
client2.send('Hello v1.0');
```

---

## **🔐 Authentication**

**Verifica identità prima di permettere operazioni**

**Pattern comuni:**

**1. Challenge-Response** (sicuro)
```
Client → Server: "Voglio autenticarmi come 'user123'"
Server → Client: Challenge (random nonce)
Client → Server: Hash(password + nonce)
Server: Verifica hash → Autentica

Pro: Password mai inviata in chiaro
Contro: Più complesso
```

**2. Token-Based** (moderno)
```
Client → Server: Username + Password
Server → Client: JWT token
Client → Server: Token in ogni richiesta
Server: Valida token

Pro: Stateless, scalabile
Contro: Revocation difficile
```

**3. Certificate-Based** (enterprise)
```
Client: Presenta certificato X.509
Server: Valida con CA
Mutual TLS

Pro: Sicurezza massima
Contro: Setup complesso
```

**Quando usare:**
- Challenge-Response: Custom protocols
- Token: APIs, microservices
- Certificate: Enterprise, banking

### **Challenge-Response Authentication**

```javascript
const crypto = require('crypto');

class AuthenticatedServer {
    constructor(port) {
        this.port = port;
        this.users = new Map([
            ['user1', { password: 'pass1', salt: 'salt1' }],
            ['user2', { password: 'pass2', salt: 'salt2' }]
        ]);
        this.server = null;
    }
    
    generateChallenge() {
        return crypto.randomBytes(16).toString('hex');
    }
    
    verifyResponse(username, challenge, response) {
        const user = this.users.get(username);
        if (!user) {
            return false;
        }
        
        const expected = crypto
            .createHash('sha256')
            .update(challenge + user.password + user.salt)
            .digest('hex');
        
        return expected === response;
    }
    
    start() {
        this.server = require('net').createServer((socket) => {
            let authenticated = false;
            let challenge = null;
            let username = null;
            
            socket.on('data', (data) => {
                const message = data.toString().trim();
                
                if (!authenticated) {
                    if (!challenge) {
                        // Expect username
                        username = message;
                        challenge = this.generateChallenge();
                        socket.write(`CHALLENGE ${challenge}\n`);
                    } else {
                        // Verify response
                        if (this.verifyResponse(username, challenge, message)) {
                            authenticated = true;
                            socket.write('AUTH_OK\n');
                            console.log(`✅ User ${username} authenticated`);
                        } else {
                            socket.write('AUTH_FAILED\n');
                            socket.end();
                        }
                    }
                } else {
                    // Authenticated - handle commands
                    socket.write(`Echo: ${message}\n`);
                }
            });
        });
        
        return new Promise((resolve) => {
            this.server.listen(this.port, resolve);
        });
    }
}

// Client
class AuthenticatedClient {
    constructor(host, port, username, password, salt) {
        this.host = host;
        this.port = port;
        this.username = username;
        this.password = password;
        this.salt = salt;
        this.socket = null;
        this.authenticated = false;
    }
    
    connect() {
        return new Promise((resolve, reject) => {
            this.socket = require('net').connect({
                host: this.host,
                port: this.port
            });
            
            this.socket.on('connect', () => {
                // Send username
                this.socket.write(this.username + '\n');
                
                this.socket.once('data', (data) => {
                    const message = data.toString().trim();
                    
                    if (message.startsWith('CHALLENGE')) {
                        const challenge = message.split(' ')[1];
                        
                        // Calculate response
                        const response = crypto
                            .createHash('sha256')
                            .update(challenge + this.password + this.salt)
                            .digest('hex');
                        
                        this.socket.write(response + '\n');
                        
                        this.socket.once('data', (data) => {
                            const authResult = data.toString().trim();
                            
                            if (authResult === 'AUTH_OK') {
                                this.authenticated = true;
                                this.setupHandlers();
                                resolve();
                            } else {
                                reject(new Error('Authentication failed'));
                            }
                        });
                    }
                });
            });
            
            this.socket.on('error', reject);
        });
    }
    
    setupHandlers() {
        this.socket.on('data', (data) => {
            console.log('Received:', data.toString().trim());
        });
    }
    
    send(message) {
        if (!this.authenticated) {
            throw new Error('Not authenticated');
        }
        
        this.socket.write(message + '\n');
    }
}

// Uso
const server = new AuthenticatedServer(3000);
await server.start();

const client = new AuthenticatedClient('localhost', 3000, 'user1', 'pass1', 'salt1');
await client.connect();
console.log('✅ Authenticated!');

client.send('Hello secure server!');
```

---

## **🎯 Command Dispatcher**

**Routing comandi a handler specifici**

**Pattern:**
```
Messaggio in arrivo
     ↓
Parse comando
     ↓
Dispatcher
     ├── 'getUser' → getUserHandler()
     ├── 'savePost' → savePostHandler()
     ├── 'deleteComment' → deleteCommentHandler()
     └── unknown → errorHandler()
```

**Vantaggi:**
- ✅ Organizzazione codice (handler separati)
- ✅ Facile aggiungere comandi
- ✅ Testability (test ogni handler isolato)
- ✅ Middleware per comando (auth, validation)

**Simile a:**
- Express.js: `app.get('/users', handler)`
- Command pattern (design pattern)
- Event dispatcher

**Quando usare:**
- ✅ Server con multiple operazioni (>5 comandi)
- ✅ Logica complessa per comando
- ✅ Team development (handler separati)

### **Command Pattern Implementation**

```javascript
class CommandDispatcher {
    constructor() {
        this.commands = new Map();
    }
    
    register(name, command) {
        this.commands.set(name, command);
    }
    
    async dispatch(name, args, context) {
        const command = this.commands.get(name);
        
        if (!command) {
            throw new Error(`Unknown command: ${name}`);
        }
        
        // Validate
        if (command.validate) {
            const validation = command.validate(args);
            if (!validation.valid) {
                throw new Error(`Validation failed: ${validation.error}`);
            }
        }
        
        // Check permissions
        if (command.permissions && context.user) {
            const hasPermission = command.permissions.some(p => 
                context.user.permissions.includes(p)
            );
            
            if (!hasPermission) {
                throw new Error('Permission denied');
            }
        }
        
        // Execute
        return await command.execute(args, context);
    }
    
    getHelp(commandName = null) {
        if (commandName) {
            const command = this.commands.get(commandName);
            return command ? command.help : null;
        }
        
        return Array.from(this.commands.entries()).map(([name, cmd]) => ({
            name,
            description: cmd.help
        }));
    }
}

// Commands
const echoCommand = {
    help: 'Echo back the message',
    validate: (args) => {
        if (!args.message) {
            return { valid: false, error: 'message is required' };
        }
        return { valid: true };
    },
    execute: async (args) => {
        return { echo: args.message };
    }
};

const getUserCommand = {
    help: 'Get user information',
    permissions: ['read:users'],
    validate: (args) => {
        if (!args.id) {
            return { valid: false, error: 'id is required' };
        }
        return { valid: true };
    },
    execute: async (args, context) => {
        // Simula database query
        return {
            id: args.id,
            name: 'John Doe',
            requestedBy: context.user.username
        };
    }
};

// Server con dispatcher
class CommandServer {
    constructor(port) {
        this.port = port;
        this.dispatcher = new CommandDispatcher();
        this.server = null;
        
        this.setupCommands();
    }
    
    setupCommands() {
        this.dispatcher.register('echo', echoCommand);
        this.dispatcher.register('getUser', getUserCommand);
        this.dispatcher.register('help', {
            help: 'Show available commands',
            execute: async (args) => {
                return this.dispatcher.getHelp(args.command);
            }
        });
    }
    
    start() {
        this.server = require('net').createServer((socket) => {
            const context = {
                user: {
                    username: 'admin',
                    permissions: ['read:users', 'write:users']
                }
            };
            
            let buffer = '';
            
            socket.on('data', async (chunk) => {
                buffer += chunk.toString();
                
                const lines = buffer.split('\n');
                buffer = lines.pop();
                
                for (const line of lines) {
                    if (line.trim()) {
                        try {
                            const request = JSON.parse(line);
                            const result = await this.dispatcher.dispatch(
                                request.command,
                                request.args || {},
                                context
                            );
                            
                            socket.write(JSON.stringify({
                                success: true,
                                data: result
                            }) + '\n');
                        } catch (err) {
                            socket.write(JSON.stringify({
                                success: false,
                                error: err.message
                            }) + '\n');
                        }
                    }
                }
            });
        });
        
        return new Promise((resolve) => {
            this.server.listen(this.port, resolve);
        });
    }
}

// Uso
const server = new CommandServer(3000);
await server.start();

// Client può inviare:
// {"command":"echo","args":{"message":"Hello"}}
// {"command":"getUser","args":{"id":123}}
// {"command":"help"}
```

---

## **📞 RPC Pattern**

**Chiamare funzioni remote come se fossero locali**

**L'idea:**
```javascript
// Sembra chiamata locale:
const result = await rpcClient.call('add', 5, 3);

// Ma esegue sul server remoto:
Server riceve: {method: 'add', params: [5, 3], id: 1}
Server esegue: add(5, 3) = 8
Server risponde: {result: 8, id: 1}
Client riceve: 8
```

**Vantaggi:**
- ✅ Astrazione totale della rete
- ✅ Codice client leggibile (no serializzazione manuale)
- ✅ Supporto Promise/async-await
- ✅ Type safety (con TypeScript)

**Svantaggi:**
- ❌ Nasconde latenza di rete (falsa località)
- ❌ Timeout/errori rete diventano eccezioni
- ❌ Debug difficile (stack trace attraversa rete)

**Quando usare:**
- ✅ Microservices communication
- ✅ Client-Server con API complesse
- ✅ Quando si vuole nascondere dettagli di rete

**Alternative:**
- gRPC (Google, production-ready)
- JSON-RPC (standard)
- MessagePack-RPC (binario)

### **Simple RPC Implementation**

```javascript
class RPCServer {
    constructor(port) {
        this.port = port;
        this.procedures = new Map();
        this.server = null;
    }
    
    register(name, fn) {
        this.procedures.set(name, fn);
    }
    
    async call(name, ...args) {
        const proc = this.procedures.get(name);
        
        if (!proc) {
            throw new Error(`Procedure not found: ${name}`);
        }
        
        return await proc(...args);
    }
    
    start() {
        this.server = require('net').createServer((socket) => {
            let buffer = '';
            
            socket.on('data', async (chunk) => {
                buffer += chunk.toString();
                
                const lines = buffer.split('\n');
                buffer = lines.pop();
                
                for (const line of lines) {
                    if (line.trim()) {
                        try {
                            const { id, procedure, args } = JSON.parse(line);
                            const result = await this.call(procedure, ...args);
                            
                            socket.write(JSON.stringify({
                                id,
                                result
                            }) + '\n');
                        } catch (err) {
                            socket.write(JSON.stringify({
                                id: null,
                                error: err.message
                            }) + '\n');
                        }
                    }
                }
            });
        });
        
        return new Promise((resolve) => {
            this.server.listen(this.port, resolve);
        });
    }
}

class RPCClient {
    constructor(host, port) {
        this.host = host;
        this.port = port;
        this.socket = null;
        this.callId = 0;
        this.pendingCalls = new Map();
        this.buffer = '';
    }
    
    connect() {
        return new Promise((resolve, reject) => {
            this.socket = require('net').connect({
                host: this.host,
                port: this.port
            });
            
            this.socket.on('connect', () => {
                this.setupHandlers();
                resolve();
            });
            
            this.socket.on('error', reject);
        });
    }
    
    setupHandlers() {
        this.socket.on('data', (chunk) => {
            this.buffer += chunk.toString();
            
            const lines = this.buffer.split('\n');
            this.buffer = lines.pop();
            
            for (const line of lines) {
                if (line.trim()) {
                    const response = JSON.parse(line);
                    const pending = this.pendingCalls.get(response.id);
                    
                    if (pending) {
                        this.pendingCalls.delete(response.id);
                        
                        if (response.error) {
                            pending.reject(new Error(response.error));
                        } else {
                            pending.resolve(response.result);
                        }
                    }
                }
            }
        });
    }
    
    call(procedure, ...args) {
        return new Promise((resolve, reject) => {
            const id = ++this.callId;
            
            this.pendingCalls.set(id, { resolve, reject });
            
            this.socket.write(JSON.stringify({
                id,
                procedure,
                args
            }) + '\n');
        });
    }
}

// Uso
const rpcServer = new RPCServer(3000);

rpcServer.register('add', (a, b) => a + b);
rpcServer.register('multiply', (a, b) => a * b);
rpcServer.register('fibonacci', (n) => {
    if (n <= 1) return n;
    let a = 0, b = 1;
    for (let i = 2; i <= n; i++) {
        [a, b] = [b, a + b];
    }
    return b;
});

await rpcServer.start();

const rpcClient = new RPCClient('localhost', 3000);
await rpcClient.connect();

const sum = await rpcClient.call('add', 5, 3);
console.log('5 + 3 =', sum);

const product = await rpcClient.call('multiply', 4, 7);
console.log('4 * 7 =', product);

const fib = await rpcClient.call('fibonacci', 10);
console.log('fibonacci(10) =', fib);
```

---

## **📡 Pub/Sub Pattern**

**Broadcasting eventi a subscriber interessati**

**Pattern:**
```
Server (Broker)
   ├── Topic 'news'
   │     ├── Client A (subscribed)
   │     └── Client B (subscribed)
   ├── Topic 'sports'
   │     └── Client C (subscribed)
   └── Topic 'weather'
         ├── Client A (subscribed)
         └── Client D (subscribed)

Publisher invia a 'news'
  → Ricevono: Client A, Client B
```

**Vantaggi:**
- ✅ Disaccoppiamento (publisher non conosce subscriber)
- ✅ Scalabilità (N subscriber senza modificare publisher)
- ✅ Filtering (subscribe solo a topic interessanti)
- ✅ Broadcasting efficiente

**Use cases:**
- ✅ Real-time notifications (chat, feed)
- ✅ Event streaming (logs, metrics)
- ✅ Multi-user applications (game state)
- ✅ IoT (sensor data distribution)

**Confronto con alternatives:**
- **Redis Pub/Sub**: Production-ready, clustering
- **MQTT**: IoT standard, QoS levels
- **Kafka**: Stream processing, persistence
- **WebSocket**: Browser-compatible

**Questo esempio: TCP custom** (educational)

### **Publish/Subscribe Implementation**

```javascript
class PubSubServer {
    constructor(port) {
        this.port = port;
        this.subscriptions = new Map(); // topic -> Set<socket>
        this.server = null;
    }
    
    subscribe(topic, socket) {
        if (!this.subscriptions.has(topic)) {
            this.subscriptions.set(topic, new Set());
        }
        
        this.subscriptions.get(topic).add(socket);
        console.log(`📥 Subscription: ${topic}`);
    }
    
    unsubscribe(topic, socket) {
        if (this.subscriptions.has(topic)) {
            this.subscriptions.get(topic).delete(socket);
            
            if (this.subscriptions.get(topic).size === 0) {
                this.subscriptions.delete(topic);
            }
        }
    }
    
    publish(topic, message) {
        if (this.subscriptions.has(topic)) {
            const subscribers = this.subscriptions.get(topic);
            const data = JSON.stringify({
                type: 'message',
                topic,
                message
            }) + '\n';
            
            for (const socket of subscribers) {
                if (!socket.destroyed) {
                    socket.write(data);
                }
            }
            
            console.log(`📤 Published to ${topic}: ${subscribers.size} subscribers`);
        }
    }
    
    start() {
        this.server = require('net').createServer((socket) => {
            let buffer = '';
            
            socket.on('data', (chunk) => {
                buffer += chunk.toString();
                
                const lines = buffer.split('\n');
                buffer = lines.pop();
                
                for (const line of lines) {
                    if (line.trim()) {
                        try {
                            const msg = JSON.parse(line);
                            
                            switch (msg.type) {
                                case 'subscribe':
                                    this.subscribe(msg.topic, socket);
                                    socket.write(JSON.stringify({
                                        type: 'subscribed',
                                        topic: msg.topic
                                    }) + '\n');
                                    break;
                                
                                case 'unsubscribe':
                                    this.unsubscribe(msg.topic, socket);
                                    socket.write(JSON.stringify({
                                        type: 'unsubscribed',
                                        topic: msg.topic
                                    }) + '\n');
                                    break;
                                
                                case 'publish':
                                    this.publish(msg.topic, msg.message);
                                    socket.write(JSON.stringify({
                                        type: 'published',
                                        topic: msg.topic
                                    }) + '\n');
                                    break;
                            }
                        } catch (err) {
                            console.error('Parse error:', err.message);
                        }
                    }
                }
            });
            
            socket.on('close', () => {
                // Cleanup subscriptions
                for (const [topic, sockets] of this.subscriptions) {
                    sockets.delete(socket);
                    if (sockets.size === 0) {
                        this.subscriptions.delete(topic);
                    }
                }
            });
        });
        
        return new Promise((resolve) => {
            this.server.listen(this.port, resolve);
        });
    }
}

class PubSubClient {
    constructor(host, port) {
        this.host = host;
        this.port = port;
        this.socket = null;
        this.handlers = new Map();
        this.buffer = '';
    }
    
    connect() {
        return new Promise((resolve, reject) => {
            this.socket = require('net').connect({
                host: this.host,
                port: this.port
            });
            
            this.socket.on('connect', () => {
                this.setupHandlers();
                resolve();
            });
            
            this.socket.on('error', reject);
        });
    }
    
    setupHandlers() {
        this.socket.on('data', (chunk) => {
            this.buffer += chunk.toString();
            
            const lines = this.buffer.split('\n');
            this.buffer = lines.pop();
            
            for (const line of lines) {
                if (line.trim()) {
                    const msg = JSON.parse(line);
                    
                    if (msg.type === 'message') {
                        const handler = this.handlers.get(msg.topic);
                        if (handler) {
                            handler(msg.message);
                        }
                    }
                }
            }
        });
    }
    
    subscribe(topic, handler) {
        this.handlers.set(topic, handler);
        
        this.socket.write(JSON.stringify({
            type: 'subscribe',
            topic
        }) + '\n');
    }
    
    unsubscribe(topic) {
        this.handlers.delete(topic);
        
        this.socket.write(JSON.stringify({
            type: 'unsubscribe',
            topic
        }) + '\n');
    }
    
    publish(topic, message) {
        this.socket.write(JSON.stringify({
            type: 'publish',
            topic,
            message
        }) + '\n');
    }
}

// Uso
const pubsubServer = new PubSubServer(3000);
await pubsubServer.start();

// Subscriber 1
const subscriber1 = new PubSubClient('localhost', 3000);
await subscriber1.connect();

subscriber1.subscribe('news', (message) => {
    console.log('[Sub1] News:', message);
});

// Subscriber 2
const subscriber2 = new PubSubClient('localhost', 3000);
await subscriber2.connect();

subscriber2.subscribe('news', (message) => {
    console.log('[Sub2] News:', message);
});

subscriber2.subscribe('alerts', (message) => {
    console.log('[Sub2] Alert:', message);
});

// Publisher
const publisher = new PubSubClient('localhost', 3000);
await publisher.connect();

setTimeout(() => {
    publisher.publish('news', { title: 'Breaking News!' });
    publisher.publish('alerts', { level: 'warning', text: 'System maintenance' });
}, 1000);
```

---

## **🎓 Riepilogo**

**Pattern di Interazione:**
- Request-Response con ID tracking
- Message framing (length-prefixed, delimiter, fixed-length)
- Protocol negotiation per versioning
- Authentication con challenge-response
- Command dispatcher per routing
- RPC per chiamate remote
- Pub/Sub per messaging asincrono

**Best Practices:**
- ✅ Usare framing per delimitare messaggi
- ✅ Implementare timeout su richieste
- ✅ Validare input prima di elaborare
- ✅ Negoziare protocollo per compatibilità
- ✅ Autenticare client prima di operazioni
- ✅ Error handling robusto
- ✅ Logging per debugging

---

**Prossima Guida**: [06-Gestione_Connessioni.md](./06-Gestione_Connessioni.md) - Connection management avanzato
