
// module.exports = db;
const { app } = require('electron');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

// Determine correct database path based on environment
let dbPath;
if (app.isPackaged) {
  // In production, use the database from extraResources
  dbPath = path.join(process.resourcesPath, 'db.sqlite');
} else {
  // In development, use the local database file
  dbPath = path.join(__dirname, '..', 'db.sqlite');
}

// Ensure the database file exists
if (!fs.existsSync(dbPath) && app.isPackaged) {
  console.error('Database file not found at:', dbPath);
  // Create an empty database if it doesn't exist
  fs.writeFileSync(dbPath, '');
}

// Initialize the database
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Database opening error: ', err);
  } else {
    console.log('Connected to the SQLite database at:', dbPath);
    
    // Create tables if they don't exist
    db.run(`CREATE TABLE IF NOT EXISTS user (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_name TEXT,
      email TEXT,
      password TEXT,
      cookies TEXT,
      type TEXT,
      two_fa_code TEXT
    )`, (err) => {
      if (err) {
        console.error('Error creating tables:', err);
      } else {
        console.log('Database tables checked/created successfully');
      }
    });
  }
});

module.exports = db;