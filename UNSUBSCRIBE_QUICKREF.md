# Unsubscribe Feature - Quick Reference

## 🚀 Quick Start

```bash
# Start all services
./start.sh

# The cardprocessor-go server will start on port 5004
# with both birthday cards AND unsubscribe functionality
```

## 🔗 URLs

### Customer-Facing (Proxied via Express)
```
https://yourdomain.com/api/unsubscribe/birthday?token=abc123...
↓ (Proxied by Express on port 5000)
http://localhost:5004/api/unsubscribe/birthday?token=abc123...
```

### Direct Access (Development)
```
http://localhost:5004/api/unsubscribe/birthday?token=abc123...
```

## 📍 Port Reference

| Port | Service | Includes |
|------|---------|----------|
| 5000 | Express Server | API, Proxy, Frontend |
| **5004** | **Cardprocessor-Go** | **Birthday Cards + Unsubscribe** |
| 3004 | Form Server | Form serving |
| 3502 | Server Node | Temporal client |
| 50051 | Temporal Server | GRPC bridge |
| 3505 | Webhook Server | Webhooks |

## 🛠️ Testing

### Health Check
```bash
curl http://localhost:5004/health
```

Expected response:
```json
{
  "status": "ok",
  "service": "birthday-card-processor",
  "version": "1.0.0"
}
```

### Test Unsubscribe Page
```bash
# Via proxy (production path)
curl "http://localhost:5000/api/unsubscribe/birthday?token=YOUR_TOKEN"

# Direct to cardprocessor-go
curl "http://localhost:5004/api/unsubscribe/birthday?token=YOUR_TOKEN"
```

## 📁 Key Files

```
cardprocessor-go/
├── main.go                          # Main server entry point
├── internal/
│   ├── router/router.go             # Routes (includes unsubscribe)
│   ├── handlers/birthday.go         # Unsubscribe handlers
│   └── repository/repository.go     # Database operations
└── templates/
    ├── unsubscribe.html             # Main unsubscribe form
    ├── unsubscribe_success.html     # Success page
    └── unsubscribe_error.html       # Error page

server/
└── routes.ts                        # Express proxy configuration

start.sh                             # Startup script
```

## 🗄️ Database

### Tables
- `birthday_unsubscribe_tokens` - Token storage
- `email_contacts` - Contact preferences

### Query Examples
```sql
-- Check if token exists and is valid
SELECT * FROM birthday_unsubscribe_tokens 
WHERE token = 'abc123...' AND used = false;

-- Check contact status
SELECT email, birthday_email_enabled, birthday_unsubscribed_at
FROM email_contacts 
WHERE id = 'contact-id';
```

## 🔄 Flow Summary

1. **Token Generation** → When sending birthday emails
2. **Customer Clicks Link** → Via email footer
3. **Express Proxies** → Port 5000 → 5004
4. **Cardprocessor-Go Handles** → Validates & shows form
5. **Customer Submits** → Form POST
6. **Database Updates** → `birthday_email_enabled = false`
7. **Success Page** → Confirmation shown

## 🎯 API Endpoints

### Public (No Auth Required)
```
GET  /api/unsubscribe/birthday?token=xxx  # Show form
POST /api/unsubscribe/birthday            # Process unsubscribe
```

### Authenticated
```
POST /api/birthday-unsubscribe-token/:contactId  # Generate token
GET  /api/birthday-settings                      # Get settings
PUT  /api/birthday-settings                      # Update settings
GET  /api/birthday-contacts                      # List contacts
POST /api/birthday-test                          # Test email
```

## 🐛 Troubleshooting

### Port 5004 in use
```bash
lsof -ti:5004 | xargs kill -9
```

### Templates not loading
- Ensure running from `cardprocessor-go` directory
- Check `templates/*.html` files exist

### Database connection failed
- Verify `DATABASE_URL` environment variable
- Check PostgreSQL is running

### Proxy not working
- Verify Express server is running on 5000
- Check cardprocessor-go is running on 5004
- Look for errors in Express logs

## 📝 Environment Variables

```bash
DATABASE_URL=postgres://...           # Database connection
JWT_SECRET=your-secret-key            # JWT signing key
PORT=5004                             # Cardprocessor-go port (default)
CARDPROCESSOR_PORT=5004              # Also supported
```

## 🔐 Security Notes

- ✅ Tokens are 32-byte cryptographically secure random strings
- ✅ Tokens can only be used once (marked as `used = true`)
- ✅ No authentication required for unsubscribe (by design)
- ✅ All queries use parameterized statements (SQL injection safe)
- ✅ CORS enabled for cross-origin requests

## 📚 Documentation

- **Full Guide:** `/UNSUBSCRIBE_IMPLEMENTATION.md`
- **Detailed Docs:** `/cardprocessor-go/UNSUBSCRIBE_SERVER.md`
- **Flow Diagram:** `/cardprocessor-go/UNSUBSCRIBE_FLOW.txt`
- **Migration Notes:** `/MIGRATION_TO_5004.md`

## 💡 Tips

1. Always test via proxy (port 5000) to simulate production
2. Use direct access (port 5004) for debugging
3. Check both Express and cardprocessor-go logs
4. Verify database changes after testing
5. Use health endpoint to confirm server is running

## 🚨 Common Issues

| Issue | Solution |
|-------|----------|
| 404 on unsubscribe URL | Check cardprocessor-go is running on 5004 |
| Template not found | Verify templates exist in `cardprocessor-go/templates/` |
| Token invalid | Check token exists in `birthday_unsubscribe_tokens` table |
| Already unsubscribed | Normal - shows success page if token already used |
| Proxy error | Verify Express can reach `localhost:5004` |

---

**Need Help?** Check the full documentation in:
- `/UNSUBSCRIBE_IMPLEMENTATION.md`
- `/cardprocessor-go/UNSUBSCRIBE_SERVER.md`