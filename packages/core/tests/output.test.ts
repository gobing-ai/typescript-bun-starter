import { describe, expect, test } from 'bun:test';
import { echo, echoError, type WriteTarget } from '../src/output';

function createMockTarget(output: string[]): WriteTarget {
    return {
        write(chunk) {
            output.push(String(chunk));
            return true;
        },
    };
}

describe('echo', () => {
    test('writes a newline-terminated message to the provided target', () => {
        const output: string[] = [];

        echo('hello', createMockTarget(output));

        expect(output).toEqual(['hello\n']);
    });

    test('preserves empty messages as a single newline', () => {
        const output: string[] = [];

        echo('', createMockTarget(output));

        expect(output).toEqual(['\n']);
    });
});

describe('echoError', () => {
    test('writes a newline-terminated message to the provided error target', () => {
        const output: string[] = [];

        echoError('boom', createMockTarget(output));

        expect(output).toEqual(['boom\n']);
    });
});
