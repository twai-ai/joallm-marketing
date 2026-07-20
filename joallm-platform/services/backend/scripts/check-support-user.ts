import { db } from '../src/database/connection.js';
import { users } from '../src/database/schema.js';
import { eq } from 'drizzle-orm';

async function checkSupportUser() {
  try {
    console.log('🔍 Checking for support@joallm.ai user...');
    
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, 'support@joallm.ai'))
      .limit(1);

    if (user) {
      console.log('✅ User found:');
      console.log({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      });
    } else {
      console.log('❌ User NOT found in database');
      console.log('💡 You may need to register the user first');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error checking user:', error);
    process.exit(1);
  }
}

checkSupportUser();
