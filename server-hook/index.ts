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
const PORT = process.env.WEBHOOK_PORT || 3505;

// Security middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false
}));

// CORS - Allow all origins for webhook endpoints since they come from external providers
app.use(cors({
  origin: true, // Allow all origins for webhooks
  credentials: false // Don't need credentials for webhooks
}));

// Trust proxy for proper IP detection
app.set('trust proxy', 1);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Enhanced request logging with full debug info
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`\n🔍 ${timestamp} - ${req.method} ${req.url} from ${req.ip}`);
  
  // Log all headers
  console.log('📋 HEADERS:', JSON.stringify(req.headers, null, 2));
  
  // Log query parameters
  if (Object.keys(req.query).length > 0) {
    console.log('🔍 QUERY PARAMS:', JSON.stringify(req.query, null, 2));
  }
  
  // Log body for POST/PUT requests (will be populated after body parser)
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    // We'll log the body in the route handlers since it needs to be parsed first
    console.log('📤 REQUEST METHOD:', req.method);
    console.log('📍 REQUEST URL:', req.url);
    console.log('🌐 CLIENT IP:', req.ip);
    console.log('🕐 TIMESTAMP:', timestamp);
  }
  
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'webhook-server',
    port: PORT
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.setHeader('Content-Type', 'text/plain');
  res.send('Authentik Webhook Server - Ready');
});

// Mount webhook routes under multiple paths to catch different webhook URLs
app.use('/api/webhooks', webhookRoutes);
app.use('/api/webhook', webhookRoutes); // Handle singular form
app.use('/webhooks', webhookRoutes);     // Handle without /api prefix
app.use('/webhook', webhookRoutes);      // Handle singular without /api prefix

// Error handling middleware
app.use((err: any, req: any, res: any, next: any) => {
  console.error('Webhook server error:', err);
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
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Authentik Webhook Server running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 Webhook endpoints:`);
  console.log(`   - GET  http://localhost:${PORT}/api/webhooks/resend`);
  console.log(`   - POST http://localhost:${PORT}/api/webhooks/resend`);
  console.log(`   - POST http://localhost:${PORT}/api/webhooks/postmark`);
  console.log(`   - POST http://localhost:${PORT}/api/webhooks/test/webhook-event`);
  console.log(`🎯 Ready to receive webhook events!`);
});

export default app;
