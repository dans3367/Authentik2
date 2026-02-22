import { logger } from "@trigger.dev/sdk/v3";
import { SESClient, SendEmailCommand, SendRawEmailCommand } from "@aws-sdk/client-ses";

export interface SESEmailPayload {
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
    tags?: Record<string, string>;
}

/**
 * Send an email (or batch of individual emails) via Amazon SES.
 *
 * SES does not have a native batch API like Resend.  Instead we send one
 * `SendEmailCommand` per recipient so we can capture per-recipient
 * `MessageId` values for webhook correlation.
 *
 * Returns an array of per-recipient results.
 */
export async function sendSESEmail(
    payload: SESEmailPayload
): Promise<{ data: { id: string; recipient: { email: string }; status: string }[] }> {
    const accessKeyId = process.env.AWS_SES_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SES_SECRET_ACCESS_KEY;
    const region = process.env.AWS_SES_REGION || "us-east-1";

    if (!accessKeyId || !secretAccessKey) {
        throw new Error("AWS SES credentials not configured (AWS_SES_ACCESS_KEY_ID / AWS_SES_SECRET_ACCESS_KEY)");
    }

    const client = new SESClient({
        region,
        credentials: { accessKeyId, secretAccessKey },
    });

    // Build "From" header
    const fromAddress = payload.from.name
        ? `${payload.from.name} <${payload.from.email}>`
        : payload.from.email;

    // Convert tags map → SES MessageTags list
    const messageTags = payload.tags
        ? Object.entries(payload.tags).map(([Name, Value]) => ({ Name, Value }))
        : undefined;

    logger.info("Sending email(s) via Amazon SES", {
        recipientCount: payload.recipients.length,
        subject: payload.subject,
        from: fromAddress,
        hasTags: !!messageTags,
    });

    const results: { id: string; recipient: { email: string }; status: string }[] = [];

    for (const recipient of payload.recipients) {
        try {
            const configurationSetName = process.env.AWS_SES_CONFIGURATION_SET || undefined;

            const command = new SendEmailCommand({
                Source: fromAddress,
                Destination: {
                    ToAddresses: [recipient.email],
                },
                Message: {
                    Subject: { Data: payload.subject, Charset: "UTF-8" },
                    Body: {
                        ...(payload.html_content
                            ? { Html: { Data: payload.html_content, Charset: "UTF-8" } }
                            : {}),
                        ...(payload.text_content
                            ? { Text: { Data: payload.text_content, Charset: "UTF-8" } }
                            : {}),
                    },
                },
                ...(payload.reply_to ? { ReplyToAddresses: [payload.reply_to] } : {}),
                ...(messageTags ? { Tags: messageTags } : {}),
                ...(configurationSetName ? { ConfigurationSetName: configurationSetName } : {}),
            });

            const response = await client.send(command);
            const messageId = response.MessageId || "";

            results.push({
                id: messageId,
                recipient: { email: recipient.email },
                status: "queued",
            });

            logger.info("SES email sent", {
                messageId,
                to: recipient.email,
            });
        } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            logger.error("SES send failed for recipient", {
                to: recipient.email,
                error: errMsg,
            });
            // Re-throw so the caller (newsletter.ts) can handle fallback
            throw new Error(`SES failed for ${recipient.email}: ${errMsg}`);
        }
    }

    return { data: results };
}
