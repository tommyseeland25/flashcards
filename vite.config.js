import { defineConfig } from 'vite';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * After a build, fill in public/sw.js's two placeholders: the list of every output file to
 * precache, and a cache name derived from the files' contents (so any change = a new cache = the
 * browser notices there is an update). Reads the real output folder so nothing can be missed.
 */
function stampServiceWorker() {
  let outDir;
  return {
    name: 'stamp-service-worker',
    apply: 'build',
    configResolved: (config) => { outDir = config.build.outDir; },
    closeBundle() {
      const files = readdirSync(outDir, { recursive: true, withFileTypes: true })
        .filter((e) => e.isFile())
        .map((e) => relative(outDir, join(e.parentPath, e.name)).split('\\').join('/'))
        .filter((f) => f !== 'sw.js' && !f.endsWith('.map'))
        .sort();
      const hash = createHash('sha256');
      for (const f of files) hash.update(f).update(readFileSync(join(outDir, f)));

      const swPath = join(outDir, 'sw.js');
      const stamped = readFileSync(swPath, 'utf8')
        .replace('__CACHE_NAME__', `flashcards-${hash.digest('hex').slice(0, 10)}`)
        .replace('__PRECACHE__', JSON.stringify(['./', ...files]));
      if (stamped.includes('__PRECACHE__') || stamped.includes('__CACHE_NAME__')) throw new Error('sw.js placeholders were not replaced');
      writeFileSync(swPath, stamped);
    },
  };
}

export default defineConfig({
  base: './', // relative URLs, so the app works from any folder or sub-path (e.g. GitHub Pages)
  plugins: [stampServiceWorker()],
  test: {
    include: ['tests/**/*.test.js'],
  },
});
