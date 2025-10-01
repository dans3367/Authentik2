# Bug Fix: UnsubscribeContactFromBirthdayEmails PostgreSQL Parameter Error

## Issue Detected
The enhanced error logging immediately caught a critical bug:

```
❌ [500 ERROR] UnsubscribeContactFromBirthdayEmails failed
   └─ Error Message: failed to unsubscribe contact from birthday emails: 
      pq: inconsistent types deduced for parameter $2
```

## Root Cause
In `internal/repository/repository.go`, the `UnsubscribeContactFromBirthdayEmails` function had a SQL query that reused the same parameter placeholder `$2` for two different fields:

```sql
UPDATE email_contacts 
SET birthday_email_enabled = false, 
    birthday_unsubscribe_reason = $1,
    birthday_unsubscribed_at = $2,
    updated_at = $2              -- ❌ $2 used again!
WHERE id = $3
```

PostgreSQL's parameter type inference system couldn't determine the type for `$2` when it appeared in multiple places, causing the query to fail.

## Solution
Changed the query to use separate parameter placeholders for each value:

```sql
UPDATE email_contacts 
SET birthday_email_enabled = false, 
    birthday_unsubscribe_reason = $1,
    birthday_unsubscribed_at = $2,
    updated_at = $3              -- ✅ Now using $3
WHERE id = $4                    -- ✅ Now using $4
```

And updated the `ExecContext` call to pass the `now` timestamp twice:

```go
_, err := r.db.ExecContext(ctx, query, reason, now, now, contactID)
```

## Files Modified
- ✅ `/internal/repository/repository.go` - Fixed SQL parameter placeholders

## Testing
To verify the fix works:

1. Navigate to the unsubscribe page with a valid token
2. Submit the unsubscribe form
3. The operation should complete successfully without the parameter type error

## Impact
- **Before**: Users would see an error page when trying to unsubscribe from birthday emails
- **After**: Unsubscribe functionality works correctly and updates both `birthday_unsubscribed_at` and `updated_at` timestamps

## Lesson Learned
PostgreSQL requires each parameter placeholder (`$1`, `$2`, etc.) to be unique in the query, even if you want to use the same value multiple times. The solution is to:
1. Use separate placeholders (`$2`, `$3`, etc.)
2. Pass the same value multiple times in the arguments

Alternatively, you could use a subquery or CTE to avoid parameter duplication, but passing the value twice is simpler and more performant.

## Related
This bug was discovered thanks to the enhanced error logging added in the previous commit. The detailed error output made it immediately obvious what the problem was and where to look.

