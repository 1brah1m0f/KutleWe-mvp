const { Pool } = require("pg");

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn("DATABASE_URL bosdur. /db-test endpoint-i xeta verecek.");
}

const pool = connectionString
  ? new Pool({
      connectionString,
      ssl: {
        rejectUnauthorized: false
      }
    })
  : null;

module.exports = {
  pool
};
