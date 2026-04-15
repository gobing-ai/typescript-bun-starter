import { stdin as input, stdout as output } from 'node:process';
import { createInterface } from 'node:readline/promises';
import type { Readable, Writable } from 'node:stream';

interface ReadlineStreams {
    input?: Readable;
    output?: Writable;
}

export async function askWithReadline(question: string, streams: ReadlineStreams = {}): Promise<string> {
    const rl = createInterface({
        input: streams.input ?? input,
        output: streams.output ?? output,
    });
    try {
        return await rl.question(question);
    } finally {
        rl.close();
    }
}
