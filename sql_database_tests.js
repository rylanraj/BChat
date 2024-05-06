const mysql = require('mysql2');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
}).promise();

async function main(){
    try{
        const result = await pool.query("SELECT * FROM REMINDER WHERE UserID = 1;");
        console.log(result[0]);
    }catch(err){
        console.log(err);
    }
}
main();