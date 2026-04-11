import { Database } from "bun:sqlite";
import { beforeAll, describe, expect, test } from "bun:test";
import { Writable } from "node:stream";
import { Cli } from "clipanion";
import { SkillCreateCommand } from "../../src/commands/skill-create";
import { SkillGetCommand } from "../../src/commands/skill-get";

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
  cli.register(SkillGetCommand);
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

function processGet(cli: Cli, args: string[], opts: { stdout?: string[]; stderr?: string[] }) {
  return cli.process(args, {
    stdout: opts.stdout ? createMockWritable(opts.stdout) : undefined,
    stderr: opts.stderr ? createMockWritable(opts.stderr) : undefined,
  }) as SkillGetCommand;
}

function processCreate(cli: Cli, args: string[], opts: { stdout?: string[] }) {
  return cli.process(args, {
    stdout: opts.stdout ? createMockWritable(opts.stdout) : undefined,
  }) as SkillCreateCommand;
}

describe("SkillGetCommand", () => {
  test("registers at skill get path", () => {
    const cli = makeCli();
    const command = cli.process(["skill", "get"]);
    expect(command).toBeInstanceOf(SkillGetCommand);
  });

  test("--json without --id outputs error and returns 1", async () => {
    const cli = makeCli();
    const chunks: string[] = [];
    const command = processGet(cli, ["skill", "get", "--json"], { stdout: chunks });

    const exitCode = await command.execute();
    expect(exitCode).toBe(1);

    const output = JSON.parse(chunks.join(""));
    expect(output.error).toContain("--id is required");
  });

  test("human mode without --id writes error to stderr", async () => {
    const cli = makeCli();
    const errChunks: string[] = [];
    const command = processGet(cli, ["skill", "get"], { stderr: errChunks });

    const exitCode = await command.execute();
    expect(exitCode).toBe(1);
    expect(errChunks.join("")).toContain("--id is required");
  });

  test("--json with valid --id returns skill JSON", async () => {
    const cli = makeCli();

    // Create a skill first
    const createChunks: string[] = [];
    const createCommand = processCreate(
      cli,
      ["skill", "create", "--name", "get-test", "--description", "A test", "--json"],
      { stdout: createChunks },
    );
    await createCommand.execute();
    const created = JSON.parse(createChunks.join(""));

    // Get it
    const getChunks: string[] = [];
    const getCommand = processGet(cli, ["skill", "get", "--id", created.id, "--json"], {
      stdout: getChunks,
    });

    const exitCode = await getCommand.execute();
    expect(exitCode).toBe(0);

    const output = JSON.parse(getChunks.join(""));
    expect(output.name).toBe("get-test");
    expect(output.description).toBe("A test");
    expect(output.id).toBe(created.id);
  });

  test("--json with nonexistent --id returns error", async () => {
    const cli = makeCli();
    const chunks: string[] = [];
    const command = processGet(cli, ["skill", "get", "--id", "nonexistent", "--json"], {
      stdout: chunks,
    });

    const exitCode = await command.execute();
    expect(exitCode).toBe(1);

    const output = JSON.parse(chunks.join(""));
    expect(output.error).toContain("Skill not found");
  });

  test("human mode with valid --id prints skill details", async () => {
    const cli = makeCli();

    // Create a skill
    const createChunks: string[] = [];
    const createCommand = processCreate(
      cli,
      ["skill", "create", "--name", "human-get-test", "--json"],
      { stdout: createChunks },
    );
    await createCommand.execute();
    const created = JSON.parse(createChunks.join(""));

    // Get in human mode
    const getChunks: string[] = [];
    const getCommand = processGet(cli, ["skill", "get", "--id", created.id], {
      stdout: getChunks,
    });

    const exitCode = await getCommand.execute();
    expect(exitCode).toBe(0);
    const output = getChunks.join("");
    expect(output).toContain("human-get-test");
    expect(output).toContain("ID:");
    expect(output).toContain("Name:");
    expect(output).toContain("Version:");
  });
});
