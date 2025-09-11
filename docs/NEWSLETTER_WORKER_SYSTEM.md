# Newsletter Worker System

A robust, scalable email delivery system for newsletter campaigns with real-time progress tracking, error handling, and worker management.

## 🎯 **Overview**

The Newsletter Worker System replaces the complex Temporal-based solution with a more straightforward, reliable worker-based architecture that provides:

- **Reliable Email Delivery**: Robust queue-based system with retry logic
- **Real-time Progress Tracking**: Live updates on email sending progress
- **Scalable Worker Pool**: Multiple workers for concurrent processing
- **Advanced Error Handling**: Comprehensive error tracking and recovery
- **Rate Limiting**: Built-in rate limiting to respect provider limits
- **Admin Controls**: Worker scaling, monitoring, and emergency controls

## 🏗️ **Architecture**

### Core Components

1. **NewsletterWorker** (`/server/workers/NewsletterWorker.ts`)
   - Individual worker process for handling email jobs
   - Manages job queue, progress tracking, and error handling
   - Built-in rate limiting and batch processing

2. **NewsletterWorkerService** (`/server/services/NewsletterWorkerService.ts`)
   - Service layer managing multiple worker instances
   - Load balancing, scaling, and health monitoring
   - Singleton service for application-wide access

3. **API Routes** (`/server/routes/newsletterWorkerRoutes.ts`)
   - RESTful API for job management and worker control
   - Real-time job status and progress endpoints
   - Admin endpoints for worker scaling and emergency controls

4. **Frontend Components**
   - **NewsletterWorkerProgress**: Real-time progress visualization
   - **useNewsletterWorker**: React hook for worker operations
   - Integration with existing newsletter interface

## 🚀 **Quick Start**

### Basic Usage

```typescript
import { useNewsletterWorker } from '@/hooks/useNewsletterWorker';

function NewsletterComponent() {
  const { sendNewsletter, isSending } = useNewsletterWorker();
  
  const handleSend = () => {
    sendNewsletter({
      newsletterId: 'newsletter-123',
      priority: 'normal',
      batchSize: 25,
    });
  };
  
  return (
    <Button onClick={handleSend} disabled={isSending}>
      {isSending ? 'Sending...' : 'Send Newsletter'}
    </Button>
  );
}
```

### Advanced Configuration

```typescript
// Environment Variables
NEWSLETTER_WORKERS=3                    // Number of worker instances
NEWSLETTER_MAX_CONCURRENT_JOBS=2        // Jobs per worker
NEWSLETTER_BATCH_SIZE=25                // Emails per batch
NEWSLETTER_BATCH_DELAY=2000             // Delay between batches (ms)
NEWSLETTER_MAX_RETRIES=3                // Max retry attempts
```

## 📊 **API Reference**

### Job Management

#### Send Newsletter
```http
POST /api/newsletter-worker/{id}/send-with-worker
Content-Type: application/json

{
  "testEmail": "test@example.com",     // Optional: send test email
  "priority": "normal",                // low | normal | high
  "scheduledFor": "2024-01-15T10:00:00Z", // Optional: schedule for later
  "batchSize": 25                      // Optional: override batch size
}
```

#### Get Job Status
```http
GET /api/newsletter-worker/jobs/{jobId}/status
```

Response:
```json
{
  "status": "success",
  "job": {
    "jobId": "newsletter-123-1234567890",
    "total": 1000,
    "sent": 750,
    "failed": 5,
    "progress": 75,
    "status": "processing",
    "currentBatch": 3,
    "totalBatches": 4,
    "startedAt": "2024-01-15T10:00:00Z",
    "estimatedCompletionTime": "2024-01-15T10:15:00Z",
    "errors": [...]
  }
}
```

#### Cancel Job
```http
POST /api/newsletter-worker/jobs/{jobId}/cancel
```

### Worker Management (Admin Only)

#### Get Worker Statistics
```http
GET /api/newsletter-worker/workers/stats
```

#### Scale Workers
```http
POST /api/newsletter-worker/workers/scale
Content-Type: application/json

{
  "workerCount": 5
}
```

#### Emergency Stop
```http
POST /api/newsletter-worker/workers/emergency-stop
```

#### Health Check
```http
GET /api/newsletter-worker/health
```

## 🔧 **Configuration**

### Worker Configuration

```typescript
interface WorkerConfig {
  maxConcurrentJobs: number;     // Default: 2
  batchSize: number;             // Default: 25
  delayBetweenBatches: number;   // Default: 2000ms
  maxRetries: number;            // Default: 3
  retryDelay: number;            // Default: 5000ms
  healthCheckInterval: number;   // Default: 30000ms
  progressUpdateInterval: number; // Default: 5000ms
}
```

### Service Configuration

```typescript
interface WorkerServiceConfig {
  numberOfWorkers: number;       // Default: 3
  workerConfig: WorkerConfig;
  autoStart: boolean;           // Default: true
  healthCheckInterval: number;   // Default: 60000ms
  cleanupInterval: number;      // Default: 300000ms
  maxJobAge: number;            // Default: 24 hours
}
```

