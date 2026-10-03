const { withConnection } = require('./src/config/database');
async function run() {
  return withConnection(async (c) => {
    try {
      const r = await c.execute("SELECT * FROM mortuary_records");
      console.log('Table exists. Rows:', r.rows.length);
    } catch (e) {
      console.error('Error:', e.message);
    }
  });
}
run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
