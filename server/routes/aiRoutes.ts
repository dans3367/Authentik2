import { Router } from "express";
import { generateText } from "ai";

const router = Router();

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
      model: 'google/gemini-2.0-flash',
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

export default router;
