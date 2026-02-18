// Load environment variables FIRST - before any other imports
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory of this file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from parent directory - must happen before importing db
const envPath = path.join(__dirname, '..', '.env');
dotenv.config({ path: envPath });

// Now we can safely import modules that depend on environment variables
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { webhookRoutes } from './routes/webhookRoutes';

const app = express();
const PORT = process.env.BOUNCE_WEBHOOK_PORT || 5003;

// Security middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false
}));

// CORS - Allow all origins for webhook endpoints
app.use(cors({
  origin: true,
  credentials: false
}));

// Trust proxy for proper IP detection
app.set('trust proxy', 1);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    console.log(`📨 ${new Date().toISOString()} - ${req.method} ${req.url} from ${req.ip}`);
  }
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'webhook-bounces',
    port: PORT
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.setHeader('Content-Type', 'text/plain');
  res.send('Authentik Bounce Webhook Server - Ready');
});

// Mount webhook routes
app.use('/api/webhooks', webhookRoutes);
app.use('/api/webhook', webhookRoutes);
app.use('/webhooks', webhookRoutes);
app.use('/webhook', webhookRoutes);

// Error handling middleware
app.use((err: any, req: any, res: any, next: any) => {
  console.error('[Bounce Webhook] Server error:', err);
  res.status(500).json({
    message: 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    message: 'Endpoint not found',
    path: req.url,
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`🛡️  Bounce Webhook Server running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 Endpoints:`);
  console.log(`   - POST http://localhost:${PORT}/api/webhooks/resend     (Resend bounces/suppressions)`);
  console.log(`   - POST http://localhost:${PORT}/api/webhooks/postmark   (Postmark bounces)`);
  console.log(`   - POST http://localhost:${PORT}/api/webhooks/add        (Manual add)`);
  console.log(`   - GET  http://localhost:${PORT}/api/webhooks/list       (List all)`);
  console.log(`🎯 Ready to receive bounce/suppression events!`);
});

export default app;
