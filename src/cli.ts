#!/usr/bin/env node
import { readFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { priceBaseDrg, type PriceBaseDrgRequest } from "./priceBaseDrg.js";

type CliOptions = {
  readonly year: number;
  readonly drgCode: string;
  readonly landesbasisfallwert: string;
  readonly dataDirectory?: string;
  readonly catalogFilePath?: string;
};

type PartialCliOptions = {
  year?: number;
  drgCode?: string;
  landesbasisfallwert?: string;
  dataDirectory?: string;
  catalogFilePath?: string;
};

type CliErrorResponse = {
  readonly status: "error";
  readonly errors: readonly [{ readonly code: string; readonly message: string }];
};

type CliHelpResponse = {
  readonly status: "help";
  readonly text: string;
};

type CliVersionResponse = {
  readonly status: "version";
  readonly version: string;
};

const DEFAULT_DATA_DIRECTORY = "data/official";

if (isMainModule()) {
  const response = run(process.argv.slice(2));
  if (response.status === "help") {
    process.stdout.write(response.text);
    process.exitCode = 0;
  } else if (response.status === "version") {
    process.stdout.write(`${response.version}\n`);
    process.exitCode = 0;
  } else {
    process.stdout.write(`${JSON.stringify(response, stableJsonReplacer, 2)}\n`);
    process.exitCode = response.status === "priced" ? 0 : 1;
  }
}

export function run(args: readonly string[]) {
  const parsed = parseArgs(args);
  if ("status" in parsed) {
    return parsed;
  }

  const request: PriceBaseDrgRequest = {
    year: parsed.year,
    drgCode: parsed.drgCode,
    landesbasisfallwert: parsed.landesbasisfallwert,
    dataDirectory: parsed.dataDirectory ?? DEFAULT_DATA_DIRECTORY,
    ...(parsed.catalogFilePath === undefined ? {} : { catalogFilePath: parsed.catalogFilePath }),
  };

  return priceBaseDrg(request);
}

function parseArgs(args: readonly string[]): CliOptions | CliErrorResponse | CliHelpResponse | CliVersionResponse {
  const options: PartialCliOptions = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === undefined) {
      continue;
    }

    const [name, inlineValue] = splitOption(arg);

    if (name === "--help" || name === "-h") {
      return cliHelp();
    }

    if (name === "--version") {
      return cliVersion();
    }

    if (name === "--") {
      return cliError(
        "UNKNOWN_OPTION",
        args[index + 1] === "year"
          ? "Unknown option: --. Did you mean --year? Use --year without a space."
          : "Unknown option: --. Options use the form --year 2026, --drg A01A, and --lbfw 4000.00.",
      );
    }

    const value = inlineValue ?? args[index + 1];

    if (!name.startsWith("--")) {
      return cliError("UNKNOWN_ARGUMENT", `Unknown positional argument: ${name}. Run with --help for usage.`);
    }

    if (value === undefined || value.startsWith("--")) {
      return cliError("MISSING_ARGUMENT_VALUE", `Missing value for ${name}. Run with --help for usage.`);
    }

    if (inlineValue === undefined) {
      index += 1;
    }

    switch (name) {
      case "--year": {
        if (!/^\d{4}$/u.test(value)) {
          return cliError("INVALID_YEAR", "--year must be a four-digit year");
        }
        options.year = Number(value);
        break;
      }
      case "--drg":
      case "--drg-code":
        options.drgCode = value;
        break;
      case "--lbfw":
      case "--landesbasisfallwert":
        options.landesbasisfallwert = value;
        break;
      case "--data-dir":
        options.dataDirectory = value;
        break;
      case "--catalog-file":
        options.catalogFilePath = value;
        break;
      default:
        return cliError("UNKNOWN_OPTION", `Unknown option: ${name}. Run with --help for supported options.`);
    }
  }

  if (options.year === undefined) {
    return cliError("MISSING_REQUIRED_OPTION", "Missing required option: --year");
  }
  if (options.drgCode === undefined) {
    return cliError("MISSING_REQUIRED_OPTION", "Missing required option: --drg");
  }
  if (options.landesbasisfallwert === undefined) {
    return cliError("MISSING_REQUIRED_OPTION", "Missing required option: --lbfw");
  }

  return {
    year: options.year,
    drgCode: options.drgCode,
    landesbasisfallwert: options.landesbasisfallwert,
    ...(options.dataDirectory === undefined ? {} : { dataDirectory: options.dataDirectory }),
    ...(options.catalogFilePath === undefined ? {} : { catalogFilePath: options.catalogFilePath }),
  };
}

function splitOption(arg: string): readonly [string, string | undefined] {
  const equalsIndex = arg.indexOf("=");
  if (equalsIndex === -1) {
    return [arg, undefined];
  }

  return [arg.slice(0, equalsIndex), arg.slice(equalsIndex + 1)];
}

function cliError(code: string, message: string): CliErrorResponse {
  return {
    status: "error",
    errors: [{ code, message }],
  };
}

function cliHelp(): CliHelpResponse {
  return {
    status: "help",
    text: [
      "drg-price-lookup",
      "",
      "Local base DRG amount lookup for user-supplied official Fallpauschalen-Katalog files.",
      "",
      "Usage:",
      "  node dist/src/cli.js --year <YYYY> --drg <DRG_CODE> --lbfw <EUR_AMOUNT> [options]",
      "",
      "Required options:",
      "  --year <YYYY>                Supported XLSX years: 2022, 2023, 2024, 2025, 2026. CSV export support: 2025.",
      "  --drg, --drg-code <CODE>      Already-known DRG/aG-DRG code, for example A01A or B79Z.",
      "  --lbfw <EUR_AMOUNT>           Caller-supplied Landesbasisfallwert, for example 4000.00.",
      "",
      "Input file options:",
      "  --data-dir <DIR>              Defaults to data/official and expects {year}/raw/<one file>.",
      "  --catalog-file <PATH>         Use one specific local XLSX or supported CSV file.",
      "",
      "Examples:",
      "  node dist/src/cli.js --year 2023 --drg A01A --lbfw 4000.00",
      "  node dist/src/cli.js --year 2024 --drg A01A --lbfw 4000.00 --catalog-file data/official/2024/raw/Fallpauschalenkatalog 2024_2024-09-26.xlsx",
      "",
      "Data setup:",
      "  Put official files under data/official/{year}/raw/ or run the explicit curl onboarding commands in README.md.",
      "  The CLI reads local files only; it does not download pricing data at runtime.",
      "",
    ].join("\n"),
  };
}

function cliVersion(): CliVersionResponse {
  return {
    status: "version",
    version: packageVersion(),
  };
}

function packageVersion(): string {
  try {
    const packageJsonPath = fileURLToPath(new URL("../../package.json", import.meta.url));
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { version?: unknown };
    return typeof packageJson.version === "string" ? packageJson.version : "0.0.0";
  } catch {
    return "0.0.0";
  }
}

function stableJsonReplacer(_key: string, value: unknown): unknown {
  if (value instanceof Map) {
    return Object.fromEntries(value);
  }
  return value;
}

function isMainModule(): boolean {
  const entryPoint = process.argv[1];
  if (entryPoint === undefined) {
    return false;
  }

  return realpathSync(entryPoint) === realpathSync(fileURLToPath(import.meta.url));
}
