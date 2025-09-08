import dotenv from 'dotenv';
import { Server, ServerCredentials } from '@grpc/grpc-js';
import { TemporalWorkerService } from './services/temporal-worker';
import { NewsletterGrpcService } from './services/newsletter-grpc-service';
import { WorkflowGrpcService } from './services/workflow-grpc-service';
import { loadProtoDefinitions } from './utils/proto-loader';

// Load environment variables
dotenv.config();

const PORT = process.env.TEMPORAL_SERVER_PORT || 50051;
const TEMPORAL_ADDRESS = process.env.TEMPORAL_ADDRESS || 'localhost:7233';
const TEMPORAL_NAMESPACE = process.env.TEMPORAL_NAMESPACE || 'default';

async function startServer() {
  console.log('🚀 Starting Authentik Temporal Server...');

  try {
    // Initialize Temporal Worker Service
    const temporalWorker = new TemporalWorkerService(TEMPORAL_ADDRESS, TEMPORAL_NAMESPACE);
    await temporalWorker.initialize();
    console.log('✅ Temporal Worker initialized');

    // Load proto definitions
    const protoDefinitions = loadProtoDefinitions();
    console.log('✅ Proto definitions loaded');

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
          console.error('❌ Failed to bind server:', err);
          process.exit(1);
        }

        server.start();
        console.log(`🎯 GRPC Server running on port ${port}`);
        console.log(`📡 Temporal connection: ${TEMPORAL_ADDRESS}`);
        console.log(`🌐 Namespace: ${TEMPORAL_NAMESPACE}`);
      }
    );

    // Start Temporal Worker
    await temporalWorker.start();
    console.log('✅ Temporal Worker started');

    // Graceful shutdown
    const shutdown = async () => {
      console.log('\n🛑 Shutting down Temporal Server...');
      
      server.tryShutdown((err) => {
        if (err) {
          console.error('❌ Error during GRPC server shutdown:', err);
          server.forceShutdown();
        }
        console.log('✅ GRPC Server shut down');
      });

      await temporalWorker.shutdown();
      console.log('✅ Temporal Worker shut down');
      
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    process.on('uncaughtException', (err) => {
      console.error('❌ Uncaught Exception:', err);
      shutdown();
    });
    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
      shutdown();
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});


