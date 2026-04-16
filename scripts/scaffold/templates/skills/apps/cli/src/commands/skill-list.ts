import { Command } from 'clipanion';

export class SkillListCommand extends Command {
    static paths = [['skill', 'list']];

    static usage = Command.Usage({
        category: 'Skills',
        description: 'List all skills',
    });

    async execute(): Promise<number> {
        this.context.stdout.write('skill list: not yet implemented\n');
        return 0;
    }
}
