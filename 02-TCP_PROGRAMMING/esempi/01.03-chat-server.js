/**
 * 01.03 - Simple Chat Server
 * 
 * Server TCP chat che permette a più client di comunicare tra loro.
 * Dimostra la gestione di connessioni multiple e il broadcast di messaggi.
 * 
 * Utilizzo:
 *   node 01.03-chat-server.js
 * 
 * Test con netcat (apri più terminali):
 *   nc localhost 3002
 */

const net = require('net');

// Configurazione
const PORT = 3002;
const HOST = '0.0.0.0';

// Gestione client
let clientId = 0;
const clients = new Map();

// Funzione per broadcast messaggi
function broadcast(message, excludeId = null) {
    for (const [id, client] of clients) {
        if (id !== excludeId && !client.socket.destroyed) {
            client.socket.write(message);
        }
    }
}

// Funzione per inviare lista utenti
function sendUserList(socket) {
    socket.write('\n👥 Utenti connessi:\n');
    for (const [id, client] of clients) {
        socket.write(`  [${id}] ${client.username}\n`);
    }
    socket.write('\n');
}

// Crea il server
const server = net.createServer((socket) => {
    const id = ++clientId;
    let username = null;
    
    console.log(`📥 Nuova connessione [${id}] da:`, 
        `${socket.remoteAddress}:${socket.remotePort}`);
    
    // Welcome message
    socket.write('='.repeat(60) + '\n');
    socket.write('💬  CHAT SERVER\n');
    socket.write('='.repeat(60) + '\n\n');
    socket.write('Inserisci il tuo username: ');
    
    // Gestione dati
    socket.on('data', (data) => {
        const message = data.toString().trim();
        
        // Se username non ancora impostato
        if (!username) {
            if (message.length < 3) {
                socket.write('❌ Username troppo corto (min 3 caratteri)\n');
                socket.write('Inserisci il tuo username: ');
                return;
            }
            
            // Controlla se username già in uso
            const usernameTaken = Array.from(clients.values())
                .some(c => c.username === message);
            
            if (usernameTaken) {
                socket.write('❌ Username già in uso\n');
                socket.write('Inserisci il tuo username: ');
                return;
            }
            
            username = message;
            
            // Registra il client
            clients.set(id, {
                socket: socket,
                username: username,
                connectedAt: Date.now()
            });
            
            console.log(`✅ [${id}] Username impostato: ${username}`);
            console.log(`📊 Utenti online: ${clients.size}`);
            
            // Benvenuto
            socket.write(`\n✅ Benvenuto ${username}!\n`);
            socket.write('📖 Comandi: /help /users /quit\n\n');
            
            // Notifica agli altri
            broadcast(`📢 ${username} è entrato in chat\n`, id);
            
            return;
        }
        
        // Gestione comandi
        if (message.startsWith('/')) {
            const command = message.toLowerCase().split(' ')[0];
            
            switch (command) {
                case '/help':
                    socket.write('\n📖 Comandi disponibili:\n');
                    socket.write('  /help   - Mostra questo messaggio\n');
                    socket.write('  /users  - Lista utenti connessi\n');
                    socket.write('  /quit   - Esci dalla chat\n\n');
                    break;
                    
                case '/users':
                    sendUserList(socket);
                    break;
                    
                case '/quit':
                case '/exit':
                    socket.write('\n👋 Arrivederci!\n');
                    socket.end();
                    break;
                    
                default:
                    socket.write(`❓ Comando sconosciuto: ${command}\n`);
                    socket.write('Digita /help per i comandi disponibili\n\n');
            }
            
            return;
        }
        
        // Messaggio normale - broadcast a tutti
        if (message.length > 0) {
            const timestamp = new Date().toLocaleTimeString('it-IT');
            const formattedMessage = `[${timestamp}] ${username}: ${message}\n`;
            
            console.log(`💬 [${id}] ${username}: ${message}`);
            
            // Invia a tutti gli altri client
            broadcast(formattedMessage, id);
            
            // Conferma al mittente
            socket.write(`✓ Inviato\n`);
        }
    });
    
    // Gestione chiusura
    socket.on('close', () => {
        if (username) {
            console.log(`👋 [${id}] ${username} disconnesso`);
            
            // Notifica agli altri
            broadcast(`📢 ${username} ha lasciato la chat\n`, id);
            
            // Rimuovi dalla lista
            clients.delete(id);
            
            console.log(`📊 Utenti online: ${clients.size}`);
        } else {
            console.log(`👋 [${id}] Connessione chiusa (no username)`);
        }
    });
    
    // Gestione errori
    socket.on('error', (err) => {
        console.error(`❌ [${id}] Errore:`, err.message);
    });
});

// Gestione errori server
server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`❌ Porta ${PORT} già in uso`);
    } else {
        console.error('❌ Errore server:', err.message);
    }
    process.exit(1);
});

// Avvio server
server.listen(PORT, HOST, () => {
    console.log(`✅ Chat Server avviato su ${HOST}:${PORT}`);
    console.log(`📝 Test con: nc localhost ${PORT}`);
    console.log('💬 Apri più terminali per chattare');
});

// Statistiche periodiche
setInterval(() => {
    if (clients.size > 0) {
        console.log(`\n📊 Statistiche:`);
        console.log(`  Utenti online: ${clients.size}`);
        for (const [id, client] of clients) {
            const duration = ((Date.now() - client.connectedAt) / 1000).toFixed(0);
            console.log(`  [${id}] ${client.username} (${duration}s)`);
        }
    }
}, 30000);

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\n🛑 Chiusura server...');
    
    // Notifica tutti i client
    broadcast('\n⚠️  Server in chiusura. Disconnessione...\n');
    
    // Chiudi tutte le connessioni
    for (const [id, client] of clients) {
        client.socket.end();
    }
    
    server.close(() => {
        console.log('✅ Server chiuso');
        process.exit(0);
    });
});
