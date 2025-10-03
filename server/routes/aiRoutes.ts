import { Router } from "express";
import { generateText } from "ai";

const router = Router();

// AI model configuration - default google/gemini-2.0-flash
const AI_MODEL = 'meta/llama-3.1-8b';

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
    const promptText = `Create a warm and professional happy birthday card greeting from ${businessName || "our business"} to our customer${customerName ? ` ${customerName}` : ""}. The message should be friendly, sincere, and appropriate for a business-to-customer relationship. Keep it concise (2-3 sentences) and celebratory. Do not include a greeting like "Dear" or a signature - just the birthday message body.`;

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
    const promptText = `Improve the following birthday greeting from a business to a customer. Make it more engaging, clear, and professional while maintaining its original meaning and tone. Change any first-person singular pronouns (I, me, my) to first-person plural (we, us, our) to reflect that this message is from a business. Keep the improved version concise and natural. Only return the improved text without any explanations or additional commentary:\n\n${text}`;

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

    const promptText = `Add tasteful, celebratory emojis to the following birthday greeting from a business to a customer. Change any first-person singular pronouns (I, me, my) to first-person plural (we, us, our) to reflect that this message is from a business. Keep the original wording otherwise intact, only add or swap in emojis where they naturally enhance the sentiment. Avoid overusing emojis and do not include explanations. Return only the updated text.\n\n${text}`;

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

    const promptText = `Expand the following birthday greeting from a business to a customer to be slightly longer (around 30-40% more words) while keeping the original tone, message, and professionalism. Change any first-person singular pronouns (I, me, my) to first-person plural (we, us, our) to reflect that this message is from a business. Do not add a salutation or signature. Return only the expanded text without explanations.\n\n${text}`;

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

    const promptText = `Make the following birthday greeting from a business to a customer more concise and shorter (around 30-40% fewer words) while keeping the core message, tone, and warmth intact. Change any first-person singular pronouns (I, me, my) to first-person plural (we, us, our) to reflect that this message is from a business. Do not add a salutation or signature. Return only the shortened text without explanations.\n\n${text}`;

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

export default router;
