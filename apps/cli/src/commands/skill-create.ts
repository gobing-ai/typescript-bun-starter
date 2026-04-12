import type { NewSkill } from "@project/core";
import { SkillService } from "@project/core";
import { Command, Option } from "clipanion";
import { getPromptClient } from "../ui/prompts";

export class SkillCreateCommand extends Command {
  // biome-ignore lint/complexity/noUselessConstructor: V8 function coverage requires explicit constructor
  constructor() {
    super();
  }

  static paths = [["skill", "create"]];

  static usage = Command.Usage({
    category: "Skills",
    description: "Create a new skill",
    examples: [
      ["Create a skill", "tbs skill create --name web-search"],
      [
        "Create with description",
        'tbs skill create --name web-search --description "Search the web"',
      ],
      ["JSON output", "tbs skill create --name web-search --json"],
    ],
  });

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
    const prompts = getPromptClient();
    const name = this.name ?? (!this.json ? await prompts.promptText("Skill name") : null);

    if (!name) {
      if (this.json) {
        this.context.stdout.write(`${JSON.stringify({ error: "--name is required" })}\n`);
      } else {
        this.context.stderr.write("Error: skill name is required\n");
      }
      return 1;
    }

    const description =
      this.description ??
      (!this.json ? await prompts.promptText("Description", { optional: true }) : null);

    const input: NewSkill = {
      name,
      ...(description ? { description } : {}),
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
