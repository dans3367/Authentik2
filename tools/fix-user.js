// Fix the dan@zendwise.com user for testing

async function fixUser() {
  const baseUrl = 'http://127.0.0.1:3504';
  
  try {
    console.log('🔧 Fixing dan@zendwise.com user...');
    
    // First try to register the user (this will set password properly)
    const registerResponse = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'dan@zendwise.com',
        password: 'Password123',
        confirmPassword: 'Password123',
        firstName: 'Daniel',
        lastName: 'Solis'
      })
    });
    
    if (registerResponse.ok) {
      console.log('✅ User registered successfully');
    } else {
      const errorData = await registerResponse.text();
      console.log('⚠️ Registration response:', registerResponse.status, errorData);
    }
    
    // Now try to login
    console.log('🔐 Attempting login...');
    const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'dan@zendwise.com',
        password: 'Password123'
      })
    });
    
    if (loginResponse.ok) {
      const loginData = await loginResponse.json();
      const token = loginData.accessToken;
      console.log('✅ Login successful!');
      console.log('🎫 Token:', token ? `${token.substring(0, 50)}...` : 'No token');
      
      // Test getting newsletters
      console.log('📧 Testing newsletters API...');
      const newslettersResponse = await fetch(`${baseUrl}/api/newsletters`, {
        method: 'GET',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json' 
        }
      });
      
      if (newslettersResponse.ok) {
        const newslettersData = await newslettersResponse.json();
        console.log('✅ Newsletters API working!');
        console.log('📊 Newsletters:', newslettersData.newsletters?.length || 0, 'found');
        
        // Show newsletter statuses
        if (newslettersData.newsletters?.length) {
          newslettersData.newsletters.forEach((newsletter, index) => {
            console.log(`📄 Newsletter ${index + 1}: "${newsletter.title}" (${newsletter.status})`);
          });
          
          // Test detailed stats for the first newsletter if it's sent
          const firstNewsletter = newslettersData.newsletters[0];
          if (firstNewsletter && firstNewsletter.status === 'sent') {
            console.log('🔍 Testing detailed stats for sent newsletter...');
            const detailedStatsResponse = await fetch(`${baseUrl}/api/newsletters/${firstNewsletter.id}/detailed-stats`, {
              method: 'GET',
              headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json' 
              }
            });
            
            if (detailedStatsResponse.ok) {
              const detailedData = await detailedStatsResponse.json();
              console.log('✅ Detailed stats API working!');
              console.log('📈 Total emails:', detailedData.totalEmails);
              console.log('📋 Sample data:', JSON.stringify(detailedData, null, 2));
            } else {
              const error = await detailedStatsResponse.text();
              console.log('❌ Detailed stats failed:', detailedStatsResponse.status, error);
            }
          } else {
            console.log('ℹ️ No sent newsletters found. Detailed stats only work for sent newsletters.');
            console.log('💡 Create and send a newsletter to test detailed stats!');
          }
        } else {
          console.log('ℹ️ No newsletters found. Create a newsletter to test the feature!');
        }
        
      } else {
        const error = await newslettersResponse.text();
        console.log('❌ Newsletters API failed:', newslettersResponse.status, error);
      }
      
    } else {
      const errorData = await loginResponse.text();
      console.log('❌ Login failed:', loginResponse.status, errorData);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the fix
fixUser();
