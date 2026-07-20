#!/usr/bin/env node

/**
 * Generate a test JWT token for frontend testing
 */

import jwt from 'jsonwebtoken';
import { config } from '../dist/config/config.js';

function generateTestToken() {
  console.log('🔑 Generating test JWT token...\n');

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

  console.log('✅ Test token generated successfully!');
  console.log(`📧 User: ${testUser.email}`);
  console.log(`🆔 ID: ${testUser.id}`);
  console.log(`👤 Role: ${testUser.role}`);
  console.log(`⏰ Expires: 24 hours`);
  console.log(`\n🔑 Token:`);
  console.log(token);
  console.log(`\n📋 Usage:`);
  console.log(`Authorization: Bearer ${token}`);
  console.log(`\n🧪 Test with curl:`);
  console.log(`curl -X POST http://localhost:3001/api/rag/search \\`);
  console.log(`  -H "Content-Type: application/json" \\`);
  console.log(`  -H "Authorization: Bearer ${token}" \\`);
  console.log(`  -d '{"query": "Railway", "limit": 3, "threshold": 0.1}'`);
}

generateTestToken();
