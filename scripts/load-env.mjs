import { existsSync, readFileSync } from "node:fs";

/**
 * Loads .env.local into process.env for the standalone scripts. Next.js does
 * this for the app itself, but a plain `node scripts/...` does not, so without
 * it `npm run db:migrate` fails right after `npm run setup` has just written
 * the file. Real environment variables always win.
 */
export function loadEnvLocal(path = ".env.local") {
    if (!existsSync(path)) return false;

    for (const rawLine of readFileSync(path, "utf8").split("\n")) {
        const line = rawLine.trim();
        if (line.length === 0 || line.startsWith("#")) continue;

        const separator = line.indexOf("=");
        if (separator < 1) continue;

        const key = line.slice(0, separator).trim();
        let value = line.slice(separator + 1).trim();

        // Tolerate quoted values, which people add by hand.
        if (
            (value.startsWith('"') && value.endsWith('"') && value.length > 1) ||
            (value.startsWith("'") && value.endsWith("'") && value.length > 1)
        ) {
            value = value.slice(1, -1);
        }

        if (process.env[key] === undefined) process.env[key] = value;
    }
    return true;
}
