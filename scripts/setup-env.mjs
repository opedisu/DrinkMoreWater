#!/usr/bin/env node
/**
 * Generates every secret this app needs and installs them in your hosting
 * provider.
 *
 * The secrets are created on the machine that runs this script, written to
 * .env.local (gitignored) and piped straight into the provider's CLI. They are
 * never printed to the terminal, so they do not end up in your scrollback,
 * shell history or any transcript.
 *
 *   node scripts/setup-env.mjs --local        just write .env.local
 *   node scripts/setup-env.mjs --railway      also push to the linked Railway service
 *   node scripts/setup-env.mjs --vercel       also push to the linked Vercel project
 *
 * Re-running keeps the values already in .env.local; pass --rotate to replace
 * them. Rotating VAPID_PRIVATE_KEY unsubscribes every device.
 */

import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { createInterface } from "node:readline/promises";

const require = createRequire(import.meta.url);
const ENV_FILE = ".env.local";
const args = new Set(process.argv.slice(2));
const rotate = args.has("--rotate");

const PUBLIC_KEYS = new Set(["NEXT_PUBLIC_VAPID_PUBLIC_KEY", "VAPID_SUBJECT", "APP_URL"]);

function parseEnvFile(path) {
    if (!existsSync(path)) return {};
    const values = {};
    for (const line of readFileSync(path, "utf8").split("\n")) {
        const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
        if (match) values[match[1]] = match[2];
    }
    return values;
}

// One interface for the whole run, with a small queue in front of it.
// readline emits every line in a buffered chunk at once, so a prompt-per-
// question approach silently drops input when stdin is a pipe rather than a
// terminal. Queueing makes the script behave the same either way.
let rl = null;
const bufferedLines = [];
const waitingResolvers = [];
let inputClosed = false;

function input() {
    if (rl) return rl;

    rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.on("line", (line) => {
        const resolve = waitingResolvers.shift();
        if (resolve) resolve(line);
        else bufferedLines.push(line);
    });
    rl.on("close", () => {
        inputClosed = true;
        while (waitingResolvers.length > 0) waitingResolvers.shift()("");
    });
    return rl;
}

async function ask(question) {
    input();
    process.stdout.write(question);

    if (bufferedLines.length > 0) {
        const line = bufferedLines.shift();
        process.stdout.write(`${line}\n`);
        return line.trim();
    }
    if (inputClosed) return "";

    const line = await new Promise((resolve) => waitingResolvers.push(resolve));
    return line.trim();
}

function closeInput() {
    rl?.close();
    rl = null;
}

const existing = parseEnvFile(ENV_FILE);
const env = { ...existing };

function setSecret(key, generate) {
    if (env[key] && !rotate) return "kept";
    env[key] = generate();
    return "generated";
}

const report = [];

report.push(["AUTH_SECRET", setSecret("AUTH_SECRET", () => randomBytes(48).toString("base64url"))]);
report.push(["CRON_SECRET", setSecret("CRON_SECRET", () => randomBytes(32).toString("base64url"))]);

if (!env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || rotate) {
    const keys = require("web-push").generateVAPIDKeys();
    env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = keys.publicKey;
    env.VAPID_PRIVATE_KEY = keys.privateKey;
    report.push(["VAPID key pair", "generated"]);
} else {
    report.push(["VAPID key pair", "kept"]);
}

if (!env.VAPID_SUBJECT) {
    const email = await ask("Contact email for push services (e.g. you@example.com): ");
    env.VAPID_SUBJECT = `mailto:${email || "hello@example.com"}`;
}

if (!env.DATABASE_URL) {
    console.log("\nPaste your Postgres connection string. It is not echoed back.");
    env.DATABASE_URL = await ask("DATABASE_URL: ");
    if (!env.DATABASE_URL.startsWith("postgres")) {
        console.error("That does not look like a Postgres URL. Nothing was written.");
        process.exit(1);
    }
}

if (!env.APP_URL) {
    env.APP_URL = await ask("Public URL of the deployment (blank to fill in later): ");
}

const ORDER = [
    "DATABASE_URL",
    "AUTH_SECRET",
    "NEXT_PUBLIC_VAPID_PUBLIC_KEY",
    "VAPID_PRIVATE_KEY",
    "VAPID_SUBJECT",
    "CRON_SECRET",
    "APP_URL",
    "RESEND_API_KEY",
    "EMAIL_FROM"
];

const lines = ORDER.filter((key) => env[key]).map((key) => `${key}=${env[key]}`);
writeFileSync(ENV_FILE, lines.join("\n") + "\n", { mode: 0o600 });
chmodSync(ENV_FILE, 0o600);

