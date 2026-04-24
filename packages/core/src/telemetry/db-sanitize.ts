/**
 * SQL sanitization for debug-mode DB statement capture.
 *
 * Strips parameter values, string literals, numeric literals, and
 * identifier-specific data from SQL text before it is attached to spans.
 * Only low-cardinality structural metadata survives.
 *
 * @example
 * ```ts
 * sanitizeSql('SELECT * FROM users WHERE id = ? AND name = "Alice"')
 * // => 'SELECT * FROM users WHERE id = ? AND name = ?'
 * ```
 */

/**
 * Redact string literals ('...', "...") and numeric literals from SQL text.
 *
 * Replaces quoted strings with `?` and standalone numbers with `?`.
 * Preserves SQL structure, keywords, placeholders, and table/column names.
 */
export function sanitizeSql(sql: string): string {
    let result = sql;

    // Redact single-quoted strings
    result = result.replace(/'[^']*'/g, '?');

    // Redact double-quoted identifiers used as values (rare but safe)
    result = result.replace(/"[^"]*"/g, '?');

    // Redact standalone numeric literals (not part of identifiers)
    result = result.replace(/\b\d+(\.\d+)?\b/g, '?');

    return result;
}

/**
 * Extract the SQL operation keyword (SELECT, INSERT, UPDATE, DELETE, etc.)
 * from a SQL statement. Returns uppercase or undefined.
 */
export function extractSqlOperation(sql: string): string | undefined {
    const match = sql.trim().match(/^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|PRAGMA)\b/i);
    return match?.[1]?.toUpperCase();
}
