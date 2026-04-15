import { describe, expect, test } from 'bun:test';
import { PassThrough } from 'node:stream';
import { askWithReadline } from '../../src/ui/readline';

describe('askWithReadline', () => {
    test('returns the entered answer', async () => {
        const input = new PassThrough();
        const output = new PassThrough();

        const answerPromise = askWithReadline('Skill name: ', { input, output });
        input.end('hello world\n');

        await expect(answerPromise).resolves.toBe('hello world');
    });

    test('writes the prompt to the provided output stream', async () => {
        const input = new PassThrough();
        const output = new PassThrough();
        let rendered = '';

        output.on('data', (chunk) => {
            rendered += chunk.toString();
        });

        const answerPromise = askWithReadline('Delete skill? ', { input, output });
        input.end('yes\n');

        await answerPromise;
        expect(rendered).toContain('Delete skill? ');
    });
});
