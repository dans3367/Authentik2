// Test script to create a sample form and then test the form frontend server
import { db, forms } from './server/db.js';

async function createTestForm() {
  try {
    // Create a test form
    const testFormData = {
      elements: [
        {
          id: 'name',
          type: 'text',
          label: 'Full Name',
          required: true,
          placeholder: 'Enter your full name'
        },
        {
          id: 'email',
          type: 'email', 
          label: 'Email Address',
          required: true,
          placeholder: 'Enter your email'
        },
        {
          id: 'feedback',
          type: 'textarea',
          label: 'Feedback',
          required: false,
          placeholder: 'Share your feedback with us'
        },
        {
          id: 'rating',
          type: 'radio',
          label: 'How would you rate our service?',
          required: true,
          options: ['Excellent', 'Good', 'Average', 'Poor']
        }
      ]
    };

    const newForm = await db.insert(forms).values({
      tenantId: 'c3fe612e-8a42-45de-a98e-a0b29be414df', // Use existing tenant
      userId: 'a6f4f05f-609f-4a26-87b8-0d6529ad9d64', // Use existing user
      title: 'Customer Feedback Form',
      description: 'We value your feedback! Please take a moment to share your experience.',
      formData: JSON.stringify(testFormData),
      theme: 'modern',
      isActive: true
    }).returning({ id: forms.id });

    console.log('Test form created with ID:', newForm[0].id);
    console.log('Access the form at: http://localhost:5000/form/' + newForm[0].id);
    
    return newForm[0].id;
  } catch (error) {
    console.error('Error creating test form:', error);
  }
}

createTestForm();