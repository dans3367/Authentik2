import { Puck, type Config, type Fields } from "@measured/puck";
import "@measured/puck/puck.css";
import { AITextarea } from "./AITextarea";
import { TextComponentWithAI } from "./TextComponentWithAI";
import { TextFieldWithAIHelper } from "./TextFieldWithAIHelper";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

// Newsletter-focused Puck editor configuration
const config: Config = {
  components: {
    Heading: {
      fields: {
        text: { type: "text", label: "Heading Text" },
        level: {
          type: "select",
          options: [
            { label: "H1", value: "h1" },
            { label: "H2", value: "h2" },
            { label: "H3", value: "h3" },
          ],
          label: "Heading Level",
        },
        align: {
          type: "radio",
          options: [
            { label: "Left", value: "left" },
            { label: "Center", value: "center" },
            { label: "Right", value: "right" },
          ],
          label: "Alignment",
        },
      },
      defaultProps: {
        text: "Your Heading Here",
        level: "h2",
        align: "left",
      },
      render: ({ text, level, align }) => {
        const Component = level as "h1" | "h2" | "h3";
        const fontSize = {
          h1: "text-4xl",
          h2: "text-3xl",
          h3: "text-2xl",
        };
        return (
          <Component
            className={`${fontSize[level as keyof typeof fontSize]} font-bold mb-4 text-${align}`}
          >
            {text}
          </Component>
        );
      },
    },
    Text: {
      fields: {
        content: {
          type: "custom",
          label: "Page Text",
          render: ({ value, onChange }) => (
            <TextFieldWithAIHelper
              value={value || ""}
              onChange={onChange}
            />
          ),
        },
        align: {
          type: "radio",
          options: [
            { label: "Left", value: "left" },
            { label: "Center", value: "center" },
            { label: "Right", value: "right" },
            { label: "Justify", value: "justify" },
          ],
          label: "Alignment",
        },
      },
      defaultProps: {
        content: "Enter your text content here...",
        align: "left",
      },
      render: ({ content, align, puck }) => (
        <TextComponentWithAI
          content={content}
          align={align}
          puck={{
            isEditing: true, // Always show in edit mode when rendering
          }}
          onChange={() => {
            // Puck manages state updates internally via fields
          }}
        />
      ),
    },
    Image: {
      fields: {
        src: { type: "text", label: "Image URL" },
        alt: { type: "text", label: "Alt Text" },
        width: {
          type: "radio",
          options: [
            { label: "Small (300px)", value: "300" },
            { label: "Medium (500px)", value: "500" },
            { label: "Large (700px)", value: "700" },
            { label: "Full Width", value: "100%" },
          ],
          label: "Width",
        },
        align: {
          type: "radio",
          options: [
            { label: "Left", value: "left" },
            { label: "Center", value: "center" },
            { label: "Right", value: "right" },
          ],
          label: "Alignment",
        },
      },
      defaultProps: {
        src: "https://via.placeholder.com/600x400",
        alt: "Newsletter image",
        width: "500",
        align: "center",
      },
      render: ({ src, alt, width, align }) => {
        const alignClass = {
          left: "mr-auto",
          center: "mx-auto",
          right: "ml-auto",
        };
        return (
          <div className={`mb-4 flex ${align === "center" ? "justify-center" : align === "right" ? "justify-end" : "justify-start"}`}>
            <img
              src={src}
              alt={alt}
              style={{ maxWidth: width === "100%" ? "100%" : `${width}px` }}
              className={`rounded-lg ${alignClass[align as keyof typeof alignClass]}`}
            />
          </div>
        );
      },
    },
    Button: {
      fields: {
        text: { type: "text", label: "Button Text" },
        href: { type: "text", label: "Link URL" },
        style: {
          type: "radio",
          options: [
            { label: "Primary", value: "primary" },
            { label: "Secondary", value: "secondary" },
            { label: "Outline", value: "outline" },
          ],
          label: "Button Style",
        },
        align: {
          type: "radio",
          options: [
            { label: "Left", value: "left" },
            { label: "Center", value: "center" },
            { label: "Right", value: "right" },
          ],
          label: "Alignment",
        },
      },
      defaultProps: {
        text: "Click Here",
        href: "#",
        style: "primary",
        align: "center",
      },
      render: ({ text, href, style, align }) => {
        const styleClasses = {
          primary: "bg-blue-600 text-white hover:bg-blue-700",
          secondary: "bg-gray-600 text-white hover:bg-gray-700",
          outline: "border-2 border-blue-600 text-blue-600 bg-transparent hover:bg-blue-50",
        };
        const alignClass = {
          left: "justify-start",
          center: "justify-center",
          right: "justify-end",
        };
        return (
          <div className={`mb-4 flex ${alignClass[align as keyof typeof alignClass]}`}>
            <a
              href={href}
              className={`inline-block px-8 py-3 rounded-lg font-semibold transition-colors ${
                styleClasses[style as keyof typeof styleClasses]
              }`}
            >
              {text}
            </a>
          </div>
        );
      },
    },
    Divider: {
      fields: {
        style: {
          type: "radio",
          options: [
            { label: "Solid", value: "solid" },
            { label: "Dashed", value: "dashed" },
            { label: "Dotted", value: "dotted" },
          ],
          label: "Line Style",
        },
        thickness: {
          type: "radio",
          options: [
            { label: "Thin", value: "1" },
            { label: "Medium", value: "2" },
            { label: "Thick", value: "4" },
          ],
          label: "Thickness",
        },
      },
      defaultProps: {
        style: "solid",
        thickness: "1",
      },
      render: ({ style, thickness }) => {
        const styleMap = {
          solid: "border-solid",
          dashed: "border-dashed",
          dotted: "border-dotted",
        };
        return (
          <hr
            className={`my-6 ${styleMap[style as keyof typeof styleMap]}`}
            style={{ borderTopWidth: `${thickness}px` }}
          />
        );
      },
    },
    Spacer: {
      fields: {
        size: {
          type: "radio",
          options: [
            { label: "Small (16px)", value: "16" },
            { label: "Medium (32px)", value: "32" },
            { label: "Large (64px)", value: "64" },
            { label: "Extra Large (96px)", value: "96" },
          ],
          label: "Space Size",
        },
      },
      defaultProps: {
        size: "32",
      },
      render: ({ size }) => <div style={{ height: `${size}px` }} />,
    },
  },
};

