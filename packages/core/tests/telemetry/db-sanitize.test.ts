import { describe, expect, test } from 'bun:test';
import { extractSqlOperation, sanitizeSql } from '../../src/telemetry/db-sanitize';

describe('sanitizeSql', () => {
    test('redacts single-quoted strings', () => {
        const result = sanitizeSql("SELECT * FROM users WHERE name = 'Alice'");
        expect(result).not.toContain('Alice');
        expect(result).toContain('?');
        expect(result).toContain('SELECT');
    });

    test('redacts numeric literals', () => {
        const result = sanitizeSql('SELECT * FROM users WHERE id = 42');
        expect(result).not.toContain('42');
        expect(result).toContain('SELECT');
    });

    test('preserves SQL structure and placeholders', () => {
        const result = sanitizeSql('SELECT * FROM users WHERE id = ? AND name = ?');
        expect(result).toBe('SELECT * FROM users WHERE id = ? AND name = ?');
    });

    test('redacts double-quoted values', () => {
        const result = sanitizeSql('SELECT * FROM users WHERE name = "Bob"');
        expect(result).not.toContain('Bob');
    });

    test('handles empty input', () => {
        expect(sanitizeSql('')).toBe('');
    });

    test('handles SQL with no literals', () => {
        const sql = 'SELECT id, name FROM users';
        expect(sanitizeSql(sql)).toBe(sql);
    });

    test('redacts floating point numbers', () => {
        const result = sanitizeSql('SELECT * FROM products WHERE price = 19.99');
        expect(result).not.toContain('19.99');
        expect(result).toContain('SELECT');
    });

    test('redacts multiple string values', () => {
        const result = sanitizeSql("SELECT * FROM users WHERE first = 'Alice' AND last = 'Smith'");
        expect(result).not.toContain('Alice');
        expect(result).not.toContain('Smith');
    });
});

describe('extractSqlOperation', () => {
    test('returns uppercase SELECT', () => {
        expect(extractSqlOperation('SELECT * FROM users')).toBe('SELECT');
    });

    test('returns uppercase INSERT', () => {
        expect(extractSqlOperation('insert into users values (?)')).toBe('INSERT');
    });

    test('returns uppercase UPDATE', () => {
        expect(extractSqlOperation('  UPDATE users SET name = ?')).toBe('UPDATE');
    });

    test('returns uppercase DELETE', () => {
        expect(extractSqlOperation('DELETE FROM users')).toBe('DELETE');
    });

    test('returns uppercase CREATE', () => {
        expect(extractSqlOperation('CREATE TABLE users')).toBe('CREATE');
    });

    test('returns undefined for empty string', () => {
        expect(extractSqlOperation('')).toBeUndefined();
    });

    test('returns undefined for non-SQL text', () => {
        expect(extractSqlOperation('not sql')).toBeUndefined();
    });

    test('handles leading whitespace', () => {
        expect(extractSqlOperation('   SELECT 1')).toBe('SELECT');
    });
});
