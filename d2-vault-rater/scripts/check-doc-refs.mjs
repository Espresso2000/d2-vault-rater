#!/usr/bin/env node
/**
 * Checks every relative link in docs/ (npm run docs:check):
 *  - the linked file or folder exists;
 *  - a #L<n> or #L<n>-L<m> anchor points at lines the file has;
 *  - link text ending in ":<n>" or ":<n>-<m>" names the same lines as the anchor.
 * Links inside fenced code blocks and links to other sites are skipped. Exits 1 on any failure.
 * Usage: node scripts/check-doc-refs.mjs [docs folder]
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const docsDir = resolve(process.argv[2] ?? join(import.meta.dirname, "..", "docs"));
const docs = readdirSync(docsDir, { recursive: true })
  .map(String)
  .filter((f) => f.endsWith(".md"))
  .map((f) => join(docsDir, f));

const lineCounts = new Map();
function lineCount(file) {
  if (!lineCounts.has(file)) {
    const lines = readFileSync(file, "utf8").split(/\r?\n/);
    if (lines.at(-1) === "") lines.pop();
    lineCounts.set(file, lines.length);
  }
  return lineCounts.get(file);
}

const errors = [];
let links = 0;
let lineRefs = 0;
for (const doc of docs) {
  // Blank out fenced code so example links there aren't checked; keeps line numbers for messages.
  const text = readFileSync(doc, "utf8").replace(/```[\s\S]*?```/g, (block) => block.replace(/[^\n]/g, " "));
  for (const m of text.matchAll(/\[([^\]]*)\]\(([^)\s]+)\)/g)) {
    const [, label, href] = m;
    if (/^[a-z][\w+.-]*:/i.test(href) || href.startsWith("#")) continue;
    links++;
    const at = `${relative(process.cwd(), doc)}:${text.slice(0, m.index).split("\n").length}`;
    const [path, anchor] = href.split("#");
    const target = resolve(dirname(doc), decodeURIComponent(path));
    if (!existsSync(target)) {
      errors.push(`${at}: ${href}: no such file`);
      continue;
    }
    const lines = anchor && /^L(\d+)(?:-L(\d+))?$/.exec(anchor);
    if (!lines) {
      if (anchor && !target.endsWith(".md")) errors.push(`${at}: ${href}: anchor should be #L<n> or #L<n>-L<m>`);
      continue;
    }
    lineRefs++;
    if (!statSync(target).isFile()) {
      errors.push(`${at}: ${href}: line anchor on a folder`);
      continue;
    }
    const from = Number(lines[1]);
    const to = Number(lines[2] ?? lines[1]);
    const count = lineCount(target);
    if (from < 1 || to < from || to > count) errors.push(`${at}: ${href}: ${path} has ${count} lines`);
    const named = /:(\d+)(?:-(\d+))?\s*$/.exec(label.replace(/`/g, ""));
    if (named && (Number(named[1]) !== from || Number(named[2] ?? named[1]) !== to)) errors.push(`${at}: [${label}] does not match #${anchor}`);
  }
}

for (const e of errors) console.error(e);
console.log(`${docs.length} docs, ${links} relative links, ${lineRefs} line references, ${errors.length} problems`);
process.exit(errors.length ? 1 : 0);
