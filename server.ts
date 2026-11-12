import 'dotenv/config';
import express from 'express';
import path from 'path';
import app from './api/index.ts';

// Lokální spuštění: API z api/index.ts + frontend (v dev Vite middleware, v produkci složka dist/).
// Na Vercelu se tento soubor nepoužívá – tam běží api/index.ts jako funkce a dist/ jako statické soubory.
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const dist = path.resolve(import.meta.dirname, 'dist');
    app.use(express.static(dist));
    app.get('*', (req, res) => {
      res.sendFile(path.join(dist, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
