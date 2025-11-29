/**
 * 02.02 - HTTP Client from Scratch
 * 
 * Client TCP che effettua una richiesta HTTP manuale senza librerie.
 * Dimostra come costruire e inviare una richiesta HTTP raw su socket TCP.
 * 
 * Utilizzo:
 *   node 02.02-http-client.js
 * 
 * Esempio di richiesta HTTP:
 *   GET / HTTP/1.1
 *   Host: example.com
 *   Connection: close
 */

const net = require('net');

// Configurazione
const HOST = 'example.com';
const PORT = 80;
const PATH = '/';

console.log(`🌐 Richiesta HTTP a http://${HOST}${PATH}\n`);

// Costruisci la richiesta HTTP
const httpRequest = [
    `GET ${PATH} HTTP/1.1`,
    `Host: ${HOST}`,
    `User-Agent: CustomTCPClient/1.0`,
    `Accept: text/html`,
    `Connection: close`,
    '',
    ''
].join('\r\n');

console.log('📤 Richiesta HTTP:');
console.log('─'.repeat(60));
console.log(httpRequest);
console.log('─'.repeat(60) + '\n');

// Connetti al server
const client = net.connect({ host: HOST, port: PORT });

let responseData = '';
let headersParsed = false;
let statusCode = null;
let headers = {};
let body = '';

// Connessione stabilita
client.on('connect', () => {
    console.log('✅ Connesso a', `${HOST}:${PORT}\n`);
    
    // Invia la richiesta HTTP
    client.write(httpRequest);
});

// Dati ricevuti
client.on('data', (data) => {
    responseData += data.toString();
    
    // Parse della risposta
    if (!headersParsed && responseData.includes('\r\n\r\n')) {
        const parts = responseData.split('\r\n\r\n');
        const headerSection = parts[0];
        body = parts.slice(1).join('\r\n\r\n');
        
        // Parse status line
        const lines = headerSection.split('\r\n');
        const statusLine = lines[0];
        const statusMatch = statusLine.match(/HTTP\/\d\.\d (\d+) (.+)/);
        
        if (statusMatch) {
            statusCode = parseInt(statusMatch[1]);
            console.log('📥 Risposta HTTP:');
            console.log('─'.repeat(60));
            console.log(`Status: ${statusCode} ${statusMatch[2]}`);
        }
        
        // Parse headers
        console.log('\n📋 Headers:');
        for (let i = 1; i < lines.length; i++) {
            const [key, ...valueParts] = lines[i].split(': ');
            if (key && valueParts.length > 0) {
                const value = valueParts.join(': ');
                headers[key.toLowerCase()] = value;
                console.log(`  ${key}: ${value}`);
            }
        }
        
        console.log('─'.repeat(60) + '\n');
        headersParsed = true;
    } else if (headersParsed) {
        body += data.toString();
    }
});

// Connessione chiusa
client.on('close', () => {
    console.log('📄 Body (primi 500 caratteri):');
    console.log('─'.repeat(60));
    console.log(body.substring(0, 500));
    
    if (body.length > 500) {
        console.log(`\n... (${body.length - 500} caratteri rimanenti)`);
    }
    
    console.log('─'.repeat(60));
    
    console.log('\n📊 Statistiche:');
    console.log(`  Status Code: ${statusCode}`);
    console.log(`  Content-Length: ${headers['content-length'] || 'N/A'}`);
    console.log(`  Content-Type: ${headers['content-type'] || 'N/A'}`);
    console.log(`  Body Length: ${body.length} bytes`);
    
    console.log('\n✅ Connessione chiusa');
});

// Gestione errori
client.on('error', (err) => {
    console.error('❌ Errore:', err.message);
    
    if (err.code === 'ENOTFOUND') {
        console.error(`💡 Host "${HOST}" non trovato`);
    } else if (err.code === 'ECONNREFUSED') {
        console.error(`💡 Connessione rifiutata da ${HOST}:${PORT}`);
    }
    
    process.exit(1);
});

// Timeout dopo 10 secondi
client.setTimeout(10000);

client.on('timeout', () => {
    console.error('⏰ Timeout connessione');
    client.destroy();
    process.exit(1);
});
