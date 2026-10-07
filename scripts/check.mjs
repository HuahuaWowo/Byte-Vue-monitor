import { readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
const skip = new Set([".git", "node_modules", "dist", "demo-dist", "test-results", "playwright-report"]);
async function walk(dir) {
  let files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (skip.has(entry.name)) continue;
    const path = dir + "/" + entry.name;
    files.push(...(entry.isDirectory() ? await walk(path) : /\.(js|mjs)$/.test(path) ? [path] : []));
  }
  return files;
}
const files = await walk(".");
for (const file of files) {
  const check = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (check.status) { console.error(file, check.stderr); process.exit(1); }
}
console.log("Parsed " + files.length + " JavaScript modules");