## 📈 **Monitoring & Analytics**

### Real-time Metrics

- **Worker Health**: Active/total workers, health status
- **Job Progress**: Real-time progress bars and statistics
- **Error Tracking**: Detailed error logs with email addresses
- **Performance**: Processing speed, estimated completion times
- **Success Rates**: Delivery success vs. failure rates

### Progress Tracking Features

- Real-time progress updates (every 3-5 seconds)
- Batch-level progress indication
- Estimated completion times
- Error details with expandable error lists
- Success/failure counters

## 🛡️ **Error Handling**

### Automatic Error Recovery

1. **Retry Logic**: Failed emails automatically retried up to 3 times
2. **Email Filtering**: Bounced/suppressed emails filtered before sending
3. **Rate Limiting**: Automatic throttling to prevent provider limits
4. **Graceful Degradation**: Workers continue processing despite individual failures

### Error Types

- **Provider Errors**: Email service provider failures
- **Rate Limit Errors**: Temporary throttling from providers
- **Invalid Email Errors**: Malformed email addresses
- **Network Errors**: Connectivity issues
- **Suppression Errors**: Bounced/unsubscribed emails

### Error Reporting

```typescript
interface JobError {
  email: string;
  error: string;
  timestamp: Date;
}
```

## 🔐 **Security & Permissions**

### Access Control

- **Job Management**: Requires authentication
- **Worker Stats**: Admin role required (Owner/Administrator)
- **Worker Scaling**: Admin role required
- **Emergency Stop**: Admin role required

### Data Privacy

- No email content stored in job progress
- Error logs include email addresses for debugging
- Automatic cleanup of old job data (24 hours default)

## 🚨 **Emergency Procedures**

### Emergency Stop

When critical issues arise:

1. **Via API**: `POST /api/newsletter-worker/workers/emergency-stop`
2. **Via Admin UI**: Emergency stop button in worker stats
3. **Server Restart**: Workers gracefully shut down on SIGTERM/SIGINT

### Recovery Procedures

1. **Check Worker Health**: Monitor worker status endpoint
2. **Restart Failed Workers**: Use worker restart endpoint
3. **Scale Workers**: Adjust worker count based on load
4. **Review Errors**: Check job error logs for patterns

## 📋 **Maintenance**

### Regular Tasks

1. **Monitor Worker Health**: Check `/health` endpoint
2. **Review Error Logs**: Analyze failed email patterns
3. **Performance Tuning**: Adjust batch sizes and worker counts
4. **Cleanup**: Old jobs automatically cleaned up

### Performance Optimization

- **Batch Size**: Larger batches = faster processing, higher memory usage
- **Worker Count**: More workers = higher throughput, more resource usage
- **Delay Settings**: Shorter delays = faster sending, higher provider load

## 🔄 **Migration from Temporal**

### Benefits Over Temporal

1. **Simpler Architecture**: No external Temporal server required
2. **Better Monitoring**: Real-time progress tracking
3. **Easier Debugging**: Clear error handling and logging
4. **Lower Resource Usage**: No additional infrastructure needed
5. **More Reliable**: Fewer external dependencies

### Compatibility

- Same API interface for newsletter sending
- Automatic fallback maintains existing functionality
- Progressive migration possible

## 🧪 **Testing**

### Test Email Sending

```typescript
const { sendNewsletter } = useNewsletterWorker();

// Send test email
sendNewsletter({
  newsletterId: 'newsletter-123',
  testEmail: 'test@example.com',
  priority: 'high'
});
```

### Load Testing

```bash
# Test multiple concurrent newsletters
for i in {1..10}; do
  curl -X POST /api/newsletter-worker/newsletter-$i/send-with-worker \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"priority": "low", "batchSize": 10}'
done
```

## 📞 **Support & Troubleshooting**

### Common Issues

1. **Workers Not Starting**: Check environment variables
2. **Slow Processing**: Increase worker count or batch size
3. **High Error Rates**: Check email provider configuration
4. **Memory Issues**: Reduce batch size or worker count

### Debug Mode

Set `NODE_ENV=development` for detailed logging:

```bash
NODE_ENV=development npm start
```

### Health Monitoring

```bash
# Check worker health
curl /api/newsletter-worker/health

# Get detailed stats
curl -H "Authorization: Bearer $TOKEN" \
     /api/newsletter-worker/workers/stats
```

## 🔮 **Future Enhancements**

- **Redis Integration**: Persistent job queue with Redis
- **Webhook Support**: Real-time notifications via webhooks
- **Advanced Analytics**: Detailed delivery analytics and reporting
- **A/B Testing**: Built-in A/B testing for newsletter campaigns
- **Template Management**: Advanced template system integration
- **Scheduled Campaigns**: Cron-like scheduling for recurring newsletters

---

The Newsletter Worker System provides a production-ready, scalable solution for email delivery with comprehensive monitoring and management capabilities. For additional support or feature requests, please contact the development team.

