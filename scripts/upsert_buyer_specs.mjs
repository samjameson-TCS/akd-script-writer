import { readFileSync } from 'fs';
import { createConnection } from 'mysql2/promise';

const data = JSON.parse(readFileSync('/home/ubuntu/buyer_specs_final.json', 'utf8'));

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

// Parse mysql://user:pass@host:port/db?ssl=...
const m = dbUrl.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/);
if (!m) {
  console.error('Could not parse DATABASE_URL:', dbUrl);
  process.exit(1);
}
const [, user, password, host, port, database] = m;

const conn = await createConnection({
  host,
  port: parseInt(port),
  user,
  password,
  database,
  ssl: { rejectUnauthorized: true },
});

console.log('Connected to DB');

let updated = 0;
let inserted = 0;

for (const [lawsuitName, content] of Object.entries(data)) {
  // Check if exists
  const [rows] = await conn.execute(
    'SELECT id FROM buyer_specs WHERE buyerName = ?',
    [lawsuitName]
  );
  
  if (rows.length > 0) {
    await conn.execute(
      'UPDATE buyer_specs SET content = ?, updatedAt = NOW() WHERE buyerName = ?',
      [content, lawsuitName]
    );
    console.log(`  UPDATED: ${lawsuitName} (${content.length} chars)`);
    updated++;
  } else {
    await conn.execute(
      'INSERT INTO buyer_specs (buyerName, content, createdAt, updatedAt) VALUES (?, ?, NOW(), NOW())',
      [lawsuitName, content]
    );
    console.log(`  INSERTED: ${lawsuitName} (${content.length} chars)`);
    inserted++;
  }
}

await conn.end();
console.log(`\nDone: ${updated} updated, ${inserted} inserted`);
