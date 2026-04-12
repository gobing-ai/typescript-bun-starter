type LoggerConfig = {
  category: string | string[];
  lowestLevel: "info" | "warning";
  sinks: string[];
};

type Environment = Record<string, string | undefined>;

interface LoggerConfigResult {
  loggers: [LoggerConfig, LoggerConfig];
}

function isTestEnvironment(env: Environment): boolean {
  return env.NODE_ENV === "test";
}

export function getLoggerConfig(env: Environment = process.env): LoggerConfigResult {
  const appSinks = isTestEnvironment(env) ? [] : ["console"];

  return {
    loggers: [
      {
        category: "tbs",
        lowestLevel: "info",
        sinks: appSinks,
      },
      {
        category: ["logtape", "meta"],
        lowestLevel: "warning",
        sinks: [],
      },
    ],
  };
}
