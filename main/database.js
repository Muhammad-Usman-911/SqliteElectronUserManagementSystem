const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../db.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error("Database Connection Error:", err);
    } else {
        console.log("Connected to SQLite");
    }
});

// Create user table if not exists
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS user (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE,
            password TEXT NOT NULL,
            cookies TEXT,
            two_fa_code TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
});

module.exports = db;
