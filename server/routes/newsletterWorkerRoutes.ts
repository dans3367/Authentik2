import { Router } from 'express';
import { authenticateToken, requireTenant } from '../middleware/auth-middleware';
import { newsletterWorkerService } from '../services/NewsletterWorkerService';
import { db } from '../db';
import { newsletters, emailContacts } from '@shared/schema';
import { eq, and, inArray } from 'drizzle-orm';

export const newsletterWorkerRoutes = Router();

// Send newsletter using worker system
newsletterWorkerRoutes.post("/:id/send-with-worker", authenticateToken, requireTenant, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { testEmail, priority = 'normal', scheduledFor, batchSize = 25 } = req.body;

    // Get newsletter
    const newsletter = await db.query.newsletters.findFirst({
      where: and(
        eq(newsletters.id, id),
        eq(newsletters.tenantId, req.user.tenantId)
      ),
      with: {
        user: true
      }
    });

    if (!newsletter) {
      return res.status(404).json({ message: 'Newsletter not found' });
    }

    if (newsletter.status === 'sent') {
      return res.status(400).json({ message: 'Newsletter has already been sent' });
    }

    // If test email is provided, handle test sending separately
    if (testEmail) {
      try {
        // Add test job to worker
        const jobId = newsletterWorkerService.addJob({
          newsletterId: newsletter.id,
          tenantId: req.user.tenantId,
          userId: req.user.id,
          groupUUID: `test-${Date.now()}`,
          subject: `[TEST] ${newsletter.subject}`,
          content: newsletter.content,
          recipients: [{
            id: 'test-recipient',
            email: testEmail,
            firstName: 'Test',
            lastName: 'User'
          }],
          batchSize: 1,
          priority: 'high',
          metadata: {
            isTest: true,
            originalNewsletterId: newsletter.id,
          },
        });

        return res.json({
          message: 'Test newsletter job queued successfully',
          jobId,
          testEmail,
        });
      } catch (error) {
        console.error('Failed to queue test newsletter:', error);
        return res.status(500).json({ message: 'Failed to queue test newsletter' });
      }
    }

    // Get recipients for actual newsletter sending
    const recipients = await db.query.emailContacts.findMany({
      where: and(
        eq(emailContacts.tenantId, req.user.tenantId),
        eq(emailContacts.status, 'active'),
        eq(emailContacts.newsletterEnabled, true)
      ),
      columns: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
      }
    });

    if (recipients.length === 0) {
      return res.status(400).json({ 
        message: 'No active recipients found for newsletter',
        recipientCount: 0 
      });
    }

    // Update newsletter status to 'sending'
    await db.update(newsletters)
      .set({
        status: 'sending',
        sentAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(newsletters.id, id));

    // Generate group UUID for tracking
    const groupUUID = `newsletter-${id}-${Date.now()}`;

    try {
      // Add job to worker queue
      const jobId = newsletterWorkerService.addJob({
        newsletterId: newsletter.id,
        tenantId: req.user.tenantId,
        userId: req.user.id,
        groupUUID,
        subject: newsletter.subject,
        content: newsletter.content,
        recipients: recipients.map(recipient => ({
          id: recipient.id,
          email: recipient.email,
          firstName: recipient.firstName || undefined,
          lastName: recipient.lastName || undefined,
        })),
        batchSize,
        priority: priority as 'low' | 'normal' | 'high',
        scheduledFor: scheduledFor ? new Date(scheduledFor) : undefined,
        metadata: {
          newsletterTitle: newsletter.title,
          userEmail: newsletter.user?.email,
          scheduledFor,
        },
      });

      res.json({
        message: 'Newsletter job queued successfully',
        jobId,
        groupUUID,
        recipientCount: recipients.length,
        status: 'queued',
        newsletter: {
          id: newsletter.id,
          title: newsletter.title,
          subject: newsletter.subject,
        },
      });

      console.log(`✅ [Newsletter Worker] Job ${jobId} queued for newsletter ${id} with ${recipients.length} recipients`);

    } catch (workerError) {
      console.error('Failed to queue newsletter job:', workerError);
      
      // Revert newsletter status
      await db.update(newsletters)
        .set({
          status: 'draft',
          updatedAt: new Date(),
        })
        .where(eq(newsletters.id, id));

      return res.status(500).json({ 
        message: 'Failed to queue newsletter job',
        error: workerError instanceof Error ? workerError.message : 'Unknown error'
      });
    }

  } catch (error) {
    console.error('Newsletter worker send error:', error);
    res.status(500).json({ 
      message: 'Failed to process newsletter send request',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get job status
newsletterWorkerRoutes.get("/jobs/:jobId/status", authenticateToken, async (req: any, res) => {
  try {
    const { jobId } = req.params;
    
    const jobStatus = newsletterWorkerService.getJobStatus(jobId);
    
    if (!jobStatus) {
      return res.status(404).json({ message: 'Job not found' });
    }

    // Verify job belongs to the user's tenant
    if ((jobStatus as any).tenantId && (jobStatus as any).tenantId !== req.user.tenantId) {
      return res.status(404).json({ message: 'Job not found' });
    }

    res.json({
      status: 'success',
      job: jobStatus,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Get job status error:', error);
    res.status(500).json({ 
      message: 'Failed to get job status',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get all job statuses for the tenant
newsletterWorkerRoutes.get("/jobs", authenticateToken, async (req: any, res) => {
  try {
    const allJobs = newsletterWorkerService.getAllJobStatuses();
    
    // Filter jobs by tenant to enforce tenant isolation
    const tenantJobs = Object.fromEntries(
      Object.entries(allJobs).filter(([_, job]) => {
        return (job as any).tenantId === req.user.tenantId;
      })
    );

    res.json({
      status: 'success',
      jobs: tenantJobs,
      count: Object.keys(tenantJobs).length,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Get jobs error:', error);
    res.status(500).json({ 
      message: 'Failed to get jobs',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Cancel a job
newsletterWorkerRoutes.post("/jobs/:jobId/cancel", authenticateToken, async (req: any, res) => {
  try {
    const { jobId } = req.params;
    
    // Verify job belongs to the user's tenant before cancelling
    const jobStatus = newsletterWorkerService.getJobStatus(jobId);
    if (!jobStatus || ((jobStatus as any).tenantId && (jobStatus as any).tenantId !== req.user.tenantId)) {
      return res.status(404).json({ message: 'Job not found or cannot be cancelled' });
    }

    const cancelled = await newsletterWorkerService.cancelJob(jobId);
    
    if (!cancelled) {
      return res.status(404).json({ message: 'Job not found or cannot be cancelled' });
    }

    res.json({
      status: 'success',
      message: 'Job cancelled successfully',
      jobId,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Cancel job error:', error);
    res.status(500).json({ 
      message: 'Failed to cancel job',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get worker service statistics (admin only)
newsletterWorkerRoutes.get("/workers/stats", authenticateToken, async (req: any, res) => {
  try {
    // Check if user has admin privileges (adjust based on your role system)
    if (req.user?.role !== 'Owner' && req.user?.role !== 'Administrator') {
      return res.status(403).json({ message: 'Insufficient privileges' });
    }

    const stats = newsletterWorkerService.getStats();
    const workerDetails = newsletterWorkerService.getWorkerDetails();

    res.json({
      status: 'success',
      stats,
      workers: workerDetails,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Get worker stats error:', error);
    res.status(500).json({ 
      message: 'Failed to get worker statistics',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Scale workers (admin only)
newsletterWorkerRoutes.post("/workers/scale", authenticateToken, async (req: any, res) => {
  try {
    // Check if user has admin privileges
    if (req.user?.role !== 'Owner' && req.user?.role !== 'Administrator') {
      return res.status(403).json({ message: 'Insufficient privileges' });
    }

    const { workerCount } = req.body;
    
    if (!workerCount || workerCount < 1 || workerCount > 10) {
      return res.status(400).json({ message: 'Worker count must be between 1 and 10' });
    }

    await newsletterWorkerService.scaleWorkers(workerCount);

    res.json({
      status: 'success',
      message: `Scaled to ${workerCount} workers`,
      workerCount,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Scale workers error:', error);
    res.status(500).json({ 
      message: 'Failed to scale workers',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Restart a specific worker (admin only)
newsletterWorkerRoutes.post("/workers/:workerId/restart", authenticateToken, async (req: any, res) => {
  try {
    // Check if user has admin privileges
    if (req.user?.role !== 'Owner' && req.user?.role !== 'Administrator') {
      return res.status(403).json({ message: 'Insufficient privileges' });
    }

    const { workerId } = req.params;
    
    await newsletterWorkerService.restartWorker(workerId);

    res.json({
      status: 'success',
      message: `Worker ${workerId} restarted successfully`,
      workerId,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Restart worker error:', error);
    res.status(500).json({ 
      message: 'Failed to restart worker',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Emergency stop all workers (admin only)
newsletterWorkerRoutes.post("/workers/emergency-stop", authenticateToken, async (req: any, res) => {
  try {
    // Check if user has admin privileges
    if (req.user?.role !== 'Owner' && req.user?.role !== 'Administrator') {
      return res.status(403).json({ message: 'Insufficient privileges' });
    }

    await newsletterWorkerService.emergencyStop();

    res.json({
      status: 'success',
      message: 'Emergency stop executed successfully',
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Emergency stop error:', error);
    res.status(500).json({ 
      message: 'Failed to execute emergency stop',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Health check endpoint
newsletterWorkerRoutes.get("/health", async (req, res) => {
  try {
    const stats = newsletterWorkerService.getStats();
    
    const health = {
      status: stats.isHealthy ? 'healthy' : 'unhealthy',
      workers: {
        total: stats.totalWorkers,
        active: stats.activeWorkers,
        ratio: stats.totalWorkers > 0 ? stats.activeWorkers / stats.totalWorkers : 0,
      },
      jobs: {
        active: stats.totalActiveJobs,
        queued: stats.totalQueuedJobs,
        total: stats.totalJobs,
      },
      timestamp: new Date().toISOString(),
    };

    const statusCode = stats.isHealthy ? 200 : 503;
    res.status(statusCode).json(health);

  } catch (error) {
    console.error('Health check error:', error);
    res.status(503).json({
      status: 'error',
      message: 'Health check failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

export default newsletterWorkerRoutes;

