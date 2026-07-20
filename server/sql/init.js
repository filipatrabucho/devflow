import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME } = process.env;
const {
  BOOTSTRAP_SENIOR_NAME = 'Admin',
  BOOTSTRAP_SENIOR_EMAIL,
  BOOTSTRAP_SENIOR_PASSWORD,
  ALLOWED_EMAIL_DOMAIN = '@pkf.pt',
} = process.env;

async function main() {
  const connection = await mysql.createConnection({
    host: DB_HOST,
    port: Number(DB_PORT) || 3306,
    user: DB_USER,
    password: DB_PASSWORD,
    multipleStatements: true,
  });

  const [colCheck] = await connection.query(
    'SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?',
    [DB_NAME, 'roles', 'can_validate_tasks']
  );
  const hadValidateColumn = colCheck[0].cnt > 0;

  const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  console.log('Applying schema...');
  await connection.query(schemaSql);
  await connection.changeUser({ database: DB_NAME });

  if (!hadValidateColumn) {
    await connection.execute("UPDATE roles SET can_validate_tasks = 1 WHERE key_name IN ('senior', 'admin')");
    console.log('Defaulted "Validate tasks" to on for the senior and admin roles.');
  }

  const [rows] = await connection.query('SELECT COUNT(*) AS count FROM users');
  if (rows[0].count === 0) {
    if (!BOOTSTRAP_SENIOR_EMAIL || !BOOTSTRAP_SENIOR_PASSWORD) {
      console.log(
        'No users found. Set BOOTSTRAP_SENIOR_EMAIL and BOOTSTRAP_SENIOR_PASSWORD in .env to auto-create the first senior account.'
      );
    } else if (!BOOTSTRAP_SENIOR_EMAIL.toLowerCase().endsWith(ALLOWED_EMAIL_DOMAIN.toLowerCase())) {
      console.error(`BOOTSTRAP_SENIOR_EMAIL must end with ${ALLOWED_EMAIL_DOMAIN}`);
      process.exitCode = 1;
    } else {
      const passwordHash = await bcrypt.hash(BOOTSTRAP_SENIOR_PASSWORD, 12);
      await connection.execute(
        'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
        [BOOTSTRAP_SENIOR_NAME, BOOTSTRAP_SENIOR_EMAIL.toLowerCase(), passwordHash, 'senior']
      );
      console.log(`Bootstrap senior user created: ${BOOTSTRAP_SENIOR_EMAIL}`);
    }
  } else {
    console.log('Users table already populated, skipping bootstrap user.');
  }

  await connection.end();
  console.log('Database ready.');
}

main().catch((err) => {
  console.error('Database initialization failed:', err);
  process.exitCode = 1;
});
