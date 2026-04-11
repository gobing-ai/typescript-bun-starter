import { beforeAll, describe, expect, test } from "bun:test";
import { Writable } from "node:stream";
import { Cli } from "clipanion";
import { SkillCreateCommand } from "../../src/commands/skill-create";
import { SkillDeleteCommand } from "../../src/commands/skill-delete";
import { setupCliTestDb } from "../test-setup";

beforeAll(() => {
  setupCliTestDb();
});

function makeCli() {
  const cli = new Cli({ binaryName: "tbs" });
  cli.register(SkillDeleteCommand);
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

function processDelete(cli: Cli, args: string[], opts: { stdout?: string[]; stderr?: string[] }) {
  return cli.process(args, {
    stdout: opts.stdout ? createMockWritable(opts.stdout) : undefined,
    stderr: opts.stderr ? createMockWritable(opts.stderr) : undefined,
  }) as SkillDeleteCommand;
}

function processCreate(cli: Cli, args: string[], opts: { stdout?: string[] }) {
  return cli.process(args, {
    stdout: opts.stdout ? createMockWritable(opts.stdout) : undefined,
  }) as SkillCreateCommand;
}

describe("SkillDeleteCommand", () => {
  test("registers at skill delete path", () => {
    const cli = makeCli();
    const command = cli.process(["skill", "delete"]);
    expect(command).toBeInstanceOf(SkillDeleteCommand);
  });

  test("--json without --id outputs error and returns 1", async () => {
    const cli = makeCli();
    const chunks: string[] = [];
    const command = processDelete(cli, ["skill", "delete", "--json"], { stdout: chunks });

    const exitCode = await command.execute();
    expect(exitCode).toBe(1);

    const output = JSON.parse(chunks.join(""));
    expect(output.error).toContain("--id is required");
  });

  test("human mode without --id writes error to stderr", async () => {
    const cli = makeCli();
    const errChunks: string[] = [];
    const command = processDelete(cli, ["skill", "delete"], { stderr: errChunks });

    const exitCode = await command.execute();
    expect(exitCode).toBe(1);
    expect(errChunks.join("")).toContain("--id is required");
  });

  test("--json deletes a skill and outputs confirmation", async () => {
    const cli = makeCli();

    const createChunks: string[] = [];
    const createCommand = processCreate(
      cli,
      ["skill", "create", "--name", "delete-test", "--json"],
      { stdout: createChunks },
    );
    await createCommand.execute();
    const created = JSON.parse(createChunks.join(""));

    const delChunks: string[] = [];
    const delCommand = processDelete(cli, ["skill", "delete", "--id", created.id, "--json"], {
      stdout: delChunks,
    });

    const exitCode = await delCommand.execute();
    expect(exitCode).toBe(0);

    const output = JSON.parse(delChunks.join(""));
    expect(output.deleted).toBe(true);
    expect(output.id).toBe(created.id);
  });

  test("--json with nonexistent id returns error", async () => {
    const cli = makeCli();
    const chunks: string[] = [];
    const command = processDelete(cli, ["skill", "delete", "--id", "nonexistent", "--json"], {
      stdout: chunks,
    });

    const exitCode = await command.execute();
    expect(exitCode).toBe(1);

    const output = JSON.parse(chunks.join(""));
    expect(output.error).toContain("Skill not found");
  });

  test("human mode deletes and prints confirmation", async () => {
    const cli = makeCli();

    const createChunks: string[] = [];
    const createCommand = processCreate(
      cli,
      ["skill", "create", "--name", "human-del-test", "--json"],
      { stdout: createChunks },
    );
    await createCommand.execute();
    const created = JSON.parse(createChunks.join(""));

    const delChunks: string[] = [];
    const delCommand = processDelete(cli, ["skill", "delete", "--id", created.id], {
      stdout: delChunks,
    });

    const exitCode = await delCommand.execute();
    expect(exitCode).toBe(0);
    expect(delChunks.join("")).toContain("Deleted skill");
  });
});
