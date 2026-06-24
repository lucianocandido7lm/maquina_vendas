import { DBSQLClient } from '@databricks/sql';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const token = process.env.DATABRICKS_TOKEN;
const host = process.env.DATABRICKS_SERVER_HOSTNAME;
const httpPath = process.env.DATABRICKS_HTTP_PATH;
const dbCatalog = process.env.DATABRICKS_CATALOG || 'data_platform_dev';
const dbSchema = process.env.DATABRICKS_SCHEMA || 'gold_cvcrm';

class DatabricksPool {
  constructor() {
    this.client = new DBSQLClient();
    this.connection = null;
    this.isConnecting = false;
  }

  async getConnection() {
    if (this.connection) return this.connection;
    if (this.isConnecting) {
      // Pequeno backoff iterativo se multiplos requests chegarem ao subir o server
      await new Promise((resolve) => setTimeout(resolve, 500));
      return this.getConnection();
    }

    this.isConnecting = true;
    try {
      this.connection = await this.client.connect({ token, host, path: httpPath });
      console.log('✅ Databricks Warehouse Conectado.');
      return this.connection;
    } catch (err) {
      console.error('❌ Erro na Conexão Databricks:', err);
      throw err;
    } finally {
      this.isConnecting = false;
    }
  }

  async executeQuery(sql, params = {}) {
    const conn = await this.getConnection();
    const session = await conn.openSession({
      initialCatalog: dbCatalog,
      initialSchema: dbSchema
    });
    
    try {
      // Parametrização segura enviada juntamente via connector
      const op = await session.executeStatement(sql, { 
        runAsync: true,
        namedParameters: params 
      });
      const rows = await op.fetchAll();
      await op.close();
      return rows;
    } finally {
      await session.close();
    }
  }
}

export const dbPool = new DatabricksPool();
