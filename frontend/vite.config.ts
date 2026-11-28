import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { isStaffRoute } from './src/staff-routes';

const hmrClientPort = process.env.VITE_HMR_CLIENT_PORT;
const serverOrigin = 'http://server:3000';

export default defineConfig({
  plugins: [react(), tailwindcss(), {
    name: 'staff-page-access',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const path = request.url?.split('?')[0].replace(/\/+$/, '');
        if (!isStaffRoute(path)) return next();
        response.setHeader('Cache-Control', 'no-store');
        try {
          const session = await fetch(`${serverOrigin}/api/staff/session`, {
            headers: { cookie: request.headers.cookie ?? '' }, signal: AbortSignal.timeout(4_000),
          });
          if (session.status === 401 || session.status === 403) {
            response.writeHead(303, { Location: '/staff/login' }).end();
            return;
          }
          if (!session.ok) throw new Error('Staff session unavailable');
          const { role } = await session.json() as { role: string };
          if (path !== '/staff/agenda' && role !== 'ADMIN') {
            response.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Acces rezervat administratoarei.');
            return;
          }
          next();
        } catch {
          response.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' })
            .end('Verificarea sesiunii este temporar indisponibilă.');
        }
      });
    },
  }],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    hmr: hmrClientPort ? { clientPort: Number(hmrClientPort) } : undefined,
    proxy: {
      '/api': { target: serverOrigin },
    },
  },
});
