/**
 * 06.02 - Session Management
 * 
 * Sistema di gestione sessioni per client TCP.
 * Dimostra autenticazione, timeout sessione, e gestione stato.
 * 
 * Features:
 *   - Autenticazione utente
 *   - Session ID unici
 *   - Timeout automatico
 *   - Gestione stato per sessione
 *   - Comandi autorizzati
 */

const net = require('net');
const crypto = require('crypto');

// Gestione sessioni
class SessionManager {
    constructor(config = {}) {
        this.config = {
            sessionTimeout: 300000, // 5 minuti
            cleanupInterval: 60000,  // 1 minuto
            ...config
        };
        
        this.sessions = new Map();
        this.users = new Map([
            ['admin', { password: 'admin123', role: 'admin' }],
            ['user1', { password: 'pass1', role: 'user' }],
            ['user2', { password: 'pass2', role: 'user' }]
        ]);
        
        this.startCleanup();
    }
    
    createSession(username, role) {
        const sessionId = crypto.randomBytes(16).toString('hex');
        
        const session = {
            id: sessionId,
            username: username,
            role: role,
            createdAt: Date.now(),
            lastActivity: Date.now(),
            data: {}
        };
        
        this.sessions.set(sessionId, session);
        
        console.log(`✅ Sessione creata: ${sessionId} (user: ${username}, role: ${role})`);
        
        return session;
    }
    
    getSession(sessionId) {
        const session = this.sessions.get(sessionId);
        
        if (!session) {
            return null;
        }
        
        // Verifica timeout
        if (Date.now() - session.lastActivity > this.config.sessionTimeout) {
            console.log(`⏰ Sessione ${sessionId} scaduta`);
            this.destroySession(sessionId);
            return null;
        }
        
        // Aggiorna attività
        session.lastActivity = Date.now();
        
        return session;
    }
    
    destroySession(sessionId) {
        const session = this.sessions.get(sessionId);
        
        if (session) {
            console.log(`🗑️  Sessione distrutta: ${sessionId} (user: ${session.username})`);
            this.sessions.delete(sessionId);
        }
    }
    
    authenticate(username, password) {
        const user = this.users.get(username);
        
        if (!user || user.password !== password) {
            return null;
        }
        
        return this.createSession(username, user.role);
    }
    
    startCleanup() {
        setInterval(() => {
            const now = Date.now();
            let cleaned = 0;
            
            for (const [id, session] of this.sessions) {
                if (now - session.lastActivity > this.config.sessionTimeout) {
                    this.destroySession(id);
                    cleaned++;
                }
            }
            
            if (cleaned > 0) {
                console.log(`🧹 Pulizia: ${cleaned} sessioni scadute rimosse`);
            }
        }, this.config.cleanupInterval);
    }
    
    getStats() {
        return {
            activeSessions: this.sessions.size,
            registeredUsers: this.users.size
        };
    }
}

// Server con sessioni
class SessionServer {
    constructor(port = 3300) {
        this.port = port;
        this.server = null;
        this.sessionManager = new SessionManager();
        this.connections = new Map();
    }
    
    start() {
        this.server = net.createServer((socket) => {
            const connId = crypto.randomBytes(4).toString('hex');
            
            const connection = {
                id: connId,
                socket: socket,
                session: null,
                buffer: ''
            };
            
            this.connections.set(connId, connection);
            
            console.log(`\n📥 [${connId}] Client connesso: ${socket.remoteAddress}:${socket.remotePort}`);
            
            // Benvenuto
            socket.write('='.repeat(60) + '\n');
            socket.write('SESSION MANAGEMENT SERVER\n');
            socket.write('='.repeat(60) + '\n');
            socket.write('Commands:\n');
            socket.write('  login <username> <password>\n');
            socket.write('  logout\n');
            socket.write('  whoami\n');
            socket.write('  set <key> <value>  - Store session data\n');
            socket.write('  get <key>          - Retrieve session data\n');
            socket.write('  stats              - Server stats (admin only)\n');
            socket.write('  quit\n');
            socket.write('='.repeat(60) + '\n\n');
            
            socket.on('data', (data) => {
                connection.buffer += data.toString();
                
                let newlineIdx;
                while ((newlineIdx = connection.buffer.indexOf('\n')) !== -1) {
                    const line = connection.buffer.substring(0, newlineIdx).trim();
                    connection.buffer = connection.buffer.substring(newlineIdx + 1);
                    
                    this.handleCommand(connection, line);
                }
            });
            
            socket.on('close', () => {
                console.log(`👋 [${connId}] Client disconnesso`);
                
                if (connection.session) {
                    this.sessionManager.destroySession(connection.session.id);
                }
                
                this.connections.delete(connId);
            });
            
            socket.on('error', (err) => {
                console.error(`❌ [${connId}] Errore:`, err.message);
            });
        });
        
        this.server.listen(this.port, () => {
            console.log('='.repeat(60));
            console.log(`✅ Session Server avviato su porta ${this.port}`);
            console.log('='.repeat(60));
            console.log('Test users:');
            console.log('  admin / admin123 (role: admin)');
            console.log('  user1 / pass1 (role: user)');
            console.log('  user2 / pass2 (role: user)');
            console.log('='.repeat(60) + '\n');
        });
    }
    
