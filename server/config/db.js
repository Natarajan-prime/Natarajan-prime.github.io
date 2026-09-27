const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const dbName = process.env.DB_NAME || 'college_leave_db';

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : 'root',
    database: dbName,
    ssl: process.env.DB_HOST && process.env.DB_HOST !== 'localhost' ? { rejectUnauthorized: true } : false,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Auto-create DB if missing, test connection & run auto-migration on startup
(async () => {
    try {
        // Step A: Ensure database exists on cloud server
        try {
            const adminConn = await mysql.createConnection({
                host: process.env.DB_HOST || 'localhost',
                port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306,
                user: process.env.DB_USER || 'root',
                password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : 'root',
                ssl: process.env.DB_HOST && process.env.DB_HOST !== 'localhost' ? { rejectUnauthorized: true } : false
            });
            await adminConn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\`;`);
            await adminConn.end();
            console.log(`✅ Ensured database '${dbName}' exists on MySQL server.`);
        } catch (setupErr) {
            console.warn('Note: Could not run pre-create query, proceeding to direct connect:', setupErr.message);
        }

        // Step B: Connect pool and run migrations
        const connection = await pool.getConnection();
        console.log('✅ Connected successfully to MySQL Database: ' + dbName);
        connection.release();
        
        // Auto-migrate tables and columns seamlessly
        const autoMigrate = require('./migrate');
        await autoMigrate();
    } catch (err) {
        console.error('⚠️ Database connection error: ' + err.message);
        console.error('👉 Make sure MySQL is running and password in .env is correct.');
    }
})();

module.exports = pool;
