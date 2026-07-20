import { db } from '../database/connection.js';
import { client } from '../database/connection.js';
import { users } from '../database/schema.js';
import { eq } from 'drizzle-orm';

const email = process.argv[2];
const role = process.argv[3];
const subscriptionTier = process.argv[4];

if (!email || !role) {
  console.error('Usage: tsx src/scripts/set-role.mts <email> <role> [subscriptionTier]');
  process.exit(1);
}

const before = await db.select({ id: users.id, email: users.email, role: users.role, subscriptionTier: users.subscriptionTier })
  .from(users).where(eq(users.email, email));

if (before.length === 0) {
  console.error(`User not found: ${email}`);
  process.exit(1);
}

console.log('Before:', before[0]);

await db.update(users)
  .set({
    role,
    ...(subscriptionTier ? { subscriptionTier } : {}),
  } as any)
  .where(eq(users.email, email));

const after = await db.select({ id: users.id, email: users.email, role: users.role, subscriptionTier: users.subscriptionTier })
  .from(users).where(eq(users.email, email));

console.log('After: ', after[0]);
await client.end();
