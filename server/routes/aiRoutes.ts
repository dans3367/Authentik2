import { Router } from "express";
import { generateText } from "ai";

const router = Router();

// AI model configuration - default google/gemini-2.0-flash
// Other models: meta/llama-3.1-8b, google/gemini-2.0-flash-lite, xai/grok-3-mini, meta/llama-4-scout
const AI_MODEL = 'google/gemini-2.5-flash-lite';

// POST /api/ai/generate-birthday-message
// Generate a birthday card message using AI
router.post("/generate-birthday-message", async (req, res) => {
  try {
    const { customerName, businessName } = req.body;

    // Validate API key
    const apiKey = process.env.AI_GATEWAY_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: "AI Gateway API key not configured"
      });
    }

    // Construct the prompt
    const promptText = `Create a warm and professional happy birthday card greeting from ${businessName || "our business"} to our customer${customerName ? ` ${customerName}` : ""}. The message should be friendly, sincere, and appropriate for a business-to-customer relationship. Keep it concise (2-3 sentences) and celebratory. Do not include a greeting like "Dear" or a signature - just the birthday message body. Do not use phrases like "At [Company Name]" or similar company references. Format the output as a single HTML <p> tag containing all the text. Do not use multiple paragraph tags or add extra line breaks. Return only the raw HTML content - do not wrap it in markdown code blocks (\`\`\`html or \`\`\`), backticks, or any other formatting. Return the HTML directly.`;

    // Generate the text using AI Gateway with plain model string
    const { text } = await generateText({
      model: AI_MODEL,
      prompt: promptText,
    });

    res.json({
      success: true,
      message: text,
    });
  } catch (error: any) {
    console.error("Error generating birthday message:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to generate birthday message",
    });
  }
});

// POST /api/ai/improve-text
// Improve selected text using AI
router.post("/improve-text", async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        success: false,
        error: "Text is required"
      });
    }

    // Validate API key
    const apiKey = process.env.AI_GATEWAY_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: "AI Gateway API key not configured"
      });
    }

    // Construct the prompt for improving the text
    const promptText = `Improve the following birthday greeting from a business to a customer. Make it more engaging, clear, and professional while maintaining its original meaning and tone. Change any first-person singular pronouns (I, me, my) to first-person plural (we, us, our) to reflect that this message is from a business. Keep the improved version concise and natural. Do not use phrases like "At [Company Name]" or similar company references. Format the output as HTML, using one <p> tag per logical paragraph (group related sentences together). Do not put each sentence in its own <p> tag. Do not add extra line breaks between paragraphs. Return only the raw HTML content - do not wrap it in markdown code blocks (\`\`\`html or \`\`\`), backticks, or any other formatting. Return the HTML directly.\n\n${text}`;

    // Generate the improved text using AI Gateway
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

    const apiKey = process.env.AI_GATEWAY_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: "AI Gateway API key not configured",
      });
    }

    const promptText = `Add tasteful, celebratory emojis to the following birthday greeting from a business to a customer. Change any first-person singular pronouns (I, me, my) to first-person plural (we, us, our) to reflect that this message is from a business. Keep the original wording otherwise intact, only add or swap in emojis where they naturally enhance the sentiment. Avoid overusing emojis and do not include explanations. Do not use phrases like "At [Company Name]" or similar company references. Format the output as HTML, using one <p> tag per logical paragraph (group related sentences together). Do not put each sentence in its own <p> tag. Do not add extra line breaks between paragraphs. Return only the raw HTML content - do not wrap it in markdown code blocks (\`\`\`html or \`\`\`), backticks, or any other formatting. Return the HTML directly.\n\n${text}`;

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

    const apiKey = process.env.AI_GATEWAY_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: "AI Gateway API key not configured",
      });
    }

    const promptText = `Expand the following birthday greeting from a business to a customer to be slightly longer (around 30-40% more words) while keeping the original tone, message, and professionalism. Change any first-person singular pronouns (I, me, my) to first-person plural (we, us, our) to reflect that this message is from a business. Do not add a salutation or signature. Do not use phrases like "At [Company Name]" or similar company references. Format the output as HTML, using one <p> tag per logical paragraph (group related sentences together). Do not put each sentence in its own <p> tag. Do not add extra line breaks between paragraphs. Return only the raw HTML content - do not wrap it in markdown code blocks (\`\`\`html or \`\`\`), backticks, or any other formatting. Return the HTML directly.\n\n${text}`;

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

    const apiKey = process.env.AI_GATEWAY_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: "AI Gateway API key not configured",
      });
    }

    const promptText = `You are a text editor. Your task is to make the following birthday greeting shorter and more concise.

RULES:
1. Remove unnecessary words while keeping the core message
2. Change "I/me/my" to "we/us/our" 
3. Keep the warm, friendly tone
4. Do NOT add greetings, signatures, or company references like "At [Company Name]"
5. Format as HTML with <p> tags (one per paragraph, group related sentences)
6. Return ONLY the shortened HTML - no explanations, no markdown code blocks

TEXT TO SHORTEN:
${text}`;
console.log(text);
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

    const apiKey = process.env.AI_GATEWAY_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: "AI Gateway API key not configured",
      });
    }

    const promptText = `Rewrite the following birthday greeting from a business to a customer in a slightly more casual, conversational tone while keeping it professional and warm. Maintain the original intent and replace any first-person singular pronouns (I, me, my) with first-person plural (we, us, our). Do not add a salutation or signature and keep the length similar. Do not use phrases like "At [Company Name]" or similar company references. Format the output as HTML, using one <p> tag per logical paragraph (group related sentences together). Do not put each sentence in its own <p> tag. Do not add extra line breaks between paragraphs. Return only the raw HTML content - do not wrap it in markdown code blocks (\`\`\`html or \`\`\`), backticks, or any other formatting. Return the HTML directly.\n\n${text}`;

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

    const apiKey = process.env.AI_GATEWAY_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: "AI Gateway API key not configured",
      });
    }

    const promptText = `Rewrite the following birthday greeting from a business to a customer in a more formal, polished tone while keeping it warm and sincere. Maintain the original meaning and replace any first-person singular pronouns (I, me, my) with first-person plural (we, us, our). Do not add a salutation or signature and keep the length similar. Do not use phrases like "At [Company Name]" or similar company references. Format the output as HTML, using one <p> tag per logical paragraph (group related sentences together). Do not put each sentence in its own <p> tag. Do not add extra line breaks between paragraphs. Return only the raw HTML content - do not wrap it in markdown code blocks (\`\`\`html or \`\`\`), backticks, or any other formatting. Return the HTML directly.\n\n${text}`;

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

    const apiKey = process.env.AI_GATEWAY_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: "AI Gateway API key not configured",
      });
    }

    const languageMap: { [key: string]: string } = {
      "english": "English",
      "spanish": "Spanish (Español)",
      "mandarin": "Chinese (简体中文)",
      "hindi": "Hindi (हिन्दी)",
      "bengali": "Bengali (বাংলা)"
    };

    const targetLanguageName = languageMap[targetLanguage] || targetLanguage;

    const promptText = `You are a professional translator. Translate the following birthday greeting to ${targetLanguageName}.

RULES:
1. Keep the same warm, friendly tone
2. Make it natural and culturally appropriate for ${targetLanguageName} speakers
3. Maintain any HTML formatting from the input
4. Do NOT add greetings, signatures, or explanations
5. Return ONLY the translated HTML - no markdown code blocks

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