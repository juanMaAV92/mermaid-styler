import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

export const MESSAGE = 'Insert sanitized nodes with importNode/replaceChildren (AUD-015).';

const assignment = /\.innerHTML\s*\+?=(?!=)/;
const allowComment = /lint-allow-inner-html\s+--\s+\S/;

export function findInnerHtmlAssignments(text, file) {
  const lines = text.split(/\r?\n/);
  const hits = [];
  lines.forEach((line, index) => {
    if (!assignment.test(line)) return;
    if (index > 0 && allowComment.test(lines[index - 1])) return;
    hits.push({ file, line: index + 1 });
  });
  return hits;
}

async function* walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (/\.(ts|astro)$/.test(entry.name)) yield path;
  }
}

async function main() {
  const hits = [];
  for await (const path of walk('src')) {
    hits.push(...findInnerHtmlAssignments(await readFile(path, 'utf8'), relative('.', path)));
  }
  for (const hit of hits) console.error(`${hit.file}:${hit.line} ${MESSAGE}`);
  if (hits.length > 0) process.exit(1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
