// Simple script to add test managers via the API
async function addTestManagers() {
  const baseUrl = 'http://127.0.0.1:3504';
  
  try {
    // First, login to get a token
    console.log('Logging in...');
    const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'dan@zendwise.com',
        password: 'password123'
      })
    });
    
    if (!loginResponse.ok) {
      const errorData = await loginResponse.text();
      console.error('Login failed:', loginResponse.status, errorData);
      throw new Error('Failed to login');
    }
    
    const loginData = await loginResponse.json();
    const token = loginData.accessToken;
    console.log('✅ Logged in successfully');
    console.log('Token:', token ? 'Got token' : 'No token');
    
    // Test managers to create
    const managers = [
      {
        email: 'john.manager@example.com',
        password: 'password123',
        confirmPassword: 'password123',
        firstName: 'John',
        lastName: 'Manager',
        role: 'Manager'
      },
      {
        email: 'jane.admin@example.com',
        password: 'password123',
        confirmPassword: 'password123',
        firstName: 'Jane',
        lastName: 'Admin',
        role: 'Administrator'
      },
      {
        email: 'mike.manager@example.com',
        password: 'password123',
        confirmPassword: 'password123',
        firstName: 'Mike',
        lastName: 'Smith',
        role: 'Manager'
      }
    ];
    
    // Create each manager
    for (const manager of managers) {
      console.log(`Creating ${manager.role}: ${manager.email}...`);
      try {
        const response = await fetch(`${baseUrl}/api/users`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(manager)
        });
        
        if (response.ok) {
          console.log(`✅ Created ${manager.email}`);
        } else {
          const error = await response.json();
          console.log(`❌ Failed to create ${manager.email}: ${error.message}`);
        }
      } catch (error) {
        console.log(`❌ Error creating ${manager.email}:`, error);
      }
    }
    
    console.log('Done!');
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the script
addTestManagers();