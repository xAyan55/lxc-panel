import 'dotenv/config';
import bcrypt from 'bcrypt';
import { getDb } from '../config/database.js';
import { generateApiKey } from './helpers.js';

async function setup() {
  const args = process.argv.slice(2);
  const email = args[0];
  const password = args[1];

  if (!email || !password) {
    console.error('Usage: node setup.js <admin_email> <admin_password>');
    process.exit(1);
  }

  const db = getDb();
  
  try {
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      console.log(`Admin user ${email} already exists. Skipping...`);
      process.exit(0);
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const apiKey = generateApiKey();
    
    db.prepare(`
      INSERT INTO users (email, password, name, role, max_containers, api_key, api_key_created_at)
      VALUES (?, ?, ?, 'admin', 99, ?, datetime('now'))
    `).run(email, hashedPassword, 'System Admin', apiKey);

    console.log('--------------------------------------------------');
    console.log('✅ Admin user created successfully!');
    console.log(`Email: ${email}`);
    console.log(`API Key: ${apiKey}`);
    console.log('--------------------------------------------------');
    process.exit(0);
  } catch (err) {
    console.error('❌ Setup failed:', err.message);
    process.exit(1);
  }
}

setup();
