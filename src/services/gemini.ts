import { GoogleGenAI, Type } from "@google/genai";

function getAiClient(userApiKey?: string, trialValid?: boolean) {
  if (userApiKey) {
    return new GoogleGenAI({ apiKey: userApiKey });
  }
  if (trialValid) {
    return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  throw new Error("AI Trial expired. Please add your Gemini API key in settings.");
}

export async function suggestWorkoutPlan(split: string, experience: string, goal: string, userApiKey?: string, trialValid?: boolean) {
  const ai = getAiClient(userApiKey, trialValid);
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `You are an expert fitness coach. Suggest a workout plan for a ${experience} level user whose goal is ${goal}. Today's muscle split is ${split}. Provide a list of exercises with suggested sets, reps, and weight guidance. Also suggest two cardio options: one intense and one medium.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          exercises: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                sets: { type: Type.NUMBER },
                reps: { type: Type.STRING },
                weightGuidance: { type: Type.STRING },
                notes: { type: Type.STRING }
              },
              required: ["name", "sets", "reps", "weightGuidance", "notes"]
            }
          },
          cardio: {
            type: Type.OBJECT,
            properties: {
              intense: { type: Type.STRING, description: "Intense cardio suggestion (e.g., HIIT)" },
              medium: { type: Type.STRING, description: "Medium cardio suggestion (e.g., LISS)" }
            },
            required: ["intense", "medium"]
          }
        },
        required: ["exercises", "cardio"]
      }
    }
  });

  if (!response.text) {
    throw new Error("Failed to generate workout plan");
  }

  return JSON.parse(response.text);
}

export async function calculateMacros(mealDescription: string, userApiKey?: string, trialValid?: boolean) {
  const ai = getAiClient(userApiKey, trialValid);
  
  const prompt = `Analyze the following meal and estimate its nutritional content. Use Google Search to find the most accurate and up-to-date nutritional information for these specific foods. Meal description: ${mealDescription}
      
You MUST return ONLY a valid JSON object with the following structure, and no other text or markdown formatting:
{
  "name": "A short, descriptive name for the meal",
  "calories": 0,
  "protein": 0,
  "carbs": 0,
  "fat": 0
}`;

  let response;
  try {
    response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });
  } catch (error: any) {
    // If we hit a quota error (often caused by Search Grounding limits on free tier),
    // fallback to standard generation without the googleSearch tool.
    if (error.message?.includes("429") || error.message?.includes("quota") || error.status === 429) {
      console.warn("Search Grounding quota exceeded, falling back to standard generation...");
      try {
        response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: prompt,
        });
      } catch (fallbackError: any) {
        if (fallbackError.message?.includes("429") || fallbackError.message?.includes("quota") || fallbackError.status === 429) {
          throw new Error("API Quota Exceeded. Your Gemini API key has run out of quota completely. Please check your billing details or try again later.");
        }
        throw fallbackError;
      }
    } else {
      throw error;
    }
  }

  if (!response.text) {
    throw new Error("Failed to generate macros");
  }

  try {
    const text = response.text.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(text);
  } catch (e) {
    console.error("Failed to parse macros JSON:", response.text);
    throw new Error("Failed to parse macros response");
  }
}
