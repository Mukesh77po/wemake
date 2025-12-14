import { GoogleGenAI, Type } from "@google/genai";
import { SmartDevice, AICommandResponse } from "../types";

// IMPORTANT: Vite uses import.meta.env, not process.env
const ai = new GoogleGenAI({
  apiKey: import.meta.env.VITE_GOOGLE_API_KEY
});

export const parseVoiceCommand = async (
  command: string,
  devices: SmartDevice[]
): Promise<AICommandResponse> => {
  try {
    const deviceContext = devices.map(d =>
      `ID: ${d.id}, Name: ${d.name}, Type: ${d.type}, Location: ${d.location}, Status: ${d.isOn ? 'ON' : 'OFF'}`
    ).join('\n');

    const prompt = `
      You are "AccessiHome", a warm, casual, and friendly assistive home assistant. 
      Your Persona:
      - Speak like a helpful friend.
      - NEVER use formal titles like "Sir", "Madam", "Mr.", or "Ms.".
      - Be concise and soft-spoken.
      
      User Command: "${command}"
      
      Available Devices:
      ${deviceContext}

      Instructions:
      1. Identify the device and action (TURN_ON, TURN_OFF, TOGGLE).
      2. If the user just says a greeting (e.g., "Hello", "Hi", "Good morning"), 
         set targetDeviceId to null, action to UNKNOWN, and provide a warm 
         conversationalResponse (e.g., "Hi there! Ready to help.").
      3. If the command is valid, set the device ID and action. 
         Leave conversationalResponse EMPTY.
      4. If unclear, ask kindly for clarification.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            targetDeviceId: { type: Type.STRING, nullable: true },
            action: { type: Type.STRING, enum: ["TURN_ON", "TURN_OFF", "TOGGLE", "UNKNOWN"] },
            reasoning: { type: Type.STRING },
            conversationalResponse: { type: Type.STRING, nullable: true }
          },
          required: ["targetDeviceId", "action", "reasoning"]
        }
      }
    });

    // Clean markdown fences if added by AI
    let cleanText = response.text || "{}";
    cleanText = cleanText.replace(/```json/g, '').replace(/```/g, '').trim();

    const result = JSON.parse(cleanText);
    return result as AICommandResponse;

  } catch (error) {
    console.error("AI Parsing Error:", error);
    return {
      targetDeviceId: null,
      action: 'UNKNOWN',
      reasoning: "Failed to parse command or AI service unavailable.",
      conversationalResponse: "Sorry, I'm having trouble connecting right now."
    };
  }
};
