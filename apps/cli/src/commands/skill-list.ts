import { SkillService } from '@project/core';
import { Command, Option } from 'clipanion';

export class SkillListCommand extends Command {
    constructor() {
        super();
    }

    static paths = [['skill', 'list']];

    static usage = Command.Usage({
        category: 'Skills',
        description: 'List all skills',
        examples: [
            ['List skills', 'tbs skill list'],
            ['JSON output', 'tbs skill list --json'],
        ],
    });

    json = Option.Boolean('--json', false, {
        description: 'Output as JSON (agent mode)',
    });

    async execute() {
        const service = new SkillService();
        const result = await service.list();

        if (!result.ok) {
            if (this.json) {
                this.context.stdout.write(`${JSON.stringify({ error: result.error.message })}\n`);
            } else {
                this.context.stderr.write(`Error: ${result.error.message}\n`);
            }
            return 1;
        }

        if (this.json) {
            this.context.stdout.write(`${JSON.stringify(result.data)}\n`);
        } else {
            if (result.data.length === 0) {
                this.context.stdout.write('No skills found.\n');
                return 0;
            }
            for (const skill of result.data) {
                const desc = skill.description ? `  ${skill.description}` : '';
                this.context.stdout.write(`  ${skill.name}  (${skill.id})  v${skill.version}${desc}\n`);
            }
        }
        return 0;
    }
}
