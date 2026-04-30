#!/usr/bin/env bun
/**
 * Check for schema/migration drift.
 *
 * Runs `drizzle-kit generate` and verifies no new migration files were produced.
 * Exit 0 = in sync, exit 1 = drift detected, exit 2 = drizzle-kit error.
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const DRIZZLE_DIR = './drizzle';

function countSqlFiles(): number {
    try {
        return readdirSync(DRIZZLE_DIR).filter((f) => f.endsWith('.sql')).length;
    } catch {
        return 0;
    }
}

const before = countSqlFiles();

let stdout: string;
try {
    stdout = execFileSync('bun', ['drizzle-kit', 'generate', '--name=drift-check'], {
        cwd: process.cwd(),
    }).toString();
} catch (error) {
    console.error('drizzle-kit generate failed:', error instanceof Error ? error.message : String(error));
    process.exit(2);
}

// No schema changes = no drift
if (stdout.includes('No schema changes')) {
    console.log('✓ No schema drift — migrations are in sync.');
    process.exit(0);
}

const after = countSqlFiles();
if (after > before) {
    // Clean up the generated drift-check files
    for (const f of readdirSync(DRIZZLE_DIR)) {
        if (f.includes('drift-check')) rmSync(`${DRIZZLE_DIR}/${f}`, { recursive: true });
    }
    const metaDir = `${DRIZZLE_DIR}/meta`;
    for (const f of readdirSync(metaDir).filter((f) => f.includes('drift-check'))) {
        rmSync(`${metaDir}/${f}`);
    }
    // Remove drift-check entry from journal
    try {
        const journalPath = `${metaDir}/_journal.json`;
        const journal = JSON.parse(readFileSync(journalPath, 'utf-8')) as { entries: Array<{ tag: string }> };
        journal.entries = journal.entries.filter((e) => !e.tag.includes('drift-check'));
        writeFileSync(journalPath, `${JSON.stringify(journal, null, 2)}\n`);
    } catch {
        // Journal may not exist
    }

    console.error('\n✗ Schema drift detected!');
    console.error('  Schema changed but migrations not regenerated.');
    console.error('  Run:  bun run db:generate\n');
    process.exit(1);
}

console.log('✓ No schema drift — migrations are in sync.');
process.exit(0);
