#!/usr/bin/env bun

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import contract from '../contracts/project-contracts.json';

interface InstructionPolicy {
    editableSources: string[];
    purpose: string[];
    scopeAndPrecedence: string[];
    verification: {
        command: string;
        description: string;
    };
    repositoryContract: string[];
    namingAndPlacement: string[];
    codeRules: string[];
    changeApprovalBoundaries: string[];
    canonicalReferences: string[];
}

interface ProjectIdentity {
    displayName: string;
}

interface GeneratedTarget {
    path: string;
    title: string;
    intro: string;
}

const ROOT = resolve(import.meta.dir, '..');
const policy = contract.instructionPolicy as InstructionPolicy;
const projectIdentity = contract.projectIdentity as ProjectIdentity;
const mode = process.argv.includes('--check') ? 'check' : 'write';

const targets: GeneratedTarget[] = [
    {
        path: 'AGENTS.md',
        title: `# AGENTS.md -- ${projectIdentity.displayName}`,
        intro: 'This file is consumed by coding agents that honor AGENTS.md repository instructions.',
    },
    {
        path: 'CLAUDE.md',
        title: `# CLAUDE.md -- ${projectIdentity.displayName}`,
        intro: 'This file is consumed by Claude Code and mirrors the root repository contract.',
    },
    {
        path: 'GEMINI.md',
        title: `# GEMINI.md -- ${projectIdentity.displayName}`,
        intro: 'This file is consumed by Gemini tooling and mirrors the root repository contract.',
    },
    {
        path: '.github/copilot-instructions.md',
        title: `# Copilot Instructions -- ${projectIdentity.displayName}`,
        intro: 'This file is consumed by GitHub Copilot repository custom instructions and mirrors the root repository contract.',
    },
];

const outOfSyncTargets: string[] = [];

for (const target of targets) {
    const rendered = renderInstructionFile(target);
    const absPath = resolve(ROOT, target.path);

    if (mode === 'check') {
        const existing = existsSync(absPath) ? readFileSync(absPath, 'utf8') : '';
        if (existing !== rendered) {
            outOfSyncTargets.push(target.path);
        }
        continue;
    }

    mkdirSync(dirname(absPath), { recursive: true });
    writeFileSync(absPath, rendered);
}

if (mode === 'check' && outOfSyncTargets.length > 0) {
    process.stderr.write('Generated instruction files are out of date.\n\n');
    for (const target of outOfSyncTargets) {
        process.stderr.write(`- ${target}\n`);
    }
    process.stderr.write('\nRun `bun run generate:instructions`.\n');
    process.exit(1);
}

if (mode === 'write') {
    process.stdout.write(`Generated ${targets.length} instruction files\n`);
} else {
    process.stdout.write('Generated instruction files are in sync\n');
}

function renderInstructionFile(target: GeneratedTarget): string {
    const sections = [
        target.title,
        generatedNotice(target.intro),
        section('Purpose', toBullets(resolvePlaceholders(policy.purpose))),
        section('Scope And Precedence', toBullets(resolvePlaceholders(policy.scopeAndPrecedence))),
        section(
            'Mandatory Verification',
            `After any intentional repo change, run:\n\n\`\`\`bash\n${policy.verification.command}\n\`\`\`\n\n${resolvePlaceholders([policy.verification.description])[0]}`,
        ),
        section('Repository Contract', toBullets(resolvePlaceholders(policy.repositoryContract))),
        section('Naming And Placement', toBullets(resolvePlaceholders(policy.namingAndPlacement))),
        section('Code Rules', toBullets(resolvePlaceholders(policy.codeRules))),
        section(
            'Change Approval Boundaries',
            `Ask before changing any of the following:\n\n${toBullets(resolvePlaceholders(policy.changeApprovalBoundaries))}`,
        ),
        section('Canonical References', toBullets(resolvePlaceholders(policy.canonicalReferences))),
    ];

    return `${sections.join('\n\n')}\n`;
}

function generatedNotice(intro: string): string {
    const editableSources = policy.editableSources.map((path) => `\`${path}\``).join(', ');
    return [
        intro,
        '',
        '> Generated file. Do not edit directly.',
        `> Edit ${editableSources}, then run \`bun run generate:instructions\`.`,
    ].join('\n');
}

function section(title: string, body: string): string {
    return `## ${title}\n\n${body}`;
}

function toBullets(items: string[]): string {
    return items.map((item) => `- ${item}`).join('\n');
}

function resolvePlaceholders(items: string[]): string[] {
    const workspaceContractsPackage = contract.requiredWorkspaces['packages/contracts'];
    const workspaceCorePackage = contract.requiredWorkspaces['packages/core'];
    const workspacePackagePattern = workspaceCorePackage.endsWith('/core')
        ? `${workspaceCorePackage.slice(0, -'/core'.length)}/<name>`
        : '<scope>/<name>';

    return items.map((item) =>
        item
            .replaceAll('{{displayName}}', projectIdentity.displayName)
            .replaceAll('{{workspaceContractsPackage}}', workspaceContractsPackage)
            .replaceAll('{{workspaceCorePackage}}', workspaceCorePackage)
            .replaceAll('{{workspacePackagePattern}}', workspacePackagePattern),
    );
}
