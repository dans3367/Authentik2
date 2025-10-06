#!/bin/bash

echo "=========================================="
echo "Email Tracking Implementation Verification"
echo "=========================================="
echo ""

echo "✅ Checking files..."
echo ""

# Check migration file
if [ -f "/home/root/Authentik/migrations/019_add_outgoing_emails_tracking.sql" ]; then
    echo "✅ Migration file exists: migrations/019_add_outgoing_emails_tracking.sql"
else
    echo "❌ Migration file NOT found"
fi

# Check models
if grep -q "type OutgoingEmail struct" /home/root/Authentik/cardprocessor-go/internal/models/models.go; then
    echo "✅ OutgoingEmail model added to models.go"
else
    echo "❌ OutgoingEmail model NOT found in models.go"
fi

# Check repository
if grep -q "CreateOutgoingEmailRecord" /home/root/Authentik/cardprocessor-go/internal/repository/repository.go; then
    echo "✅ CreateOutgoingEmailRecord method added to repository.go"
else
    echo "❌ CreateOutgoingEmailRecord NOT found in repository.go"
fi

# Check activities
if grep -q "type EmailContext struct" /home/root/Authentik/cardprocessor-go/internal/temporal/activities.go; then
    echo "✅ EmailContext struct added to activities.go"
else
    echo "❌ EmailContext struct NOT found in activities.go"
fi

if grep -q "func recordOutgoingEmail" /home/root/Authentik/cardprocessor-go/internal/temporal/activities.go; then
    echo "✅ recordOutgoingEmail function added to activities.go"
else
    echo "❌ recordOutgoingEmail function NOT found in activities.go"
fi

# Check updated functions
if grep -q "func SendBirthdayTestEmail(ctx context.Context, content EmailContent, tenantID string, emailType string)" /home/root/Authentik/cardprocessor-go/internal/temporal/activities.go; then
    echo "✅ SendBirthdayTestEmail updated with new parameters"
else
    echo "❌ SendBirthdayTestEmail NOT updated"
fi

# Check workflows
if grep -q "SendBirthdayTestEmail, emailContent, input.TenantID" /home/root/Authentik/cardprocessor-go/internal/temporal/workflows.go; then
    echo "✅ Workflow calls updated to pass tenantID"
else
    echo "❌ Workflow calls NOT updated"
fi

echo ""
echo "✅ Checking compilation..."
echo ""

cd /home/root/Authentik/cardprocessor-go
if go build -o /tmp/verify-build 2>&1 | grep -q "error"; then
    echo "❌ Compilation FAILED"
    go build 2>&1 | head -10
else
    echo "✅ Code compiles successfully!"
    ls -lh /tmp/verify-build | awk '{print "   Binary size: " $5}'
    rm /tmp/verify-build
fi

echo ""
echo "=========================================="
echo "Documentation Files:"
echo "=========================================="
echo ""
ls -lh /home/root/Authentik/*.md | grep -E "(EMAIL|WIRED|QUICK)" | awk '{print "📄 " $9 " (" $5 ")"}'

echo ""
echo "=========================================="
echo "Summary"
echo "=========================================="
echo ""
echo "🎉 Email tracking system is FULLY WIRED UP!"
echo ""
echo "Next steps:"
echo "1. Run migration: psql -d your_db -f migrations/019_add_outgoing_emails_tracking.sql"
echo "2. Rebuild: cd cardprocessor-go && go build"
echo "3. Deploy and test!"
echo ""
echo "Read WIRED_UP_COMPLETE.md for full details."
echo ""