interface PuckNewsletterEditorProps {
  initialData?: any;
  onChange?: (data: any) => void;
}

export function PuckNewsletterEditor({ initialData, onChange }: PuckNewsletterEditorProps) {
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [sending, setSending] = useState(false);
  const [publishData, setPublishData] = useState<any>(null);
  const { toast } = useToast();

  const base = initialData || {
    content: [],
    root: { props: {} },
  };

  const existingClass = base.root?.props?.className || "";
  const paddingClass = "p-[10px]";
  const className = existingClass.includes(paddingClass)
    ? existingClass
    : `${existingClass} ${paddingClass}`.trim();

  const data = {
    ...base,
    root: {
      ...(base.root || {}),
      props: {
        ...(base.root?.props || {}),
        className,
      },
    },
  };

  const escapeHtml = (str: string) =>
    String(str).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m] as string));

  const nl2br = (str: string) => escapeHtml(String(str)).replace(/\n/g, "<br/>");

  const renderPuckToHtml = (puckData: any): string => {
    const blocks = puckData?.content || [];
    const parts: string[] = [];
    for (const block of blocks) {
      const t = block?.type;
      const p = block?.props || {};
      if (t === "Heading") {
        const level = p.level || "h2";
        const align = p.align || "left";
        const text = p.text || "";
        parts.push(`<${level} style="margin:0 0 16px; font-weight:700; text-align:${align};">${escapeHtml(String(text))}</${level}>`);
      } else if (t === "Text") {
        const align = p.align || "left";
        const content = p.content || "";
        parts.push(`<div style="margin:0 0 16px; text-align:${align}; line-height:1.6;">${nl2br(String(content))}</div>`);
      } else if (t === "Image") {
        const src = p.src || "";
        const alt = escapeHtml(String(p.alt || ""));
        const width = p.width || "500";
        const align = p.align || "center";
        const styleWidth = width === "100%" ? "100%" : `${parseInt(width, 10)}px`;
        const justify = align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center";
        parts.push(`<div style="display:flex; justify-content:${justify}; margin:0 0 16px;"><img src="${escapeHtml(String(src))}" alt="${alt}" style="max-width:${styleWidth}; border-radius:8px;" /></div>`);
      } else if (t === "Button") {
        const text = p.text || "Click Here";
        const href = p.href || "#";
        const style = p.style || "primary";
        let bg = "#2563eb";
        let color = "#ffffff";
        let border = "none";
        if (style === "secondary") { bg = "#4b5563"; color = "#ffffff"; }
        if (style === "outline") { bg = "transparent"; color = "#2563eb"; border = "2px solid #2563eb"; }
        parts.push(`<div style="margin:0 0 16px; text-align:center;"><a href="${escapeHtml(String(href))}" style="display:inline-block; padding:12px 24px; border-radius:8px; font-weight:600; text-decoration:none; background:${bg}; color:${color}; border:${border};">${escapeHtml(String(text))}</a></div>`);
      } else if (t === "Divider") {
        const style = p.style || "solid";
        const thickness = parseInt(p.thickness || "1", 10);
        parts.push(`<hr style="border:0; border-top:${thickness}px ${style} #e5e7eb; margin:24px 0;" />`);
      } else if (t === "Spacer") {
        const size = parseInt(p.size || "32", 10);
        parts.push(`<div style="height:${size}px;"></div>`);
      }
    }
    return `<div style="max-width:700px; margin:0 auto; padding:10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">${parts.join("")}</div>`;
  };

  const htmlToText = (html: string) => html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const handlePublish = async (publishPayload: any) => {
    setPublishData(publishPayload);
    if (onChange) {
      onChange(publishPayload);
    }
    setDialogOpen(true);
  };

  const handleSendTest = async () => {
    if (!testEmail.trim()) {
      toast({ title: "Email required", description: "Enter a valid email address", variant: "destructive" });
      return;
    }
    try {
      setSending(true);
      const payload = publishData || data;
      const html = renderPuckToHtml(payload);
      const subj = subject.trim() || "Test Newsletter";
      const res = await apiRequest("POST", "/api/email/send", {
        to: testEmail.trim(),
        subject: subj,
        html,
        text: htmlToText(html),
        metadata: { source: "puck-send-test" },
      });
      await res.json();
      toast({ title: "Sent", description: `Test email sent to ${testEmail.trim()}` });
      setDialogOpen(false);
      setSending(false);
    } catch (e: any) {
      setSending(false);
      toast({ title: "Failed to send", description: e?.message || "Error sending test email", variant: "destructive" });
    }
  };

  return (
    <div className="puck-newsletter-editor w-full min-h-screen">
      <Puck
        config={config}
        data={data}
        onPublish={handlePublish}
      />
      <Dialog open={isDialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Send Test Email</DialogTitle>
            <DialogDescription>Enter the recipient and subject to send your current content as an email.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="test-email">Recipient Email</Label>
              <Input id="test-email" type="email" placeholder="you@example.com" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} disabled={sending} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="test-subject">Subject</Label>
              <Input id="test-subject" placeholder="Test Newsletter" value={subject} onChange={(e) => setSubject(e.target.value)} disabled={sending} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={sending}>Cancel</Button>
            <Button onClick={handleSendTest} disabled={sending || !testEmail.trim()}>{sending ? "Sending..." : "Send Test"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
