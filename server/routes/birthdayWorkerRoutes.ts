import express from 'express';
import { authenticateToken } from '../middleware/auth-middleware';
import { birthdayWorkerService } from '../services/BirthdayWorkerService';

const birthdayWorkerRoutes = express.Router();

// Get birthday worker status and statistics
birthdayWorkerRoutes.get("/status", authenticateToken, async (req: any, res) => {
  try {
    const stats = birthdayWorkerService.getStats();
    
    res.json({
      success: true,
      worker: {
        isRunning: stats.isRunning,
        enabled: stats.enabled,
        stats: {
          totalJobs: stats.totalJobs,
          pendingJobs: stats.pendingJobs,
          processingJobs: stats.processingJobs,
          completedJobs: stats.completedJobs,
          failedJobs: stats.failedJobs,
        },
        config: stats.config,
      },
    });
  } catch (error) {
    console.error('Get birthday worker status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get birthday worker status',
    });
  }
});

// Get specific job status
birthdayWorkerRoutes.get("/jobs/:jobId/status", authenticateToken, async (req: any, res) => {
  try {
    const { jobId } = req.params;
    
    const jobStatus = birthdayWorkerService.getJobStatus(jobId);
    
    if (!jobStatus) {
      return res.status(404).json({ 
        success: false,
        message: 'Job not found' 
      });
    }

    res.json({
      success: true,
      job: jobStatus,
    });
  } catch (error) {
    console.error('Get birthday job status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get job status',
    });
  }
});

// Get all job statuses
birthdayWorkerRoutes.get("/jobs", authenticateToken, async (req: any, res) => {
  try {
    const allJobs = birthdayWorkerService.getAllJobStatuses();
    
    res.json({
      success: true,
      jobs: allJobs,
      count: Object.keys(allJobs).length,
    });
  } catch (error) {
    console.error('Get birthday jobs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get jobs',
    });
  }
});

// Start the birthday worker
birthdayWorkerRoutes.post("/start", authenticateToken, async (req: any, res) => {
  try {
    if (birthdayWorkerService.isRunning()) {
      return res.status(400).json({
        success: false,
        message: 'Birthday worker is already running',
      });
    }

    birthdayWorkerService.start();
    
    res.json({
      success: true,
      message: 'Birthday worker started successfully',
    });
  } catch (error) {
    console.error('Start birthday worker error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start birthday worker',
    });
  }
});

// Stop the birthday worker
birthdayWorkerRoutes.post("/stop", authenticateToken, async (req: any, res) => {
  try {
    if (!birthdayWorkerService.isRunning()) {
      return res.status(400).json({
        success: false,
        message: 'Birthday worker is not running',
      });
    }

    await birthdayWorkerService.stop();
    
    res.json({
      success: true,
      message: 'Birthday worker stopped successfully',
    });
  } catch (error) {
    console.error('Stop birthday worker error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to stop birthday worker',
    });
  }
});

// Restart the birthday worker
birthdayWorkerRoutes.post("/restart", authenticateToken, async (req: any, res) => {
  try {
    console.log('🔄 [BirthdayWorker] Restarting birthday worker...');
    
    if (birthdayWorkerService.isRunning()) {
      await birthdayWorkerService.stop();
    }
    
    // Wait a moment before starting
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    birthdayWorkerService.start();
    
    res.json({
      success: true,
      message: 'Birthday worker restarted successfully',
    });
  } catch (error) {
    console.error('Restart birthday worker error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to restart birthday worker',
    });
  }
});

// Force cleanup of old jobs
birthdayWorkerRoutes.post("/cleanup", authenticateToken, async (req: any, res) => {
  try {
    const { maxAge } = req.body;
    
    const cleanedCount = birthdayWorkerService.cleanupOldJobs(maxAge);
    
    res.json({
      success: true,
      message: `Cleaned up ${cleanedCount} old birthday jobs`,
      cleanedJobs: cleanedCount,
    });
  } catch (error) {
    console.error('Cleanup birthday jobs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cleanup birthday jobs',
    });
  }
});

// Get birthday worker health check
birthdayWorkerRoutes.get("/health", authenticateToken, async (req: any, res) => {
  try {
    const stats = birthdayWorkerService.getStats();
    const isHealthy = stats.isRunning && stats.enabled;
    
    res.status(isHealthy ? 200 : 503).json({
      success: true,
      healthy: isHealthy,
      status: isHealthy ? 'healthy' : 'unhealthy',
      details: {
        running: stats.isRunning,
        enabled: stats.enabled,
        activeJobs: stats.processingJobs,
        failedJobs: stats.failedJobs,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Birthday worker health check error:', error);
    res.status(503).json({
      success: false,
      healthy: false,
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    });
  }
});

export { birthdayWorkerRoutes };