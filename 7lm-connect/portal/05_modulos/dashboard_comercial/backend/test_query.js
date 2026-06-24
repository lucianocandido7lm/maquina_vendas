import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  ssl: { rejectUnauthorized: false }
});

pool.query("SELECT table_name, column_name FROM information_schema.columns WHERE table_name IN ('vw_hierarquia_cvcrm')").then(res => {
  console.log(res.rows);
  process.exit(0);
});
