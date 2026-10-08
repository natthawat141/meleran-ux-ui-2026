import { spawn, type ChildProcess } from 'node:child_process';
import { createConnection } from 'node:net';
import path from 'node:path';
import type { Plugin } from 'vite';

const port = 8787;
const healthUrl = `http://127.0.0.1:${port}/mock-api/v1/courses`;

async function catalogApiHealthy(timeoutMs = 0): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  do {
    try {
      const response = await fetch(healthUrl);
      if (response.ok && response.headers.get('x-melearn-mock') === 'provisional-api') return true;
    } catch {
      // The dev server is not accepting connections yet.
    }
    if (timeoutMs === 0) return false;
    await new Promise((resolve) => setTimeout(resolve, 100));
  } while (Date.now() < deadline);
  return false;
}

function portTaken(): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ host: '127.0.0.1', port });
    const finish = (open: boolean) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(open);
    };
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
  });
}

/** Starts the in-memory catalog API for `vite dev` only. Production builds never call this. */
export function devCatalogServerPlugin(repoRoot: string): Plugin {
  let child: ChildProcess | undefined;
  let owned = false;
  return {
    name: 'dev-catalog-api',
    async configureServer(server) {
      if (!(await catalogApiHealthy())) {
        if (await portTaken()) {
          server.config.logger.error(`[catalog] port ${port} is already used, and it is not the dev catalog API. Guest /courses will show a load error.`);
        } else {
          child = spawn(process.execPath, [path.join(repoRoot, 'tools/provisional-api/dev-server.ts')], {
            cwd: repoRoot,
            stdio: 'inherit',
          });
          owned = true;
          if (!(await catalogApiHealthy(5_000))) {
            server.config.logger.error('[catalog] the dev catalog API did not become ready. Guest /courses will show a load error.');
          }
        }
      }
      server.httpServer?.once('close', () => {
        if (owned) child?.kill();
      });
    },
  };
}
