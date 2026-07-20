import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import bcrypt from 'bcryptjs';
import { users } from '../src/database/schema.js';
import { config } from '../src/config/config.js';
import { eq, isNull } from 'drizzle-orm';

const connectionString = config.databaseUrl;
const client = postgres(connectionString);
const db = drizzle(client);

async function fixUserPasswords() {
  try {
    console.log('Fixing user passwords...');
    
    // Get all users without passwords
    const usersWithoutPasswords = await db.select().from(users).where(isNull(users.password));
    
    console.log(`Found ${usersWithoutPasswords.length} users without passwords`);
    
    // Set default password for users without passwords
    const defaultPassword = await bcrypt.hash('password123', 12);
    
    for (const user of usersWithoutPasswords) {
      await db.update(users)
        .set({
          password: defaultPassword,
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));
      
      console.log(`✅ Updated password for user: ${user.email}`);
    }
    
    console.log('✅ All user passwords fixed!');
    
  } catch (error) {
    console.error('❌ Error fixing user passwords:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

fixUserPasswords();
