#!/usr/bin/env bun
import { type ChildProcess, spawn } from 'node:child_process';

type ManagedProcess = {
    label: string;
    child: ChildProcess;
};

function writeLine(message: string): void {
    process.stderr.write(`${message}\n`);
}

function spawnManaged(label: string, args: string[]): ManagedProcess {
    const child = spawn('bun', args, {
        stdio: 'inherit',
        env: process.env,
    });

    child.on('error', (error) => {
        writeLine(`[${label}] failed to start: ${error.message}`);
    });

    return { label, child };
}

const managed = [
    spawnManaged('server', ['run', '--filter', '@starter/server', 'dev']),
    spawnManaged('web', ['run', '--filter', '@starter/web', 'dev']),
];

let shuttingDown = false;

function stopAll(signal: NodeJS.Signals): void {
    if (shuttingDown) {
        return;
    }

    shuttingDown = true;
    for (const { child } of managed) {
        if (!child.killed) {
            child.kill(signal);
        }
    }
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => {
        stopAll(signal);
    });
}

let completed = 0;

for (const { label, child } of managed) {
    child.on('exit', (code, signal) => {
        completed += 1;

        if (!shuttingDown) {
            if (signal) {
                writeLine(`[${label}] exited via ${signal}`);
                stopAll('SIGTERM');
            } else if (code && code !== 0) {
                writeLine(`[${label}] exited with code ${code}`);
                stopAll('SIGTERM');
            }
        }

        if (completed === managed.length) {
            const failingProcess = managed.find(
                ({ child: managedChild }) => managedChild.exitCode && managedChild.exitCode !== 0,
            );
            process.exit(failingProcess?.child.exitCode ?? 0);
        }
    });
}
