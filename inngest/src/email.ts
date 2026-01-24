import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export interface SendEmailParams {
  to: string | string[];
  from?: string;
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
  cc?: string | string[];
  bcc?: string | string[];
  tags?: { name: string; value: string }[];
}

export interface SendEmailResult {
  success: boolean;
  id?: string;
  error?: string;
}

export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const fromAddress = params.from || process.env.EMAIL_FROM || "noreply@example.com";

  try {
    const emailOptions: any = {
      from: fromAddress,
      to: Array.isArray(params.to) ? params.to : [params.to],
      subject: params.subject,
      html: params.html || undefined,
      text: params.text || "",
      cc: params.cc ? (Array.isArray(params.cc) ? params.cc : [params.cc]) : undefined,
      bcc: params.bcc ? (Array.isArray(params.bcc) ? params.bcc : [params.bcc]) : undefined,
      replyTo: params.replyTo,
      tags: params.tags,
    };

    const { data, error } = await resend.emails.send(emailOptions);

    if (error) {
      console.error("[Email] Failed to send:", error);
      return { success: false, error: error.message };
    }

    console.log("[Email] Sent successfully:", data?.id);
    return { success: true, id: data?.id };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error("[Email] Exception:", errorMessage);
    return { success: false, error: errorMessage };
  }
}

export async function sendBatchEmails(
  emails: SendEmailParams[]
): Promise<SendEmailResult[]> {
  const results: SendEmailResult[] = [];

  for (const email of emails) {
    const result = await sendEmail(email);
    results.push(result);
  }

  return results;
}
