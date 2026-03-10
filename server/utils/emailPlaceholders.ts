/**
 * Shared email placeholder replacement utility.
 *
 * Replaces template placeholders (e.g. {{first_name}}, {{company_name}})
 * with actual contact/company data. Handles both HTML body and subject lines.
 * All substituted values are HTML-escaped to prevent injection attacks.
 */

function escapeHtml(str: string): string {
    return str.replace(/[&<>"']/g, (c: string) => {
        switch (c) {
            case '&':
                return '&amp;';
            case '<':
                return '&lt;';
            case '>':
                return '&gt;';
            case '"':
                return '&quot;';
            case "'":
                return '&#39;';
            default:
                return c;
        }
    });
}

export interface EmailContactInfo {
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
}

/**
 * Replace template placeholders with actual contact/company data.
 *
 * Supported placeholders:
 * - {{first_name}} / {{firstName}}
 * - {{last_name}} / {{lastName}}
 * - {{full_name}} / {{fullName}}
 * - {{email}}
 * - {{company_name}} / {{companyName}}
 * - {customer_name} (legacy single-brace variant)
 */
export function replaceEmailPlaceholders(
    text: string,
    contact: EmailContactInfo,
    companyName?: string,
): string {
    // HTML-escape all values before substitution to prevent injection
    const escapedFirstName = escapeHtml(contact.firstName || '');
    const escapedLastName = escapeHtml(contact.lastName || '');
    const escapedFullName = escapeHtml(`${contact.firstName || ''} ${contact.lastName || ''}`.trim());
    const escapedEmail = escapeHtml(contact.email || '');
    const escapedCompanyName = escapeHtml(companyName || '');

    return text
        .replace(/\{\{\s*first_name\s*\}\}/gi, escapedFirstName)
        .replace(/\{\{\s*firstName\s*\}\}/gi, escapedFirstName)
        .replace(/\{\{\s*last_name\s*\}\}/gi, escapedLastName)
        .replace(/\{\{\s*lastName\s*\}\}/gi, escapedLastName)
        .replace(/\{\{\s*full_name\s*\}\}/gi, escapedFullName)
        .replace(/\{\{\s*fullName\s*\}\}/gi, escapedFullName)
        .replace(/\{\{\s*email\s*\}\}/gi, escapedEmail)
        .replace(/\{\{\s*company_name\s*\}\}/gi, escapedCompanyName)
        .replace(/\{\{\s*companyName\s*\}\}/gi, escapedCompanyName)
        .replace(/\{customer_name\}/gi, escapedFirstName);
}
