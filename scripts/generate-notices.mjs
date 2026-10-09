import { readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const lock = JSON.parse(await readFile('package-lock.json', 'utf8'));
const notices = ['Third-party software licenses\nGenerated from package-lock.json; includes installed production dependencies.\n'];
for (const [path, entry] of Object.entries(lock.packages)) {
  if (!path.startsWith('node_modules/') || entry.dev) continue;
  const directory = resolve(path);
  let files;
  try { files = await readdir(directory); } catch { continue; } // platform-specific optional package
  const metadata = JSON.parse(await readFile(resolve(directory, 'package.json'), 'utf8'));
  notices.push(`\n=== ${metadata.name}@${metadata.version} (${metadata.license ?? entry.license ?? 'See package terms'}) ===\n`);
  const licenses = files.filter((name) => /^(licen[cs]e|copying|notice)([.-]|$)/i.test(name));
  for (const file of licenses) {
    try { notices.push(await readFile(resolve(directory, file), 'utf8')); } catch { /* directory, not a license file */ }
  }
  if (!licenses.length) notices.push(`License metadata: ${metadata.license ?? entry.license ?? 'not declared'}\n`);
}
await writeFile('dist/third-party-licenses.txt', notices.join('\n'));
console.log('Generated dist/third-party-licenses.txt');
