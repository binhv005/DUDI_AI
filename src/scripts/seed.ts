import fs from 'fs';
import path from 'path';

// Parse .env.local manually
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf8');
  for (const line of envConfig.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const [key, ...values] = trimmed.split('=');
      process.env[key.trim()] = values.join('=').trim();
    }
  }
}

import { connectToDatabase } from '../lib/mongodb/mongoose';
import User from '../models/User';
import KnowledgeDocument from '../models/KnowledgeDocument';
import { KnowledgeService } from '../features/knowledge/knowledge.service';
import bcrypt from 'bcryptjs';

import { seedDudiKnowledge } from './seed-dudi-knowledge';

export async function seedAdminUser() {
  await connectToDatabase();

  const adminEmails = [
    (process.env.ADMIN_EMAIL || 'admin@dudisoftware.com').toLowerCase(),
    'admin@dudisoftware.com',
    'admin@smartconsult.ai'
  ];
  const adminPassword = process.env.ADMIN_PASSWORD || 'AdminSecurePass123!';
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(adminPassword, salt);

  for (const email of Array.from(new Set(adminEmails))) {
    let adminUser = await User.findOne({ email });
    if (!adminUser) {
      adminUser = await User.create({
        name: 'DUDI Administrator',
        email,
        passwordHash,
        role: 'ADMIN',
        status: 'ACTIVE',
      });
      console.log(`[Seed] Admin user created: ${adminUser.email}`);
    } else {
      console.log(`[Seed] Admin user already exists: ${adminUser.email}`);
    }
  }

  // Seed DUDI Software Knowledge Documents if empty
  const docCount = await KnowledgeDocument.countDocuments();
  if (docCount === 0) {
    console.log('[Seed] Seeding DUDI SOFTWARE business knowledge documents...');
    await seedDudiKnowledge();
  }

  return {
    success: true,
    message: `Admin accounts and knowledge base ready.`,
  };
}

if (require.main === module) {
  seedAdminUser()
    .then((res) => {
      console.log('[Seed Admin] Finished:', res.message);
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Seed Admin] Error:', err);
      process.exit(1);
    });
}


