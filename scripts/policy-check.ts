#!/usr/bin/env bun
/**
 * Policy Driver - Reusable CLI for enforcing repository policies.
 *
 * This file is intentionally self-contained so it can be copied into another
 * project without dragging in additional repo-specific runtime dependencies.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { echo, echoError } from '@starter/core';

export interface RgMatchSpec {
    kind: 'rg';
    pattern: string;
    flags?: string | undefined;
}

export interface SgMatchSpec {
    kind: 'sg';
    pattern: string;
    rewrite?: string | undefined;
}

export type MatchSpec = RgMatchSpec | SgMatchSpec;

export interface FixSpec {
    mode: 'command' | 'rewrite';
    command?: string | undefined;
    replace?: string | undefined;
}

export interface PolicyRule {
    id: string;
    engine: 'rg' | 'sg';
    message: string;
    severity?: 'error' | 'warning';
    allow?: string[];
    match: MatchSpec;
    fix?: FixSpec;
}

export interface PolicyDocument {
    id: string;
    description: string;
    rationale?: string[];
    notes?: string[];
    targets: string[];
    include?: string[];
    exclude?: string[];
    rules: PolicyRule[];
}

export interface Violation {
    policy: string;
    rule: string;
    file: string;
    line: number;
    message: string;
    severity: 'error' | 'warning';
    fixAvailable: boolean;
}

export interface FixResult {
    rule: string;
    file: string;
    success: boolean;
    output?: string;
    error?: string;
}

export interface Summary {
    total: number;
    errors: number;
    warnings: number;
    fixesApplied: number;
    fixesFailed: number;
    filesChecked: number;
    policies: number;
    engineErrors: number;
    exitCode: 0 | 1;
}

interface RgResult {
    matches: Array<{ file: string; line: number; text: string }>;
    error?: string;
}

interface FileDiscoveryResult {
    files: string[];
    error?: string;
}

export interface ExecuteOptions {
    cwd: string;
    fix: boolean;
    preview: boolean;
    failFast: boolean;
}

export interface ExecutePoliciesResult {
    violations: Violation[];
    fixes: FixResult[];
    summary: Summary;
    errors: string[];
    policyIds: string[];
}

interface ExecutePolicyResult {
    violations: Violation[];
    fixes: FixResult[];
    errors: string[];
    checkedFiles: number;
}

export interface Args {
    policy: string[];
    fix: boolean;
    preview: boolean;
    machine: boolean;
    policyDir: string;
    failFast: boolean;
    cwd: string;
    help: boolean;
}

export function loadPolicy(path: string): PolicyDocument {
    const content = readFileSync(path, 'utf-8');
    const parsed = JSON.parse(content) as Record<string, unknown>;
    return validatePolicy(parsed, path);
}

export function validatePolicy(raw: unknown, file: string): PolicyDocument {
    if (!raw || typeof raw !== 'object') {
        throw new Error(`Policy file "${file}" must be an object`);
    }

    const doc = raw as Record<string, unknown>;

    const id = validateString(doc, 'id', file);
    const description = validateString(doc, 'description', file);

    if (!Array.isArray(doc.targets) || doc.targets.length === 0) {
        throw new Error(`Policy "${file}" must have non-empty "targets" array`);
    }

    if (!Array.isArray(doc.rules) || doc.rules.length === 0) {
        throw new Error(`Policy "${file}" must have non-empty "rules" array`);
    }

    const result: PolicyDocument = {
        id,
        description,
        targets: validateStringArray(doc.targets, `${file}.targets`),
        rules: doc.rules.map((rule, index) => validateRule(rule, index, file)),
    };

    if (doc.rationale !== undefined) {
        result.rationale = validateStringArray(doc.rationale, `${file}.rationale`);
    }

    if (doc.notes !== undefined) {
        result.notes = validateStringArray(doc.notes, `${file}.notes`);
    }

    if (doc.include !== undefined) {
        result.include = validateStringArray(doc.include, `${file}.include`);
    }

    if (doc.exclude !== undefined) {
        result.exclude = validateStringArray(doc.exclude, `${file}.exclude`);
    }

    return result;
}

function validateRule(raw: unknown, index: number, file: string): PolicyRule {
    if (!raw || typeof raw !== 'object') {
        throw new Error(`Rule ${index} in "${file}" must be an object`);
    }

    const rule = raw as Record<string, unknown>;
    const context = `${file}[${index}]`;
    const id = validateString(rule, 'id', context);
    const message = validateString(rule, 'message', context);

    const engine = rule.engine;
    if (engine !== 'rg' && engine !== 'sg') {
        throw new Error(`Rule "${id}" in "${file}" must have engine "rg" or "sg"`);
    }

    const match = rule.match;
    if (!match || typeof match !== 'object') {
        throw new Error(`Rule "${id}" in "${file}" must have "match" object`);
    }

    const matchObj = match as Record<string, unknown>;
    const matchKind = matchObj.kind;
    if (matchKind !== 'rg' && matchKind !== 'sg') {
        throw new Error(`Rule "${id}" in "${file}" match.kind must be "rg" or "sg"`);
    }

    if (matchKind !== engine) {
        throw new Error(`Rule "${id}" in "${file}" must align engine "${engine}" with match.kind "${matchKind}"`);
    }

    const policyRule: PolicyRule = {
        id,
        engine,
        message,
        severity: rule.severity === 'warning' ? 'warning' : 'error',
        match:
            matchKind === 'rg'
                ? {
                      kind: 'rg',
                      pattern: validateString(matchObj, 'pattern', `${context}.match`),
                      flags:
                          matchObj.flags === undefined
                              ? undefined
                              : validateOptionalString(matchObj.flags, `${context}.match.flags`),
                  }
                : {
                      kind: 'sg',
                      pattern: validateString(matchObj, 'pattern', `${context}.match`),
                      rewrite:
                          matchObj.rewrite === undefined
                              ? undefined
                              : validateOptionalString(matchObj.rewrite, `${context}.match.rewrite`),
                  },
    };

    if (rule.allow !== undefined) {
        policyRule.allow = validateStringArray(rule.allow, `${context}.allow`);
    }

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
            fix.command = validateString(fixObj, 'command', `${context}.fix`);
        } else {
            fix.replace = validateString(fixObj, 'replace', `${context}.fix`);
        }
        policyRule.fix = fix;
    }

    return policyRule;
}

function validateString(obj: Record<string, unknown>, field: string, path: string): string {
    return validateOptionalString(obj[field], `${path}.${field}`);
}

function validateOptionalString(value: unknown, path: string): string {
    if (typeof value !== 'string' || value.trim() === '') {
        throw new Error(`"${path}" must be a non-empty string`);
    }

    return value;
}

function validateStringArray(value: unknown, path: string): string[] {
    if (!Array.isArray(value) || value.length === 0) {
        throw new Error(`"${path}" must be a non-empty string array`);
    }

    for (const entry of value) {
        if (typeof entry !== 'string' || entry.trim() === '') {
            throw new Error(`"${path}" must contain only non-empty strings`);
        }
    }

    return [...value];
}

export async function executePolicies(
    policyDir: string,
    selectedPolicies: string[],
    options: ExecuteOptions,
): Promise<ExecutePoliciesResult> {
    const violations: Violation[] = [];
    const fixes: FixResult[] = [];
    const errors: string[] = [];
    const dirPath = resolve(options.cwd, policyDir);

    if (!existsSync(dirPath)) {
        return {
            violations,
            fixes,
            summary: computeSummary(violations, fixes, 0, 0, 1),
            errors: [`Policy directory not found: ${dirPath}`],
            policyIds: [],
        };
    }

    const policyFiles = discoverPolicyFiles(dirPath, selectedPolicies, options.cwd, errors);
    const policies: PolicyDocument[] = [];
    for (const file of policyFiles) {
        try {
            policies.push(loadPolicy(file));
        } catch (error) {
            errors.push(`Failed to load ${file}: ${(error as Error).message}`);
            if (options.failFast) {
                break;
            }
        }
    }

    let filesChecked = 0;
    for (const policy of policies) {
        const result = executePolicy(policy, options);
        violations.push(...result.violations);
        fixes.push(...result.fixes);
        errors.push(...result.errors);
        filesChecked += result.checkedFiles;

        if (options.failFast && result.errors.length > 0) {
            break;
        }
    }

    const summary = computeSummary(violations, fixes, policies.length, filesChecked, errors.length);
    return { violations, fixes, summary, errors, policyIds: policies.map((policy) => policy.id) };
}

function discoverPolicyFiles(dirPath: string, selectedPolicies: string[], cwd: string, errors: string[]): string[] {
    if (selectedPolicies.length === 0) {
        return readdirSync(dirPath, { withFileTypes: true })
            .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
            .map((entry) => resolve(dirPath, entry.name))
            .sort();
    }

    const policyFiles: string[] = [];
    for (const spec of selectedPolicies) {
        const directPath = resolve(cwd, spec);
        if (existsSync(directPath)) {
            policyFiles.push(directPath);
            continue;
        }

        const withExt = resolve(dirPath, `${spec}.json`);
        if (existsSync(withExt)) {
            policyFiles.push(withExt);
            continue;
        }

        errors.push(`Policy not found: ${spec}`);
    }

    return policyFiles;
}

export function executePolicy(policy: PolicyDocument, options: ExecuteOptions): ExecutePolicyResult {
    const violations: Violation[] = [];
    const fixes: FixResult[] = [];
    const errors: string[] = [];
    const discovery = discoverFiles(policy, options.cwd);

    if (discovery.error) {
        errors.push(`Policy "${policy.id}" file discovery failed: ${discovery.error}`);
        return {
            violations,
            fixes,
            errors,
            checkedFiles: 0,
        };
    }

    for (const rule of policy.rules) {
        if (rule.engine === 'sg') {
            errors.push(`Policy "${policy.id}" rule "${rule.id}" uses unsupported engine "sg"`);
            continue;
        }

        const fixedFiles = new Set<string>();

        for (const file of discovery.files) {
            const relativeFile = toRelativePath(options.cwd, file);

            if (matchesAnyPattern(relativeFile, rule.allow)) {
                continue;
            }

            const result = executeRg(rule.match, file, options.cwd);
            if (result.error) {
                errors.push(`Policy "${policy.id}" rule "${rule.id}" failed: ${result.error}`);
                break;
            }

            for (const match of result.matches) {
                violations.push({
                    policy: policy.id,
                    rule: rule.id,
                    file: match.file,
                    line: match.line,
                    message: rule.message,
                    severity: rule.severity ?? 'error',
                    fixAvailable: !!rule.fix,
                });

                if (options.fix && rule.fix && !fixedFiles.has(match.file)) {
                    fixes.push(executeFix(rule, match.file, options));
                    fixedFiles.add(match.file);
                }
            }
        }
    }

    return {
        violations,
        fixes,
        errors,
        checkedFiles: discovery.files.length,
    };
}

export function discoverFiles(policy: PolicyDocument, cwd: string): FileDiscoveryResult {
    const files = new Set<string>();

    for (const target of policy.targets) {
        const result = globFiles(target, policy.exclude, cwd);
        if (result.error) {
            return { files: [], error: result.error };
        }

        for (const file of result.files) {
            const relativeFile = toRelativePath(cwd, file);
            if (policy.include && !matchesAnyPattern(relativeFile, policy.include)) {
                continue;
            }
            files.add(file);
        }
    }

    return { files: [...files].sort() };
}

export function globFiles(pattern: string, exclude: string[] | undefined, cwd: string): FileDiscoveryResult {
    const args = ['--files', '--glob', pattern];
    for (const excluded of exclude ?? []) {
        args.push('--glob', `!${excluded}`);
    }

    try {
        const output = execFileSync('rg', args, { cwd, encoding: 'utf-8', timeout: 30000 });
        const files = output
            .split('\n')
            .filter((line) => line.trim() !== '')
            .map((line) => resolve(cwd, line));
        return { files };
    } catch (error) {
        if (isNoMatchError(error)) {
            return { files: [] };
        }

        return { files: [], error: extractExecError(error) };
    }
}

export function executeRg(spec: MatchSpec, file: string, cwd: string): RgResult {
    if (spec.kind !== 'rg') {
        return { matches: [], error: `Unsupported match kind "${spec.kind}" for rg execution` };
    }

    const args = ['--no-heading', '--with-filename', '--line-number', '--color=never'];
    if (spec.flags) {
        if (spec.flags.includes('i')) {
            args.push('--ignore-case');
        }
        if (spec.flags.includes('w')) {
            args.push('--word-regexp');
        }
    }
    args.push(spec.pattern, file);

    try {
        const output = execFileSync('rg', args, { cwd, encoding: 'utf-8', timeout: 30000 });
        const matches = output
            .split('\n')
            .filter((line) => line.trim() !== '')
            .map((line) => {
                const parts = line.split(':');
                const filePart = parts[0] ?? file;
                const linePart = Number.parseInt(parts[1] ?? '0', 10);
                return {
                    file: resolve(cwd, filePart),
                    line: Number.isNaN(linePart) ? 0 : linePart,
                    text: parts.slice(2).join(':'),
                };
            });

        return { matches };
    } catch (error) {
        if (isNoMatchError(error)) {
            return { matches: [] };
        }

        return { matches: [], error: extractExecError(error) };
    }
}

export function executeFix(
    rule: PolicyRule,
    file: string,
    options: Pick<ExecuteOptions, 'cwd' | 'preview'>,
): FixResult {
    if (!rule.fix) {
        return { rule: rule.id, file, success: false, error: 'No fix defined' };
    }

    if (rule.fix.mode === 'rewrite') {
        return executeRewriteFix(rule, file, options.preview);
    }

    if (!rule.fix.command) {
        return { rule: rule.id, file, success: false, error: 'Command fix missing command string' };
    }

    const argv = splitCommand(rule.fix.command).map((token) =>
        token.replaceAll('{path}', file).replaceAll('{cwd}', options.cwd),
    );

    if (argv.length === 0) {
        return { rule: rule.id, file, success: false, error: 'Command fix resolved to an empty command' };
    }

    if (options.preview) {
        return { rule: rule.id, file, success: true, output: `[PREVIEW] Would execute: ${argv.join(' ')}` };
    }

    try {
        const command = argv[0];
        if (!command) {
            return { rule: rule.id, file, success: false, error: 'Command fix resolved to an empty command' };
        }
        const output = execFileSync(command, argv.slice(1), {
            cwd: options.cwd,
            encoding: 'utf-8',
            timeout: 60000,
        });
        return { rule: rule.id, file, success: true, output: output.trim() };
    } catch (error) {
        return { rule: rule.id, file, success: false, error: extractExecError(error) };
    }
}

export function executeRewriteFix(rule: PolicyRule, file: string, preview: boolean): FixResult {
    if (!rule.fix?.replace) {
        return { rule: rule.id, file, success: false, error: 'Rewrite fix missing replacement' };
    }

    if (rule.match.kind !== 'rg') {
        return { rule: rule.id, file, success: false, error: 'Rewrite mode currently supports rg rules only' };
    }

    let regex: RegExp;
    try {
        regex = new RegExp(rule.match.pattern, buildRegexFlags(rule.match.flags));
    } catch (error) {
        return { rule: rule.id, file, success: false, error: `Invalid rewrite regex: ${(error as Error).message}` };
    }

    const original = readFileSync(file, 'utf-8');
    const updated = original.replace(regex, rule.fix.replace);
    if (updated === original) {
        return { rule: rule.id, file, success: false, error: 'Rewrite fix made no changes' };
    }

    if (preview) {
        return { rule: rule.id, file, success: true, output: `[PREVIEW] Would rewrite ${toDisplayPath(file)}` };
    }

    writeFileSync(file, updated);
    return { rule: rule.id, file, success: true, output: `Rewrote ${toDisplayPath(file)}` };
}

export function buildRegexFlags(flags?: string): string {
    const result = new Set(['g']);
    if (flags?.includes('i')) {
        result.add('i');
    }
    if (flags?.includes('m')) {
        result.add('m');
    }
    return [...result].join('');
}

export function splitCommand(command: string): string[] {
    const tokens: string[] = [];
    let current = '';
    let quote: "'" | '"' | null = null;
    let escaping = false;
    let tokenStarted = false;

    for (const char of command) {
        if (escaping) {
            current += char;
            escaping = false;
            tokenStarted = true;
            continue;
        }

        if (char === '\\') {
            escaping = true;
            continue;
        }

        if (quote) {
            if (char === quote) {
                quote = null;
            } else {
                current += char;
            }
            tokenStarted = true;
            continue;
        }

        if (char === "'" || char === '"') {
            quote = char;
            tokenStarted = true;
            continue;
        }

        if (/\s/.test(char)) {
            if (current !== '' || tokenStarted) {
                tokens.push(current);
                current = '';
                tokenStarted = false;
            }
            continue;
        }

        current += char;
        tokenStarted = true;
    }

    if (quote) {
        throw new Error(`Unterminated quote in command: ${command}`);
    }

    if (escaping) {
        current += '\\';
    }

    if (current !== '' || tokenStarted) {
        tokens.push(current);
    }

    return tokens;
}

export function matchesAnyPattern(path: string, patterns?: string[]): boolean {
    return patterns?.some((pattern) => matchesGlob(path, pattern)) ?? false;
}

export function matchesGlob(path: string, pattern: string): boolean {
    const normalizedPath = normalizePath(path);
    const normalizedPattern = normalizePath(pattern)
        .replace(/\*\*/g, '::DOUBLE_STAR::')
        .replace(/\*/g, '::STAR::')
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/::DOUBLE_STAR::/g, '.*')
        .replace(/::STAR::/g, '[^/]*');

    return new RegExp(`^${normalizedPattern}$`).test(normalizedPath);
}

