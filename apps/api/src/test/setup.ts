import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.test' });

beforeAll(async () => {
  // Setup test database or mocks
});

afterAll(async () => {
  // Cleanup test database or mocks
});

beforeEach(() => {
  // Reset state before each test
});

afterEach(() => {
  // Cleanup after each test
});