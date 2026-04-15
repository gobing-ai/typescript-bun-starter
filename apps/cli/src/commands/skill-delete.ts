import { SkillService } from '@project/core';
import { Command, Option } from 'clipanion';
import { getPromptClient } from '../ui/prompts';

export class SkillDeleteCommand extends Command {
    constructor() {
        super();
    }

    static paths = [['skill', 'delete']];

    static usage = Command.Usage({
        category: 'Skills',
        description: 'Delete a skill by ID',
        examples: [
            ['Delete a skill', 'tbs skill delete --id abc-123'],
            ['JSON output', 'tbs skill delete --id abc-123 --json'],
        ],
    });

    json = Option.Boolean('--json', false, {
        description: 'Output as JSON (agent mode)',
    });

    id = Option.String('--id', {
        description: 'Skill ID (required)',
        required: false,
    });

    async execute() {
        const prompts = getPromptClient();
        const id = this.id ?? (!this.json ? await prompts.promptText('Skill ID') : null);

        if (!id) {
            if (this.json) {
                this.context.stdout.write(`${JSON.stringify({ error: '--id is required' })}\n`);
            } else {
                this.context.stderr.write('Error: skill id is required\n');
            }
            return 1;
        }

        if (!this.json) {
            const confirmed = await prompts.confirm(`Delete skill ${id}?`);
            if (!confirmed) {
                this.context.stdout.write('Deletion cancelled.\n');
                return 0;
            }
        }

        const service = new SkillService();
        const result = await service.delete(id);

        if (!result.ok) {
            if (this.json) {
                this.context.stdout.write(`${JSON.stringify({ error: result.error.message })}\n`);
            } else {
                this.context.stderr.write(`Error: ${result.error.message}\n`);
            }
            return 1;
        }

        if (this.json) {
            this.context.stdout.write(`${JSON.stringify({ deleted: true, id })}\n`);
        } else {
            this.context.stdout.write(`Deleted skill: ${id}\n`);
        }
        return 0;
    }
}