export function normalizePath(path: string): string {
    return path.replaceAll('\\', '/');
}

export function toRelativePath(cwd: string, file: string): string {
    return normalizePath(relative(cwd, file));
}

export function toDisplayPath(file: string): string {
    return normalizePath(file);
}

export function isNoMatchError(error: unknown): boolean {
    return (
        typeof error === 'object' && error !== null && 'status' in error && (error as { status?: number }).status === 1
    );
}

export function extractExecError(error: unknown): string {
    if (typeof error !== 'object' || error === null) {
        return String(error);
    }

    const stderr = (error as { stderr?: string | Uint8Array }).stderr;
    if (typeof stderr === 'string' && stderr.trim() !== '') {
        return stderr.trim();
    }

    if (stderr instanceof Uint8Array && stderr.length > 0) {
        return Buffer.from(stderr).toString().trim();
    }

    const message = (error as Error).message;
    return message;
}

export function formatViolation(violation: Violation, color: boolean): string {
    const filePath = color ? `\x1b[33m${violation.file}\x1b[0m` : violation.file;
    const lineNum = color ? `\x1b[36m${violation.line}\x1b[0m` : String(violation.line);
    const severity =
        violation.severity === 'error'
            ? color
                ? '\x1b[31merror\x1b[0m'
                : 'error'
            : color
              ? '\x1b[33mwarning\x1b[0m'
              : 'warning';
    const fixTag = violation.fixAvailable ? (color ? ' \x1b[32m[fixable]\x1b[0m' : ' [fixable]') : '';

    return `[${filePath}:${lineNum}] ${violation.rule} (${severity})${fixTag}\n  ${violation.message}`;
}

