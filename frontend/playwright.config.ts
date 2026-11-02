/**
 * End-to-end tests against the real FastAPI backend (local JSON storage, an
 * in-memory publisher and a throwaway history file) and the Vite dev server.
 * No AWS access is needed. Ports differ from the defaults so a running dev
 * setup does not collide with the test servers.
 */
import { defineConfig, devices } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const API_PORT = 8017
const WEB_PORT = 4399
const repoRoot = path.resolve(import.meta.dirname, '..')

function pythonExecutable(): string {
  if (process.env.PYTHON) return process.env.PYTHON
  const venv = path.join(repoRoot, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python')
  return fs.existsSync(venv) ? venv : 'python'
}

const historyFile = path.join(os.tmpdir(), `eventgate-e2e-${process.pid}-${Date.now()}.json`)

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 30_000,
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: [
    {
      command: `"${pythonExecutable()}" -m uvicorn eventgate.main:app --port ${API_PORT}`,
      cwd: repoRoot,
      url: `http://127.0.0.1:${API_PORT}/health`,
      env: { PYTHONPATH: path.join(repoRoot, 'backend', 'src'), EVENTGATE_HISTORY_FILE: historyFile },
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `npx vite --port ${WEB_PORT} --strictPort`,
      url: `http://localhost:${WEB_PORT}`,
      env: { VITE_EVENTGATE_API_URL: `http://127.0.0.1:${API_PORT}` },
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
})
