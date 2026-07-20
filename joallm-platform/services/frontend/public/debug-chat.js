// JoaLLM Chat Diagnostic Script
// Run this in browser console (F12) to diagnose chat issues

console.log('%c🔍 JoaLLM Chat Diagnostic Starting...', 'color: #FF4444; font-size: 16px; font-weight: bold;');
console.log('');

async function runDiagnostics() {
  const results = {
    passed: [],
    failed: [],
    warnings: []
  };

  // Test 1: Backend Health
  console.log('1️⃣ Testing Backend Connection...');
  try {
    const health = await fetch('http://localhost:3000/api/health');
    const data = await health.json();
    if (data.status === 'healthy') {
      results.passed.push('✅ Backend is healthy');
      console.log('   ✅ Backend Status:', data.status);
      console.log('   ✅ Services:', data.services);
    } else {
      results.failed.push('❌ Backend unhealthy');
    }
  } catch (e) {
    results.failed.push('❌ Cannot connect to backend: ' + e.message);
    console.error('   ❌ Error:', e);
  }

  // Test 2: Session Creation
  console.log('\n2️⃣ Testing Session Creation...');
  try {
    const sessionRes = await fetch('http://localhost:3000/api/chat/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Debug Test Chat' })
    });
    
    if (sessionRes.ok) {
      const session = await sessionRes.json();
      results.passed.push('✅ Can create sessions');
      console.log('   ✅ Session created:', session.id);
      console.log('   ✅ Short ID:', session.shortId);
      
      // Test 3: Chat Stream
      console.log('\n3️⃣ Testing Chat Stream...');
      const streamRes = await fetch('http://localhost:3000/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.id,
          messages: [{ role: 'user', content: 'Test message' }],
          model: 'llama-3.3-70b-versatile',
          parameters: { temperature: 0.7, maxTokens: 50 }
        })
      });
      
      if (streamRes.ok) {
        results.passed.push('✅ Streaming endpoint works');
        console.log('   ✅ Stream Status:', streamRes.status);
        console.log('   ✅ Content-Type:', streamRes.headers.get('content-type'));
        
        // Read first chunk
        const reader = streamRes.body.getReader();
        const decoder = new TextDecoder();
        const {value, done} = await reader.read();
        if (!done) {
          const chunk = decoder.decode(value);
          console.log('   ✅ First chunk received:', chunk.substring(0, 100));
          results.passed.push('✅ Received streaming data');
        }
        reader.cancel();
      } else {
        const error = await streamRes.text();
        results.failed.push('❌ Stream failed: ' + streamRes.status);
        console.error('   ❌ Error:', error);
      }
    } else {
      results.failed.push('❌ Cannot create session: ' + sessionRes.status);
    }
  } catch (e) {
    results.failed.push('❌ Session/Stream test failed: ' + e.message);
    console.error('   ❌ Error:', e);
  }

  // Test 4: Frontend State
  console.log('\n4️⃣ Checking Frontend State...');
  const textarea = document.querySelector('textarea');
  const sendButton = document.querySelector('button[type="submit"], button:has(.lucide-send)');
  const messagesList = document.querySelector('[data-messages], .message-list, [class*="message"]');
  
  if (textarea) {
    results.passed.push('✅ Input textarea found');
    console.log('   ✅ Textarea:', textarea.placeholder);
    console.log('   ✅ Disabled:', textarea.disabled);
  } else {
    results.warnings.push('⚠️  Input textarea not found');
  }
  
  if (sendButton) {
    results.passed.push('✅ Send button found');
    console.log('   ✅ Send button:', sendButton.disabled ? 'Disabled' : 'Enabled');
  } else {
    results.warnings.push('⚠️  Send button not found');
  }
  
  if (messagesList) {
    results.passed.push('✅ Messages container found');
  } else {
    results.warnings.push('⚠️  Messages container not found');
  }

  // Test 5: Check for React Query
  console.log('\n5️⃣ Checking React Query...');
  if (window.__REACT_QUERY_CLIENT__) {
    results.passed.push('✅ React Query available');
    console.log('   ✅ Query Client found');
  } else {
    results.warnings.push('⚠️  React Query client not detected');
  }

  // Test 6: Check Local Storage
  console.log('\n6️⃣ Checking Local Storage...');
  try {
    const chatStore = localStorage.getItem('chat-store');
    if (chatStore) {
      const parsed = JSON.parse(chatStore);
      console.log('   ✅ Chat store found');
      console.log('   📊 Active Session:', parsed.state?.activeSessionId || 'None');
      console.log('   📊 Messages:', parsed.state?.messages?.length || 0);
      results.passed.push('✅ Local storage accessible');
    } else {
      results.warnings.push('⚠️  No chat store in localStorage');
    }
  } catch (e) {
    results.warnings.push('⚠️  Cannot read localStorage: ' + e.message);
  }

  // Print Summary
  console.log('\n' + '='.repeat(60));
  console.log('%c📊 DIAGNOSTIC SUMMARY', 'color: #FF4444; font-size: 14px; font-weight: bold;');
  console.log('='.repeat(60));
  
  console.log('\n%c✅ PASSED (' + results.passed.length + ')', 'color: green; font-weight: bold;');
  results.passed.forEach(r => console.log(r));
  
  if (results.warnings.length > 0) {
    console.log('\n%c⚠️  WARNINGS (' + results.warnings.length + ')', 'color: orange; font-weight: bold;');
    results.warnings.forEach(r => console.log(r));
  }
  
  if (results.failed.length > 0) {
    console.log('\n%c❌ FAILED (' + results.failed.length + ')', 'color: red; font-weight: bold;');
    results.failed.forEach(r => console.log(r));
  }
  
  console.log('\n' + '='.repeat(60));
  
  if (results.failed.length === 0) {
    console.log('%c🎉 All critical tests passed! Chat should be working.', 'color: green; font-size: 14px; font-weight: bold;');
    console.log('\n%c💡 If chat still not working:', 'color: #FF4444; font-weight: bold;');
    console.log('1. Try hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)');
    console.log('2. Clear console and try sending a message');
    console.log('3. Check Network tab for actual request/response');
  } else {
    console.log('%c❌ Some tests failed. Please fix the issues above.', 'color: red; font-size: 14px; font-weight: bold;');
    console.log('\n%c💡 Next steps:', 'color: #FF4444; font-weight: bold;');
    console.log('1. Fix backend issues (if any)');
    console.log('2. Restart both frontend and backend');
    console.log('3. Run this diagnostic again');
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('%c🔍 Diagnostic Complete', 'color: #FF4444; font-size: 16px; font-weight: bold;');
}

// Run diagnostics
runDiagnostics().catch(e => {
  console.error('%c❌ Diagnostic failed:', 'color: red; font-weight: bold;', e);
});


