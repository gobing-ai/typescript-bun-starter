import { Database } from "bun:sqlite";
import { beforeAll, describe, expect, test } from "bun:test";
import { Writable } from "node:stream";
import { Cli } from "clipanion";
import { SkillCreateCommand } from "../../src/commands/skill-create";

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

function processWithMock(cli: Cli, args: string[], opts: { stdout?: string[]; stderr?: string[] }) {
  return cli.process(args, {
    stdout: opts.stdout ? createMockWritable(opts.stdout) : undefined,
    stderr: opts.stderr ? createMockWritable(opts.stderr) : undefined,
  }) as SkillCreateCommand;
}

describe("SkillCreateCommand", () => {
  test("registers at skill create path", () => {
    const cli = makeCli();
    const command = cli.process(["skill", "create"]);
    expect(command).toBeInstanceOf(SkillCreateCommand);
  });

  test("--json with --name creates a skill and outputs JSON", async () => {
    const cli = makeCli();
    const chunks: string[] = [];
    const command = processWithMock(cli, ["skill", "create", "--name", "test-skill", "--json"], {
      stdout: chunks,
    });

    const exitCode = await command.execute();
    expect(exitCode).toBe(0);

    const output = JSON.parse(chunks.join(""));
    expect(output.name).toBe("test-skill");
    expect(output.id).toBeDefined();
  });

  test("--json without --name outputs error JSON and returns 1", async () => {
    const cli = makeCli();
    const chunks: string[] = [];
    const command = processWithMock(cli, ["skill", "create", "--json"], { stdout: chunks });

    const exitCode = await command.execute();
    expect(exitCode).toBe(1);

    const output = JSON.parse(chunks.join(""));
    expect(output.error).toContain("--name is required");
  });

  test("human mode without --name writes error to stderr and returns 1", async () => {
    const cli = makeCli();
    const errChunks: string[] = [];
    const command = processWithMock(cli, ["skill", "create"], { stderr: errChunks });

    const exitCode = await command.execute();
    expect(exitCode).toBe(1);
    expect(errChunks.join("")).toContain("--name is required");
  });

  test("human mode with --name prints confirmation", async () => {
    const cli = makeCli();
    const chunks: string[] = [];
    const command = processWithMock(cli, ["skill", "create", "--name", "human-test"], {
      stdout: chunks,
    });

    const exitCode = await command.execute();
    expect(exitCode).toBe(0);
    expect(chunks.join("")).toContain("Created skill: human-test");
  });

  test("--description is passed through", async () => {
    const cli = makeCli();
    const chunks: string[] = [];
    const command = processWithMock(
      cli,
      ["skill", "create", "--name", "desc-test", "--description", "A test desc", "--json"],
      { stdout: chunks },
    );

    const exitCode = await command.execute();
    expect(exitCode).toBe(0);

    const output = JSON.parse(chunks.join(""));
    expect(output.description).toBe("A test desc");
  });
});
