// Simple test to verify route modules can be imported
console.log('Testing route imports...');

try {
  // Test importing the main routes file
  const { registerRoutes } = require('./routes.ts');
  console.log('✓ Main routes file imported successfully');
  
  // Test importing individual route modules
  const authRoutes = require('./routes/authRoutes.ts');
  console.log('✓ Auth routes imported successfully');
  
  const adminRoutes = require('./routes/adminRoutes.ts');
  console.log('✓ Admin routes imported successfully');
  
  const formsRoutes = require('./routes/formsRoutes.ts');
  console.log('✓ Forms routes imported successfully');
  
  const subscriptionRoutes = require('./routes/subscriptionRoutes.ts');
  console.log('✓ Subscription routes imported successfully');
  
  const companyRoutes = require('./routes/companyRoutes.ts');
  console.log('✓ Company routes imported successfully');
  
  const shopsRoutes = require('./routes/shopsRoutes.ts');
  console.log('✓ Shops routes imported successfully');
  
  const emailManagementRoutes = require('./routes/emailManagementRoutes.ts');
  console.log('✓ Email management routes imported successfully');
  
  const newsletterRoutes = require('./routes/newsletterRoutes.ts');
  console.log('✓ Newsletter routes imported successfully');
  
  const campaignRoutes = require('./routes/campaignRoutes.ts');
  console.log('✓ Campaign routes imported successfully');
  
  const webhookRoutes = require('./routes/webhookRoutes.ts');
  console.log('✓ Webhook routes imported successfully');
  
  const devRoutes = require('./routes/devRoutes.ts');
  console.log('✓ Dev routes imported successfully');
  
  console.log('\n🎉 All route modules imported successfully!');
  console.log('✅ Refactoring appears to be working correctly.');
  
} catch (error) {
  console.error('❌ Error importing route modules:', error.message);
  process.exit(1);
}