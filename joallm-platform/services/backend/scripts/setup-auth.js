#!/usr/bin/env node

/**
 * Setup authentication for frontend testing
 */

import jwt from 'jsonwebtoken';
import { config } from '../dist/config/config.js';

function setupAuth() {
  console.log('🔧 Setting up authentication for frontend testing...\n');

  // Use the system admin user for testing
  const testUser = {
    id: '00000000-0000-0000-0000-000000000000',
    email: 'system@joallm.ai',
    role: 'admin'
  };

  const token = jwt.sign(
    {
      id: testUser.id,
      email: testUser.email,
      role: testUser.role
    },
    config.jwtSecret,
    { expiresIn: '24h' }
  );

  console.log('✅ Authentication setup complete!');
  console.log(`📧 User: ${testUser.email}`);
  console.log(`🆔 ID: ${testUser.id}`);
  console.log(`👤 Role: ${testUser.role}`);
  console.log(`⏰ Expires: 24 hours`);
  console.log(`\n🔑 JWT Token:`);
  console.log(token);
  
  console.log(`\n📋 Environment Variables for .env:`);
  console.log(`# Add this to your .env file for testing`);
  console.log(`TEST_AUTH_TOKEN=${token}`);
  console.log(`TEST_USER_ID=${testUser.id}`);
  console.log(`TEST_USER_EMAIL=${testUser.email}`);
  
  console.log(`\n🧪 Test the API:`);
  console.log(`curl -X POST http://localhost:3001/api/rag/search \\`);
  console.log(`  -H "Content-Type: application/json" \\`);
  console.log(`  -H "Authorization: Bearer ${token}" \\`);
  console.log(`  -d '{"query": "Railway", "limit": 3, "threshold": 0.1}'`);
  
  console.log(`\n🌐 Frontend Testing:`);
  console.log(`1. Open http://localhost:5175`);
  console.log(`2. Open browser dev tools (F12)`);
  console.log(`3. Go to Console tab`);
  console.log(`4. Run: localStorage.setItem('auth_token', '${token}');`);
  console.log(`5. Refresh the page`);
  console.log(`6. Try searching for "Railway"`);
  
  console.log(`\n📊 Expected Results:`);
  console.log(`- 3 search results about Railway deployment`);
  console.log(`- Content about Railway backend deployment fixes`);
  console.log(`- Similarity scores showing relevance`);
}

setupAuth();
