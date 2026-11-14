const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

let pool;
let isInMemory = false;

// Determine if we should attempt connection to a live PostgreSQL server
const connectionConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME || 'queueflow',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
    };

const schemaPath = path.join(__dirname, '../database/schema.sql');
const schemaSql = fs.existsSync(schemaPath) ? fs.readFileSync(schemaPath, 'utf8') : '';

/**
 * Initialize Database Connection
 * Tries real PostgreSQL first; seamlessly falls back to embedded pg-mem if live DB is unreachable.
 */
const initDb = async () => {
  if (pool) return pool;

  try {
    const livePool = new Pool(connectionConfig);
    // Test connectivity with a short timeout
    const client = await Promise.race([
      livePool.connect(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout')), 2500))
    ]);

    console.log('✅ [Database] Connected to live PostgreSQL server successfully.');
    pool = livePool;
    client.release();

    // Auto-apply schema if tables don't exist
    if (schemaSql) {
      await pool.query(schemaSql);
      console.log('✅ [Database] PostgreSQL schema verified/initialized.');
    }
    return pool;
  } catch (err) {
    console.warn(`⚠️ [Database] Live PostgreSQL connection failed (${err.message}).`);
    console.log('⚡ [Database] Initializing embedded in-memory PostgreSQL engine (pg-mem) for immediate testing...');

    try {
      const { newDb } = require('pg-mem');
      const memDb = newDb({
        autoCreateForeignKeyIndices: true,
      });

      // Register current_timestamp and helpers if needed
      memDb.public.registerFunction({
        name: 'current_timestamp',
        implementation: () => new Date(),
      });

      // pg-mem doesn't support complex partial unique indices syntax in DDL directly in some versions,
      // so we sanitize partial index clauses for memory simulation if needed, or apply schema cleanly
      const sanitizedSchema = schemaSql
        .replace(/CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_serving_per_queue[\s\S]*?;/gi, '-- partial index handled in controller')
        .replace(/TIMESTAMP WITH TIME ZONE/gi, 'TIMESTAMP');

      memDb.public.none(sanitizedSchema);
      
      const pgAdapter = memDb.adapters.createPg();
      pool = new pgAdapter.Pool();
      isInMemory = true;
      console.log('✅ [Database] Embedded PostgreSQL memory database initialized successfully.');
      return pool;
    } catch (memErr) {
      console.error('❌ [Database] Failed to initialize fallback in-memory PostgreSQL:', memErr);
      throw memErr;
    }
  }
};

module.exports = {
  initDb,
  getPool: () => pool,
  isInMemory: () => isInMemory,
  query: async (text, params) => {
    if (!pool) {
      await initDb();
    }
    return pool.query(text, params);
  },
  getClient: async () => {
    if (!pool) {
      await initDb();
    }
    return pool.connect();
  }
};
