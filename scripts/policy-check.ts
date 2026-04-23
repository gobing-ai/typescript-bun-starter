#!/usr/bin/env bun
/**
 * Policy Driver - Reusable CLI for enforcing repository policies
 *
 * Single-file policy enforcement tool. Can be copied to any project.
 *
 * Usage:
 *   bun scripts/policy-check.ts                    # Run all policies
 *   bun scripts/policy-check.ts --policy db       # Run specific policy
 *   bun scripts/policy-check.ts --fix               # Apply fixes
 *   bun scripts/policy-check.ts --preview          # Preview fixes (dry-run)
 *   bun scripts/policy-check.ts --machine           # JSON output
 *   bun scripts/policy-check.ts --policy-dir ./pol # Custom policy directory
 *
 * Policy file format (JSON):
 *   {
 *     "id": "my-policy",
 *     "description": "What this policy enforces",
 *     "rationale": ["Why this matters"],
 *     "targets": ["src\/**\/*.ts"],
 *     "exclude": ["**\/*.test.ts"],
 *     "rules": [{
 *       "id": "no-banned-import",
 *       "engine": "rg",
 *       "message": "Don't use banned import",
 *       "severity": "error",
 *       "allow": ["src/whitelist.ts"],
 *       "match": { "kind": "rg", "pattern": "from 'banned'" }
 *     }]
 *   }
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { echo, echoError } from '@starter/core';

// =============================================================================
// Types
// =============================================================================

interface RgMatchSpec {
    kind: 'rg';
    pattern: string;
    flags?: string | undefined;
}

interface SgMatchSpec {
    kind: 'sg';
    pattern: string;
    rewrite?: string | undefined;
}

type MatchSpec = RgMatchSpec | SgMatchSpec;

interface FixSpec {
    mode: 'command' | 'rewrite';
    command?: string;
    replace?: string;
}

interface PolicyRule {
    id: string;
    engine: 'rg' | 'sg';
    message: string;
    severity?: 'error' | 'warning';
    allow?: string[];
    match: MatchSpec;
    fix?: FixSpec;
}

interface PolicyDocument {
    id: string;
    description: string;
    rationale?: string[];
    notes?: string[];
    targets: string[];
    include?: string[];
    exclude?: string[];
    rules: PolicyRule[];
}

interface Violation {
    policy: string;
    rule: string;
    file: string;
    line: number;
    message: string;
    severity: 'error' | 'warning';
    fixAvailable: boolean;
}

interface FixResult {
    rule: string;
    file: string;
    success: boolean;
    output?: string;
    error?: string;
}

interface Summary {
    total: number;
    errors: number;
    warnings: number;
    fixesApplied: number;
    fixesFailed: number;
    filesChecked: number;
    policies: number;
    exitCode: 0 | 1 | 2;
}

// =============================================================================
// Policy Loader (JSON)
// =============================================================================

function loadPolicy(path: string): PolicyDocument {
    const content = readFileSync(path, 'utf-8');
    const parsed = JSON.parse(content) as Record<string, unknown>;
    return validatePolicy(parsed, path);
}

function validatePolicy(raw: unknown, file: string): PolicyDocument {
    if (!raw || typeof raw !== 'object') {
        throw new Error(`Policy file "${file}" must be an object`);
    }

    const doc = raw as Record<string, unknown>;

    const id = validateString(doc, 'id', file);
    const description = validateString(doc, 'description', file);

    if (!Array.isArray(doc.targets) || doc.targets.length === 0) {
        throw new Error(`Policy "${file}" must have non-empty "targets" array`);
    }
    for (const t of doc.targets) {
        if (typeof t !== 'string') {
            throw new Error(`Policy "${file}" targets must be strings`);
        }
    }

    if (!Array.isArray(doc.rules) || doc.rules.length === 0) {
        throw new Error(`Policy "${file}" must have non-empty "rules" array`);
    }

    const rules = doc.rules.map((r, i) => validateRule(r, i, file));

    const result: PolicyDocument = {
        id,
        description,
        targets: doc.targets as string[],
        rules,
    };

    if (doc.rationale && Array.isArray(doc.rationale)) {
        result.rationale = doc.rationale as string[];
    }
    if (doc.notes && Array.isArray(doc.notes)) {
        result.notes = doc.notes as string[];
    }
    if (doc.include && Array.isArray(doc.include)) {
        result.include = doc.include as string[];
    }
    if (doc.exclude && Array.isArray(doc.exclude)) {
        result.exclude = doc.exclude as string[];
    }

    return result;
}

function validateRule(raw: unknown, index: number, file: string): PolicyRule {
    if (!raw || typeof raw !== 'object') {
        throw new Error(`Rule ${index} in "${file}" must be an object`);
    }

    const rule = raw as Record<string, unknown>;

    const id = validateString(rule, 'id', `${file}[${index}]`);
    const engine = rule.engine;
    if (engine !== 'rg' && engine !== 'sg') {
        throw new Error(`Rule "${id}" in "${file}" must have engine "rg" or "sg"`);
    }

    const message = validateString(rule, 'message', `${file}[${index}]`);

    const match = rule.match;
    if (!match || typeof match !== 'object') {
        throw new Error(`Rule "${id}" in "${file}" must have "match" object`);
    }

    const matchObj = match as Record<string, unknown>;
    const matchKind = matchObj.kind;
    if (matchKind !== 'rg' && matchKind !== 'sg') {
        throw new Error(`Rule "${id}" in "${file}" match.kind must be "rg" or "sg"`);
    }

    const pattern = validateString(matchObj, 'pattern', `${file}[${index}].match`);

    const result: PolicyRule = {
        id,
        engine,
        message,
        severity: (rule.severity as 'error' | 'warning') ?? 'error',
        match:
            matchKind === 'rg'
                ? { kind: 'rg', pattern, flags: matchObj.flags === undefined ? undefined : (matchObj.flags as string) }
                : {
                      kind: 'sg',
                      pattern,
                      rewrite: matchObj.rewrite === undefined ? undefined : (matchObj.rewrite as string),
                  },
    };

    if (rule.allow && Array.isArray(rule.allow)) {
        result.allow = rule.allow as string[];
    }

    // Validate fix if present
    if (rule.fix !== undefined) {
        if (!rule.fix || typeof rule.fix !== 'object') {
            throw new Error(`Rule "${id}" in "${file}" fix must be an object`);
        }
        const fixObj = rule.fix as Record<string, unknown>;
        const mode = fixObj.mode;
        if (mode !== 'command' && mode !== 'rewrite') {
            throw new Error(`Rule "${id}" in "${file}" fix.mode must be "command" or "rewrite"`);
        }
        const fix: FixSpec = { mode };
        if (mode === 'command') {
            if (typeof fixObj.command !== 'string') {
                throw new Error(`Rule "${id}" in "${file}" fix.command must be a string`);
            }
            fix.command = fixObj.command;
        }
        if (mode === 'rewrite') {
            if (typeof fixObj.replace !== 'string') {
                throw new Error(`Rule "${id}" in "${file}" fix.replace must be a string`);
            }
            fix.replace = fixObj.replace;
        }
        result.fix = fix;
    }

    return result;
}

function validateString(obj: Record<string, unknown>, field: string, path: string): string {
    const value = obj[field];
    if (typeof value !== 'string' || value.trim() === '') {
        throw new Error(`"${field}" in "${path}" must be a non-empty string`);
    }
    return value;
}

// =============================================================================
// Policy Engine
// =============================================================================

interface ExecuteOptions {
    cwd: string;
    fix: boolean;
    preview: boolean;
    failFast: boolean;
}

async function executePolicies(
    policyDir: string,
    selectedPolicies: string[],
    options: ExecuteOptions,
): Promise<{ violations: Violation[]; fixes: FixResult[]; summary: Summary; errors: string[] }> {
    const violations: Violation[] = [];
    const fixes: FixResult[] = [];
    const errors: string[] = [];
    const dirPath = resolve(options.cwd, policyDir);

    if (!existsSync(dirPath)) {
        return {
            violations,
            fixes,
            summary: emptySummary(),
            errors: [`Policy directory not found: ${dirPath}`],
        };
    }

    // Discover policy files
    let policyFiles: string[];
    if (selectedPolicies.length > 0) {
        policyFiles = [];
        for (const spec of selectedPolicies) {
            const directPath = resolve(spec);
            if (existsSync(directPath)) {
                policyFiles.push(directPath);
            } else {
                const withExt = resolve(dirPath, `${spec}.json`);
                if (existsSync(withExt)) {
                    policyFiles.push(withExt);
                } else {
                    errors.push(`Policy not found: ${spec}`);
                }
            }
        }
    } else {
        policyFiles = readdirSync(dirPath, { withFileTypes: true })
            .filter((e) => e.isFile() && e.name.endsWith('.json'))
            .map((e) => resolve(dirPath, e.name));
    }

    // Load policies
    const policies: PolicyDocument[] = [];
    for (const file of policyFiles) {
        try {
            policies.push(loadPolicy(file));
        } catch (error) {
            errors.push(`Failed to load ${file}: ${(error as Error).message}`);
        }
    }

    // Execute policies
    for (const policy of policies) {
        const result = executePolicy(policy, options);
        violations.push(...result.violations);
        fixes.push(...result.fixes);
        if (result.error && options.failFast) {
            errors.push(result.error);
            break;
        }
    }

    const summary = computeSummary(violations, fixes, policies.length);

    return { violations, fixes, summary, errors };
}

function executePolicy(
    policy: PolicyDocument,
    options: { cwd: string; fix: boolean; preview: boolean },
): { violations: Violation[]; fixes: FixResult[]; error?: string } {
    const violations: Violation[] = [];
    const fixes: FixResult[] = [];

    try {
        // Expand targets to files
        const files = discoverFiles(policy, options.cwd);

        for (const rule of policy.rules) {
            for (const file of files) {
                // Check allowlist
                if (rule.allow?.some((p) => file.endsWith(p) || file.includes(p))) {
                    continue;
                }

                if (rule.engine === 'rg') {
                    const spec = rule.match as RgMatchSpec;
                    const matches = executeRg(spec, file, options.cwd);

                    for (const match of matches) {
                        violations.push({
                            policy: policy.id,
                            rule: rule.id,
                            file: match.file,
                            line: match.line,
                            message: rule.message,
                            severity: rule.severity ?? 'error',
                            fixAvailable: !!rule.fix,
                        });

                        // Execute fix if enabled
                        if (options.fix && rule.fix && !options.preview) {
                            const fixResult = executeFix(rule, match.file, options);
                            fixes.push(fixResult);
                        }
                    }
                } else if (rule.engine === 'sg') {
                    // SG placeholder - report as warning
                    violations.push({
                        policy: policy.id,
                        rule: rule.id,
                        file,
                        line: 0,
                        message: `SG engine not yet implemented: ${rule.message}`,
                        severity: 'warning',
                        fixAvailable: false,
                    });
                }
            }
        }
    } catch (error) {
        return { violations, fixes, error: (error as Error).message };
    }

    return { violations, fixes };
}

function discoverFiles(policy: PolicyDocument, cwd: string): string[] {
    const files: Set<string> = new Set();

    for (const target of policy.targets) {
        // Target is relative to cwd, not absolute path
        const pattern = target;
        try {
            const matches = glob(pattern, policy.exclude, cwd);
            for (const file of matches) {
                if (policy.include && policy.include.length > 0) {
                    if (!policy.include.some((inc) => file.includes(inc))) continue;
                }
                files.add(file);
            }
        } catch {
            // Glob failed - skip this target
        }
    }

    return Array.from(files).sort();
}

function glob(pattern: string, exclude?: string[], cwd?: string): string[] {
    // Use rg --files for file discovery (rg handles glob patterns natively)
    const args = ['--files', '--glob', pattern];
    const baseDir = cwd ?? '.';

    try {
        const result = execFileSync('rg', args, { cwd: baseDir, encoding: 'utf-8' });
        let files = result
            .split('\n')
            .filter((f) => f.trim())
            .filter((f) => !f.includes('node_modules'))
            .map((f) => resolve(baseDir, f));

        // Filter by exclude patterns (handle ** glob patterns)
        if (exclude) {
            files = files.filter((f) => {
                // Get path relative to baseDir for matching
                const relativePath = f.startsWith(baseDir) ? f.slice(baseDir.length + 1) : f;
                for (const ex of exclude) {
                    // Normalize glob to regex:
                    // ** -> match anything including slashes -> [\s\S]*
                    // * -> match anything except slash -> [^/]*
                    const normalized = ex
                        .replace(/\\/g, '/')
                        .replace(/\*\*/g, '{{STARSTAR}}')
                        .replace(/\*/g, '{{STAR}}')
                        .replace(/\{\{STARSTAR\}\}/g, '[\\s\\S]*')
                        .replace(/\{\{STAR\}\}/g, '[^/]*');
                    const regex = new RegExp(`^${normalized}$`);
                    if (regex.test(relativePath)) return false;
                }
                return true;
            });
        }

        return files;
    } catch {
        return [];
    }
}

