// AI API functions for birthday card generation

interface GenerateBirthdayMessageParams {
  customerName?: string;
  businessName?: string;
}

interface GenerateBirthdayMessageResponse {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Generate a birthday card message using AI
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
      throw new Error(errorData.error || "Failed to generate birthday message");
    }

    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error("Error generating birthday message:", error);
    return {
      success: false,
      error: error.message || "Failed to generate birthday message",
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
