import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

// One id per build, stamped into two places: compiled into the bundle as
// __BUILD_ID__, and written to dist/version.json.
//
// That pairing is the whole update mechanism. The running app knows the id it
// was built with; version.json says the id the server is currently serving. If
// they disagree, a newer deploy exists. Nothing else on the page can answer
// that question — the service worker only notices when sw.js itself changes,
// and hashed asset URLs are invisible to code that already loaded.
const BUILD_ID = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)

function versionManifest() {
  return {
    name: 'havn-version-manifest',
    apply: 'build',
    // writeBundle, not emitFile: public/ is copied into dist/ during the build,
    // so an emitted asset can be clobbered. This runs after that copy.
    writeBundle(options) {
      const outDir = options.dir || resolve(process.cwd(), 'dist')
      mkdirSync(outDir, { recursive: true })
      writeFileSync(
        resolve(outDir, 'version.json'),
        JSON.stringify({ buildId: BUILD_ID, builtAt: new Date().toISOString() }) + '\n'
      )
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), versionManifest()],
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
})
