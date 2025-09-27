/**
 * Example activity functions that can be called from workflows
 */

export async function processData(data: string): Promise<string> {
  console.log('Processing data:', data);

  // Simulate some processing time
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Transform the data (example transformation)
  const processed = data.toUpperCase().replace(/\s+/g, '_');

  console.log('Data processing completed:', processed);
  return processed;
}

export async function sendNotification(userId: string, message: string): Promise<void> {
  console.log(`Sending notification to user ${userId}: ${message}`);

  // Simulate API call or database operation
  await new Promise(resolve => setTimeout(resolve, 500));

  // In a real implementation, this would send an actual notification
  // For example: email, SMS, push notification, etc.
  console.log('Notification sent successfully');
}
debugger;
export async function fetchUserData(userId: string): Promise<{ id: string; name: string; email: string }> {
  console.log('Fetching user data for:', userId);
  // Simulate database lookup
  await new Promise(resolve => setTimeout(resolve, 300));

  // Mock user data - in real implementation, this would query your database
  const userData = {
    id: userId,
    name: `User ${userId}`,
    email: `user${userId}@example.com`
  };

  console.log('User data fetched:', userData);
  return userData;
}

export async function logActivity(workflowId: string, activity: string, details?: any): Promise<void> {
  console.log(`Logging activity for workflow ${workflowId}: ${activity}`, details);

  // Simulate logging to database or external service
  await new Promise(resolve => setTimeout(resolve, 100));

  console.log('Activity logged successfully');
}


