import crypto from 'crypto';

/**
 * Character set for short IDs
 * Excludes ambiguous characters: 0, O, I, l, 1
 * Total: 57 characters for good entropy
 */
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
const ID_LENGTH = 8;

/**
 * Generate a random short ID
 * @returns 8-character alphanumeric string
 */
export function generateShortId(): string {
  const randomBytes = crypto.randomBytes(ID_LENGTH);
  let result = '';
  
  for (let i = 0; i < ID_LENGTH; i++) {
    result += CHARS[randomBytes[i] % CHARS.length];
  }
  
  return result;
}

/**
 * Generate a unique short ID with collision detection
 * @param checkExists Function to check if ID already exists
 * @param maxRetries Maximum number of retries before giving up
 * @returns Unique short ID
 * @throws Error if unable to generate unique ID after max retries
 */
export async function generateUniqueShortId(
  checkExists: (id: string) => Promise<boolean>,
  maxRetries: number = 5
): Promise<string> {
  for (let i = 0; i < maxRetries; i++) {
    const id = generateShortId();
    const exists = await checkExists(id);
    
    if (!exists) {
      return id;
    }
    
    // Log collision for monitoring
    console.warn(`Short ID collision detected: ${id}, retrying... (attempt ${i + 1}/${maxRetries})`);
  }
  
  throw new Error(`Failed to generate unique short ID after ${maxRetries} retries`);
}

/**
 * Validate short ID format
 * @param id Short ID to validate
 * @returns true if valid, false otherwise
 */
export function isValidShortId(id: string): boolean {
  if (id.length !== ID_LENGTH) {
    return false;
  }
  
  for (const char of id) {
    if (!CHARS.includes(char)) {
      return false;
    }
  }
  
  return true;
}


