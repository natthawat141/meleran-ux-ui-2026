import { spawn, type ChildProcess } from 'node:child_process';
import { createConnection } from 'node:net';
import path from 'node:path';
import type { Plugin } from 'vite';

const port = Number(process.env.MELEARN_MOCK_PORT ?? 8787);
const healthUrl = `http://127.0.0.1:${port}/mock-api/v1/courses`;

export function adminProvisionalApiPlugin(repoRoot: string): Plugin {
  let child: ChildProcess | undefined;
  let owned = false;
  return {
    name: 'admin-provisional-api',
    async configureServer(server) {
      try {
        const response = await fetch(healthUrl);
        if (response.ok && response.headers.get('x-melearn-mock') === 'provisional-api') return;
      } catch { /* Start the shared development server below. */ }
      const busy = await new Promise<boolean>((resolve) => {
        const socket = createConnection({ host: '127.0.0.1', port });
        const finish = (value: boolean) => { socket.destroy(); resolve(value); };
        socket.once('connect', () => finish(true)); socket.once('error', () => finish(false));
      });
      if (busy) { server.config.logger.error(`[mock API] port ${port} is occupied by an unknown service.`); return; }
      child = spawn(process.execPath, [path.join(repoRoot, 'tools/provisional-api/dev-server.ts')], { cwd: repoRoot, stdio: 'inherit' });
      owned = true;
      const deadline = Date.now() + 5_000;
      while (Date.now() < deadline) {
        try { const response = await fetch(healthUrl); if (response.ok && response.headers.get('x-melearn-mock') === 'provisional-api') break; }
        catch { /* Wait briefly while the process starts. */ }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      server.httpServer?.once('close', () => { if (owned) child?.kill(); });
    },
  };
}
