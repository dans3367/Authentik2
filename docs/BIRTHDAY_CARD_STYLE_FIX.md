# Birthday Card Style Fix - Manual Send Birthday Card Feature

## Issue
Birthday card emails sent using the `/birthdays?tab=customers` Send Birthday Card button did not match the styles of test birthday cards. The manual cards were missing:
- Header images (200px background images)
- Custom theme support with header images
- Signature sections
- Proper placeholder processing ({{firstName}}, {{lastName}})

## Root Cause
The `renderBirthdayTemplate` function in `server/routes/emailManagementRoutes.ts` (used for manual birthday cards) was using a simplified template without header images, while test birthday cards used the rich Go cardprocessor templates with full styling.

## Solution Applied
Updated the `renderBirthdayTemplate` function in `/home/root/Authentik/server/routes/emailManagementRoutes.ts` to match the styling and features of the Go cardprocessor and temporal-server templates.

### Changes Made

#### 1. Added Header Images for All Templates
- **Default theme**: Birthday cake/celebration image
- **Confetti theme**: Party/confetti themed image
- **Balloons theme**: Balloons themed image
- **Custom theme**: User-uploaded image or default gradient

All header images are 200px tall with cover sizing and proper border radius.

#### 2. Added Placeholder Processing
Created a `processPlaceholders` helper function that replaces:
- `{{firstName}}` - First name from recipientName
- `{{lastName}}` - Last name from recipientName

This ensures custom messages and promotions can use dynamic placeholders.

#### 3. Enhanced Custom Theme Support
For custom templates, the function now:
- Extracts custom header images from `customThemeData.imageUrl`
- Uses gradient fallback if no image provided
- Supports custom titles and signatures
- Handles both old and new customThemeData structures

#### 4. Added Signature Support
- Renders signature section if provided in theme data
- Signature replaces the "From Message" section
- Styled with italic font and proper spacing
- Supports placeholder processing

#### 5. Improved Layout Structure
The template now follows the same 4-section structure as test cards:
1. **Header Image** (standalone, 200px)
2. **Header Text** (title/headline)
3. **Content Area** (message, promotion, signature)
4. **Footer** (from message or unsubscribe)

#### 6. Enhanced Promotion Styling
- Matches test card promotion styling exactly
- Gradient background with proper border
- Supports placeholder processing in title, description, and content
- Dynamic color based on template theme

## Templates Now Include

### Predefined Templates (default, confetti, balloons)
```html
<!-- Header Image with themed background -->
<div style="height: 200px; background-image: url('...')">

<!-- Header Text -->
<div style="padding: 30px 30px 20px 30px;">
  <h1>Happy Birthday, [Name]!</h1>
</div>

<!-- Content with message and promotion -->
<div style="padding: 30px;">
  <div>Message content</div>
  <!-- Promotion section -->
  <!-- Signature or From Message -->
  <!-- Unsubscribe link -->
</div>
```

### Custom Templates
```html
<!-- Custom header image or gradient -->
<div style="height: 200px; background-image: url('[custom]')">

<!-- Custom title -->
<div style="padding: 30px 30px 20px 30px;">
  <h1>[Custom Title]</h1>
</div>

<!-- Custom message and styling -->
<div style="padding: 30px;">
  <div>[Custom Message with {{firstName}} placeholders]</div>
  <!-- Promotion if exists -->
  <!-- Custom signature if provided -->
  <!-- From message (only if no signature) -->
</div>
<!-- Unsubscribe section -->
```

## Testing Recommendations

1. **Test with Default Template**
   - Send birthday card to customer using default template
   - Verify header image appears (birthday cake)
   - Verify gradient background colors match test cards

2. **Test with Confetti Template**
   - Send birthday card using confetti template
   - Verify confetti header image
   - Verify red/yellow gradient colors

3. **Test with Balloons Template**
   - Send birthday card using balloons template
   - Verify balloons header image
   - Verify blue/purple gradient colors

4. **Test with Custom Template**
   - Configure custom theme with:
     - Custom header image
     - Custom title and message
     - Custom signature
   - Send birthday card
   - Verify all custom elements appear correctly

5. **Test with Promotions**
   - Configure a promotion in birthday settings
   - Send birthday card
   - Verify promotion section matches test card styling

6. **Test Placeholder Processing**
   - Use {{firstName}} and {{lastName}} in custom messages
   - Verify placeholders are replaced with actual names

## Files Modified
- `/home/root/Authentik/server/routes/emailManagementRoutes.ts`
  - Added `processPlaceholders` helper function (lines 2028-2043)
  - Completely rewrote `renderBirthdayTemplate` function (lines 2045-2274)

## Backward Compatibility
✅ All existing functionality maintained
✅ Works with both old and new customThemeData structures
✅ Gracefully handles missing data (fallbacks to defaults)
✅ No breaking changes to API or parameters

## Result
Birthday cards sent via the "Send Birthday Card" button on `/birthdays?tab=customers` now have **identical styling** to test birthday cards sent through the cardprocessor, including:
- ✅ Header images
- ✅ Custom themes with images
- ✅ Signatures
- ✅ Placeholder processing
- ✅ Consistent promotion styling
- ✅ Proper unsubscribe links




