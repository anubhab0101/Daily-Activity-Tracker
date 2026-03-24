import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function calculateMacros(mealDescription: string) {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Analyze the following meal and estimate its nutritional content. Meal description: ${mealDescription}`,
    config: {
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
