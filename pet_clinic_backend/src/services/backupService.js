const fs = require('fs');
const path = require('path');
const oracledb = require('oracledb');
const { executeQueryArray } = require('../config/database');

// Force CLOBs to be fetched as strings to avoid circular JSON Stream errors
oracledb.fetchAsString = [oracledb.CLOB];

const BACKUP_DIR = path.join(__dirname, '../../backups');
const SETTINGS_FILE = path.join(__dirname, '../../database/settings.json');
const LAST_BACKUP_FILE = path.join(__dirname, '../../database/last_backup.json');

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

async function performBackup() {
  console.log("🔄 Starting database backup...");
  try {
    const backupData = {
      timestamp: new Date().toISOString(),
      data: {}
    };

    // 1. Fetch all table names in the current schema
    const tablesResult = await executeQueryArray(`SELECT table_name FROM user_tables`);
    const tables = tablesResult.rows.map(row => row[0]);

    // 2. Fetch all data from each table
    for (const table of tables) {
      try {
        const result = await executeQueryArray(`SELECT * FROM ${table}`);
        const metaData = result.metaData.map(col => col.name);
        
        // Convert array of arrays to array of objects
        backupData.data[table] = result.rows.map(row => {
          const rowObj = {};
          row.forEach((val, i) => {
            rowObj[metaData[i]] = val;
          });
          return rowObj;
        });
      } catch (e) {
        console.error(`⚠️ Failed to backup table ${table}:`, e.message);
      }
    }

    // 3. Save the backup file
    const filename = `backup_${new Date().toISOString().slice(0,10)}.json`;
    const filepath = path.join(BACKUP_DIR, filename);
    fs.writeFileSync(filepath, JSON.stringify(backupData, null, 2), 'utf8');
    
    // 4. Update last backup time
    fs.writeFileSync(LAST_BACKUP_FILE, JSON.stringify({ lastBackup: new Date().toISOString() }), 'utf8');
    
    console.log(`✅ Backup completed successfully: ${filename}`);
  } catch (err) {
    console.error("❌ Failed to perform backup:", err);
  }
}

function checkBackupSchedule() {
  try {
    // Check user preferences for backup schedule
    if (!fs.existsSync(SETTINGS_FILE)) return;
    const settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
    const schedule = settings.backup; // 'daily', 'weekly', 'monthly', 'disabled'
    
    if (!schedule || schedule === 'disabled') return;

    let lastBackup = new Date(0);
    if (fs.existsSync(LAST_BACKUP_FILE)) {
      const lbData = JSON.parse(fs.readFileSync(LAST_BACKUP_FILE, 'utf8'));
      lastBackup = new Date(lbData.lastBackup);
    }

    const now = new Date();
    const diffHours = (now - lastBackup) / (1000 * 60 * 60);

    let shouldBackup = false;
    if (schedule === 'daily' && diffHours >= 24) shouldBackup = true;
    if (schedule === 'weekly' && diffHours >= (24 * 7)) shouldBackup = true;
    if (schedule === 'monthly' && diffHours >= (24 * 30)) shouldBackup = true;

    if (shouldBackup) {
      performBackup();
    }
  } catch (e) {
    console.error("Backup check error:", e);
  }
}

// Check schedule every hour
function startBackupCron() {
  console.log("⏰ Starting automatic backup cron job...");
  checkBackupSchedule(); // Check immediately on startup
  setInterval(checkBackupSchedule, 1000 * 60 * 60); // Check every hour
}

module.exports = { performBackup, startBackupCron };
