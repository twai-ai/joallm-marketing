import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should register a new user', async ({ page }) => {
    // Click on register/sign up button
    await page.click('text=Sign Up');
    
    // Fill registration form
    await page.fill('input[name="name"]', 'Test User');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.fill('input[name="confirmPassword"]', 'password123');
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Wait for success message or redirect
    await expect(page.locator('text=Registration successful')).toBeVisible();
  });

  test('should login with existing user', async ({ page }) => {
    // Click on login button
    await page.click('text=Login');
    
    // Fill login form
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Wait for redirect to dashboard
    await expect(page).toHaveURL(/.*dashboard/);
  });

  test('should show validation errors for invalid input', async ({ page }) => {
    await page.click('text=Sign Up');
    
    // Submit empty form
    await page.click('button[type="submit"]');
    
    // Check for validation errors
    await expect(page.locator('text=Name is required')).toBeVisible();
    await expect(page.locator('text=Email is required')).toBeVisible();
    await expect(page.locator('text=Password is required')).toBeVisible();
  });

  test('should show error for invalid email format', async ({ page }) => {
    await page.click('text=Sign Up');
    
    await page.fill('input[name="name"]', 'Test User');
    await page.fill('input[name="email"]', 'invalid-email');
    await page.fill('input[name="password"]', 'password123');
    await page.fill('input[name="confirmPassword"]', 'password123');
    
    await page.click('button[type="submit"]');
    
    await expect(page.locator('text=Invalid email format')).toBeVisible();
  });

  test('should show error for password mismatch', async ({ page }) => {
    await page.click('text=Sign Up');
    
    await page.fill('input[name="name"]', 'Test User');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.fill('input[name="confirmPassword"]', 'different-password');
    
    await page.click('button[type="submit"]');
    
    await expect(page.locator('text=Passwords do not match')).toBeVisible();
  });

  test('should logout successfully', async ({ page }) => {
    // First login
    await page.click('text=Login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    // Wait for dashboard
    await expect(page).toHaveURL(/.*dashboard/);
    
    // Click logout
    await page.click('text=Logout');
    
    // Should redirect to home page
    await expect(page).toHaveURL(/.*\/$/);
  });
});






