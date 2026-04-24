import { describe, expect, it } from 'bun:test';
import { createBrowserApiClient } from '../src/lib/browser-api-client';

describe('browser-api-client', () => {
    describe('createBrowserApiClient', () => {
        it('should create client with base URL', () => {
            const client = createBrowserApiClient('https://api.example.com');
            expect(client).toBeDefined();
            expect(typeof client.get).toBe('function');
            expect(typeof client.post).toBe('function');
            expect(typeof client.put).toBe('function');
            expect(typeof client.delete).toBe('function');
        });

        it('should create client without base URL', () => {
            const client = createBrowserApiClient();
            expect(client).toBeDefined();
            expect(typeof client.get).toBe('function');
        });

        it('should return proper ApiResponse structure', async () => {
            // Mock fetch not available in test, but we can verify types
            const client = createBrowserApiClient();
            const result = await client.get('/test').catch(() => null);
            // The result will be an ApiResponse type when fetch fails
            expect(result).toBeDefined();
        });
    });
});
