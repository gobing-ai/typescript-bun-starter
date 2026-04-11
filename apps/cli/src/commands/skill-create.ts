import type { NewSkill } from "@project/core";
import { SkillService } from "@project/core";
import { Command, Option } from "clipanion";

export class SkillCreateCommand extends Command {
  // biome-ignore lint/complexity/noUselessConstructor: V8 function coverage requires explicit constructor
  constructor() {
    super();
  }

  static paths = [["skill", "create"]];

  json = Option.Boolean("--json", false, {
    description: "Output as JSON (agent mode)",
  });

  name = Option.String("--name", {
    description: "Skill name (required)",
    required: false,
  });

  description = Option.String("--description", {
    description: "Skill description",
    required: false,
  });

  async execute() {
    if (!this.name) {
      if (this.json) {
        this.context.stdout.write(`${JSON.stringify({ error: "--name is required" })}\n`);
      } else {
        this.context.stderr.write("Error: --name is required\n");
      }
      return 1;
    }

    const input: NewSkill = {
      name: this.name,
      ...(this.description ? { description: this.description } : {}),
    };

    const service = new SkillService();
    const result = await service.create(input);

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
      this.context.stdout.write(`Created skill: ${result.data.name} (${result.data.id})\n`);
    }
    return 0;
  }
}
