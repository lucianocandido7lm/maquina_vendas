import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

async function checkPostgresConnection() {
  console.log(`🔍 Testando conexão com Postgres em: ${process.env.DB_HOST}...`);
  
  const client = new Client({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    const res = await client.query('SELECT NOW() as tempo_atual, current_database() as database_name');
    console.log("✅ Conexão estabelecida com sucesso!");
    console.log(`⏱️ Horário no Postgres: ${res.rows[0].tempo_atual}`);
    console.log(`📁 Database conectada: ${res.rows[0].database_name}`);
  } catch (err) {
    console.error("❌ ERRO DE CONEXÃO:");
    if (err.code === '28000') {
      console.error("👉 O IP do seu Front não está autorizado no pg_hba.conf do Postgres.");
    } else if (err.code === 'ECONNREFUSED') {
      console.error("👉 O Postgres não está respondendo nesse IP ou a porta 5432 está fechada.");
    } else {
      console.error(err.message);
    }
  } finally {
    await client.end();
  }
}

checkPostgresConnection();
