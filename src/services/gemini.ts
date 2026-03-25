import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export function createChatSession() {
  return ai.chats.create({
    model: "gemini-3-flash-preview",
    config: {
      systemInstruction: "You are a highly specialized fitness and nutrition assistant. Your sole purpose is to provide advice and answer questions strictly related to meals, macros, workouts, and fitness progress. Do not answer questions or provide suggestions outside of these domains. If a user asks about anything else, politely inform them that you can only assist with meals, macros, workouts, and fitness progress. Be concise and encouraging.",
      tools: [{ googleSearch: {} }],
      toolConfig: { includeServerSideToolInvocations: true }
    },
  });
}

export async function suggestWorkoutPlan(split: string, experience: string, goal: string) {
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
export async function calculateMacros(mealDescription: string) {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Analyze the following meal and estimate its nutritional content. Use Google Search to find the most accurate and up-to-date nutritional information for these specific foods. Meal description: ${mealDescription}`,
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "A short, descriptive name for the meal" },
          calories: { type: Type.NUMBER, description: "Estimated total calories" },
          protein: { type: Type.NUMBER, description: "Estimated protein in grams" },
          carbs: { type: Type.NUMBER, description: "Estimated carbohydrates in grams" },
          fat: { type: Type.NUMBER, description: "Estimated fat in grams" },
        },
        required: ["name", "calories", "protein", "carbs", "fat"],
      },
    },
  });

  if (!response.text) {
    throw new Error("Failed to generate macros");
  }

  return JSON.parse(response.text);
}
