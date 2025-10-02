import dotenv from 'dotenv';
import path from 'path';
import { Server, ServerCredentials } from '@grpc/grpc-js';
import { TemporalWorkerService } from './services/temporal-worker';
import { NewsletterGrpcService } from './services/newsletter-grpc-service';
import { WorkflowGrpcService } from './services/workflow-grpc-service';
import { loadProtoDefinitions } from './utils/proto-loader';
import { serverLogger } from './logger';
import { ActivityConfig } from './activity-config';

// Load environment variables (local .env and monorepo root .env)
const localEnv = dotenv.config();
const rootEnvPath = path.resolve(__dirname, '../../.env');
const rootEnv = dotenv.config({ path: rootEnvPath });

serverLogger.info(
  `🧪 [Env] Loaded local .env: ${localEnv.error ? 'no' : 'yes'} | loaded root .env (${rootEnvPath}): ${rootEnv.error ? 'no' : 'yes'}`
);
serverLogger.info(
  `🧪 [Env] RESEND_API_KEY present: ${process.env.RESEND_API_KEY ? 'yes' : 'no'}, PRIMARY_EMAIL_PROVIDER: ${process.env.PRIMARY_EMAIL_PROVIDER || 'unset'}`
);

// Create activity configuration from environment variables
const activityConfig: ActivityConfig = {
  backendUrl: process.env.BACKEND_URL || 'http://localhost:3500',
  resendApiKey: process.env.RESEND_API_KEY || '',
  postmarkApiToken: process.env.POSTMARK_API_TOKEN || '',
  primaryEmailProvider: process.env.PRIMARY_EMAIL_PROVIDER || 'resend',
  frontendUrl: process.env.FRONTEND_URL || 'https://app.zendwise.work',
  fromEmail: process.env.FROM_EMAIL || 'admin@zendwise.work',
  emailConcurrencyLimit: parseInt(process.env.EMAIL_CONCURRENCY_LIMIT || '5')
};

serverLogger.info(`🔧 Activity configuration created - Backend: ${activityConfig.backendUrl}, Provider: ${activityConfig.primaryEmailProvider}, From: ${activityConfig.fromEmail}, Resend: ${activityConfig.resendApiKey ? 'yes' : 'no'}, Postmark: ${activityConfig.postmarkApiToken ? 'yes' : 'no'}`);

const PORT = process.env.TEMPORAL_SERVER_PORT || 50051;
const TEMPORAL_ADDRESS = process.env.TEMPORAL_ADDRESS || '100.125.36.104:7233';
const TEMPORAL_NAMESPACE = process.env.TEMPORAL_NAMESPACE || 'default';
const TEMPORAL_TASK_QUEUE = process.env.TEMPORAL_TASK_QUEUE || 'authentik-tasks';

async function startServer() {
  serverLogger.info('🚀 Starting Authentik Temporal Server...');

  try {
    // Initialize Temporal Worker Service
    const temporalWorker = new TemporalWorkerService(
      TEMPORAL_ADDRESS,
      TEMPORAL_NAMESPACE,
      TEMPORAL_TASK_QUEUE,
      activityConfig
    );
    await temporalWorker.initialize();
    serverLogger.info('✅ Temporal Worker initialized');
    serverLogger.info(`📮 Task queue: ${TEMPORAL_TASK_QUEUE}`);

    // Load proto definitions
    const protoDefinitions = loadProtoDefinitions();
    serverLogger.info('✅ Proto definitions loaded');

    // Create GRPC services
    const newsletterService = new NewsletterGrpcService(temporalWorker);
    const workflowService = new WorkflowGrpcService(temporalWorker);

    // Create and configure GRPC server
    const server = new Server();

    // Add services to server
    server.addService(protoDefinitions.NewsletterService.service, {
      sendNewsletter: newsletterService.sendNewsletter.bind(newsletterService),
      getNewsletterStatus: newsletterService.getNewsletterStatus.bind(newsletterService),
      cancelNewsletter: newsletterService.cancelNewsletter.bind(newsletterService),
    });

    server.addService(protoDefinitions.WorkflowService.service, {
      startWorkflow: workflowService.startWorkflow.bind(workflowService),
      getWorkflowResult: workflowService.getWorkflowResult.bind(workflowService),
      signalWorkflow: workflowService.signalWorkflow.bind(workflowService),
      cancelWorkflow: workflowService.cancelWorkflow.bind(workflowService),
    });

    // Start server
    server.bindAsync(
      `0.0.0.0:${PORT}`,
      ServerCredentials.createInsecure(),
      (err, port) => {
        if (err) {
          serverLogger.error(`❌ Failed to bind server: ${err.message}`);
          process.exit(1);
        }

        server.start();
        serverLogger.info(`🎯 GRPC Server running on port ${port}`);
        serverLogger.info(`📡 Temporal connection: ${TEMPORAL_ADDRESS}`);
        serverLogger.info(`🌐 Namespace: ${TEMPORAL_NAMESPACE}`);
      }
    );

    // Start Temporal Worker
    await temporalWorker.start();
    serverLogger.info('✅ Temporal Worker started');

    // Graceful shutdown
    const shutdown = async () => {
      serverLogger.info('\n🛑 Shutting down Temporal Server...');
      
      server.tryShutdown((err) => {
        if (err) {
          serverLogger.error(`❌ Error during GRPC server shutdown: ${err.message}`);
          server.forceShutdown();
        }
        serverLogger.info('✅ GRPC Server shut down');
      });

      await temporalWorker.shutdown();
      serverLogger.info('✅ Temporal Worker shut down');
      
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    process.on('uncaughtException', (err) => {
      serverLogger.error(`❌ Uncaught Exception: ${err.message}`);
      shutdown();
    });
    process.on('unhandledRejection', (reason, promise) => {
      serverLogger.error(`❌ Unhandled Rejection: ${reason}`);
      shutdown();
    });

  } catch (error) {
    serverLogger.error(`❌ Failed to start server: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

startServer().catch((error) => {
  serverLogger.error(`❌ Fatal error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});


