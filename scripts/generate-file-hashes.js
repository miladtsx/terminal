import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const PUBLIC_FILES_DIR = path.join(ROOT, "public", "files");
const OUTPUT_PATH = path.join(ROOT, "src", "data", "fileManifest.json");

const TEXT_EXTS = new Set([".txt", ".json", ".md", ".yaml", ".yml"]);

async function hashFile(fullPath) {
  const buffer = await fs.readFile(fullPath);
  const hash = createHash("sha256").update(buffer).digest("hex");
  const stat = await fs.stat(fullPath);
  const name = path.basename(fullPath);
  const ext = path.extname(name).toLowerCase();

  return {
    name,
    path: `files/${name}`,
    size: stat.size,
    sha256: hash,
    text: TEXT_EXTS.has(ext),
    mtime: stat.mtime.toISOString(),
  };
}

async function main() {
  const exists = await fs
    .stat(PUBLIC_FILES_DIR)
    .then((s) => s.isDirectory())
    .catch(() => false);

  if (!exists) {
    console.error(`missing directory: ${PUBLIC_FILES_DIR}`);
    process.exit(1);
  }

  const entries = await fs.readdir(PUBLIC_FILES_DIR, { withFileTypes: true });
  const files = entries.filter((entry) => entry.isFile());

  if (!files.length) {
    console.error(`no files found in ${PUBLIC_FILES_DIR}`);
    process.exit(1);
  }

  const results = [];
  for (const file of files) {
    const fullPath = path.join(PUBLIC_FILES_DIR, file.name);
    const meta = await hashFile(fullPath);
    results.push(meta);
    console.log(`hashed ${file.name} ${meta.sha256}`);
  }

  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await fs.writeFile(OUTPUT_PATH, JSON.stringify(results, null, 2));
  console.log(`wrote manifest: ${path.relative(ROOT, OUTPUT_PATH)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
