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
 * Seed initial demo manager and sample queues if database is empty
 */
const seedDemoData = async (targetPool) => {
  try {
    const check = await targetPool.query('SELECT COUNT(*)::int AS cnt FROM managers');
    if (check.rows[0].cnt === 0) {
      console.log('🌱 [Database] Seeding demo manager and test queues...');
      // Password is 'password123'
      const passHash = '$2a$10$d9H9wUoleP4oujz/444xtuiXEbXyA8OsLG8FbLr3dnqI/p7ENAYaC';
      
      const mgrRes = await targetPool.query(
        `INSERT INTO managers (full_name, email, password)
         VALUES ($1, $2, $3)
         RETURNING id`,
        ['Demo Manager', 'demo@queueflow.com', passHash]
      );
      const managerId = mgrRes.rows[0].id;

      // Seed Queue 1: Doctor Consultation
      const q1Res = await targetPool.query(
        `INSERT INTO queues (manager_id, name, prefix)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [managerId, 'Doctor Consultation', 'DOC']
      );
      const q1Id = q1Res.rows[0].id;

      // Add tokens to Queue 1
      await targetPool.query(
        `INSERT INTO tokens (queue_id, token_number, person_name, phone_number, position, status)
         VALUES 
           ($1, 'DOC001', 'Rahul Verma', '+91 9876543210', 1, 'WAITING'),
           ($1, 'DOC002', 'Amit Patel', '+91 9123456789', 2, 'WAITING'),
           ($1, 'DOC003', 'Priya Singh', '+91 9988776655', 3, 'WAITING')`,
        [q1Id]
      );

      await targetPool.query(
        `INSERT INTO queue_snapshots (queue_id, waiting_count, serving_count)
         VALUES ($1, 3, 0)`,
        [q1Id]
      );

      // Seed Queue 2: Cash & Billing Counter
      const q2Res = await targetPool.query(
        `INSERT INTO queues (manager_id, name, prefix)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [managerId, 'Cash & Billing Counter', 'CSH']
      );
      const q2Id = q2Res.rows[0].id;

      // Add tokens to Queue 2
      await targetPool.query(
        `INSERT INTO tokens (queue_id, token_number, person_name, phone_number, position, status)
         VALUES 
           ($1, 'CSH001', 'John Doe', '+1 555-0199', 1, 'WAITING'),
           ($1, 'CSH002', 'Sneha Rao', '+91 9811223344', 2, 'WAITING')`,
        [q2Id]
      );

      await targetPool.query(
        `INSERT INTO queue_snapshots (queue_id, waiting_count, serving_count)
         VALUES ($1, 2, 0)`,
        [q2Id]
      );

      console.log('✅ [Database] Seeded test manager (demo@queueflow.com / password123) with sample queues.');
    }
  } catch (err) {
    console.warn('⚠️ [Database] Seed check warning:', err.message);
  }
};

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

    await seedDemoData(pool);
    return pool;
  } catch (err) {
    console.warn(`⚠️ [Database] Live PostgreSQL connection failed (${err.message}).`);
    console.log('⚡ [Database] Initializing embedded in-memory PostgreSQL engine (pg-mem) for immediate testing...');

    try {
      const { newDb } = require('pg-mem');
      const memDb = newDb({
        autoCreateForeignKeyIndices: true,
      });

      memDb.public.registerFunction({
        name: 'current_timestamp',
        implementation: () => new Date(),
      });

      const sanitizedSchema = schemaSql
        .replace(/CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_serving_per_queue[\s\S]*?;/gi, '-- partial index handled in controller')
        .replace(/TIMESTAMP WITH TIME ZONE/gi, 'TIMESTAMP');

      memDb.public.none(sanitizedSchema);
      
      const pgAdapter = memDb.adapters.createPg();
      pool = new pgAdapter.Pool();
      isInMemory = true;
      console.log('✅ [Database] Embedded PostgreSQL memory database initialized successfully.');

      await seedDemoData(pool);
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
