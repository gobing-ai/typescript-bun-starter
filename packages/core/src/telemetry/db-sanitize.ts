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
 *
 * Handles SQL `''` and `""` escape sequences inside literals so values like
 * `'O''Brien'` are fully redacted to a single `?` rather than leaking
 * fragments between the doubled quotes.
 */
export function sanitizeSql(sql: string): string {
    let result = '';
    let i = 0;
    const len = sql.length;

    while (i < len) {
        const code = sql.charCodeAt(i);

        // Quote characters: ' (39) or " (34)
        if (code === 39 || code === 34) {
            // Walk the literal, recognizing the SQL `''` / `""` escape rule:
            // a doubled quote inside a literal is data, not the terminator.
            const quote = code;
            i++;
            while (i < len) {
                if (sql.charCodeAt(i) === quote) {
                    if (sql.charCodeAt(i + 1) === quote) {
                        i += 2; // escaped doubled quote — still inside literal
                        continue;
                    }
                    i++; // closing quote
                    break;
                }
                i++;
            }
            result += '?';
            continue;
        }

        // Numeric literal: only when the preceding char isn't part of an identifier.
        // Mirrors the original `\b\d+(\.\d+)?\b` semantics.
        if (code >= 48 && code <= 57) {
            const prev = result.length > 0 ? result.charCodeAt(result.length - 1) : 0;
            const isIdentifierContinuation =
                (prev >= 65 && prev <= 90) || (prev >= 97 && prev <= 122) || prev === 95 || (prev >= 48 && prev <= 57);

            if (!isIdentifierContinuation) {
                while (i < len) {
                    const c = sql.charCodeAt(i);
                    if (c < 48 || c > 57) break;
                    i++;
                }
                if (i < len && sql.charCodeAt(i) === 46 && i + 1 < len) {
                    const next = sql.charCodeAt(i + 1);
                    if (next >= 48 && next <= 57) {
                        i++;
                        while (i < len) {
                            const c = sql.charCodeAt(i);
                            if (c < 48 || c > 57) break;
                            i++;
                        }
                    }
                }
                result += '?';
                continue;
            }
        }

        result += sql[i] ?? '';
        i++;
    }

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
