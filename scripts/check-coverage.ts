#!/usr/bin/env bun
/**
 * Coverage gate: enforces per-file line coverage >= 90% AND detects missing tests.
 *
 * 1. Reads Bun's lcov output from coverage/lcov.info.
 * 2. Checks every source file against the threshold.
 * 3. Detects source files with no corresponding test file.
 * 4. Files in the whitelist are exempt from the missing-test check.
 *
 * Exits with code 1 if any file fails coverage or is missing tests.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const COVERAGE_FILE = resolve(import.meta.dir, "..", "coverage", "lcov.info");
const THRESHOLD = 90;

/** Source files that are exempt from the "must have a test" check. */
const NO_TEST_REQUIRED = new Set([
  // packages/core
  "packages/core/src/db/schema.ts", // pure Drizzle table definition
  "packages/core/src/db/client.ts", // convenience export (2 lines)
  "packages/core/src/db/adapters/d1.ts", // D1 adapter (needs Workers runtime)
  "packages/core/src/types/index.ts", // type re-exports only
  "packages/core/src/types/result.ts", // type-only definition
  "packages/core/src/schemas/skill.ts", // Zod schema definitions
  "packages/core/src/index.ts", // barrel exports
  "packages/core/src/logger.ts", // single getLogger call
  // apps/cli
  "apps/cli/src/index.ts", // entry point (CLI wiring + LogTape config)
  // apps/server
  "apps/server/src/index.ts", // entry point (Hono wiring + LogTape config)
]);

// Directories to scan for source files (relative to project root).
const SRC_DIRS = ["packages/core/src", "apps/cli/src", "apps/server/src"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Recursively collect all .ts files under a directory. */
function collectTsFiles(dir: string, root: string): string[] {
  const results: string[] = [];
  if (!existsSync(dir)) return results;

  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      results.push(...collectTsFiles(full, root));
    } else if (entry.endsWith(".ts") && !entry.endsWith(".d.ts")) {
      results.push(relative(root, full));
    }
  }
  return results;
}

/**
 * Derive the expected test file path for a source file.
 *
 * Maps:  {package}/src/{relpath}.ts  →  {package}/tests/{relpath}.test.ts
 *
 * Example:
 *   packages/core/src/services/skill-service.ts
 *   → packages/core/tests/services/skill-service.test.ts
 */
function expectedTestPath(srcFile: string): string {
  // e.g. "packages/core/src/services/skill-service.ts"
  const idx = srcFile.indexOf("/src/");
  if (idx === -1) return "";
  const pkg = srcFile.slice(0, idx); // "packages/core"
  const relPath = srcFile.slice(idx + "/src/".length); // "services/skill-service.ts"
  const testRel = relPath.replace(/\.ts$/, ".test.ts");
  return `${pkg}/tests/${testRel}`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const projectRoot = resolve(import.meta.dir, "..");

// ---- Part 1: Coverage threshold check ----

if (!existsSync(COVERAGE_FILE)) {
  console.error("No coverage file found at", COVERAGE_FILE);
  console.error("Run `bun test --coverage` first.");
  process.exit(1);
}

const lcov = readFileSync(COVERAGE_FILE, "utf-8");

interface FileCoverage {
  file: string;
  linesFound: number;
  linesHit: number;
}

const coveredFiles: FileCoverage[] = [];
let current: Partial<FileCoverage> | null = null;

for (const line of lcov.split("\n")) {
  const trimmed = line.trim();
  if (trimmed.startsWith("SF:")) {
    current = { file: trimmed.slice(3) };
  } else if (trimmed.startsWith("LF:") && current) {
    current.linesFound = Number(trimmed.slice(3));
  } else if (trimmed.startsWith("LH:") && current) {
    current.linesHit = Number(trimmed.slice(3));
  } else if (trimmed === "end_of_record" && current?.file) {
    coveredFiles.push(current as FileCoverage);
    current = null;
  }
}

const coverageFailures: { file: string; pct: number }[] = [];

for (const entry of coveredFiles) {
  if (
    entry.file.includes("node_modules") ||
    entry.file.includes("__tests__") ||
    entry.file.includes(".test.") ||
    entry.file.includes(".spec.") ||
    entry.file.includes("/drizzle/") ||
    entry.file.includes("scripts/")
  ) {
    continue;
  }

  if (entry.linesFound === 0) continue;

  const pct = Math.round((entry.linesHit / entry.linesFound) * 100);

  if (pct < THRESHOLD) {
    coverageFailures.push({ file: entry.file, pct });
  }
}

// ---- Part 2: Missing test detection ----

// Collect all source .ts files from the project
const allSourceFiles = new Set<string>();
for (const srcDir of SRC_DIRS) {
  const absDir = join(projectRoot, srcDir);
  for (const f of collectTsFiles(absDir, projectRoot)) {
    allSourceFiles.add(f);
  }
}

// Files that appear in coverage (have at least some lines instrumented)
const coveredSet = new Set(coveredFiles.map((e) => e.file));

const missingTests: string[] = [];

for (const srcFile of allSourceFiles) {
  // Skip whitelisted files
  if (NO_TEST_REQUIRED.has(srcFile)) continue;

  // Skip if not in coverage at all (type-only files, barrel exports without logic)
  if (!coveredSet.has(srcFile)) continue;

  // Check if a corresponding test file exists
  const testPath = expectedTestPath(srcFile);
  if (!testPath) continue;

  const absTestPath = join(projectRoot, testPath);
  if (!existsSync(absTestPath)) {
    missingTests.push(srcFile);
  }
}

// ---- Report ----

let failed = false;

if (coverageFailures.length > 0) {
  console.error(`\nCoverage gate failed: ${coverageFailures.length} file(s) below ${THRESHOLD}%\n`);
  for (const { file, pct } of coverageFailures) {
    console.error(`  ${pct}%  ${file}`);
  }
  console.error("");
  failed = true;
}

if (missingTests.length > 0) {
  console.error(`Missing tests: ${missingTests.length} source file(s) have no test file\n`);
  for (const srcFile of missingTests) {
    const testPath = expectedTestPath(srcFile);
    console.error(`  ${srcFile}`);
    console.error(`    expected: ${testPath}`);
  }
  console.error("");
  console.error(
    "If this is intentional, add the file to NO_TEST_REQUIRED in scripts/check-coverage.ts",
  );
  console.error("");
  failed = true;
}

if (failed) {
  process.exit(1);
}

console.log(
  `Coverage gate passed: all source files >= ${THRESHOLD}% and all testable files have tests`,
);
