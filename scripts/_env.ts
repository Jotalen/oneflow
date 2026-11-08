import fs from "node:fs";
import path from "node:path";

/** Load .env.local / .env into process.env for scripts (Next does this for the app). */
export function loadEnv(): void {
  for (const f of [".env.local", ".env"]) {
    const p = path.join(process.cwd(), f);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m || process.env[m[1]]) continue;
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

export function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
export const flag = (name: string) => process.argv.includes(`--${name}`);

export function requireKey(): string {
  loadEnv();
  const k = process.env.NESSIE_API_KEY;
  if (!k) {
    console.error("NESSIE_API_KEY missing. Put it in .env.local");
    process.exit(1);
  }
  return k;
}
