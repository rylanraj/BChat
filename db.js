require('dotenv').config();
const path = require('path');
const mysql = require("mysql2");
// Load SSL certificate
let ca;
try {
    const fs = require('fs');
    ca = fs.readFileSync(path.join(__dirname, 'ca.pem'));
} catch (err) {
    console.warn('Warning: ca.pem not found or could not be read. SSL may not be enabled for MySQL connection.');
}

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    ssl: ca ? { ca } : undefined
}).promise();
module.exports = {pool};