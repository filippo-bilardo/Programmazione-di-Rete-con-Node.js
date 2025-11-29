/**
 * 06.03 - Rate Limiting and Throttling
 * 
 * Implementazione di rate limiting e throttling per proteggere il server.
 * Dimostra diverse strategie di controllo del traffico.
 * 
 * Strategie implementate:
 *   - Token Bucket
 *   - Sliding Window
 *   - Fixed Window
 */

const net = require('net');

// Token Bucket Rate Limiter
class TokenBucketLimiter {
    constructor(capacity, refillRate) {
        this.capacity = capacity;
        this.tokens = capacity;
        this.refillRate = refillRate; // tokens per secondo
        this.lastRefill = Date.now();
    }
    
    refill() {
        const now = Date.now();
        const elapsed = (now - this.lastRefill) / 1000;
        const tokensToAdd = elapsed * this.refillRate;
        
        this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
        this.lastRefill = now;
    }
    
    tryConsume(tokens = 1) {
        this.refill();
        
        if (this.tokens >= tokens) {
            this.tokens -= tokens;
            return true;
        }
        
        return false;
    }
    
    getAvailableTokens() {
        this.refill();
        return Math.floor(this.tokens);
    }
}

// Sliding Window Rate Limiter
class SlidingWindowLimiter {
    constructor(windowMs, maxRequests) {
        this.windowMs = windowMs;
        this.maxRequests = maxRequests;
        this.requests = [];
    }
    
    tryRequest() {
        const now = Date.now();
        const windowStart = now - this.windowMs;
        
        // Rimuovi richieste vecchie
        this.requests = this.requests.filter(time => time > windowStart);
        
        if (this.requests.length < this.maxRequests) {
            this.requests.push(now);
            return true;
        }
        
        return false;
    }
    
    getRequestCount() {
        const now = Date.now();
        const windowStart = now - this.windowMs;
        this.requests = this.requests.filter(time => time > windowStart);
        return this.requests.length;
    }
    
    getTimeUntilReset() {
        if (this.requests.length === 0) {
            return 0;
        }
        
        const oldestRequest = Math.min(...this.requests);
        const resetTime = oldestRequest + this.windowMs;
        return Math.max(0, resetTime - Date.now());
    }
}

// Rate Limiting Server
class RateLimitedServer {
    constructor(port = 3301) {
        this.port = port;
        this.server = null;
        
        // Rate limiters per IP
        this.ipLimiters = new Map();
        
        // Configurazione
        this.config = {
            // Global rate limit (token bucket)
            globalCapacity: 100,
            globalRefillRate: 10, // 10 req/s
            
            // Per-IP rate limit (sliding window)
            perIpWindow: 60000, // 1 minuto
            perIpMaxRequests: 30,
            
            // Cleanup
            cleanupInterval: 60000
        };
        
        this.globalLimiter = new TokenBucketLimiter(
            this.config.globalCapacity,
            this.config.globalRefillRate
        );
        
        this.stats = {
            totalRequests: 0,
            allowedRequests: 0,
            blockedRequests: 0,
            blockedIPs: new Set()
        };
        
        this.startCleanup();
    }
    
    getIPLimiter(ip) {
        if (!this.ipLimiters.has(ip)) {
            this.ipLimiters.set(ip, new SlidingWindowLimiter(
                this.config.perIpWindow,
                this.config.perIpMaxRequests
            ));
        }
        
        return this.ipLimiters.get(ip);
    }
    
    checkRateLimit(ip) {
        // Global limit
        if (!this.globalLimiter.tryConsume()) {
            return {
                allowed: false,
                reason: 'global',
                retryAfter: 1000
            };
        }
        
        // Per-IP limit
        const ipLimiter = this.getIPLimiter(ip);
        
        if (!ipLimiter.tryRequest()) {
            return {
                allowed: false,
                reason: 'per-ip',
                retryAfter: ipLimiter.getTimeUntilReset()
            };
        }
        
        return { allowed: true };
    }
    
