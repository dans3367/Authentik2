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