function executeRg(spec: RgMatchSpec, file: string, cwd: string): { file: string; line: number; text: string }[] {
    const args = ['--no-heading', '--with-filename', '--line-number', '--color=never'];
    if (spec.flags) {
        if (spec.flags.includes('i')) args.push('--ignore-case');
        if (spec.flags.includes('w')) args.push('--word-regexp');
    }
    args.push(spec.pattern, file);

    try {
        const result = execFileSync('rg', args, { cwd, encoding: 'utf-8', timeout: 30000 });
        return result
            .split('\n')
            .filter((l) => l.trim())
            .map((line) => {
                const parts = line.split(':');
                const filePart = parts[0] ?? file;
                const linePart = parseInt(parts[1] ?? '0', 10);
                return {
                    file: filePart,
                    line: linePart,
                    text: parts.slice(2).join(':'),
                };
            });
    } catch {
        return [];
    }
}

function executeFix(rule: PolicyRule, file: string, options: { cwd: string; preview: boolean }): FixResult {
    if (!rule.fix) {
        return { rule: rule.id, file, success: false, error: 'No fix defined' };
    }

    if (rule.fix.mode === 'command' && rule.fix.command) {
        const cmd = rule.fix.command.replace(/\{path\}/g, file).replace(/\{cwd\}/g, options.cwd);

        if (options.preview) {
            return { rule: rule.id, file, success: true, output: `[PREVIEW] Would execute: ${cmd}` };
        }

        try {
            const result = execFileSync('sh', ['-c', cmd], { cwd: options.cwd, encoding: 'utf-8', timeout: 60000 });
            return { rule: rule.id, file, success: true, output: result.trim() };
        } catch (error) {
            return { rule: rule.id, file, success: false, error: (error as Error).message };
        }
    }

    return { rule: rule.id, file, success: false, error: 'Rewrite mode not implemented' };
}

