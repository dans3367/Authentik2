# Quick Reference: Email Fallback Control

## TL;DR

**Production**: `ENABLE_EMAIL_FALLBACK=false` (default) ✅  
**Development**: `ENABLE_EMAIL_FALLBACK=true` (optional) ⚠️

## What It Does

Controls whether emails can bypass Temporal workflow when Temporal is unavailable.

## Quick Setup

### Production (Recommended)
```bash
# cardprocessor-go/.env
ENABLE_EMAIL_FALLBACK=false  # Already default
```
✅ Temporal required  
❌ Fails fast if Temporal down  
✅ Production-safe

### Development (Optional)
```bash
# cardprocessor-go/.env
ENABLE_EMAIL_FALLBACK=true
```
⚠️ Allows fallback  
⚠️ Shows warnings  
⚠️ Dev only!

## Quick Test

```bash
# Stop Temporal to test
docker stop temporal

# Test with fallback disabled (should fail with 503)
curl -X POST http://localhost:5003/api/birthday/test \
  -H "Content-Type: application/json" \
  -d '{"userEmail": "test@example.com", ...}'

# Enable fallback
echo "ENABLE_EMAIL_FALLBACK=true" >> cardprocessor-go/.env

# Rebuild and test (should work with warnings)
cd cardprocessor-go && go build && ./cardprocessor-go
```

## Logs to Watch

### Fallback Disabled
```
❌ Email fallback is DISABLED. Temporal is required but unavailable.
```

### Fallback Enabled  
```
⚠️ WARNING: Fallback mode is active! This bypasses Temporal workflow.
```

## Common Scenarios

| Scenario | ENABLE_EMAIL_FALLBACK | Result |
|----------|----------------------|---------|
| Prod + Temporal Up | false | ✅ Use Temporal |
| Prod + Temporal Down | false | ❌ 503 Error |
| Dev + Temporal Up | true | ✅ Use Temporal |
| Dev + Temporal Down | true | ⚠️ Use Fallback |

## When to Enable Fallback

✅ **DO Enable** when:
- Testing non-email features locally
- Temporal not set up yet in dev
- Quick local development

❌ **DON'T Enable** when:
- In production
- Testing email workflows
- Testing split promotional emails

## Troubleshooting

### Getting 503 Errors?
1. Check Temporal is running: `docker ps | grep temporal`
2. Check connection: `TEMPORAL_ADDRESS` in `.env`
3. For dev only: Set `ENABLE_EMAIL_FALLBACK=true`

### Fallback Not Working?
1. Check `.env` has `ENABLE_EMAIL_FALLBACK=true`
2. Restart Go service after changing `.env`
3. Check logs for warning messages

## Files Changed

- `cardprocessor-go/.env` - Set the variable
- `cardprocessor-go/.env.example` - Documentation
- `internal/config/config.go` - Config loading
- `internal/handlers/birthday.go` - Fallback logic

## Documentation

- Full Guide: `EMAIL_FALLBACK_CONFIGURATION.md`
- Summary: `SYSTEM_CLEANUP_SUMMARY.md`

## Remember

🔴 **Production**: Always keep fallback **DISABLED**  
🟡 **Development**: Enable only if needed  
🟢 **Temporal**: Always preferred when available
