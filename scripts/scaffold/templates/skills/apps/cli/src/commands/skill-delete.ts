import { Command } from 'clipanion';

export class SkillDeleteCommand extends Command {
    static paths = [['skill', 'delete']];

    static usage = Command.Usage({
        category: 'Skills',
        description: 'Delete a skill',
    });

    async execute(): Promise<number> {
        this.context.stdout.write('skill delete: not yet implemented\n');
        return 0;
    }
}
