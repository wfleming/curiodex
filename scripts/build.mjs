import * as esbuild from 'esbuild'
import { spawn, execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const watch = process.argv.includes('--watch')

async function typecheck() {
  try {
    await execFileAsync('node_modules/.bin/tsc', ['--noEmit', '--incremental', '--pretty', 'false'])
    return { ok: true, output: '' }
  } catch (err) {
    return { ok: false, output: String(err.stdout || err.message).trim() }
  }
}

const clientOpts = {
  entryPoints: ['src/client/index.tsx'],
  bundle: true,
  outdir: 'public',
  format: 'esm',
  sourcemap: true,
  jsx: 'automatic',
  jsxImportSource: 'preact',
  logLevel: 'info',
}

const serverOpts = {
  entryPoints: ['src/server/index.ts'],
  bundle: true,
  outfile: 'dist/server.js',
  platform: 'node',
  format: 'esm',
  packages: 'external',
  sourcemap: true,
  logLevel: 'info',
}

if (watch) {
  let child

  function typecheckGate({ restartServer }) {
    return {
      name: 'typecheck-gate',
      setup(build) {
        build.onEnd(async (result) => {
          if (result.errors.length) return

          const check = await typecheck()
          if (!check.ok) {
            console.error(`\n[typecheck] failed:\n${check.output}\n`)
            return
          }

          if (restartServer) {
            child?.kill()
            child = spawn('node', ['dist/server.js'], { stdio: 'inherit' })
          }
        })
      },
    }
  }

  const serverCtx = await esbuild.context({
    ...serverOpts,
    plugins: [typecheckGate({ restartServer: true })],
  })
  const clientCtx = await esbuild.context({
    ...clientOpts,
    plugins: [typecheckGate({ restartServer: false })],
  })

  await Promise.all([serverCtx.watch(), clientCtx.watch()])

  process.on('SIGTERM', () => child?.kill())
  process.on('SIGINT', () => child?.kill())
} else {
  await esbuild.build(clientOpts)
  await esbuild.build(serverOpts)

  const check = await typecheck()
  if (!check.ok) {
    console.error(`\n[typecheck] failed:\n${check.output}\n`)
    process.exit(1)
  }
}
