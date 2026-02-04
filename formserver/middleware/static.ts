import express from 'express';
import { createServer as createViteServer } from 'vite';

let vite: any = null;

export const serveStatic = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    if (!vite) {
      vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
        root: process.cwd()
      });
    }
    vite.ssrLoadModule('/src/main.tsx');
    vite.middlewares(req, res, next);
  } catch (error) {
    console.error('Vite middleware error:', error);
    next();
  }
};