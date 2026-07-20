import { test, expect } from '@playwright/test';

test.describe('Chat Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto('/');
    await page.click('text=Login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    // Wait for dashboard
    await expect(page).toHaveURL(/.*dashboard/);
  });

  test('should send and receive chat messages', async ({ page }) => {
    // Navigate to chat
    await page.click('text=Chat');
    
    // Wait for chat interface to load
    await expect(page.locator('[data-testid="chat-input"]')).toBeVisible();
    
    // Send a message
    await page.fill('[data-testid="chat-input"]', 'Hello, how are you?');
    await page.click('[data-testid="send-button"]');
    
    // Wait for response
    await expect(page.locator('[data-testid="message-response"]')).toBeVisible();
  });

  test('should create new chat session', async ({ page }) => {
    await page.click('text=New Chat');
    
    // Should create new session
    await expect(page.locator('[data-testid="chat-session"]')).toBeVisible();
    
    // Send message in new session
    await page.fill('[data-testid="chat-input"]', 'This is a new conversation');
    await page.click('[data-testid="send-button"]');
    
    await expect(page.locator('[data-testid="message-response"]')).toBeVisible();
  });

  test('should switch between chat sessions', async ({ page }) => {
    // Create first session
    await page.click('text=New Chat');
    await page.fill('[data-testid="chat-input"]', 'First session message');
    await page.click('[data-testid="send-button"]');
    
    // Create second session
    await page.click('text=New Chat');
    await page.fill('[data-testid="chat-input"]', 'Second session message');
    await page.click('[data-testid="send-button"]');
    
    // Switch back to first session
    await page.click('[data-testid="session-1"]');
    
    // Should show first session messages
    await expect(page.locator('text=First session message')).toBeVisible();
  });

  test('should select different AI models', async ({ page }) => {
    await page.click('text=Chat');
    
    // Open model selector
    await page.click('[data-testid="model-selector"]');
    
    // Select different model
    await page.click('text=GPT-4');
    
    // Send message with selected model
    await page.fill('[data-testid="chat-input"]', 'Test with GPT-4');
    await page.click('[data-testid="send-button"]');
    
    await expect(page.locator('[data-testid="message-response"]')).toBeVisible();
  });

  test('should handle empty message input', async ({ page }) => {
    await page.click('text=Chat');
    
    // Try to send empty message
    await page.click('[data-testid="send-button"]');
    
    // Should not send empty message
    await expect(page.locator('[data-testid="message-response"]')).not.toBeVisible();
  });

  test('should show typing indicator', async ({ page }) => {
    await page.click('text=Chat');
    
    // Send message
    await page.fill('[data-testid="chat-input"]', 'Show typing indicator');
    await page.click('[data-testid="send-button"]');
    
    // Should show typing indicator
    await expect(page.locator('[data-testid="typing-indicator"]')).toBeVisible();
    
    // Wait for response and indicator to disappear
    await expect(page.locator('[data-testid="typing-indicator"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="message-response"]')).toBeVisible();
  });

  test('should handle long messages', async ({ page }) => {
    await page.click('text=Chat');
    
    const longMessage = 'This is a very long message that should test the system\'s ability to handle lengthy user inputs without breaking the UI or causing performance issues. '.repeat(10);
    
    await page.fill('[data-testid="chat-input"]', longMessage);
    await page.click('[data-testid="send-button"]');
    
    await expect(page.locator('[data-testid="message-response"]')).toBeVisible();
  });

  test('should delete chat session', async ({ page }) => {
    // Create a session
    await page.click('text=New Chat');
    await page.fill('[data-testid="chat-input"]', 'Message to be deleted');
    await page.click('[data-testid="send-button"]');
    
    // Delete the session
    await page.click('[data-testid="delete-session"]');
    
    // Confirm deletion
    await page.click('text=Yes, Delete');
    
    // Session should be removed
    await expect(page.locator('[data-testid="session-list"]')).not.toContainText('Message to be deleted');
  });

  test('should handle network errors gracefully', async ({ page }) => {
    // Mock network failure
    await page.route('**/api/chat/message', route => route.abort());
    
    await page.click('text=Chat');
    await page.fill('[data-testid="chat-input"]', 'This will fail');
    await page.click('[data-testid="send-button"]');
    
    // Should show error message
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
  });
});