// =============================================================================
// Output Formatting
// =============================================================================

function formatViolation(v: Violation, color: boolean): string {
    const filePath = color ? `\x1b[33m${v.file}\x1b[0m` : v.file;
    const lineNum = color ? `\x1b[36m${v.line}\x1b[0m` : String(v.line);
    const severity =
        v.severity === 'error'
            ? color
                ? '\x1b[31merror\x1b[0m'
                : 'error'
            : color
              ? '\x1b[33mwarning\x1b[0m'
              : 'warning';
    const fixTag = v.fixAvailable ? (color ? ' \x1b[32m[fixable]\x1b[0m' : ' [fixable]') : '';

    return `[${filePath}:${lineNum}] ${v.rule} (${severity})${fixTag}\n  ${v.message}`;
}

function formatFixResult(f: FixResult, color: boolean): string {
    const status = f.success ? (color ? '\x1b[32m✓\x1b[0m' : '✓') : color ? '\x1b[31m✗\x1b[0m' : '✗';
    let output = `${status} ${f.rule} on ${f.file}`;
    if (f.output) output += f.success ? `\n  → ${f.output}` : '';
    if (f.error) output += color ? `\n  \x1b[31mError: ${f.error}\x1b[0m` : `\n  Error: ${f.error}`;
    return output;
}

