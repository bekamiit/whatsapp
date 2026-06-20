// src/db.js
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: 'localhost',
  port: 3306,
  user: 'monitoring',
  password: 'M0n1tASW123',
  database: 'monitoring',
  waitForConnections: true,
  connectionLimit: 10
});

module.exports = pool;
