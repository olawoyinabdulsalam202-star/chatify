import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { execSync } from 'node:child_process'

// Short commit the bundle was built from, shown in Settings -> About so QA can
// confirm the live site matches the latest commit before chasing a bug that's
// already fixed (a stale deploy has burned us before). Vercel builds from a
// detached checkout where `git rev-parse` can be unavailable, so its own
// VERCEL_GIT_COMMIT_SHA is the fallback; "unknown" if neither answers.
function resolveCommitHash() {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    const sha = process.env.VERCEL_GIT_COMMIT_SHA
    return sha ? sha.slice(0, 7) : 'unknown'
  }
}

const COMMIT_HASH = resolveCommitHash()
const BUILT_AT = new Date().toISOString()

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
        JSON.stringify({ buildId: BUILD_ID, commit: COMMIT_HASH, builtAt: BUILT_AT }) + '\n'
      )
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), versionManifest()],
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
    __COMMIT_HASH__: JSON.stringify(COMMIT_HASH),
    __BUILT_AT__: JSON.stringify(BUILT_AT),
  },
})
