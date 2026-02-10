export interface SinglePurposePreset {
  id: string;
  label: string;
  description: string;
  category: string;
  subjectLine: string;
  body: string;
  tags: string[];
}

export const SINGLE_PURPOSE_PRESETS: SinglePurposePreset[] = [
  {
    id: "appointment-thank-you",
    label: "Appointment Thank You",
    description: "Send after a completed appointment to thank the customer",
    category: "retention",
    subjectLine: "Thank you for your visit, {{first_name}}!",
    body: `<p>Hi {{first_name}},</p><p>Thank you for visiting us today! We truly appreciate your time and hope you had a great experience.</p><p>If you have any questions or need anything else, don't hesitate to reach out. We're always here to help.</p><p>We look forward to seeing you again soon!</p><p>Warm regards,<br/>{{company_name}}</p>`,
    tags: ["appointment", "thank-you"],
  },
  {
    id: "appointment-reminder",
    label: "Appointment Reminder",
    description: "Remind customers about an upcoming appointment",
    category: "custom",
    subjectLine: "Reminder: Your upcoming appointment",
    body: `<p>Hi {{first_name}},</p><p>This is a friendly reminder about your upcoming appointment with us.</p><p>If you need to reschedule or have any questions, please contact us at {{phone}} or reply to this email.</p><p>We look forward to seeing you!</p><p>Best,<br/>{{company_name}}</p>`,
    tags: ["appointment", "reminder"],
  },
  {
    id: "follow-up",
    label: "Follow-Up",
    description: "General follow-up after a service or interaction",
    category: "retention",
    subjectLine: "Following up — how was your experience?",
    body: `<p>Hi {{first_name}},</p><p>We wanted to follow up and see how everything went. Your feedback means a lot to us and helps us improve.</p><p>Is there anything we can do better? We'd love to hear from you.</p><p>Thank you for choosing {{company_name}}!</p><p>Best regards,<br/>{{company_name}}</p>`,
    tags: ["follow-up"],
  },
  {
    id: "birthday-greeting",
    label: "Birthday Greeting",
    description: "Wish your customers a happy birthday",
    category: "seasonal",
    subjectLine: "Happy Birthday, {{first_name}}! 🎂",
    body: `<p>Happy Birthday, {{first_name}}! 🎉</p><p>Wishing you a wonderful day filled with joy and celebration. We're grateful to have you as part of the {{company_name}} family.</p><p>As a special birthday treat, we have something just for you — stop by or reach out to learn more!</p><p>Cheers,<br/>{{company_name}}</p>`,
    tags: ["birthday", "greeting"],
  },
  {
    id: "review-request",
    label: "Review Request",
    description: "Ask customers to leave a review after their visit",
    category: "retention",
    subjectLine: "We'd love your feedback, {{first_name}}!",
    body: `<p>Hi {{first_name}},</p><p>Thank you for your recent visit! We hope you had a great experience.</p><p>Would you mind taking a moment to share your feedback? Your review helps us serve you better and helps others discover us too.</p><p>Thank you for your support!</p><p>Best,<br/>{{company_name}}</p>`,
    tags: ["review", "feedback"],
  },
  {
    id: "welcome-new-customer",
    label: "Welcome New Customer",
    description: "Welcome a new customer after their first visit or signup",
    category: "welcome",
    subjectLine: "Welcome to {{company_name}}, {{first_name}}!",
    body: `<p>Hi {{first_name}},</p><p>Welcome to {{company_name}}! We're thrilled to have you join us.</p><p>Here's what you can expect from us:</p><ul><li>Personalized service tailored to your needs</li><li>Exclusive offers and updates</li><li>A team that's always here to help</li></ul><p>If you have any questions, feel free to reach out at {{phone}} or {{email}}.</p><p>We look forward to a great journey together!</p><p>Warm regards,<br/>{{company_name}}</p>`,
    tags: ["welcome", "new-customer"],
  },
  {
    id: "missed-you",
    label: "We Miss You",
    description: "Re-engage customers who haven't visited in a while",
    category: "retention",
    subjectLine: "We miss you, {{first_name}}!",
    body: `<p>Hi {{first_name}},</p><p>It's been a while since your last visit and we miss you! We'd love to see you again.</p><p>A lot has changed since you were last here, and we think you'll love what's new.</p><p>Come back and see us soon — we'd love to catch up!</p><p>Best,<br/>{{company_name}}</p>`,
    tags: ["re-engagement", "win-back"],
  },
  {
    id: "referral-request",
    label: "Referral Request",
    description: "Ask satisfied customers to refer friends and family",
    category: "retention",
    subjectLine: "Know someone who'd love {{company_name}}?",
    body: `<p>Hi {{first_name}},</p><p>We're so glad you're part of the {{company_name}} family! If you've enjoyed your experience with us, we'd love for you to spread the word.</p><p>Refer a friend or family member and you'll both benefit. It's our way of saying thank you for your loyalty.</p><p>Simply share our name or reply to this email for details.</p><p>Thank you,<br/>{{company_name}}</p>`,
    tags: ["referral"],
  },
];