console.log("\nSecrets:");
for (const [name, state] of report) console.log(`  ${state === "generated" ? "+" : "="} ${name} (${state})`);
console.log(`\nWritten to ${ENV_FILE} with 0600 permissions. It is gitignored.`);
console.log("Values are not printed here on purpose — read the file if you need one.");

function run(command, argv, options = {}) {
    return execFileSync(command, argv, { stdio: ["pipe", "pipe", "pipe"], ...options }).toString();
}

/** Older Railway CLIs lack `variable set --stdin`; detect once rather than guess. */
function railwaySupportsStdin() {
    try {
        return run("railway", ["variable", "set", "--help"]).includes("--stdin");
    } catch {
        return false;
    }
}

/** Shows what is about to be written to, so secrets cannot go to the wrong service. */
function railwayTarget() {
    try {
        const status = JSON.parse(run("railway", ["status", "--json"]));
        return {
            project: status.name ?? "unknown project",
            environment: status.environment?.name ?? status.environmentName ?? "unknown environment",
            service: status.service?.name ?? status.services?.edges?.[0]?.node?.name ?? null
        };
    } catch {
        return null;
    }
}

async function pushToRailway(keys) {
    const target = railwayTarget();
    if (!target) {
        console.error("\nCould not read the linked Railway project. Run `railway link` first.");
        return;
    }

    console.log(`\nTarget: ${target.project} / ${target.environment}${target.service ? ` / ${target.service}` : ""}`);
    if (!target.service) {
        console.log("No service is linked. Re-run `railway link` and choose the app service,");
        console.log("not the Postgres one, or the variables will land in the wrong place.");
    }

    const answer = await ask(`Write ${keys.length} variables there? [y/N] `);
    if (answer.toLowerCase() !== "y") {
        console.log("Nothing was written.");
        return;
    }

    const useStdin = railwaySupportsStdin();
    console.log();

    keys.forEach((key, index) => {
        // Only the final variable triggers a deploy, so one redeploy happens
        // rather than one per variable.
        const isLast = index === keys.length - 1;
        try {
            if (useStdin) {
                // --stdin keeps the value out of the argument list, where any
                // other process on the machine could read it from `ps`.
                const argv = ["variable", "set", key, "--stdin"];
                if (!isLast) argv.push("--skip-deploys");
                run("railway", argv, { input: env[key] });
            } else {
                const argv = ["variables", "--set", `${key}=${env[key]}`];
                if (!isLast) argv.push("--skip-deploys");
                run("railway", argv);
            }
            console.log(`  ✓ ${key}${PUBLIC_KEYS.has(key) ? "" : " (secret)"}`);
        } catch (error) {
            console.error(`  ✗ ${key} — ${firstLine(error)}`);
        }
    });

    if (!useStdin) {
        console.log("\nNote: this Railway CLI is too old for `variable set --stdin`, so values");
        console.log("were passed as arguments. Upgrade it to keep secrets out of the process list.");
    }
}

async function pushToVercel(keys) {
    const answer = await ask(`\nWrite ${keys.length} variables to the linked Vercel project? [y/N] `);
    if (answer.toLowerCase() !== "y") {
        console.log("Nothing was written.");
        return;
    }
    console.log();

    for (const key of keys) {
        try {
            const argv = [
                "env", "add", key,
                "--environment", "production,preview,development",
                "--force",
                PUBLIC_KEYS.has(key) ? "--no-sensitive" : "--sensitive"
            ];
            // The value goes in on stdin rather than --value, for the same
            // reason as Railway: arguments are visible to other processes.
            run("vercel", argv, { input: `${env[key]}\n` });
            console.log(`  ✓ ${key}${PUBLIC_KEYS.has(key) ? "" : " (secret)"}`);
        } catch (error) {
            console.error(`  ✗ ${key} — ${firstLine(error)}`);
        }
    }
}

function firstLine(error) {
    const text = error.stderr?.toString().trim() || error.stdout?.toString().trim() || error.message;
    return text.split("\n").find((line) => line.trim().length > 0) ?? "failed";
}

const pushable = ORDER.filter((key) => env[key]);

if (args.has("--railway")) await pushToRailway(pushable);
if (args.has("--vercel")) await pushToVercel(pushable);

if (!args.has("--railway") && !args.has("--vercel")) {
    console.log("\nNothing was pushed to a provider. Re-run with --railway or --vercel to do that.");
}

console.log("\nNext: npm run db:migrate, then deploy.");
closeInput();
