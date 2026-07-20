import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import bcrypt from 'bcryptjs';
import { users } from '../src/database/schema.js';
import { config } from '../src/config/config.js';

const connectionString = config.databaseUrl;
const client = postgres(connectionString);
const db = drizzle(client);

async function createSuperUser() {
  try {
    console.log('Creating super user account...');
    
    // Hash the password
    const hashedPassword = await bcrypt.hash('mnb@232290', 12);
    
    // Check if user already exists
    const existingUser = await db.select().from(users).where(eq(users.email, 'support@joallm.ai')).limit(1);
    
    if (existingUser.length > 0) {
      console.log('Super user already exists. Updating...');
      
      // Update existing user to super admin
      await db.update(users)
        .set({
          password: hashedPassword,
          role: 'admin',
          subscriptionTier: 'enterprise',
          name: 'JoaLLM Support',
          updatedAt: new Date(),
        })
        .where(eq(users.email, 'support@joallm.ai'));
        
      console.log('✅ Super user updated successfully!');
    } else {
      // Create new super user
      await db.insert(users).values({
        email: 'support@joallm.ai',
        password: hashedPassword,
        name: 'JoaLLM Support',
        role: 'admin',
        subscriptionTier: 'enterprise',
        usageStats: {
          totalTokens: 0,
          totalRequests: 0,
          totalFiles: 0,
          lastReset: new Date().toISOString(),
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      
      console.log('✅ Super user created successfully!');
    }
    
    console.log('📧 Email: support@joallm.ai');
    console.log('🔑 Password: mnb@232290');
    console.log('👑 Role: admin');
    console.log('💎 Subscription: enterprise');
    console.log('🎯 Access Level: Full system access');
    
  } catch (error) {
    console.error('❌ Error creating super user:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Import eq function
import { eq } from 'drizzle-orm';

createSuperUser();
