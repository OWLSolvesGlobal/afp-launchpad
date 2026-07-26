#!/usr/bin/env node
/**
 * Recover image assets that live on Loveable's servers.
 *
 * Loveable stored images in its own R2 bucket and committed only a small
 * JSON pointer (`*.asset.json`) into the repo. Those pointers reference
 * `/__l5e/assets-v1/...`, a path only Loveable's hosting serves — so on any
 * other host the images 404.
 *
 * This script downloads each real image, writes it into src/assets, deletes
 * the pointer stub, and rewrites the code that imported it.
 *
 * USAGE:
 *   node scripts/recover-loveable-assets.mjs <your-loveable-app-url>
 *
 * e.g.
 *   node scripts/recover-loveable-assets.mjs https://afp-launchpad.lovable.app
 *
 * Find that URL by opening the project in Loveable and clicking Preview —
 * it's the address of the live preview, not the editor.
 *
 * Nothing is modified unless every single image downloads successfully.
 */

import { readdir, readFile, writeFile, unlink, access } from "node:fs/promises";
import { join, resolve } from "node:path";

const ASSETS = resolve("src/assets");
const SRC = resolve("src");

const base = process.argv[2]?.replace(/\/$/, "") ?? "";

const stubs = (await readdir(ASSETS)).filter((f) => f.endsWith(".asset.json"));
if (stubs.length === 0) {
  console.log("No .asset.json stubs found — nothing to recover.");
  process.exit(0);
}

console.log(`Found ${stubs.length} placeholder(s). Downloading from ${base}\n`);

// ---- Phase 1: download everything into memory, fail loudly ----------------
const downloaded = [];
let failures = 0;

for (const stub of stubs) {
  const meta = JSON.parse(await readFile(join(ASSETS, stub), "utf8"));
  const realName = meta.original_filename ?? stub.replace(/\.asset\.json$/, "");
  const url = `${base}${meta.url}`;

  // If the real image is already sitting in src/assets (because it was added
  // by hand), use it and skip the download entirely.
  try {
    await access(join(ASSETS, realName));
    downloaded.push({ stub, realName, buf: null });
    console.log(`  local ${realName}  (already present, skipping download)`);
    continue;
  } catch {
    // not present locally — fall through and download it
  }

  try {
    if (!base) throw new Error("no Loveable URL given and file not present locally");
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const buf = Buffer.from(await res.arrayBuffer());

    // A Loveable 404 often returns the SPA's index.html with a 200 status.
    // Reject anything that isn't actually an image.
    const type = res.headers.get("content-type") ?? "";
    if (!type.startsWith("image/")) throw new Error(`got "${type}", not an image`);
    if (meta.size && Math.abs(buf.length - meta.size) > meta.size * 0.5) {
      throw new Error(`size mismatch: expected ~${meta.size}B, got ${buf.length}B`);
    }

    downloaded.push({ stub, realName, buf });
    console.log(`  ok    ${realName}  (${Math.round(buf.length / 1024)} KB)`);
  } catch (err) {
    failures++;
    console.error(`  FAIL  ${realName}  — ${err.message}`);
  }
}

if (failures > 0) {
  console.error(
    `\n${failures} of ${stubs.length} failed. Nothing was changed.\n\n` +
      `Most likely the app URL is wrong, or the Loveable project is no longer\n` +
      `serving. Check the preview URL and try again. If the project is gone,\n` +
      `re-add those images by hand: drop the real .jpg files into src/assets\n` +
      `using the exact filenames listed above, then re-run this script — it\n` +
      `will skip the download and just fix the imports.`,
  );
  process.exit(1);
}

// ---- Phase 2: write real files, remove stubs ------------------------------
for (const { stub, realName, buf } of downloaded) {
  if (buf) await writeFile(join(ASSETS, realName), buf);
  await unlink(join(ASSETS, stub));
}
console.log(`\nWrote ${downloaded.length} image(s), removed ${downloaded.length} stub(s).`);

// ---- Phase 3: rewrite imports and usages ---------------------------------
async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(p);
    else if (/\.(ts|tsx)$/.test(entry.name)) yield p;
  }
}

let filesTouched = 0;

for await (const file of walk(SRC)) {
  let code = await readFile(file, "utf8");
  const before = code;
  const identifiers = new Set();

  // import foo from "@/assets/bar.jpg.asset.json"  ->  "@/assets/bar.jpg"
  code = code.replace(
    /import\s+(\w+)\s+from\s+(["'])([^"']*\/assets\/[^"']+?)\.asset\.json\2/g,
    (_m, ident, q, path) => {
      identifiers.add(ident);
      return `import ${ident} from ${q}${path}${q}`;
    },
  );

  // A real image import is a URL string, so `foo.url` becomes just `foo`.
  for (const ident of identifiers) {
    code = code.replace(new RegExp(`\\b${ident}\\.url\\b`, "g"), ident);
  }

  if (code !== before) {
    await writeFile(file, code);
    filesTouched++;
    console.log(`  patched ${file.replace(resolve(".") + "/", "")}`);
  }
}

console.log(
  `\nDone. ${filesTouched} file(s) updated.\n\n` +
    `Next:\n` +
    `  npm run build     # confirm it compiles\n` +
    `  npm run dev       # eyeball the images locally\n` +
    `  git add -A && git commit -m "Recover image assets from Loveable" && git push\n`,
);
