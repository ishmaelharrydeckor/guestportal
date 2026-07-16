import { Pool } from '@neondatabase/serverless';
import Database from 'better-sqlite3';
import path from 'path';

// Load environment variables (Vercel/Neon automatically sets DATABASE_URL)
const databaseUrl = process.env.DATABASE_URL;

let sqliteDb: any = null;
let pgPool: Pool | null = null;

if (databaseUrl) {
  pgPool = new Pool({ connectionString: databaseUrl });
} else {
  const dbPath = path.resolve(process.cwd(), 'guest_checkin.db');
  sqliteDb = new Database(dbPath);
  
  // Enable WAL mode for better concurrency performance
  sqliteDb.pragma('journal_mode = WAL');

  // Initialize the SQLite database tables
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS guests (
      id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      email TEXT,
      ticket_type TEXT NOT NULL,
      payment_status TEXT NOT NULL,
      amount_paid REAL,
      order_id TEXT,
      checked_in INTEGER DEFAULT 0,
      checked_in_at TEXT,
      checked_in_by TEXT
    );
    
    CREATE INDEX IF NOT EXISTS idx_guests_email ON guests(email);
    CREATE INDEX IF NOT EXISTS idx_guests_order_id ON guests(order_id);
  `);
}

export interface Guest {
  id: string;
  full_name: string;
  email: string;
  ticket_type: string;
  payment_status: string; // "Paid" | "Pending" | "Issue"
  amount_paid: number | null;
  order_id: string | null;
  checked_in: boolean; // mapped from boolean/int dynamically
  checked_in_at: string | null;
  checked_in_by: string | null;
}

// Unified query wrapper supporting both Neon PostgreSQL and SQLite
export const db = {
  async query(sql: string, params: any[] = []): Promise<any[]> {
    if (pgPool) {
      const res = await pgPool.query(sql, params);
      return res.rows;
    } else {
      const sqliteSql = sql.replace(/\$\d+/g, '?');
      return sqliteDb.prepare(sqliteSql).all(params);
    }
  },

  async queryOne(sql: string, params: any[] = []): Promise<any | null> {
    if (pgPool) {
      const res = await pgPool.query(sql, params);
      return res.rows[0] || null;
    } else {
      const sqliteSql = sql.replace(/\$\d+/g, '?');
      return sqliteDb.prepare(sqliteSql).get(params) || null;
    }
  },

  async execute(sql: string, params: any[] = []): Promise<void> {
    if (pgPool) {
      await pgPool.query(sql, params);
    } else {
      const sqliteSql = sql.replace(/\$\d+/g, '?');
      sqliteDb.prepare(sqliteSql).run(params);
    }
  },

  async transaction<T>(fn: (tx: {
    query: (sql: string, params?: any[]) => Promise<any[]>;
    queryOne: (sql: string, params?: any[]) => Promise<any | null>;
    execute: (sql: string, params?: any[]) => Promise<void>;
  }) => Promise<T>): Promise<T> {
    if (pgPool) {
      const client = await pgPool.connect();
      try {
        await client.query('BEGIN');
        const txWrapper = {
          async query(sql: string, params: any[] = []) {
            const res = await client.query(sql, params);
            return res.rows;
          },
          async queryOne(sql: string, params: any[] = []) {
            const res = await client.query(sql, params);
            return res.rows[0] || null;
          },
          async execute(sql: string, params: any[] = []) {
            await client.query(sql, params);
          }
        };
        const result = await fn(txWrapper);
        await client.query('COMMIT');
        return result;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } else {
      try {
        sqliteDb.prepare('BEGIN').run();
        const txWrapper = {
          async query(sql: string, params: any[] = []) {
            const sqliteSql = sql.replace(/\$\d+/g, '?');
            return sqliteDb.prepare(sqliteSql).all(params);
          },
          async queryOne(sql: string, params: any[] = []) {
            const sqliteSql = sql.replace(/\$\d+/g, '?');
            return sqliteDb.prepare(sqliteSql).get(params) || null;
          },
          async execute(sql: string, params: any[] = []) {
            const sqliteSql = sql.replace(/\$\d+/g, '?');
            sqliteDb.prepare(sqliteSql).run(params);
          }
        };
        const result = await fn(txWrapper);
        sqliteDb.prepare('COMMIT').run();
        return result;
      } catch (err) {
        sqliteDb.prepare('ROLLBACK').run();
        throw err;
      }
    }
  }
};

export default db;
