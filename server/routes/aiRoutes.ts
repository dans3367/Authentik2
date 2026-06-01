import { Router } from "express";
import { generateText } from "ai";
import { authenticateToken, requireTenant } from '../middleware/auth-middleware';

const router = Router();

// AI model configuration - default google/gemini-2.0-flash
// Other models: meta/llama-3.1-8b, google/gemini-2.0-flash-lite, xai/grok-3-mini, meta/llama-4-scout
const AI_MODEL = 'google/gemini-2.5-flash-lite';

function ensureApiKey(res: any) {
  const apiKey = process.env.AI_GATEWAY_API_KEY;
  if (!apiKey) {
    res.status(500).json({
      success: false,
      error: "AI Gateway API key not configured",
    });
    return false;
  }
  return true;
}

function cleanGeneratedHtml(value: string) {
  return value
    .trim()
    .replace(/^```(?:html)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

// POST /api/ai/generate-birthday-message
// Generate an occasion-specific greeting message using AI
router.post("/generate-birthday-message", authenticateToken, requireTenant, async (req, res) => {
  try {
    const { customerName, businessName, occasionType, defaultTitle } = req.body;

    if (!ensureApiKey(res)) {
      return;
    }

    // Determine the occasion context for the prompt
    const occasion = occasionType || "birthday";
    
    // Use the default title from the theme if provided, otherwise use standard greetings
    let occasionContext = occasion;
    if (defaultTitle) {
      // Extract the occasion context from the default title
      // e.g., "Happy Valentine's Day!" -> "Valentine's Day"
      // e.g., "Merry Christmas!" -> "Christmas"
      occasionContext = defaultTitle.replace(/^(Happy|Merry|Celebrate|Joyful)\s+/i, '').replace(/!+$/, '').trim();
    }
    
    // Create occasion-specific greeting templates
    const occasionGreetings: { [key: string]: string } = {
      "birthday": "happy birthday",
      "mother's day": "Happy Mother's Day",
      "father's day": "Happy Father's Day",
      "christmas": "Merry Christmas",
      "valentine's day": "Happy Valentine's Day",
      "easter": "Happy Easter",
      "new year": "Happy New Year",
      "st. patrick's day": "Happy St. Patrick's Day",
      "independence day": "Happy Independence Day",
      "thanksgiving": "Happy Thanksgiving",
      "halloween": "Happy Halloween",
    };

    const greeting = occasionGreetings[occasion.toLowerCase()] || `Happy ${occasion}`;

    // Build the prompt using the default title if available
    const titleContext = defaultTitle 
      ? `The card header reads "${defaultTitle}". Use this as the primary context for the occasion being celebrated.` 
      : '';

    const promptText = `Create a warm and professional greeting card message from ${businessName || "our business"} to our customer${customerName ? ` ${customerName}` : ""}. ${titleContext} The message should be:
- Celebratory and appropriate for ${occasionContext}
- Friendly and sincere, suitable for a business-to-customer relationship
- Concise (2-3 sentences)
- Focused on celebrating the occasion and expressing good wishes
- Match the tone and theme suggested by the card title${defaultTitle ? ` "${defaultTitle}"` : ''}
- Do NOT include a greeting like "Dear" or a signature—just the ${occasionContext} message body
- Do NOT use phrases like "At [Company Name]" or similar company references
- Do NOT repeat the card title in the message body
- Incorporate the essence of ${occasionContext} in the message
- Format the output as a single HTML <p> tag containing all the text
- Do not use multiple paragraph tags or add extra line breaks
- Return only the raw HTML content without markdown code fences or backticks`;

    const { text } = await generateText({
      model: AI_MODEL,
      prompt: promptText,
    });

    res.json({
      success: true,
      message: text,
    });
  } catch (error: any) {
    console.error("Error generating occasion message:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to generate occasion message",
    });
  }
});

// POST /api/ai/improve-text
// Improve selected text using AI
router.post("/improve-text", authenticateToken, requireTenant, async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || typeof text !== "string") {
      return res.status(400).json({
        success: false,
        error: "Text is required",
      });
    }

    if (!ensureApiKey(res)) {
      return;
    }

    const promptText = `Improve the following promotional message from a business to a customer. Make it more engaging, clear, and professional while maintaining its original meaning and tone. Change any first-person singular pronouns (I, me, my) to first-person plural (we, us, our) to reflect that this copy is from a business. Keep the improved version concise and natural. Do not use phrases like "At [Company Name]" or similar company references. Format the output as HTML, using one <p> tag per logical paragraph (group related sentences together). Do not put each sentence in its own <p> tag. Separate paragraphs ONLY with <p>...</p> tags — never use <br> tags and never output empty paragraphs or extra line breaks between paragraphs. Return only the raw HTML content without markdown code fences or backticks.

${text}`;

    const { text: improvedText } = await generateText({
      model: AI_MODEL,
      prompt: promptText,
    });

    res.json({
      success: true,
      improvedText: improvedText.trim(),
    });
  } catch (error: any) {
    console.error("Error improving text:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to improve text",
    });
  }
});

// POST /api/ai/emojify-text
// Add celebratory emojis to selected text while keeping tone appropriate
router.post("/emojify-text", authenticateToken, requireTenant, async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || typeof text !== "string") {
      return res.status(400).json({
        success: false,
        error: "Text is required",
      });
    }

    if (!ensureApiKey(res)) {
      return;
    }

    const promptText = `Add tasteful, celebratory emojis to the following promotional message from a business to a customer. Change any first-person singular pronouns (I, me, my) to first-person plural (we, us, our) to reflect that this copy is from a business. Keep the original wording otherwise intact—only add or swap in emojis where they naturally enhance the sentiment. Avoid overusing emojis and do not include explanations. Do not use phrases like "At [Company Name]" or similar company references. Format the output as HTML, using one <p> tag per logical paragraph (group related sentences together). Do not put each sentence in its own <p> tag. Separate paragraphs ONLY with <p>...</p> tags — never use <br> tags and never output empty paragraphs or extra line breaks between paragraphs. Return only the raw HTML content without markdown code fences or backticks.

${text}`;

    const { text: emojified } = await generateText({
      model: AI_MODEL,
      prompt: promptText,
    });

    res.json({
      success: true,
      emojifiedText: emojified.trim(),
    });
  } catch (error: any) {
    console.error("Error emojifying text:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to emojify text",
    });
  }
});

// POST /api/ai/expand-text
// Make selected text longer and more detailed
router.post("/expand-text", authenticateToken, requireTenant, async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || typeof text !== "string") {
      return res.status(400).json({
        success: false,
        error: "Text is required",
      });
    }

    if (!ensureApiKey(res)) {
      return;
    }

    const promptText = `Expand the following promotional message from a business to a customer to be slightly longer (around 30-40% more words) while keeping the original tone, message, and professionalism. Change any first-person singular pronouns (I, me, my) to first-person plural (we, us, our) to reflect that this copy is from a business. Do not add a salutation or signature. Do not use phrases like "At [Company Name]" or similar company references. Format the output as HTML, using one <p> tag per logical paragraph (group related sentences together). Do not put each sentence in its own <p> tag. Separate paragraphs ONLY with <p>...</p> tags — never use <br> tags and never output empty paragraphs or extra line breaks between paragraphs. Return only the raw HTML content without markdown code fences or backticks.

${text}`;

    const { text: expanded } = await generateText({
      model: AI_MODEL,
      prompt: promptText,
    });

    res.json({
      success: true,
      expandedText: expanded.trim(),
    });
  } catch (error: any) {
    console.error("Error expanding text:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to expand text",
    });
  }
});

// POST /api/ai/shorten-text
// Make selected text shorter and more concise
router.post("/shorten-text", authenticateToken, requireTenant, async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || typeof text !== "string") {
      return res.status(400).json({
        success: false,
        error: "Text is required",
      });
    }

    if (!ensureApiKey(res)) {
      return;
    }

    const promptText = `You are a text editor. Your task is to make the following promotional message shorter and more concise.

RULES:
1. Remove unnecessary words while keeping the core message
2. Change "I/me/my" to "we/us/our"
3. Keep the warm, friendly tone
4. Do NOT add greetings, signatures, or company references like "At [Company Name]"
5. Format as HTML with <p> tags (one per paragraph, group related sentences). Never use <br> tags and never output empty paragraphs or extra line breaks between paragraphs
6. Return ONLY the shortened HTML—no explanations and no markdown code fences

TEXT TO SHORTEN:
${text}`;

    const { text: shortened } = await generateText({
      model: AI_MODEL,
      prompt: promptText,
    });

    res.json({
      success: true,
      shortenedText: shortened.trim(),
    });
  } catch (error: any) {
    console.error("Error shortening text:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to shorten text",
    });
  }
});

// POST /api/ai/more-casual-text
// Make selected text feel more casual and friendly
router.post("/more-casual-text", authenticateToken, requireTenant, async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || typeof text !== "string") {
      return res.status(400).json({
        success: false,
        error: "Text is required",
      });
    }

    if (!ensureApiKey(res)) {
      return;
    }

    const promptText = `Rewrite the following promotional message from a business to a customer in a slightly more casual, conversational tone while keeping it professional and warm. Maintain the original intent and replace any first-person singular pronouns (I, me, my) with first-person plural (we, us, our). Do not add a salutation or signature and keep the length similar. Do not use phrases like "At [Company Name]" or similar company references. Format the output as HTML, using one <p> tag per logical paragraph (group related sentences together). Do not put each sentence in its own <p> tag. Separate paragraphs ONLY with <p>...</p> tags — never use <br> tags and never output empty paragraphs or extra line breaks between paragraphs. Return only the raw HTML content without markdown code fences or backticks.

${text}`;

    const { text: casual } = await generateText({
      model: AI_MODEL,
      prompt: promptText,
    });

    res.json({
      success: true,
      casualText: casual.trim(),
    });
  } catch (error: any) {
    console.error("Error making text more casual:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to make text more casual",
    });
  }
});

// POST /api/ai/more-formal-text
// Make selected text sound more formal and polished
router.post("/more-formal-text", authenticateToken, requireTenant, async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || typeof text !== "string") {
      return res.status(400).json({
        success: false,
        error: "Text is required",
      });
    }

    if (!ensureApiKey(res)) {
      return;
    }

    const promptText = `Rewrite the following promotional message from a business to a customer in a more formal, polished tone while keeping it warm and sincere. Maintain the original meaning and replace any first-person singular pronouns (I, me, my) with first-person plural (we, us, our). Do not add a salutation or signature and keep the length similar. Do not use phrases like "At [Company Name]" or similar company references. Format the output as HTML, using one <p> tag per logical paragraph (group related sentences together). Do not put each sentence in its own <p> tag. Separate paragraphs ONLY with <p>...</p> tags — never use <br> tags and never output empty paragraphs or extra line breaks between paragraphs. Return only the raw HTML content without markdown code fences or backticks.

${text}`;

    const { text: formal } = await generateText({
      model: AI_MODEL,
      prompt: promptText,
    });

    res.json({
      success: true,
      formalText: formal.trim(),
    });
  } catch (error: any) {
    console.error("Error making text more formal:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to make text more formal",
    });
  }
});

// POST /api/ai/transform-text
// Generic text transformation endpoint for Puck editor
router.post("/transform-text", authenticateToken, requireTenant, async (req, res) => {
  try {
    const { text, prompt } = req.body;

    if (!text || typeof text !== "string") {
      return res.status(400).json({
        success: false,
        error: "Text is required",
      });
    }

    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({
        success: false,
        error: "Prompt is required",
      });
    }

    if (!ensureApiKey(res)) {
      return;
    }

    const fullPrompt = `${prompt}. Return only the transformed text without any explanations, markdown, or code fences.

TEXT TO TRANSFORM:
${text}`;

    const { text: transformedText } = await generateText({
      model: AI_MODEL,
      prompt: fullPrompt,
    });

    res.json({
      success: true,
      text: transformedText.trim(),
    });
  } catch (error: any) {
    console.error("Error transforming text:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to transform text",
    });
  }
});

// POST /api/ai/transform-newsletter
// Rewrite the entire Notion newsletter body while preserving editor-safe HTML.
router.post("/transform-newsletter", authenticateToken, requireTenant, async (req, res) => {
  try {
    const { html, action, instruction } = req.body;

    if (!html || typeof html !== "string") {
      return res.status(400).json({
        success: false,
        error: "Newsletter HTML is required",
      });
    }

    if (!action || typeof action !== "string") {
      return res.status(400).json({
        success: false,
        error: "Action is required",
      });
    }

    if (!ensureApiKey(res)) {
      return;
    }

    const actionInstructions: Record<string, string> = {
      regenerate: "Regenerate the newsletter into a fresh, polished version while preserving the core topic, facts, offers, dates, links, calls to action, and overall structure.",
      improve: "Improve clarity, flow, engagement, and readability while preserving the original tone and meaning.",
      formal: "Rewrite the newsletter in a more formal, polished, professional tone while keeping it warm and sincere.",
      casual: "Rewrite the newsletter in a more casual, friendly, conversational tone while keeping it professional and clear.",
      shorten: "Make the newsletter more concise by removing repetition and unnecessary wording while preserving all important details.",
      expand: "Expand the newsletter with useful detail and smoother transitions while preserving the original intent and keeping the result focused.",
      custom: `Rewrite the newsletter according to this direction: ${typeof instruction === "string" ? instruction.trim() : ""}`,
    };

    const transformInstruction = actionInstructions[action];
    if (!transformInstruction || (action === "custom" && !String(instruction || "").trim())) {
      return res.status(400).json({
        success: false,
        error: "A valid rewrite direction is required",
      });
    }

    const promptText = `You are a professional email newsletter editor. Rewrite the complete newsletter body below.

TRANSFORMATION:
${transformInstruction}

RULES:
1. Return only raw HTML. Do not use markdown code fences, backticks, explanations, or comments.
2. Keep the result as body content only. Do not include <html>, <head>, <body>, scripts, stylesheets, or wrapper container tags.
3. Use editor-safe semantic HTML: <h1>, <h2>, <h3>, <p>, <ul>, <ol>, <li>, <strong>, <em>, <blockquote>, <hr>, <a>, and existing image markup.
4. Preserve every <img> tag exactly as provided, including src, alt, title, width, style, classes, and surrounding image wrapper markup when present. Do not add new image tags and do not remove existing image tags.
5. Preserve all links, URLs, template variables such as {{first_name}}, product names, event names, prices, dates, coupon codes, and factual claims.
6. Use one <p> tag per logical paragraph. Never use <br> tags for paragraph spacing and never output empty paragraphs.
7. Do not add greetings like "Dear subscriber", signatures, unsubscribe text, or email footer/legal boilerplate unless they already appear in the source.
8. Keep first-person business copy in first-person plural: we, us, our.

NEWSLETTER HTML:
${html}`;

    const { text } = await generateText({
      model: AI_MODEL,
      prompt: promptText,
    });

    res.json({
      success: true,
      html: cleanGeneratedHtml(text),
    });
  } catch (error: any) {
    console.error("Error transforming newsletter:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to transform newsletter",
    });
  }
});

// POST /api/ai/translate
// Translate selected text to various languages
router.post("/translate", authenticateToken, requireTenant, async (req, res) => {
  try {
    const { text, targetLanguage } = req.body;

    if (!text || typeof text !== "string") {
      return res.status(400).json({
        success: false,
        error: "Text is required",
      });
    }

    if (!targetLanguage || typeof targetLanguage !== "string") {
      return res.status(400).json({
        success: false,
        error: "Target language is required",
      });
    }

    if (!ensureApiKey(res)) {
      return;
    }

    const languageMap: { [key: string]: string } = {
      english: "English",
      spanish: "Spanish (Español)",
      mandarin: "Chinese (简体中文)",
      hindi: "Hindi (हिन्दी)",
      bengali: "Bengali (বাংলা)",
    };

    const targetLanguageName = languageMap[targetLanguage] || targetLanguage;

    const promptText = `You are a professional translator. Translate the following promotional message to ${targetLanguageName}.

RULES:
1. Keep the same warm, friendly tone
2. Make it natural and culturally appropriate for ${targetLanguageName} speakers
3. Maintain any HTML formatting from the input
4. Do NOT add greetings, signatures, or explanations
5. Return ONLY the translated HTML—no markdown code fences or backticks

TEXT TO TRANSLATE:
${text}`;

    const { text: translated } = await generateText({
      model: AI_MODEL,
      prompt: promptText,
    });

    res.json({
      success: true,
      translatedText: translated.trim(),
    });
  } catch (error: any) {
    console.error("Error translating text:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to translate text",
    });
  }
});

// POST /api/ai/generate-newsletter
// Generate a full newsletter from a user prompt
router.post("/generate-newsletter", authenticateToken, requireTenant, async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({
        success: false,
        error: "Prompt is required",
      });
    }

    if (!ensureApiKey(res)) {
      return;
    }

    const promptText = `You are a professional newsletter writer. Create a full, well-structured newsletter based on the following request:

"${prompt}"

RULES:
1. Write engaging, professional content suitable for an email newsletter
2. Use proper HTML formatting with semantic tags
3. Structure the newsletter with:
   - A compelling headline using <h1>
   - Section headings using <h2> or <h3>
   - Body paragraphs using <p> tags (separate paragraphs ONLY with <p>...</p> — never use <br> tags or empty paragraphs)
   - Bullet lists using <ul><li> where appropriate
   - Bold key phrases using <strong> where it enhances readability
4. Keep the tone warm, professional, and engaging
5. Include 3-5 content sections depending on the topic
6. Do NOT include email headers/footers, unsubscribe links, or meta information
7. Do NOT include placeholder images or image tags
8. Do NOT wrap in <html>, <body>, or <div> container tags — just the content
9. Do NOT use markdown code fences or backticks — return raw HTML only
10. Make it feel like a real, polished newsletter that's ready to send
11. Keep total length between 300-600 words`;

    const { text } = await generateText({
      model: AI_MODEL,
      prompt: promptText,
    });

    res.json({
      success: true,
      html: text.trim(),
    });
  } catch (error: any) {
    console.error("Error generating newsletter:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to generate newsletter",
    });
  }
});

// POST /api/ai/generate-newsletter-text
// Generate text content for a newsletter Text block based on a user prompt
router.post("/generate-newsletter-text", authenticateToken, requireTenant, async (req, res) => {
  try {
    const { prompt, tone } = req.body;

    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({
        success: false,
        error: "Prompt is required",
      });
    }

    if (!ensureApiKey(res)) {
      return;
    }

    const toneInstruction = tone === "formal"
      ? "Use a formal, professional tone."
      : tone === "casual"
      ? "Use a casual, friendly, conversational tone."
      : tone === "persuasive"
      ? "Use a persuasive, compelling tone that motivates action."
      : "Use a warm, professional tone.";

    const promptText = `You are a professional newsletter writer. Create a complete, well-formatted newsletter based on the following request:

"${prompt}"

RULES:
1. ${toneInstruction}
2. Output valid HTML with proper formatting:
   - Use <h2> for the main newsletter title/headline
   - Use <h3> for section headings
   - Use <p> for body paragraphs (separate paragraphs ONLY with <p>...</p> — never use <br> tags or empty paragraphs)
   - Use <ul><li> or <ol><li> for lists and key points
   - Use <strong> to bold important words, names, dates, and key phrases
   - Use <em> for emphasis where appropriate
   - Use <hr> to separate major sections if needed
3. Structure the newsletter with 3-5 sections covering different aspects of the topic
4. Each section should have a heading and 1-3 paragraphs or a mix of paragraphs and bullet lists
5. Make it feel like a real, polished newsletter ready to send — engaging, informative, and well-organized
6. Keep total length between 300-600 words
7. Do NOT include email headers, footers, unsubscribe links, greetings like "Dear subscriber", or signatures
8. Do NOT include <html>, <body>, <head>, or <div> wrapper tags — just the content HTML
9. Do NOT use markdown — output raw HTML only, no code fences or backticks
10. Do NOT include placeholder images or <img> tags`;

    const { text } = await generateText({
      model: AI_MODEL,
      prompt: promptText,
    });

    res.json({
      success: true,
      text: text.trim(),
    });
  } catch (error: any) {
    console.error("Error generating newsletter text:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to generate newsletter text",
    });
  }
});

// POST /api/ai/generate-title-subject
// Generate BOTH a newsletter title and an email subject line from the main editor body
// content in a single request. The two prompts run in parallel, so latency is roughly
// that of a single generation rather than the sum.
router.post("/generate-title-subject", authenticateToken, requireTenant, async (req, res) => {
  try {
    const { content } = req.body;

    if (!content || typeof content !== "string" || !content.trim()) {
      return res.status(400).json({
        success: false,
        error: "Content is required",
      });
    }

    if (!ensureApiKey(res)) {
      return;
    }

    const titlePrompt = `You are helping run a company email newsletter. Based on the newsletter body content below (which may contain HTML markup), come up with a short, descriptive internal name for this newsletter (max ~60 characters) that the team will recognize in their dashboard. It should summarize the main topic of the content.

Return ONLY the name text — no surrounding quotes, no markdown, and no other text.

NEWSLETTER BODY:
${content}`;

    // The subject line must read like editorial newsletter content, NOT marketing, so that
    // mailbox providers deliver it to the Primary inbox instead of flagging it as spam or
    // filing it under Promotions.
    const subjectPrompt = `You are writing the email subject line for a company NEWSLETTER — an editorial, informational update from the business to people who subscribed. It is NOT a promotional or sales email. Based on the newsletter body content below (which may contain HTML markup), write ONE subject line.

REQUIREMENTS:
- Max ~60 characters.
- Read like a genuine editorial/personal newsletter update that describes what is actually inside — informative and only lightly curiosity-driven.
- It must NOT look like an advertisement or marketing blast, so that it lands in the Primary inbox and is not tagged as spam or filed under the Promotions tab.
- Strictly AVOID spam/promotion triggers: no ALL-CAPS words, no exclamation marks, no emojis, no urgency or clickbait, and do not use these or similar words: free, sale, buy, "order now", discount, "% off", deal, offer, "limited time", "act now", hurry, "click here", winner, guarantee, "$", or price figures.
- Use plain, natural sentence case.

Return ONLY the subject line text — no surrounding quotes, no markdown, and no other text.

NEWSLETTER BODY:
${content}`;

    // Run both generations in parallel so the round-trip is ~one call, not two.
    const [titleResult, subjectResult] = await Promise.all([
      generateText({ model: AI_MODEL, prompt: titlePrompt }),
      generateText({ model: AI_MODEL, prompt: subjectPrompt }),
    ]);

    // Single-line outputs — strip stray surrounding quotes/whitespace the model may add.
    const clean = (s: string) => s.trim().replace(/^["'“”\s]+|["'“”\s]+$/g, "").trim();
    const title = clean(titleResult.text);
    const subject = clean(subjectResult.text);

    if (!title && !subject) {
      return res.status(502).json({
        success: false,
        error: "Could not generate a title and subject from the content",
      });
    }

    res.json({
      success: true,
      title,
      subject,
    });
  } catch (error: any) {
    console.error("Error generating newsletter title/subject:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to generate title and subject",
    });
  }
});

// POST /api/ai/transform-title-subject
// Regenerate or rewrite the newsletter dashboard title and inbox subject line.
router.post("/transform-title-subject", authenticateToken, requireTenant, async (req, res) => {
  try {
    const { content, title, subject, action, instruction } = req.body;
    const currentTitle = typeof title === "string" ? title.trim() : "";
    const currentSubject = typeof subject === "string" ? subject.trim() : "";
    const bodyContent = typeof content === "string" ? content.trim() : "";

    if (!bodyContent && !currentTitle && !currentSubject) {
      return res.status(400).json({
        success: false,
        error: "Content, title, or subject is required",
      });
    }

    if (!action || typeof action !== "string") {
      return res.status(400).json({
        success: false,
        error: "Action is required",
      });
    }

    if (!ensureApiKey(res)) {
      return;
    }

    const actionInstructions: Record<string, string> = {
      regenerate: "Create a fresh title and subject from the newsletter body. Do not merely copy the existing values.",
      formal: "Rewrite the existing title and subject to be more formal, polished, and professional while keeping the same meaning.",
      casual: "Rewrite the existing title and subject to be less formal, more conversational, and still clear.",
      shorten: "Make the existing title and subject shorter and more direct while preserving the main idea.",
      custom: `Rewrite the title and subject according to this direction: ${typeof instruction === "string" ? instruction.trim() : ""}`,
    };

    const transformInstruction = actionInstructions[action];
    if (!transformInstruction || (action === "custom" && !String(instruction || "").trim())) {
      return res.status(400).json({
        success: false,
        error: "A valid title/subject direction is required",
      });
    }

    const clean = (s: string) => s.trim().replace(/^["'“”\s]+|["'“”\s]+$/g, "").trim();

    const sharedContext = `CURRENT TITLE:
${currentTitle || "(none)"}

CURRENT SUBJECT:
${currentSubject || "(none)"}

NEWSLETTER BODY:
${bodyContent || "(not provided)"}`;

    const titlePrompt = `You are helping run a company email newsletter.

TASK:
${transformInstruction}

Write the internal newsletter name/title only.

REQUIREMENTS:
- Max ~60 characters.
- Summarize the main topic clearly for a dashboard.
- Use sentence case unless a proper noun requires capitalization.
- Return ONLY the title text. No quotes, markdown, labels, or explanation.

${sharedContext}`;

    const subjectPrompt = `You are writing the inbox subject line for a company NEWSLETTER. This is editorial/informational, not a sales blast.

TASK:
${transformInstruction}

Write the email subject line only.

REQUIREMENTS:
- Max ~60 characters.
- Read like a genuine newsletter update that describes what is inside.
- Avoid spam/promotion triggers: no ALL-CAPS, no exclamation marks, no emojis, no urgency, no clickbait.
- Avoid these or similar words unless already essential to the source: free, sale, buy, order now, discount, % off, deal, offer, limited time, act now, hurry, click here, winner, guarantee.
- Use plain, natural sentence case.
- Return ONLY the subject line text. No quotes, markdown, labels, or explanation.

${sharedContext}`;

    const [titleResult, subjectResult] = await Promise.all([
      generateText({ model: AI_MODEL, prompt: titlePrompt }),
      generateText({ model: AI_MODEL, prompt: subjectPrompt }),
    ]);

    const nextTitle = clean(titleResult.text);
    const nextSubject = clean(subjectResult.text);

    if (!nextTitle && !nextSubject) {
      return res.status(502).json({
        success: false,
        error: "Could not update the title and subject",
      });
    }

    res.json({
      success: true,
      title: nextTitle,
      subject: nextSubject,
    });
  } catch (error: any) {
    console.error("Error transforming newsletter title/subject:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to update title and subject",
    });
  }
});

export default router;
