import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const scriptPath = join(process.cwd(), 'scripts', 'generate_cognito_branding_assets.py')
const codexPython = join(
  homedir(),
  '.cache',
  'codex-runtimes',
  'codex-primary-runtime',
  'dependencies',
  'python',
  'python.exe',
)

const candidates = [
  process.env.PYTHON,
  'python',
  'py',
  existsSync(codexPython) ? codexPython : '',
].filter(Boolean)

let lastError = ''

for (const candidate of candidates) {
  const result = spawnSync(candidate, [scriptPath], {
    cwd: process.cwd(),
    encoding: 'utf8',
    shell: false,
  })

  if (result.error) {
    lastError = result.error.message
    continue
  }

  if (result.status === 0) {
    if (result.stdout) {
      process.stdout.write(result.stdout)
    }
    if (result.stderr) {
      process.stderr.write(result.stderr)
    }
    process.exit(0)
  }

  lastError = result.stderr || result.stdout || `Python exited with status ${result.status}`
}

console.error('Could not run the Cognito branding generator.')
console.error(lastError || 'Install Python and Pillow, or set the PYTHON environment variable.')
process.exit(1)
