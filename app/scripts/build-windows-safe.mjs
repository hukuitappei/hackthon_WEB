import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const sourceDir = process.cwd()
const stagingRoot = join(homedir(), '.codex', 'memories', 'vite-build-staging')
const stagingDir = join(stagingRoot, 'app')

rmSync(stagingDir, { recursive: true, force: true })
mkdirSync(stagingRoot, { recursive: true })

cpSync(sourceDir, stagingDir, {
  recursive: true,
  force: true,
  filter(source) {
    const normalized = source.replaceAll('\\', '/')
    return (
      !normalized.includes('/dist/') &&
      !normalized.endsWith('/dist') &&
      !normalized.includes('/node_modules/') &&
      !normalized.endsWith('/node_modules')
    )
  },
})

const runInStaging = (command) =>
  process.platform === 'win32'
    ? spawnSync(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', command], {
        cwd: stagingDir,
        stdio: 'inherit',
        shell: false,
      })
    : spawnSync('sh', ['-lc', command], {
        cwd: stagingDir,
        stdio: 'inherit',
        shell: false,
      })

const installResult = runInStaging('npm install --include=dev')

if (installResult.error) {
  throw installResult.error
}

if (installResult.status !== 0) {
  process.exit(installResult.status ?? 1)
}

const result = runInStaging('npm run build')

if (result.error) {
  throw result.error
}

if (result.status !== 0) {
  process.exit(result.status ?? 1)
}

const builtDist = join(stagingDir, 'dist')

if (!existsSync(builtDist)) {
  console.error('staging build succeeded but dist was not found')
  process.exit(1)
}

const targetDist = join(sourceDir, 'dist')

if (process.platform === 'win32') {
  const mirrorResult = spawnSync('robocopy', [builtDist, targetDist, '/MIR', '/NFL', '/NDL', '/NJH', '/NJS', '/NP'], {
    cwd: stagingDir,
    stdio: 'inherit',
    shell: false,
  })

  if (mirrorResult.error) {
    throw mirrorResult.error
  }

  if ((mirrorResult.status ?? 8) >= 8) {
    process.exit(mirrorResult.status ?? 1)
  }
} else {
  rmSync(targetDist, { recursive: true, force: true })
  cpSync(builtDist, targetDist, { recursive: true, force: true })
}

console.log(`Copied build output back to ${targetDist}`)
