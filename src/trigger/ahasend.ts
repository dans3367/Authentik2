import { logger } from "@trigger.dev/sdk/v3";

export interface AhaSendPayload {
    from: {
        email: string;
        name?: string;
    };
    recipients: {
        email: string;
        name?: string;
    }[];
    subject: string;
    html_content?: string;
    text_content?: string;
    reply_to?: string;
    substitutions?: Record<string, string>;
    attachments?: {
        filename: string;
        content: string; // base64
        content_type: string;
    }[];
    tags?: Record<string, string>;
}

export async function sendAhaEmail(payload: AhaSendPayload) {
    const apiKey = process.env.AHA_API_KEY;
    const accountId = process.env.AHA_ACCOUNT_ID;

    if (!apiKey) {
        throw new Error("AHA_API_KEY is not configured");
    }

    if (!accountId) {
        throw new Error("AHA_ACCOUNT_ID is not configured");
    }

    // AhaSend v2 API endpoint (requires account_id)
    const endpoint = `https://api.ahasend.com/v2/accounts/${accountId}/messages`;

    if (!payload.from.email || payload.from.email === "admin@zendwise.com") {
        payload.from.email = process.env.EMAIL_FROM || "admin@email.zendwise.com";
    }

    // Build v2 API payload structure
    const v2Payload: {
        from: { email: string; name?: string };
        recipients: { email: string; name?: string }[];
        subject: string;
        html_content?: string;
        text_content?: string;
        reply_to?: string;
        attachments?: { filename: string; content: string; content_type: string }[];
        tracking?: { open: boolean; click: boolean };
    } = {
        from: payload.from,
        recipients: payload.recipients,
        subject: payload.subject,
        html_content: payload.html_content,
        text_content: payload.text_content,
        tracking: { open: true, click: true },
    };

    if (payload.reply_to) {
        v2Payload.reply_to = payload.reply_to;
    }

    if (payload.attachments && payload.attachments.length > 0) {
        v2Payload.attachments = payload.attachments;
    }

    logger.info("Sending email via AhaSend", {
        to: v2Payload.recipients.map(r => r.email),
        subject: v2Payload.subject,
        tracking: v2Payload.tracking,
        hasHtmlContent: !!v2Payload.html_content,
    });

    const response = await fetch(endpoint, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(v2Payload)
    });

    if (!response.ok) {
        const errorText = await response.text();
        logger.error("AhaSend API Error", { status: response.status, response: errorText });
        throw new Error(`AhaSend failed: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    
    logger.info("AhaSend API response", {
        status: response.status,
        messageIds: result?.data?.map((d: any) => d.id),
        trackingEnabled: v2Payload.tracking,
    });
    
    return result;
}
