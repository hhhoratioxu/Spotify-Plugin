import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const root = new URL('../', import.meta.url);

export function validateRelease(value) {
  if (value?.schema !== 1 || value.repository !== 'hhhoratioxu/SpotifyLyrics' ||
      !/^[0-9a-f]{40}$/.test(value.revision) || value.core !== '3.2.2' ||
      !Array.isArray(value.artifacts) || value.artifacts.length !== 18) throw Error('Invalid runtime release');
  const paths = new Set();
  for (const item of value.artifacts) {
    if (!/^(?:Loon|Surge|Egern|QuantumultX|Shadowrocket)\/script\/(?:SpotifyLyrics\/)?[A-Za-z][A-Za-z0-9.-]*\.(?:js|txt)$/.test(item.path) ||
        !Number.isSafeInteger(item.bytes) || item.bytes < 1 || !/^[0-9a-f]{64}$/.test(item.sha256) || paths.has(item.path)) throw Error('Invalid runtime artifact');
    paths.add(item.path);
  }
  return value;
}

export const runtimeRelease = validateRelease(JSON.parse(readFileSync(new URL('provenance/runtime-release.json', root), 'utf8')));

export function runtimeURL(path, release = runtimeRelease) {
  validateRelease(release);
  if (!release.artifacts.some(item => item.path === path)) throw Error('Runtime artifact is not pinned: ' + path);
  return 'https://raw.githubusercontent.com/' + release.repository + '/' + release.revision + '/' + path;
}

// Only current native import files use this relocation. Historical source,
// original compatibility entries and provenance objects retain their bytes.
export function relocateProfile(profile, release = runtimeRelease) {
  validateRelease(release);
  return profile
    .replace(/https:\/\/raw\.githubusercontent\.com\/hhhoratioxu\/Proxy\/[0-9a-f]{40}\/([A-Za-z0-9./_-]+)/g, (_, path) => runtimeURL(path, release))
    .replaceAll('https://github.com/hhhoratioxu/Proxy/blob/main/', 'https://github.com/hhhoratioxu/SpotifyLyrics/blob/main/');
}

export function verifyRuntimeArtifacts(base = root, release = runtimeRelease) {
  validateRelease(release);
  for (const item of release.artifacts) {
    const bytes = readFileSync(new URL(item.path, base));
    if (bytes.length !== item.bytes || createHash('sha256').update(bytes).digest('hex') !== item.sha256) throw Error('Pinned runtime changed: ' + item.path);
  }
  return release.artifacts.length;
}