export function formatFixResult(fix: FixResult, color: boolean): string {
    const status = fix.success ? (color ? '\x1b[32m✓\x1b[0m' : '✓') : color ? '\x1b[31m✗\x1b[0m' : '✗';
    let output = `${status} ${fix.rule} on ${fix.file}`;
    if (fix.output) {
        output += `\n  → ${fix.output}`;
    }
    if (fix.error) {
        output += color ? `\n  \x1b[31mError: ${fix.error}\x1b[0m` : `\n  Error: ${fix.error}`;
    }
    return output;
}

export function printReport(
    violations: Violation[],
    fixes: FixResult[],
    policies: string[],
    summary: Summary,
    errors: string[],
    color: boolean,
): void {
    echo(`Policies: ${policies.join(', ') || '(none)'}`);
    echo('─'.repeat(60));

    if (errors.length > 0) {
        echo('');
        echo('Errors:');
        for (const error of errors) {
            echoError(`- ${error}`);
        }
        echo('');
    }

    const violationsByPolicy = new Map<string, Violation[]>();
    for (const violation of violations) {
        const existing = violationsByPolicy.get(violation.policy) ?? [];
        existing.push(violation);
        violationsByPolicy.set(violation.policy, existing);
    }

    const failedPolicies = [...violationsByPolicy.keys()];
    if (failedPolicies.length > 0) {
        echo('');
        echo('Failed policies:');
        for (const policy of failedPolicies) {
            const policyViolations = violationsByPolicy.get(policy) ?? [];
            const errorsForPolicy = policyViolations.filter((violation) => violation.severity === 'error').length;
            const warningsForPolicy = policyViolations.filter((violation) => violation.severity === 'warning').length;
            echo(
                `  ${color ? '\x1b[31m✗\x1b[0m' : '✗'} ${policy}: ${policyViolations.length} violation(s) (${errorsForPolicy} errors, ${warningsForPolicy} warnings)`,
            );
        }
        echo('');
        echo('Violations:');
        for (const violation of violations) {
            echo(formatViolation(violation, color));
        }
        echo('');
    }

    const passedPolicies = policies.filter((policy) => !failedPolicies.includes(policy));
    if (passedPolicies.length > 0) {
        echo('Passed policies:');
        for (const policy of passedPolicies) {
            echo(`  ${color ? '\x1b[32m✓\x1b[0m' : '✓'} ${policy}`);
        }
        echo('');
    }

    if (fixes.length > 0) {
        echo('Fixes:');
        for (const fix of fixes) {
            echo(formatFixResult(fix, color));
        }
        echo('');
    }

    const icon = summary.exitCode === 0 ? (color ? '\x1b[32m✓\x1b[0m' : '✓') : color ? '\x1b[31m✗\x1b[0m' : '✗';
    echo(`${icon} Summary:`);
    echo(`  ${summary.total} violations (${summary.errors} errors, ${summary.warnings} warnings)`);
    echo(`  ${summary.engineErrors} execution/load errors`);
    echo(`  ${summary.fixesApplied} fixes applied, ${summary.fixesFailed} fixes failed`);
    echo(`  Checked ${summary.filesChecked} files across ${summary.policies} policies`);
    echo(`  ${passedPolicies.length}/${summary.policies} policies passed`);
}

