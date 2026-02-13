
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const analyzeMinutes = async (minutesText: string) => {
  if (!minutesText || minutesText.length < 20) return null;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analise a seguinte ata de reunião de governança corporativa e extraia os principais planos de ação e decisões tomadas.
      
      ATA:
      ${minutesText}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING, description: "Resumo executivo da ata" },
            extractedActions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  description: { type: Type.STRING },
                  responsible: { type: Type.STRING },
                  deadline: { type: Type.STRING, description: "Data no formato YYYY-MM-DD" }
                }
              }
            },
            keyDeliberations: {
              type: Type.ARRAY,
              items: {
                type: Type.STRING
              }
            }
          },
          required: ["summary", "extractedActions", "keyDeliberations"]
        }
      }
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Erro ao analisar ata com Gemini:", error);
    return null;
  }
};
