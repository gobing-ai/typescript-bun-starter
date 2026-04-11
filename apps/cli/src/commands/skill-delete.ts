import { SkillService } from "@project/core";
import { Command, Option } from "clipanion";

export class SkillDeleteCommand extends Command {
  // biome-ignore lint/complexity/noUselessConstructor: V8 function coverage requires explicit constructor
  constructor() {
    super();
  }

  static paths = [["skill", "delete"]];

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
    const result = await service.delete(this.id);

    if (!result.ok) {
      if (this.json) {
        this.context.stdout.write(`${JSON.stringify({ error: result.error.message })}\n`);
      } else {
        this.context.stderr.write(`Error: ${result.error.message}\n`);
      }
      return 1;
    }

    if (this.json) {
      this.context.stdout.write(`${JSON.stringify({ deleted: true, id: this.id })}\n`);
    } else {
      this.context.stdout.write(`Deleted skill: ${this.id}\n`);
    }
    return 0;
  }
}
