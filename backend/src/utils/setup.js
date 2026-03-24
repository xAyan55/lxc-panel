import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { getDb } from '../config/database.js';
import { generateApiKey } from './helpers.js';

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '../../.env');

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

    // Update .env with credentials
    if (fs.existsSync(envPath)) {
      let content = fs.readFileSync(envPath, 'utf8');
      
      const updateEnv = (key, val) => {
        const regex = new RegExp(`^${key}=.*$`, 'm');
        if (regex.test(content)) {
          content = content.replace(regex, `${key}=${val}`);
        } else {
          content += `\n${key}=${val}`;
        }
      };

      updateEnv('ADMIN_EMAIL', email);
      updateEnv('ADMIN_PASSWORD', password);
      
      fs.writeFileSync(envPath, content);
      console.log(`[Setup] Credentials saved to ${envPath}`);
    }

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
