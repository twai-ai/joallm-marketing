// Test script to verify LLM service logic
import { LLMService } from './services/backend/src/services/llm-providers.ts';

const userApiKeys = {
  groq: 'your-groq-api-key-here'
};

console.log('Testing LLM service with user API keys...');
console.log('User API keys:', userApiKeys);

const llmService = new LLMService(userApiKeys);
console.log('LLM service created');

// Test the getProvider method
const provider = llmService.getProvider('llama-3.3-70b-versatile');
console.log('Provider type:', provider.constructor.name);

// Test if it's in mock mode
console.log('Is mock mode:', llmService.useMock);
