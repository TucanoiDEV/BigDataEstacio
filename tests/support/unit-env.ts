// Variáveis mínimas para módulos que leem configuração (chaves geradas só para teste).
process.env.APP_URL ??= "http://localhost:3000";
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5433/unused";
process.env.ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
process.env.HASH_PEPPER = Buffer.alloc(32, 9).toString("base64");
process.env.SMTP_HOST = "";
