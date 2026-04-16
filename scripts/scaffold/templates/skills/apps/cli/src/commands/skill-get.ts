import { Command } from "clipanion";

export class SkillGetCommand extends Command {
    static paths = [["skill", "get"]];

    static usage = Command.Usage({
        category: "Skills",
        description: "Get a skill by ID",
    });

    async execute(): Promise<number> {
        this.context.stdout.write("skill get: not yet implemented\n");
        return 0;
    }
}
