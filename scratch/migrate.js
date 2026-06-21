import pg from 'pg';
import fs from 'fs';
import path from 'path';

// Read .env file
const envPath = path.resolve('.env');
if (!fs.existsSync(envPath)) {
  console.error('.env file not found');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    // remove quotes
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    }
    env[match[1]] = value.trim();
  }
});

const supabaseUrl = env['VITE_SUPABASE_URL'];
const dbPassword = env['VITE_SUPABASE_DB_PASSWORD'];

if (!supabaseUrl || !dbPassword) {
  console.error('VITE_SUPABASE_URL or VITE_SUPABASE_DB_PASSWORD not found in .env');
  process.exit(1);
}

// Extract project ref from VITE_SUPABASE_URL (e.g., https://uohuninusuxtalnkxpva.supabase.co -> uohuninusuxtalnkxpva)
const projectRefMatch = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
if (!projectRefMatch) {
  console.error('Invalid VITE_SUPABASE_URL format');
  process.exit(1);
}

const projectRef = projectRefMatch[1];
const host = `db.${projectRef}.supabase.co`;

const { Client } = pg;

const client = new Client({
  host: host,
  port: 5432,
  user: 'postgres',
  password: dbPassword,
  database: 'postgres',
  ssl: {
    rejectUnauthorized: false
  }
});

async function runMigration() {
  console.log(`Connecting to database at ${host}...`);
  try {
    await client.connect();
    console.log('Connected. Running migration query...');
    await client.query(`
      ALTER TABLE public.sessions 
      ADD COLUMN IF NOT EXISTS match_mode TEXT NOT NULL DEFAULT 'fixed';
    `);
    console.log('Migration completed successfully: "match_mode" column added (or already exists).');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
