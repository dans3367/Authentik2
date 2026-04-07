# Forms & Templates

- [ ] Add custom thank you page to all forms
  - Allow setting a custom redirect URL or thank-you message per form
  - Default built-in thank you page with company branding
- [ ] Add Welcome emails in form signups via templates
  - See: [Email & Newsletters](./02-email-newsletters.md) for details
- [ ] Add server-side required field validation for public form submissions
  - Backend endpoint `POST /api/forms/public/:id/submit` accepts any data without checking required fields
  - Should parse the form's element definitions, check which fields have `required: true`, and reject submissions missing those values with a 400 response
  - Currently only client-side validation exists in `public-form.tsx`
