#!/usr/bin/env bun
import { configure, getConsoleSink } from "@logtape/logtape";
import { Cli } from "clipanion";

import { SkillCreateCommand } from "./commands/skill-create";
import { SkillDeleteCommand } from "./commands/skill-delete";
import { SkillGetCommand } from "./commands/skill-get";
import { SkillListCommand } from "./commands/skill-list";

await configure({
  loggers: [
    {
      category: "tbs",
      lowestLevel: "info",
      sinks: ["console"],
    },
  ],
  sinks: { console: getConsoleSink() },
});

const cli = new Cli({
  binaryLabel: "TypeScript Bun Starter",
  binaryName: "tbs",
  binaryVersion: "0.1.0",
});

cli.register(SkillListCommand);
cli.register(SkillCreateCommand);
cli.register(SkillGetCommand);
cli.register(SkillDeleteCommand);

cli.runExit(process.argv.slice(2));
