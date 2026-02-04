import type { Express } from "express";
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { type Server } from "http";
// Use dynamic import for 'vite' only in development to avoid importing it in production bundles

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  const isDev = process.env.NODE_ENV === 'development';
  
  if (isDev) {
    // Use Vite dev server in middleware mode to transform TSX/ESM
    const viteModule: any = await import('vite');
    const viteServer = await viteModule.createServer({
      root: __dirname,
      server: { middlewareMode: true },
      appType: 'spa',
    });

    app.use(viteServer.middlewares);

    app.use("*", async (req, res, next) => {
      const url = req.originalUrl;
      if (url.startsWith('/api')) return next();
      try {
        const templatePath = path.resolve(__dirname, "index.html");
        let template = await fs.promises.readFile(templatePath, "utf-8");
        template = await viteServer.transformIndexHtml(url, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (e) {
        next(e);
      }
    });
  } else {
    // Production mode: serve built assets
    const distPath = path.resolve(__dirname);
    app.use(express.static(distPath));
    
    // Handle client-side routing
    app.use("*", async (req, res, next) => {
      const url = req.originalUrl;
      
      // Skip API routes
      if (url.startsWith('/api')) {
        return next();
      }

      try {
        const template = await fs.promises.readFile(
          path.resolve(distPath, "index.html"),
          "utf-8"
        );
        
        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (e) {
        console.error('Error serving HTML:', e);
        next(e);
      }
    });
  }
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname);
  app.use(express.static(distPath));
  app.get("*", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}


