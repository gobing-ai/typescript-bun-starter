#!/usr/bin/env bun
import { Writable } from "node:stream";
import { configure, getConsoleSink, getStreamSink } from "@logtape/logtape";
import { Builtins, Cli } from "clipanion";

import { SkillCreateCommand } from "./commands/skill-create";
import { SkillDeleteCommand } from "./commands/skill-delete";
import { SkillGetCommand } from "./commands/skill-get";
import { SkillListCommand } from "./commands/skill-list";
import { CLI_CONFIG } from "./config";

// Detect JSON agent mode before logging is configured.
// In JSON mode, logs go to stderr only so stdout stays clean for machine output.
const isJsonMode = process.argv.includes("--json");

await configure({
  loggers: [
    {
      category: "tbs",
      lowestLevel: "info",
      sinks: ["console"],
    },
    {
      category: ["logtape", "meta"],
      lowestLevel: "warning",
      sinks: [],
    },
  ],
  sinks: {
    // In JSON mode, send all logs to stderr via stream sink.
    // In human mode, use default console sink (stdout).
    console: isJsonMode ? getStreamSink(Writable.toWeb(process.stderr)) : getConsoleSink(),
  },
});

const cli = new Cli({
  binaryLabel: CLI_CONFIG.binaryLabel,
  binaryName: CLI_CONFIG.binaryName,
  binaryVersion: CLI_CONFIG.binaryVersion,
});

cli.register(Builtins.HelpCommand);
cli.register(Builtins.VersionCommand);
cli.register(SkillListCommand);
cli.register(SkillCreateCommand);
cli.register(SkillGetCommand);
cli.register(SkillDeleteCommand);

cli.runExit(process.argv.slice(2));