export function printJson(
    violations: Violation[],
    fixes: FixResult[],
    policies: string[],
    summary: Summary,
    errors: string[],
): void {
    process.stdout.write(
        `${JSON.stringify(
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
        )}\n`,
    );
}

export function computeSummary(
    violations: Violation[],
    fixes: FixResult[],
    policyCount: number,
    filesChecked: number,
    engineErrors: number,
): Summary {
    const errors = violations.filter((violation) => violation.severity === 'error').length;
    const warnings = violations.filter((violation) => violation.severity === 'warning').length;
    const fixesApplied = fixes.filter((fix) => fix.success).length;
    const fixesFailed = fixes.filter((fix) => !fix.success).length;
    const exitCode: 0 | 1 = errors > 0 || warnings > 0 || fixesFailed > 0 || engineErrors > 0 ? 1 : 0;

    return {
        total: violations.length,
        errors,
        warnings,
        fixesApplied,
        fixesFailed,
        filesChecked,
        policies: policyCount,
        engineErrors,
        exitCode,
    };
}

export function parseArgs(argv: string[]): Args {
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

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
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
        } else if (arg === '--policy-dir' && argv[index + 1]) {
            args.policyDir = argv[index + 1] ?? 'policies';
            index += 1;
        } else if (arg === '--cwd' && argv[index + 1]) {
            args.cwd = argv[index + 1] ?? process.cwd();
            index += 1;
        } else if ((arg === '-p' || arg === '--policy') && argv[index + 1]) {
            const value = argv[index + 1];
            if (value) {
                args.policy.push(value);
            }
            index += 1;
        } else if (arg && !arg.startsWith('-')) {
            args.policy.push(arg);
        }
    }

    return args;
}