function printReport(
    violations: Violation[],
    fixes: FixResult[],
    policies: string[],
    summary: Summary,
    color: boolean,
): void {
    console.log(`\nPolicies: ${policies.join(', ')}`);
    console.log('─'.repeat(60));

    if (violations.length > 0) {
        console.log('\nViolations:');
        for (const v of violations) {
            console.log(formatViolation(v, color));
        }
        console.log('');
    }

    if (fixes.length > 0) {
        console.log('\nFixes:');
        for (const f of fixes) {
            console.log(formatFixResult(f, color));
        }
        console.log('');
    }

    const errorCount = summary.errors + fixes.filter((f) => !f.success).length;
    const icon = errorCount > 0 ? (color ? '\x1b[31m✗\x1b[0m' : '✗') : color ? '\x1b[32m✓\x1b[0m' : '✓';

    console.log(`${icon} Summary:`);
    console.log(`  ${summary.total} violations (${summary.errors} errors, ${summary.warnings} warnings)`);
    console.log(`  ${summary.fixesApplied} fixes applied, ${summary.fixesFailed} fixes failed`);
    console.log(`  Checked ${summary.filesChecked} files across ${summary.policies} policies`);
}

function printJson(
    violations: Violation[],
    fixes: FixResult[],
    policies: string[],
    summary: Summary,
    errors: string[],
): void {
    console.log(
        JSON.stringify(
            {
                version: 1,
                timestamp: new Date().toISOString(),
                policies,
                violations,
                fixes,
                summary,
                errors,
                exitCode: summary.exitCode,
            },
            null,
            2,
        ),
    );
}

