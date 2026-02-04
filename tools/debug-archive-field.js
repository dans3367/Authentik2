// Simple script to check archive field without full server setup
const { execSync } = require('child_process');

try {
  // Check if we can connect to the database and see the appointments table structure
  const result = execSync(`psql $DATABASE_URL -c "\\d appointments" 2>/dev/null || echo "DB connection failed"`, { 
    encoding: 'utf8',
    cwd: '/Users/dan/Documents/GitHub/Authentik'
  });
  
  console.log('Appointments table structure:');
  console.log(result);
  
  // Check for is_archived specifically
  const archiveCheck = execSync(`psql $DATABASE_URL -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'is_archived';" 2>/dev/null || echo "Query failed"`, {
    encoding: 'utf8',
    cwd: '/Users/dan/Documents/GitHub/Authentik'
  });
  
  console.log('\nArchive field check:');
  console.log(archiveCheck);
  
} catch (error) {
  console.log('Database check failed, likely need to run with proper env vars');
  console.log('Error:', error.message);
}
