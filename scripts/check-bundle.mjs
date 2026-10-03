import { readdir, readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

const distDirectory = resolve('dist');
const assetsDirectory = resolve(distDirectory, '_astro');
const budgets = {
  entryBytes: 35_000,
  largestChunkBytes: 700_000,
  totalJavaScriptBytes: 3_600_000,
};

const formatBytes = (value) => `${Math.round(value / 1024)} KiB`;

const assetEntries = await readdir(assetsDirectory);
const javascriptAssets = assetEntries.filter((entry) => entry.endsWith('.js'));
const javascriptSizes = await Promise.all(javascriptAssets.map(async (entry) => ({
  entry,
  bytes: (await stat(resolve(assetsDirectory, entry))).size,
})));
const totalJavaScriptBytes = javascriptSizes.reduce((total, asset) => total + asset.bytes, 0);
const largestChunk = javascriptSizes.reduce((largest, asset) => (asset.bytes > largest.bytes ? asset : largest));
const index = await readFile(resolve(distDirectory, 'index.html'), 'utf8');
const entryMatch = index.match(/<script type="module" src="\/_astro\/([^"]+\.js)">/);

if (!entryMatch) throw new Error('Could not find the initial module entry in dist/index.html.');

const entryAsset = javascriptSizes.find((asset) => asset.entry === entryMatch[1]);
if (!entryAsset) throw new Error('The initial module entry was not found in dist/_astro.');

const failures = [
  [entryAsset.bytes > budgets.entryBytes, `Initial entry is ${formatBytes(entryAsset.bytes)}; budget is ${formatBytes(budgets.entryBytes)}.`],
  [largestChunk.bytes > budgets.largestChunkBytes, `Largest chunk (${largestChunk.entry}) is ${formatBytes(largestChunk.bytes)}; budget is ${formatBytes(budgets.largestChunkBytes)}.`],
  [totalJavaScriptBytes > budgets.totalJavaScriptBytes, `Total JavaScript is ${formatBytes(totalJavaScriptBytes)}; budget is ${formatBytes(budgets.totalJavaScriptBytes)}.`],
].filter(([failed]) => failed).map(([, message]) => message);

console.log(`Bundle budget: entry ${formatBytes(entryAsset.bytes)}, largest ${formatBytes(largestChunk.bytes)}, total ${formatBytes(totalJavaScriptBytes)}.`);

if (failures.length > 0) {
  failures.forEach((failure) => console.error(failure));
  process.exitCode = 1;
}
