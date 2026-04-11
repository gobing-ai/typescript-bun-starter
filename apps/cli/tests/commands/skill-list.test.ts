import { Database } from "bun:sqlite";
import { beforeAll, describe, expect, test } from "bun:test";
import { Writable } from "node:stream";
import { Cli } from "clipanion";
import { SkillCreateCommand } from "../../src/commands/skill-create";
import { SkillListCommand } from "../../src/commands/skill-list";

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS skills (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    config TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )
`;

beforeAll(() => {
  const dbPath = process.env.DATABASE_URL || "data/app.db";
  const sqlite = new Database(dbPath, { create: true });
  sqlite.run(CREATE_TABLE_SQL);
  sqlite.run("DELETE FROM skills");
  sqlite.close();
});

function makeCli() {
  const cli = new Cli({ binaryName: "tbs" });
  cli.register(SkillListCommand);
  cli.register(SkillCreateCommand);
  return cli;
}

function createMockWritable(collector: string[]) {
  return new Writable({
    write(chunk, _encoding, callback) {
      collector.push(chunk.toString());
      callback();
    },
  });
}

function processList(cli: Cli, args: string[], opts: { stdout?: string[] }) {
  return cli.process(args, {
    stdout: opts.stdout ? createMockWritable(opts.stdout) : undefined,
  }) as SkillListCommand;
}

function processCreate(cli: Cli, args: string[], opts: { stdout?: string[] }) {
  return cli.process(args, {
    stdout: opts.stdout ? createMockWritable(opts.stdout) : undefined,
  }) as SkillCreateCommand;
}

describe("SkillListCommand", () => {
  test("registers at skill list path", () => {
    const cli = makeCli();
    expect(cli.process(["skill", "list"])).toBeDefined();
  });

  test("--json outputs valid JSON array for empty list", async () => {
    const cli = makeCli();
    const chunks: string[] = [];
    const command = processList(cli, ["skill", "list", "--json"], { stdout: chunks });

    const exitCode = await command.execute();
    expect(exitCode).toBe(0);

    const parsed = JSON.parse(chunks.join(""));
    expect(Array.isArray(parsed)).toBe(true);
  });

  test("human mode shows 'No skills found' for empty list", async () => {
    const cli = makeCli();
    const chunks: string[] = [];
    const command = processList(cli, ["skill", "list"], { stdout: chunks });

    const exitCode = await command.execute();
    expect(exitCode).toBe(0);
    expect(chunks.join("")).toContain("No skills found");
  });

  test("human mode lists created skills", async () => {
    const cli = makeCli();

    // Create a skill first
    const createChunks: string[] = [];
    const createCommand = processCreate(cli, ["skill", "create", "--name", "list-test", "--json"], {
      stdout: createChunks,
    });
    await createCommand.execute();

    // List skills
    const listChunks: string[] = [];
    const listCommand = processList(cli, ["skill", "list"], { stdout: listChunks });

    const exitCode = await listCommand.execute();
    expect(exitCode).toBe(0);
    expect(listChunks.join("")).toContain("list-test");
  });

  test("--json outputs valid JSON array with created skills", async () => {
    const cli = makeCli();

    // Create a skill
    const createChunks: string[] = [];
    const createCommand = processCreate(
      cli,
      ["skill", "create", "--name", "json-list-test", "--json"],
      { stdout: createChunks },
    );
    await createCommand.execute();

    // List with --json
    const listChunks: string[] = [];
    const listCommand = processList(cli, ["skill", "list", "--json"], { stdout: listChunks });

    const exitCode = await listCommand.execute();
    expect(exitCode).toBe(0);

    const parsed = JSON.parse(listChunks.join(""));
    expect(Array.isArray(parsed)).toBe(true);
    const names = parsed.map((s: { name: string }) => s.name);
    expect(names).toContain("json-list-test");
  });
});
