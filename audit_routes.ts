
import fs from 'fs';
import path from 'path';

const routesDir = '/Users/dan/Documents/GitHub/Authentik/server/routes';
const files = fs.readdirSync(routesDir);

console.log('Scanning route files...\n');

files.forEach(file => {
    if (!file.endsWith('.ts')) return;

    const content = fs.readFileSync(path.join(routesDir, file), 'utf-8');
    const hasAuth = content.includes('authenticateToken');
    const hasRequireTenant = content.includes('requireTenant');
    const hasTenantId = content.includes('tenantId');
    const hasInsecureDb = content.includes('db.query') && !content.includes('tenantId'); // Crude heuristic

    console.log(`File: ${file}`);
    console.log(`  - Imports/Uses authenticateToken: ${hasAuth ? 'YES' : 'NO'}`);
    console.log(`  - Imports/Uses requireTenant: ${hasRequireTenant ? 'YES' : 'NO'}`);
    console.log(`  - References tenantId: ${hasTenantId ? 'YES' : 'NO'}`);
    if (hasInsecureDb) {
        console.log(`  - POTENTIAL ISSUE: db.query without tenantId reference?`);
    }
    console.log('---');
});
