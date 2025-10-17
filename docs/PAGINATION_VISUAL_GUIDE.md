# Activity Timeline Pagination - Visual Guide

## Before vs After

### BEFORE (No Pagination)
```
┌─────────────────────────────────────────────────────────────────┐
│ Activity Timeline                     [Filter] [Refresh]        │
├─────────────────────────────────────────────────────────────────┤
│ ● Email sent - Subject...                      Jan 10, 2025     │
│ ● Email opened - Subject...                    Jan 10, 2025     │
│ ● Email clicked - Subject...                   Jan 9, 2025      │
│ ... (continues for 50+ items)                                   │
│                                                                  │
│ Showing latest 50 activities. Load more >                       │
└─────────────────────────────────────────────────────────────────┘
```

### AFTER (With Pagination)
```
┌─────────────────────────────────────────────────────────────────┐
│ Activity Timeline                     [Filter] [Refresh]        │
├─────────────────────────────────────────────────────────────────┤
│ ● Email sent - Subject...                      Jan 10, 2025     │
│ ● Email opened - Subject...                    Jan 10, 2025     │
│ ● Email clicked - Subject...                   Jan 9, 2025      │
│ ... (shows exactly 20 items)                                    │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│ Showing 1 to 20 of 156 activities                              │
│                                                                  │
│ [◄ Previous]  [1] [2] [3] ... [8]  [Next ►]                   │
└─────────────────────────────────────────────────────────────────┘
```

## Pagination States

### Page 1 (First Page)
```
Showing 1 to 20 of 156 activities

[◄ Previous]* [1]† [2] [3] [4] [5] ... [8]  [Next ►]
   (disabled)  (active)
```

### Page 3 (Middle Page)
```
Showing 41 to 60 of 156 activities

[◄ Previous]  [1] [2] [3]† [4] [5] ... [8]  [Next ►]
              (active on page 3)
```

### Page 5 (Middle Page with Ellipsis)
```
Showing 81 to 100 of 156 activities

[◄ Previous]  [1] ... [3] [4] [5]† [6] [7] ... [8]  [Next ►]
                            (active on page 5)
```

### Page 8 (Last Page)
```
Showing 141 to 156 of 156 activities

[◄ Previous]  [1] ... [4] [5] [6] [7] [8]†  [Next ►]*
                                  (active)   (disabled)
```

## Features

### 1. Smart Page Number Display
- **≤5 total pages:** Show all page numbers
- **Many pages:** Show first, current ±2, last with ellipsis
- Example: `[1] ... [4] [5] [6] [7] [8]` when on page 6 of 20

### 2. Visual States
- **Active Page:** Blue button (`variant="default"`)
- **Inactive Pages:** Outlined button (`variant="outline"`)
- **Disabled Button:** Grayed out, no hover effect
- **Loading:** All buttons disabled during fetch

### 3. Responsive Design

#### Desktop View:
```
┌─────────────────────────────────────────────────────────────────┐
│ Showing 1 to 20 of 156 activities                              │
│                                                                  │
│ [◄ Previous]  [1] [2] [3] ... [8]  [Next ►]                   │
└─────────────────────────────────────────────────────────────────┘
```

#### Mobile View:
```
┌───────────────────────────────────┐
│ Showing 1 to 20 of 156 activities│
│                                   │
│ [◄ Prev] [1] [2] [3] [Next ►]   │
└───────────────────────────────────┘
```

## User Interactions

### Click Page Number
1. User clicks page number (e.g., `[3]`)
2. Page button shows loading state (disabled)
3. API fetches page 3 data
4. Smooth scroll to top of Activity Timeline
5. Activities update with new data
6. Pagination updates: Page 3 becomes active

### Click Next Button
1. Increments current page by 1
2. Same loading/scroll behavior
3. Disabled when on last page

### Click Previous Button
1. Decrements current page by 1
2. Same loading/scroll behavior
3. Disabled when on first page

### Change Date Filter
1. User selects date range
2. **Automatically resets to page 1**
3. Pagination recalculates based on filtered results
4. May show fewer total pages

## Integration with Existing Features

### Date Range Filter
```
[Filter by Date ▼]  [Refresh]

When filter applied:
↓
Showing 1 to 20 of 42 activities  • Filtered
[◄ Previous]*  [1]† [2] [3]  [Next ►]
```

### Refresh Button
```
Clicking refresh:
1. Maintains current page
2. Shows loading spinner
3. Refetches current page data
4. Pagination stays on same page
```

### Calendar Integration
- Calendar still shows all activities (up to 1000)
- Pagination only affects timeline list below
- Dots on calendar remain accurate

## API Call Examples

### Initial Load (Page 1)
```
GET /api/email-contacts/a99909c7-bb43-44f3-9127-5f167e9a8e77/activity?page=1&limit=20
```

### Navigate to Page 3
```
GET /api/email-contacts/a99909c7-bb43-44f3-9127-5f167e9a8e77/activity?page=3&limit=20
```

### Page 2 with Date Filter
```
GET /api/email-contacts/a99909c7-bb43-44f3-9127-5f167e9a8e77/activity?page=2&limit=20&from=2025-01-01T00:00:00.000Z&to=2025-01-31T23:59:59.999Z
```

## Performance Considerations

### React Query Caching
```typescript
placeholderData: keepPreviousData
```
- Prevents UI flicker during page transitions
- Shows previous page data while loading new page
- Smooth user experience

### Scroll Behavior
```typescript
timelineElement.scrollIntoView({ 
  behavior: 'smooth', 
  block: 'start' 
})
```
- Smooth scroll animation
- Scrolls to top of Activity Timeline
- Keeps user oriented

### Loading States
- Minimum 2-second spinner for manual actions
- Prevents rapid clicking
- Provides visual feedback

## Edge Cases Handled

✅ **No Activities:** Pagination hidden
✅ **1-20 Activities:** No pagination (only 1 page)
✅ **Exactly 20 Activities:** Shows page 1 only
✅ **21+ Activities:** Pagination appears
✅ **Date Filter = 0 Results:** Shows empty state, no pagination
✅ **Network Error:** Error state, pagination hidden
✅ **Slow Connection:** Loading state, buttons disabled

---

Legend:
- `*` = Disabled state
- `†` = Active/current page
- `...` = Ellipsis indicating skipped pages
- `[Button]` = Clickable button
