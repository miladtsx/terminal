#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const PLACEHOLDER = "__SERVICE_WORKER_CACHE_NAME__";
const BASE_CACHE_NAME = "tsx-terminal";

function createVersionTag() {
  const candidates = [
    process.env.SERVICE_WORKER_VERSION,
    process.env.GITHUB_SHA,
    process.env.GITHUB_RUN_NUMBER,
    new Date().toISOString(),
  ].filter(Boolean);

  const raw = String(candidates[0] ?? BASE_CACHE_NAME);
  const sanitized = raw.replace(/[^a-z0-9]/gi, "").slice(0, 16);
  return sanitized || BASE_CACHE_NAME;
}

async function run() {
  const templatePath = path.resolve("public", "service-worker.js");
  const outputPath = path.resolve("dist", "service-worker.js");

  const versionTag = createVersionTag();
  const cacheName = `${BASE_CACHE_NAME}-${versionTag}`;

  const template = await readFile(templatePath, "utf8");
  if (!template.includes(PLACEHOLDER)) {
    throw new Error(`service worker template missing placeholder ${PLACEHOLDER}`);
  }

  const replaced = template.replace(PLACEHOLDER, cacheName);
  await writeFile(outputPath, replaced);

  console.log(`service worker cache name set to ${cacheName}
output written to ${outputPath}`);
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
