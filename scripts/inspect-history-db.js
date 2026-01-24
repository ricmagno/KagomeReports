
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(process.cwd(), 'data', 'update-history.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    db.all("SELECT * FROM update_history", [], (err, rows) => {
        if (err) {
            console.error(err);
            return;
        }
        console.log('Update History Records:', rows);
    });
});

db.close();
