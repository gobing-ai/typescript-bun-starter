export interface WriteTarget {
    write(chunk: string): unknown;
}

function writeLine(message: string, target: WriteTarget): void {
    target.write(`${message}\n`);
}

export function echo(message: string, target: WriteTarget = process.stdout): void {
    writeLine(message, target);
}

export function echoError(message: string, target: WriteTarget = process.stderr): void {
    writeLine(message, target);
}
