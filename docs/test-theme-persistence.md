# Theme Persistence Test Guide

## What's Implemented

✅ **Backend API Endpoint**: `/api/auth/theme` (PATCH)
- Validates theme value ('light' or 'dark')
- Saves theme preference to database
- Returns updated theme value

✅ **Frontend Integration**:
- `useUpdateTheme()` hook for API calls
- Theme state management in `ThemeContext`
- Automatic sync on login/refresh
- Prevents race conditions during theme changes

✅ **Database Schema**:
- `users.theme` column exists with default 'light'
- Theme included in all auth responses (login, refresh, /me)

## How to Test Theme Persistence

### 1. Test Theme Toggle
1. Log into the application
2. Click the dark mode toggle in the user dropdown
3. Verify the theme changes immediately
4. Verify no flashing/reverting occurs

### 2. Test Cross-Browser Persistence
1. Set theme to dark mode in Browser A
2. Open the app in Browser B (incognito/different browser)
3. Log in with the same account
4. Verify the theme loads as dark mode from the start

### 3. Test Logout/Login Persistence
1. Set theme to dark mode
2. Logout
3. Login again
4. Verify theme is still dark mode

### 4. Test Local Storage Override
1. Set theme to dark in the app
2. Open browser dev tools
3. Check `localStorage.getItem('theme')` = 'dark'
4. Manually set `localStorage.setItem('theme', 'light')`
5. Refresh page
6. Should load light theme from localStorage initially
7. Then sync to dark theme from backend when user data loads

## API Testing

You can test the theme API directly:

```bash
# Update theme to dark
curl -X PATCH http://localhost:5002/api/auth/theme \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"theme": "dark"}'

# Check current user data
curl -X GET http://localhost:5002/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Expected Behavior

- Theme changes should be instant (no waiting for backend)
- Theme should persist across browser sessions
- Theme should persist across different browsers for same user
- No flashing between themes on page load
- Backend saves theme preference in database
- Login/refresh responses include user's theme preference