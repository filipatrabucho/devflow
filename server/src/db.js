import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;

// COUNT(*) etc. come back as the `bigint` (OID 20) type, which node-postgres
// returns as a string by default to avoid precision loss. The app only ever
// uses small counts, so parse them as regular JS numbers.
pg.types.setTypeParser(20, (val) => parseInt(val, 10));

const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('supabase') ? { rejectUnauthorized: false } : undefined,
});

// Rewrites `?` positional placeholders (mysql2 style) into Postgres `$1, $2, ...`.
function toPgSql(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

// mysql2 returns a single "header" object (insertId/affectedRows) for
// INSERT/UPDATE/DELETE, but an array of rows for SELECT. The rest of the
// codebase was written against that shape, so this shim keeps the same
// calling convention on top of `pg`, which only ever returns `{ rows, rowCount }`.
function isSelect(sql) {
  return /^\s*(select|with)\b/i.test(sql);
}

function isInsert(sql) {
  return /^\s*insert\b/i.test(sql);
}

async function run(sql, params = []) {
  let finalSql = sql;
  if (isInsert(finalSql) && !/returning/i.test(finalSql)) {
    finalSql = `${finalSql.replace(/;\s*$/, '')} RETURNING id`;
  }

  const result = await pgPool.query(toPgSql(finalSql), params);

  if (isSelect(sql)) {
    return [result.rows, result.fields];
  }

  const header = { affectedRows: result.rowCount };
  if (isInsert(sql)) {
    header.insertId = result.rows[0]?.id;
  }
  return [header, result.fields];
}

const pool = {
  query: run,
  execute: run,
};

export default pool;
export { pgPool };
