#!/usr/bin/env bun
/**
 * Coverage gate: enforces per-file line coverage >= 90%.
 *
 * Reads Bun's lcov output from coverage/lcov.info,
 * checks every source file (excluding tests and node_modules),
 * and exits with code 1 if any file falls below the threshold.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const COVERAGE_FILE = resolve(import.meta.dir, "..", "coverage", "lcov.info");
const THRESHOLD = 90;

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

const files: FileCoverage[] = [];
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
    files.push(current as FileCoverage);
    current = null;
  }
}

const failures: { file: string; pct: number }[] = [];

for (const entry of files) {
  if (
    entry.file.includes("node_modules") ||
    entry.file.includes("__tests__") ||
    entry.file.includes(".test.") ||
    entry.file.includes(".spec.") ||
    entry.file.includes("/drizzle/")
  ) {
    continue;
  }

  if (entry.linesFound === 0) continue;

  const pct = Math.round((entry.linesHit / entry.linesFound) * 100);

  if (pct < THRESHOLD) {
    failures.push({ file: entry.file, pct });
  }
}

if (failures.length > 0) {
  console.error(`\nCoverage gate failed: ${failures.length} file(s) below ${THRESHOLD}%\n`);
  for (const { file, pct } of failures) {
    console.error(`  ${pct}%  ${file}`);
  }
  console.error("");
  process.exit(1);
}

console.log(`Coverage gate passed: all source files >= ${THRESHOLD}%`);
