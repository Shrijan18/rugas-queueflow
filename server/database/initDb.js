const { initDb, query } = require('../config/db');

async function run() {
  console.log('--- Initializing QueueFlow Database ---');
  try {
    await initDb();
    const res = await query('SELECT count(*) FROM managers');
    console.log('Managers count:', res.rows[0]);
    console.log('Database initialization verified successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Initialization error:', err);
    process.exit(1);
  }
}

run();
