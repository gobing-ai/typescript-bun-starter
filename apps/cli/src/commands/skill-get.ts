import { SkillService } from "@project/core";
import { Command, Option } from "clipanion";

export class SkillGetCommand extends Command {
  // biome-ignore lint/complexity/noUselessConstructor: V8 function coverage requires explicit constructor
  constructor() {
    super();
  }

  static paths = [["skill", "get"]];

  static usage = Command.Usage({
    category: "Skills",
    description: "Get a skill by ID",
    examples: [
      ["Get a skill", "tbs skill get --id abc-123"],
      ["JSON output", "tbs skill get --id abc-123 --json"],
    ],
  });

  json = Option.Boolean("--json", false, {
    description: "Output as JSON (agent mode)",
  });

  id = Option.String("--id", {
    description: "Skill ID (required)",
    required: false,
  });

  async execute() {
    if (!this.id) {
      if (this.json) {
        this.context.stdout.write(`${JSON.stringify({ error: "--id is required" })}\n`);
      } else {
        this.context.stderr.write("Error: --id is required\n");
      }
      return 1;
    }

    const service = new SkillService();
    const result = await service.getById(this.id);

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
      const skill = result.data;
      this.context.stdout.write(`ID:          ${skill.id}\n`);
      this.context.stdout.write(`Name:        ${skill.name}\n`);
      this.context.stdout.write(`Description: ${skill.description ?? "(none)"}\n`);
      this.context.stdout.write(`Version:     ${skill.version}\n`);
      this.context.stdout.write(`Created:     ${skill.createdAt.toISOString()}\n`);
      this.context.stdout.write(`Updated:     ${skill.updatedAt.toISOString()}\n`);
    }
    return 0;
  }
}
