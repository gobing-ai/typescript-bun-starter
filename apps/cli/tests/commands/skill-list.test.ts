import { beforeAll, describe, expect, test } from 'bun:test';
import { Writable } from 'node:stream';
import { Cli } from 'clipanion';
import { SkillCreateCommand } from '../../src/commands/skill-create';
import { SkillListCommand } from '../../src/commands/skill-list';
import { setupCliTestDb } from '../test-setup';

beforeAll(() => {
    setupCliTestDb();
});

function makeCli() {
    const cli = new Cli({ binaryName: 'tbs' });
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

describe('SkillListCommand', () => {
    test('registers at skill list path', () => {
        const cli = makeCli();
        expect(cli.process(['skill', 'list'])).toBeDefined();
    });

    test('--json outputs valid JSON array for empty list', async () => {
        const cli = makeCli();
        const chunks: string[] = [];
        const command = processList(cli, ['skill', 'list', '--json'], { stdout: chunks });

        const exitCode = await command.execute();
        expect(exitCode).toBe(0);

        const parsed = JSON.parse(chunks.join(''));
        expect(Array.isArray(parsed)).toBe(true);
    });

    test("human mode shows 'No skills found' for empty list", async () => {
        const cli = makeCli();
        const chunks: string[] = [];
        const command = processList(cli, ['skill', 'list'], { stdout: chunks });

        const exitCode = await command.execute();
        expect(exitCode).toBe(0);
        expect(chunks.join('')).toContain('No skills found');
    });

    test('human mode lists created skills', async () => {
        const cli = makeCli();

        const createChunks: string[] = [];
        const createCommand = processCreate(cli, ['skill', 'create', '--name', 'list-test', '--json'], {
            stdout: createChunks,
        });
        await createCommand.execute();

        const listChunks: string[] = [];
        const listCommand = processList(cli, ['skill', 'list'], { stdout: listChunks });

        const exitCode = await listCommand.execute();
        expect(exitCode).toBe(0);
        expect(listChunks.join('')).toContain('list-test');
    });

    test('--json outputs valid JSON array with created skills', async () => {
        const cli = makeCli();

        const createChunks: string[] = [];
        const createCommand = processCreate(cli, ['skill', 'create', '--name', 'json-list-test', '--json'], {
            stdout: createChunks,
        });
        await createCommand.execute();

        const listChunks: string[] = [];
        const listCommand = processList(cli, ['skill', 'list', '--json'], { stdout: listChunks });

        const exitCode = await listCommand.execute();
        expect(exitCode).toBe(0);

        const parsed = JSON.parse(listChunks.join(''));
        expect(Array.isArray(parsed)).toBe(true);
        const names = parsed.map((s: { name: string }) => s.name);
        expect(names).toContain('json-list-test');
    });
});
