import { describe, expect, test } from 'bun:test';
import { CORE_CONFIG } from '../src/config';

describe('CORE_CONFIG', () => {
    test('has expected db defaults', () => {
        expect(CORE_CONFIG.defaultDbPath).toBe('data/app.db');
    });

    test('has all SQLite pragmas', () => {
        const { pragmas } = CORE_CONFIG;
        expect(pragmas.journalMode).toContain('WAL');
        expect(pragmas.synchronous).toContain('NORMAL');
        expect(pragmas.foreignKeys).toContain('foreign_keys');
    });

    test('skill constraints match Zod schema limits', () => {
        const { skill } = CORE_CONFIG;
        expect(skill.nameMinLength).toBeGreaterThanOrEqual(1);
        expect(skill.nameMaxLength).toBeGreaterThan(skill.nameMinLength);
    });
});