    handleCommand(connection, line) {
        const [command, ...args] = line.split(' ');
        const { socket, session } = connection;
        
        console.log(`📨 [${connection.id}] Command: ${command}${session ? ` (user: ${session.username})` : ''}`);
        
        switch (command.toLowerCase()) {
            case 'login':
                if (session) {
                    socket.write('❌ Already logged in\n\n');
                    return;
                }
                
                const [username, password] = args;
                
                if (!username || !password) {
                    socket.write('❌ Usage: login <username> <password>\n\n');
                    return;
                }
                
                const newSession = this.sessionManager.authenticate(username, password);
                
                if (!newSession) {
                    socket.write('❌ Invalid credentials\n\n');
                    return;
                }
                
                connection.session = newSession;
                socket.write(`✅ Welcome ${username}!\n`);
                socket.write(`Session ID: ${newSession.id}\n`);
                socket.write(`Role: ${newSession.role}\n\n`);
                break;
            
            case 'logout':
                if (!session) {
                    socket.write('❌ Not logged in\n\n');
                    return;
                }
                
                this.sessionManager.destroySession(session.id);
                connection.session = null;
                socket.write('✅ Logged out\n\n');
                break;
            
            case 'whoami':
                if (!session) {
                    socket.write('❌ Not logged in\n\n');
                    return;
                }
                
                const age = ((Date.now() - session.createdAt) / 1000).toFixed(0);
                const idle = ((Date.now() - session.lastActivity) / 1000).toFixed(0);
                
                socket.write(`Username: ${session.username}\n`);
                socket.write(`Role: ${session.role}\n`);
                socket.write(`Session age: ${age}s\n`);
                socket.write(`Idle: ${idle}s\n\n`);
                break;
            
            case 'set':
                if (!session) {
                    socket.write('❌ Not logged in\n\n');
                    return;
                }
                
                const [key, ...valueParts] = args;
                const value = valueParts.join(' ');
                
                if (!key || !value) {
                    socket.write('❌ Usage: set <key> <value>\n\n');
                    return;
                }
                
                session.data[key] = value;
                socket.write(`✅ Set ${key} = ${value}\n\n`);
                break;
            
            case 'get':
                if (!session) {
                    socket.write('❌ Not logged in\n\n');
                    return;
                }
                
                const getKey = args[0];
                
                if (!getKey) {
                    // Mostra tutto
                    socket.write('Session data:\n');
                    for (const [k, v] of Object.entries(session.data)) {
                        socket.write(`  ${k} = ${v}\n`);
                    }
                    socket.write('\n');
                } else {
                    const val = session.data[getKey];
                    if (val !== undefined) {
                        socket.write(`${getKey} = ${val}\n\n`);
                    } else {
                        socket.write(`❌ Key not found: ${getKey}\n\n`);
                    }
                }
                break;
            
            case 'stats':
                if (!session) {
                    socket.write('❌ Not logged in\n\n');
                    return;
                }
                
                if (session.role !== 'admin') {
                    socket.write('❌ Access denied (admin only)\n\n');
                    return;
                }
                
                const stats = this.sessionManager.getStats();
                socket.write('='.repeat(40) + '\n');
                socket.write('SERVER STATISTICS\n');
                socket.write('='.repeat(40) + '\n');
                socket.write(`Active sessions: ${stats.activeSessions}\n`);
                socket.write(`Registered users: ${stats.registeredUsers}\n`);
                socket.write(`Connected clients: ${this.connections.size}\n`);
                socket.write('='.repeat(40) + '\n\n');
                break;
            
            case 'quit':
                socket.write('Goodbye!\n');
                socket.end();
                break;
            
            default:
                socket.write(`❌ Unknown command: ${command}\n\n`);
        }
    }
    
    stop() {
        if (this.server) {
            this.server.close(() => {
                console.log('✅ Server chiuso');
            });
        }
    }
}

// Avvia server
if (require.main === module) {
    const server = new SessionServer(3300);
    server.start();
    
    // Report periodico
    setInterval(() => {
        const stats = server.sessionManager.getStats();
        console.log(`\n📊 Stats: ${stats.activeSessions} sessioni, ${server.connections.size} connessioni`);
    }, 30000);
    
    process.on('SIGINT', () => {
        console.log('\n\n🛑 Shutdown...');
        server.stop();
        process.exit(0);
    });
}