// =============================================================================
// Helpers
// =============================================================================

function computeSummary(violations: Violation[], fixes: FixResult[], policyCount: number): Summary {
    const errors = violations.filter((v) => v.severity === 'error').length;
    const warnings = violations.filter((v) => v.severity === 'warning').length;
    const fixesApplied = fixes.filter((f) => f.success).length;
    const fixesFailed = fixes.filter((f) => !f.success).length;
    const filesChecked = new Set(violations.map((v) => v.file)).size;

    return {
        total: violations.length,
        errors,
        warnings,
        fixesApplied,
        fixesFailed,
        filesChecked,
        policies: policyCount,
        exitCode: errors + fixesFailed > 0 ? 1 : violations.length > 0 ? 1 : 0,
    };
}

function emptySummary(): Summary {
    return {
        total: 0,
        errors: 0,
        warnings: 0,
        fixesApplied: 0,
        fixesFailed: 0,
        filesChecked: 0,
        policies: 0,
        exitCode: 0,
    };
}

// =============================================================================
// CLI Argument Parsing
// =============================================================================

interface Args {
    policy: string[];
    fix: boolean;
    preview: boolean;
    machine: boolean;
    policyDir: string;
    failFast: boolean;
    cwd: string;
    help: boolean;
}

function parseArgs(argv: string[]): Args {
    const args: Args = {
        policy: [],
        fix: false,
        preview: false,
        machine: false,
        policyDir: 'policies',
        failFast: false,
        cwd: process.cwd(),
        help: false,
    };

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--help' || arg === '-h') {
            args.help = true;
        } else if (arg === '--fix') {
            args.fix = true;
        } else if (arg === '--dry-run') {
            args.preview = true;
        } else if (arg === '--machine') {
            args.machine = true;
        } else if (arg === '--fail-fast') {
            args.failFast = true;
        } else if (arg === '--policy-dir' && i + 1 < argv.length) {
            args.policyDir = argv[++i] ?? 'policies';
        } else if (arg === '--cwd' && i + 1 < argv.length) {
            args.cwd = argv[++i] ?? process.cwd();
        } else if ((arg === '-p' || arg === '--policy') && i + 1 < argv.length) {
            const value = argv[++i];
            if (value !== undefined) args.policy.push(value);
        } else if (arg !== undefined && !arg.startsWith('-')) {
            const value = argv[i];
            if (value !== undefined) args.policy.push(value);
        }
    }

    return args;
}

