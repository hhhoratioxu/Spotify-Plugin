import {readFileSync, writeFileSync, mkdirSync, readlinkSync, lstatSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const parent = fileURLToPath(new URL('../../', import.meta.url));
const before = JSON.parse(readFileSync(join(root, 'provenance/parent-files-before.json')));
const sha = b => createHash('sha256').update(b).digest('hex');
const changed = [];
for (const [path, item] of Object.entries(before.files)) {
  try {
    const file = join(parent, path), bytes = readFileSync(file);
    if (bytes.length !== item.bytes || sha(bytes) !== item.sha256 || (item.symlink && (!lstatSync(file).isSymbolicLink() || readlinkSync(file) !== item.symlink))) changed.push(path);
  } catch { changed.push(path); }
}
const report = {recordedAt:new Date().toISOString(), filesChecked:Object.keys(before.files).length, changed, parentIndexUnchanged:sha(readFileSync(join(parent,'.git/index'))) === before.parentIndexSHA256, parentIgnoreUnchanged:sha(readFileSync(join(parent,'.gitignore'))) === before.parentIgnoreSHA256};
mkdirSync(join(root, 'evidence'), {recursive:true}); writeFileSync(join(root, 'evidence/parent-preservation.json'), JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
if (changed.length || !report.parentIndexUnchanged || !report.parentIgnoreUnchanged) process.exitCode = 1;
