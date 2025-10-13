# Activity Timeline Pagination Implementation

## Summary
Added pagination support to the Activity Timeline component in the email contact view page.

## Changes Made

### 1. Component: `EmailActivityTimeline.tsx`

**Location:** `/home/root/Authentik/client/src/components/EmailActivityTimeline.tsx`

**Backup Created:** `EmailActivityTimeline.tsx.backup`

#### Key Changes:

1. **Added Pagination State**
   - `currentPage`: Tracks the current page number
   - `pageSize`: Configurable items per page (default: 20)
   - Automatically resets to page 1 when date filter changes

2. **Updated API Integration**
   - Now sends `page` parameter to backend API
   - Receives pagination metadata from API response:
     - `page`: Current page number
     - `limit`: Items per page
     - `total`: Total number of activities
     - `pages`: Total number of pages

3. **Added Pagination Controls**
   - Previous/Next buttons with disabled states
   - Smart page number display:
     - Shows first page when far from it
     - Shows "..." ellipsis for gaps
     - Shows current page ± 2 pages
     - Shows last page when far from it
   - Pagination info: "Showing X to Y of Z activities"

4. **User Experience Improvements**
   - Smooth scroll to top when changing pages
   - Loading states during page transitions
   - Disabled buttons during data fetching
   - Responsive design for mobile/desktop

5. **Added New Icons**
   - `ChevronLeft`: Previous page button
   - `ChevronRight`: Next page button

## API Compatibility

The backend API endpoint already supports pagination:
- **Endpoint:** `GET /api/email-contacts/:contactId/activity`
- **Parameters:**
  - `page`: Page number (default: 1)
  - `limit`: Items per page (default: 50)
  - `from`: Date range start (optional)
  - `to`: Date range end (optional)

**Response Format:**
```json
{
  "activities": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 156,
    "pages": 8
  }
}
```

## Component Props

```typescript
interface EmailActivityTimelineProps {
  contactId: string;
  pageSize?: number;        // Default: 20
  initialPage?: number;     // Default: 1
}
```

## Usage Example

```tsx
// Default usage (20 items per page)
<EmailActivityTimeline contactId={contact.id} />

// Custom page size
<EmailActivityTimeline contactId={contact.id} pageSize={50} />

// Start on specific page
<EmailActivityTimeline contactId={contact.id} initialPage={2} />
```

## Pagination Logic

### Page Number Display Logic:
- **Total pages ≤ 5:** Show all pages
- **Current page ≤ 3:** Show pages 1-5 + last page
- **Current page ≥ (total - 2):** Show first page + last 5 pages
- **Middle pages:** Show first + (current - 2 to current + 2) + last

### Auto-reset Behavior:
- Resets to page 1 when date range filter changes
- Maintains page when refreshing data
- Preserves page when navigating back to the view

## Visual Elements

### Pagination Bar Components:
1. **Info Text:** "Showing 1 to 20 of 156 activities"
2. **Previous Button:** Disabled on first page
3. **Page Numbers:** Current page highlighted
4. **Ellipsis (...):** Shown when pages are skipped
5. **Next Button:** Disabled on last page

### States:
- **Active Page:** Blue background (default variant)
- **Inactive Pages:** Outline style
- **Disabled:** Gray text, no pointer cursor
- **Loading:** Buttons disabled, no visual spinner in pagination

## Testing Checklist

- [ ] Pagination appears when total pages > 1
- [ ] Previous button disabled on page 1
- [ ] Next button disabled on last page
- [ ] Page numbers correctly highlight current page
- [ ] Clicking page numbers changes data
- [ ] Smooth scroll to top on page change
- [ ] Date filter resets to page 1
- [ ] Pagination info shows correct numbers
- [ ] Responsive layout works on mobile
- [ ] Loading states prevent duplicate requests

## Performance Notes

- Uses `placeholderData: keepPreviousData` to prevent flickering during page transitions
- Debounced loading spinners (2 seconds minimum) for better UX
- Separate queries for calendar data vs paginated activities
- Efficient re-renders using React Query caching

## Future Enhancements

Potential improvements for future iterations:
1. Jump to page input field
2. Items per page selector (10, 20, 50, 100)
3. URL query parameters for sharing specific pages
4. Keyboard navigation (arrow keys)
5. Export filtered activities
6. Infinite scroll option as alternative

## Files Modified

1. `/home/root/Authentik/client/src/components/EmailActivityTimeline.tsx`

## Files Backed Up

1. `/home/root/Authentik/client/src/components/EmailActivityTimeline.tsx.backup`

---

**Implementation Date:** 2025-10-11  
**Status:** ✅ Complete and Ready for Testing
