import { Router } from "express";
import { generateText } from "ai";

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

// POST /api/ai/generate-birthday-message
// Generate an occasion-specific greeting message using AI
router.post("/generate-birthday-message", async (req, res) => {
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
router.post("/improve-text", async (req, res) => {
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

    const promptText = `Improve the following promotional message from a business to a customer. Make it more engaging, clear, and professional while maintaining its original meaning and tone. Change any first-person singular pronouns (I, me, my) to first-person plural (we, us, our) to reflect that this copy is from a business. Keep the improved version concise and natural. Do not use phrases like "At [Company Name]" or similar company references. Format the output as HTML, using one <p> tag per logical paragraph (group related sentences together). Do not put each sentence in its own <p> tag. Do not add extra line breaks between paragraphs. Return only the raw HTML content without markdown code fences or backticks.

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
router.post("/emojify-text", async (req, res) => {
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

    const promptText = `Add tasteful, celebratory emojis to the following promotional message from a business to a customer. Change any first-person singular pronouns (I, me, my) to first-person plural (we, us, our) to reflect that this copy is from a business. Keep the original wording otherwise intact—only add or swap in emojis where they naturally enhance the sentiment. Avoid overusing emojis and do not include explanations. Do not use phrases like "At [Company Name]" or similar company references. Format the output as HTML, using one <p> tag per logical paragraph (group related sentences together). Do not put each sentence in its own <p> tag. Do not add extra line breaks between paragraphs. Return only the raw HTML content without markdown code fences or backticks.

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
router.post("/expand-text", async (req, res) => {
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

    const promptText = `Expand the following promotional message from a business to a customer to be slightly longer (around 30-40% more words) while keeping the original tone, message, and professionalism. Change any first-person singular pronouns (I, me, my) to first-person plural (we, us, our) to reflect that this copy is from a business. Do not add a salutation or signature. Do not use phrases like "At [Company Name]" or similar company references. Format the output as HTML, using one <p> tag per logical paragraph (group related sentences together). Do not put each sentence in its own <p> tag. Do not add extra line breaks between paragraphs. Return only the raw HTML content without markdown code fences or backticks.

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
router.post("/shorten-text", async (req, res) => {
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
5. Format as HTML with <p> tags (one per paragraph, group related sentences)
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
router.post("/more-casual-text", async (req, res) => {
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

    const promptText = `Rewrite the following promotional message from a business to a customer in a slightly more casual, conversational tone while keeping it professional and warm. Maintain the original intent and replace any first-person singular pronouns (I, me, my) with first-person plural (we, us, our). Do not add a salutation or signature and keep the length similar. Do not use phrases like "At [Company Name]" or similar company references. Format the output as HTML, using one <p> tag per logical paragraph (group related sentences together). Do not put each sentence in its own <p> tag. Do not add extra line breaks between paragraphs. Return only the raw HTML content without markdown code fences or backticks.

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
router.post("/more-formal-text", async (req, res) => {
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

    const promptText = `Rewrite the following promotional message from a business to a customer in a more formal, polished tone while keeping it warm and sincere. Maintain the original meaning and replace any first-person singular pronouns (I, me, my) with first-person plural (we, us, our). Do not add a salutation or signature and keep the length similar. Do not use phrases like "At [Company Name]" or similar company references. Format the output as HTML, using one <p> tag per logical paragraph (group related sentences together). Do not put each sentence in its own <p> tag. Do not add extra line breaks between paragraphs. Return only the raw HTML content without markdown code fences or backticks.

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
router.post("/transform-text", async (req, res) => {
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

// POST /api/ai/translate
// Translate selected text to various languages
router.post("/translate", async (req, res) => {
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

export default router;
