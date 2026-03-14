import User from '../models/User.js';

const SYSTEM_ADMIN_EMAIL = 'admin@gmail.com';
const SYSTEM_ADMIN_PASSWORD = 'admin123';

export default async function seedSystemAdmin() {
  const existing = await User.findOne({ email: SYSTEM_ADMIN_EMAIL });
  if (existing) return;
  await User.create({
    email: SYSTEM_ADMIN_EMAIL,
    password: SYSTEM_ADMIN_PASSWORD,
    name: 'System Admin',
    role: 'admin',
  });
  console.log('Seeded system admin:', SYSTEM_ADMIN_EMAIL);
}
