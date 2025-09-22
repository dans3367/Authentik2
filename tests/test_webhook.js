const crypto = require('crypto');

// Test webhook signature validation logic
const webhookSecret = 'whsec_J7jRqP+O3h1aWJbuuRM4B3tc08HwtFSg';
const testPayload = JSON.stringify({
  type: 'email.sent',
  data: {
    email: 'dan@zendwise.work',
    message_id: 'test-id-123'
  }
});

// Create a test signature (simulating what Resend would send)
const timestamp = Math.floor(Date.now() / 1000);
const secret = webhookSecret.replace('whsec_', '');
const signature = crypto
  .createHmac('sha256', secret)
  .update(testPayload)
  .digest('base64');

const testSignatureHeader = `t=${timestamp},v1=${signature}`;

console.log('Test webhook validation:');
console.log('Payload:', testPayload);
console.log('Secret:', secret);
console.log('Signature Header:', testSignatureHeader);
console.log('Generated Signature:', signature);

// Test the validation logic
function validateSignature(payload, signatureHeader, webhookSecret) {
  const secret = webhookSecret.replace('whsec_', '');
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('base64');
  
  const parts = signatureHeader.split(',');
  let timestamp = '';
  let receivedSignature = '';
  
  for (const part of parts) {
    const [key, value] = part.trim().split('=');
    if (key === 't') timestamp = value;
    if (key === 'v1') receivedSignature = value;
  }
  
  const currentTime = Math.floor(Date.now() / 1000);
  const webhookTime = parseInt(timestamp);
  const timestampValid = Math.abs(currentTime - webhookTime) <= 300;
  const signatureValid = expectedSignature === receivedSignature;
  
  return {
    timestampValid,
    signatureValid,
    valid: timestampValid && signatureValid,
    expected: expectedSignature,
    received: receivedSignature,
    timestamp,
    currentTime
  };
}

const result = validateSignature(testPayload, testSignatureHeader, webhookSecret);
console.log('\nValidation Result:', result);
