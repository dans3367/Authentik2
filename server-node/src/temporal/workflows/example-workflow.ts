import { proxyActivities } from '@temporalio/workflow';
import type * as activities from '../activities/example-activities';

// Proxy activities to be used in workflows
const { processData, sendNotification } = proxyActivities<typeof activities>({
  startToCloseTimeout: '1 minute',
});

/**
 * Example workflow that demonstrates basic Temporal functionality
 */
export async function exampleWorkflow(input: { data: string; userId: string }): Promise<string> {
  console.log('Starting example workflow with input:', input);

  try {
    // Step 1: Process the data
    const processedData = await processData(input.data);
    console.log('Data processed:', processedData);

    // Step 2: Send notification
    await sendNotification(input.userId, `Data processed: ${processedData}`);
    console.log('Notification sent to user:', input.userId);

    return `Workflow completed successfully. Processed: ${processedData}`;
  } catch (error) {
    console.error('Workflow failed:', error);
    throw error;
  }
}
