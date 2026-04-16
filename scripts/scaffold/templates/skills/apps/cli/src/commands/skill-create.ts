import { Command } from "clipanion";

export class SkillCreateCommand extends Command {
    static paths = [["skill", "create"]];

    static usage = Command.Usage({
        category: "Skills",
        description: "Create a new skill",
    });

    async execute(): Promise<number> {
        this.context.stdout.write("skill create: not yet implemented\n");
        return 0;
    }
}
