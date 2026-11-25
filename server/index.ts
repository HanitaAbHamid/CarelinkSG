import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import { initDb } from './db.js';
import { apiRouter } from './routes.js';

export function createApp() {
  initDb();
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  app.use('/api', apiRouter);

  // Serve built PWA in production
  const distDir = path.resolve(process.cwd(), 'dist');
  if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get(/^(?!\/api).*/, (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  return app;
}

// Only bind listener when invoked directly
const isDirectRun =
  process.argv[1] &&
  (process.argv[1].endsWith('index.ts') || process.argv[1].endsWith('index.js'));

if (isDirectRun) {
  const port = Number(process.env.PORT || 3001);
  const app = createApp();
  app.listen(port, '127.0.0.1', () => {
    console.log(`[CareLink SG] Server listening on http://127.0.0.1:${port} (region: ${process.env.DATA_RESIDENCY_REGION || 'ap-southeast-1'})`);
  });
}
