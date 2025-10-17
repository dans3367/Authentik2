// AI API functions for birthday card generation

interface GenerateBirthdayMessageParams {
  customerName?: string;
  businessName?: string;
  occasionType?: string;
}

interface GenerateBirthdayMessageResponse {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Generate an occasion-specific greeting card message using AI
 */
export async function generateBirthdayMessage(
  params: GenerateBirthdayMessageParams
): Promise<GenerateBirthdayMessageResponse> {
  try {
    const response = await fetch("/api/ai/generate-birthday-message", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "Failed to generate occasion message");
    }

    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error("Error generating occasion message:", error);
    return {
      success: false,
      error: error.message || "Failed to generate occasion message",
    };
  }
}

interface ImproveTextParams {
  text: string;
}

interface ImproveTextResponse {
  success: boolean;
  improvedText?: string;
  error?: string;
}

interface EmojifyTextParams {
  text: string;
}

interface EmojifyTextResponse {
  success: boolean;
  emojifiedText?: string;
  error?: string;
}

interface ExpandTextParams {
  text: string;
}

interface ExpandTextResponse {
  success: boolean;
  expandedText?: string;
  error?: string;
}

/**
 * Improve selected text using AI
 */
export async function improveText(
  params: ImproveTextParams
): Promise<ImproveTextResponse> {
  try {
    const response = await fetch("/api/ai/improve-text", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "Failed to improve text");
    }

    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error("Error improving text:", error);
    return {
      success: false,
      error: error.message || "Failed to improve text",
    };
  }
}

/**
 * Add celebratory emojis to selected text
 */
export async function emojifyText(
  params: EmojifyTextParams
): Promise<EmojifyTextResponse> {
  try {
    const response = await fetch("/api/ai/emojify-text", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "Failed to emojify text");
    }

    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error("Error emojifying text:", error);
    return {
      success: false,
      error: error.message || "Failed to emojify text",
    };
  }
}

/**
 * Expand selected text to be longer and more detailed
 */
export async function expandText(
  params: ExpandTextParams
): Promise<ExpandTextResponse> {
  try {
    const response = await fetch("/api/ai/expand-text", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "Failed to expand text");
    }

    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error("Error expanding text:", error);
    return {
      success: false,
      error: error.message || "Failed to expand text",
    };
  }
}

interface ShortenTextParams {
  text: string;
}

interface ShortenTextResponse {
  success: boolean;
  shortenedText?: string;
  error?: string;
}

interface MoreCasualTextParams {
  text: string;
}

interface MoreCasualTextResponse {
  success: boolean;
  casualText?: string;
  error?: string;
}

interface MoreFormalTextParams {
  text: string;
}

interface MoreFormalTextResponse {
  success: boolean;
  formalText?: string;
  error?: string;
}

/**
 * Shorten selected text to be more concise
 */
export async function shortenText(
  params: ShortenTextParams
): Promise<ShortenTextResponse> {
  try {
    const response = await fetch("/api/ai/shorten-text", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "Failed to shorten text");
    }

    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error("Error shortening text:", error);
    return {
      success: false,
      error: error.message || "Failed to shorten text",
    };
  }
}

/**
 * Make selected text slightly more casual
 */
export async function makeMoreCasualText(
  params: MoreCasualTextParams
): Promise<MoreCasualTextResponse> {
  try {
    const response = await fetch("/api/ai/more-casual-text", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "Failed to make text more casual");
    }

    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error("Error making text more casual:", error);
    return {
      success: false,
      error: error.message || "Failed to make text more casual",
    };
  }
}

/**
 * Make selected text more formal and polished
 */
export async function makeMoreFormalText(
  params: MoreFormalTextParams
): Promise<MoreFormalTextResponse> {
  try {
    const response = await fetch("/api/ai/more-formal-text", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "Failed to make text more formal");
    }

    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error("Error making text more formal:", error);
    return {
      success: false,
      error: error.message || "Failed to make text more formal",
    };
  }
}

interface TranslateParams {
  text: string;
  targetLanguage: string;
}

interface TranslateResponse {
  success: boolean;
  translatedText?: string;
  error?: string;
}

/**
 * Translate selected text to target language
 */
export async function translateText(
  params: TranslateParams
): Promise<TranslateResponse> {
  try {
    const response = await fetch("/api/ai/translate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "Failed to translate text");
    }

    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error("Error translating text:", error);
    return {
      success: false,
      error: error.message || "Failed to translate text",
    };
  }
}
