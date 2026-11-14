import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const base = new URL('../provenance/', import.meta.url);
const index = JSON.parse(readFileSync(new URL('snapshots.json', base), 'utf8'));

// The old commit is a provenance identifier, never a lookup in a parent .git.
export function sourceBuffer(revision, path) {
  if (!/^[0-9a-f]{40}$/.test(revision) || typeof path !== 'string' || path.startsWith('/') || path.split('/').some(p => !p || p === '.' || p === '..')) throw Error('Invalid source identity');
  const files = index.revisions[revision];
  const item = files && Object.hasOwn(files, path) ? files[path] : null;
  if (!item || !/^objects\/[0-9a-f]{64}\.txt$/.test(item.object)) throw Error('Source not exported: ' + revision + ':' + path);
  const bytes = readFileSync(new URL(item.object, base));
  if (bytes.length !== item.bytes || createHash('sha256').update(bytes).digest('hex') !== item.sha256) throw Error('Source snapshot integrity failure: ' + path);
  return bytes;
}

export function verifySnapshots() {
  let count = 0;
  for (const [revision, files] of Object.entries(index.revisions)) for (const path of Object.keys(files)) { sourceBuffer(revision, path); count++; }
  return count;
}
