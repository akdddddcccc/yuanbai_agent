// Verify the immutable v6 static archive against a fresh school build.
import {readFile, readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(await readFile(path.join(root, 'releases/school-v6-20261013/static-manifest.json'), 'utf8'));
const directory = path.join(root, 'dist-school/public');
const found = [];
async function walk(dir) {
  for (const entry of await readdir(dir, {withFileTypes: true})) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(file);
    else found.push(path.relative(directory, file).split(path.sep).join('/'));
  }
}
await walk(directory);
const failures = found.filter(file => !Object.hasOwn(manifest.files, file)).map(file => `Unexpected: ${file}`);
for (const [file, expected] of Object.entries(manifest.files)) {
  const data = await readFile(path.join(directory, file)).catch(() => null);
  if (!data || createHash('sha256').update(data).digest('hex') !== expected) failures.push(`Mismatch or missing: ${file}`);
}
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else console.log(`Verified ${found.length} static files: exact match to deployed v6 archive.`);