function printUsage(): void {
    console.log(`
Policy Driver - Reusable CLI for enforcing repository policies

Usage:
  bun scripts/policy-check.ts [options]

Options:
  -p, --policy <name>    Policy to run (can be specified multiple times)
                         If not specified, runs all policies in --policy-dir
  --fix                  Apply safe fixes where available
  --dry-run             Preview fixes without applying them
  --machine              Machine-readable JSON output
  --policy-dir <path>    Directory containing policy files (default: policies)
  --fail-fast            Stop on first policy error
  --cwd <path>           Working directory (default: current directory)
  -h, --help             Show this help message

Policy File Format (JSON):
  {
    "id": "my-policy",
    "description": "What this policy enforces",
    "rationale": ["Why this matters"],
    "targets": ["src/**/*.ts"],
    "exclude": ["**/*.test.ts"],
    "rules": [{
      "id": "no-banned-import",
      "engine": "rg",
      "message": "Don't use banned import",
      "severity": "error",
      "allow": ["src/whitelist.ts"],
      "match": { "kind": "rg", "pattern": "from 'banned'" }
    }]
  }

Examples:
  # Run all policies
  bun scripts/policy-check.ts

  # Run specific policy
  bun scripts/policy-check.ts --policy db-boundaries

  # Preview fixes
  bun scripts/policy-check.ts --fix --dry-run

  # Apply fixes
  bun scripts/policy-check.ts --fix

  # JSON output for scripts
  bun scripts/policy-check.ts --machine
`);
}

// =============================================================================
// Main
// =============================================================================

const args = parseArgs(process.argv.slice(2));

if (args.help) {
    printUsage();
    process.exit(0);
}

executePolicies(args.policyDir, args.policy, {
    cwd: args.cwd,
    fix: args.fix,
    preview: args.preview,
    failFast: args.failFast,
})
    .then(({ violations, fixes, summary, errors }) => {
        // Print errors
        for (const error of errors) {
            echoError(`[error] ${error}`);
        }

        if (violations.length === 0 && errors.length === 0 && fixes.length === 0) {
            echo('No violations found.');
        }

        if (args.machine) {
            const policyIds = violations.length > 0 ? [...new Set(violations.map((v) => v.policy))] : [];
            printJson(violations, fixes, policyIds, summary, errors);
        } else {
            const color = process.stdout.isTTY;
            const policyIds = violations.length > 0 ? [...new Set(violations.map((v) => v.policy))] : [];
            printReport(violations, fixes, policyIds, summary, color);
        }

        process.exit(summary.exitCode);
    })
    .catch((error) => {
        echoError(`Fatal error: ${error.message}`);
        process.exit(1);
    });
