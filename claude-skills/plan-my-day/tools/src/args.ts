/**
 * Minimal CLI arg parser.
 * --flag value  → named.flag = 'value'
 * --flag        → named.flag = true
 * positional    → positionals array
 */
export interface ParsedArgs {
  positionals: string[];
  named:       Record<string, string | true>;
}

export function parseArgs(argv: string[]): ParsedArgs {
  const positionals: string[] = [];
  const named: Record<string, string | true> = {};

  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        named[key] = next;
        i += 2;
      } else {
        named[key] = true;
        i++;
      }
    } else {
      positionals.push(arg);
      i++;
    }
  }

  return { positionals, named };
}

export function requireArg(named: Record<string, string | true>, key: string): string {
  const v = named[key];
  if (v === undefined) throw new Error(`Missing required argument: --${key}`);
  if (v === true)      throw new Error(`--${key} requires a value`);
  return v;
}

export function optArg(named: Record<string, string | true>, key: string): string | undefined {
  const v = named[key];
  if (v === undefined || v === true) return undefined;
  return v;
}

export function resolveRef(ref: string): number | string {
  const n = parseInt(ref, 10);
  return isNaN(n) ? ref : n;
}