    start() {
        this.server = net.createServer((socket) => {
            const clientIP = socket.remoteAddress;
            let requestCount = 0;
            let buffer = '';
            
            console.log(`\n📥 Client connesso: ${clientIP}`);
            
            socket.write('='.repeat(60) + '\n');
            socket.write('RATE LIMITED SERVER\n');
            socket.write('='.repeat(60) + '\n');
            socket.write(`Global limit: ${this.config.globalRefillRate} req/s\n`);
            socket.write(`Per-IP limit: ${this.config.perIpMaxRequests} req/${this.config.perIpWindow / 1000}s\n`);
            socket.write('='.repeat(60) + '\n');
            socket.write('Commands:\n');
            socket.write('  ping          - Test rate limit\n');
            socket.write('  stats         - Show your stats\n');
            socket.write('  server-stats  - Show server stats\n');
            socket.write('  quit          - Disconnect\n');
            socket.write('='.repeat(60) + '\n\n');
            
            socket.on('data', (data) => {
                buffer += data.toString();
                
                let newlineIdx;
                while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
                    const line = buffer.substring(0, newlineIdx).trim();
                    buffer = buffer.substring(newlineIdx + 1);
                    
                    if (line.length === 0) continue;
                    
                    this.stats.totalRequests++;
                    
                    // Check rate limit
                    const rateLimitResult = this.checkRateLimit(clientIP);
                    
                    if (!rateLimitResult.allowed) {
                        this.stats.blockedRequests++;
                        this.stats.blockedIPs.add(clientIP);
                        
                        const retryAfterSec = (rateLimitResult.retryAfter / 1000).toFixed(1);
                        
                        socket.write(`❌ RATE LIMIT EXCEEDED (${rateLimitResult.reason})\n`);
                        socket.write(`Retry after: ${retryAfterSec}s\n\n`);
                        
                        console.log(`🚫 [${clientIP}] Rate limit exceeded (${rateLimitResult.reason})`);
                        
                        continue;
                    }
                    
                    this.stats.allowedRequests++;
                    requestCount++;
                    
                    // Handle command
                    this.handleCommand(socket, clientIP, line, requestCount);
                }
            });
            
            socket.on('close', () => {
                console.log(`👋 [${clientIP}] Disconnesso (${requestCount} requests)`);
            });
            
            socket.on('error', (err) => {
                console.error(`❌ [${clientIP}] Errore:`, err.message);
            });
        });
        
        this.server.listen(this.port, () => {
            console.log('='.repeat(60));
            console.log(`✅ Rate Limited Server avviato su porta ${this.port}`);
            console.log('='.repeat(60));
            console.log(`Global: ${this.config.globalRefillRate} req/s`);
            console.log(`Per-IP: ${this.config.perIpMaxRequests} req/min`);
            console.log('='.repeat(60) + '\n');
        });
    }
    
    handleCommand(socket, ip, command, requestCount) {
        console.log(`📨 [${ip}] Request #${requestCount}: ${command}`);
        
        switch (command.toLowerCase()) {
            case 'ping':
                socket.write('pong\n\n');
                break;
            
            case 'stats':
                const ipLimiter = this.getIPLimiter(ip);
                const remaining = this.config.perIpMaxRequests - ipLimiter.getRequestCount();
                const resetMs = ipLimiter.getTimeUntilReset();
                
                socket.write('='.repeat(40) + '\n');
                socket.write('YOUR STATS\n');
                socket.write('='.repeat(40) + '\n');
                socket.write(`IP: ${ip}\n`);
                socket.write(`Session requests: ${requestCount}\n`);
                socket.write(`Window requests: ${ipLimiter.getRequestCount()}/${this.config.perIpMaxRequests}\n`);
                socket.write(`Remaining: ${remaining}\n`);
                socket.write(`Window resets in: ${(resetMs / 1000).toFixed(1)}s\n`);
                socket.write(`Global tokens: ${this.globalLimiter.getAvailableTokens()}\n`);
                socket.write('='.repeat(40) + '\n\n');
                break;
            
            case 'server-stats':
                socket.write('='.repeat(40) + '\n');
                socket.write('SERVER STATS\n');
                socket.write('='.repeat(40) + '\n');
                socket.write(`Total requests: ${this.stats.totalRequests}\n`);
                socket.write(`Allowed: ${this.stats.allowedRequests}\n`);
                socket.write(`Blocked: ${this.stats.blockedRequests}\n`);
                socket.write(`Blocked IPs: ${this.stats.blockedIPs.size}\n`);
                socket.write(`Tracked IPs: ${this.ipLimiters.size}\n`);
                socket.write(`Global tokens: ${this.globalLimiter.getAvailableTokens()}/${this.globalLimiter.capacity}\n`);
                socket.write('='.repeat(40) + '\n\n');
                break;
            
            case 'quit':
                socket.write('Goodbye!\n');
                socket.end();
                break;
            
            default:
                socket.write(`Echo: ${command}\n\n`);
        }
    }
    
    startCleanup() {
        setInterval(() => {
            let cleaned = 0;
            
            for (const [ip, limiter] of this.ipLimiters) {
                if (limiter.getRequestCount() === 0) {
                    this.ipLimiters.delete(ip);
                    cleaned++;
                }
            }
            
            if (cleaned > 0) {
                console.log(`🧹 Pulizia: ${cleaned} IP rimossi`);
            }
        }, this.config.cleanupInterval);
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
    const server = new RateLimitedServer(3301);
    server.start();
    
    // Report periodico
    setInterval(() => {
        console.log('\n📊 Periodic stats:');
        console.log(`  Total: ${server.stats.totalRequests}`);
        console.log(`  Allowed: ${server.stats.allowedRequests}`);
        console.log(`  Blocked: ${server.stats.blockedRequests}`);
        console.log(`  Tracked IPs: ${server.ipLimiters.size}`);
    }, 30000);
    
    process.on('SIGINT', () => {
        console.log('\n\n🛑 Shutdown...');
        console.log('📊 Final stats:', server.stats);
        server.stop();
        process.exit(0);
    });
}
