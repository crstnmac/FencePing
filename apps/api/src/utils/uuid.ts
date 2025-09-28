import { v4 as uuidv4 } from 'uuid';

/**
 * Check if a string is a valid UUID format
 */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Generate a new UUID
 */
export function generateUUID(): string {
  return uuidv4();
}

/**
 * Convert a Better Auth user ID to a UUID if needed
 * For now, we'll map non-UUID user IDs to UUIDs and store the mapping
 */
const userIdMapping = new Map<string, string>();

export function ensureUserUUID(betterAuthUserId: string): string {
  // If it's already a valid UUID, return it
  if (isValidUUID(betterAuthUserId)) {
    return betterAuthUserId;
  }

  // Check if we already have a mapping for this user ID
  if (userIdMapping.has(betterAuthUserId)) {
    return userIdMapping.get(betterAuthUserId)!;
  }

  // Generate a new UUID for this user ID and store the mapping
  const uuid = generateUUID();
  userIdMapping.set(betterAuthUserId, uuid);

  console.warn(`Mapped Better Auth user ID ${betterAuthUserId} to UUID ${uuid}`);
  return uuid;
}

/**
 * Validate and sanitize UUID input for database operations
 */
export function validateUUID(uuid: string, fieldName: string = 'id'): string {
  if (!uuid) {
    throw new Error(`${fieldName} is required`);
  }

  if (!isValidUUID(uuid)) {
    throw new Error(`${fieldName} must be a valid UUID format`);
  }

  return uuid;
}