export function printUsage(): void {
    echo(
        `
Policy Driver - Reusable CLI for enforcing repository policies

Usage:
  bun scripts/policy-check.ts [options]

Options:
  -p, --policy <name>    Policy to run (can be specified multiple times)
                         If not specified, runs all policies in --policy-dir
  --fix                  Apply safe fixes where available
  --dry-run              Preview fixes without applying them
  --machine              Machine-readable JSON output
  --policy-dir <path>    Directory containing policy files (default: policies)
  --fail-fast            Stop on first policy error
  --cwd <path>           Working directory (default: current directory)
  -h, --help             Show this help message
`.trim(),
    );
}

export async function main(argv = process.argv.slice(2)): Promise<number> {
    const args = parseArgs(argv);

    if (args.help) {
        printUsage();
        return 0;
    }

    const result = await executePolicies(args.policyDir, args.policy, {
        cwd: args.cwd,
        fix: args.fix,
        preview: args.preview,
        failFast: args.failFast,
    });

    if (args.machine) {
        printJson(result.violations, result.fixes, result.policyIds, result.summary, result.errors);
    } else {
        printReport(
            result.violations,
            result.fixes,
            result.policyIds,
            result.summary,
            result.errors,
            !!process.stdout.isTTY,
        );
    }

    return result.summary.exitCode;
}

if (import.meta.main) {
    main()
        .then((exitCode) => {
            process.exit(exitCode);
        })
        .catch((error) => {
            echoError(`Fatal error: ${(error as Error).message}`);
            process.exit(1);
        });
}
