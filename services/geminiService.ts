
import { GoogleGenAI, Type } from "@google/genai";
import { SYSTEM_PROMPT } from "../constants";
import { AnalysisResult, MessageRole, ChatMessage, UploadedLayer } from "../types";

// Define the schema for the structured output we need to drive the UI
const responseSchema = {
  type: Type.OBJECT,
  properties: {
    markdownResponse: {
      type: Type.STRING,
      description: "The full markdown formatted text response following the Geo-Decision Copilot output format.",
    },
    mapCenter: {
      type: Type.OBJECT,
      properties: {
        lat: { type: Type.NUMBER },
        lng: { type: Type.NUMBER },
      },
      required: ["lat", "lng"],
      description: "The center latitude/longitude for the map view based on the area of interest.",
    },
    zoomLevel: {
      type: Type.NUMBER,
      description: "Suggested zoom level for the map (e.g., 10 for city, 14 for neighborhood).",
    },
    locations: {
      type: Type.ARRAY,
      description: "List of specific locations identified or recommended in the analysis.",
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          name: { type: Type.STRING },
          lat: { type: Type.NUMBER },
          lng: { type: Type.NUMBER },
          score: { type: Type.NUMBER, description: "Suitability score 0-100" },
          type: {
            type: Type.STRING,
            enum: ["recommended", "competitor", "risk", "neutral"],
          },
          description: { type: Type.STRING, description: "Short tooltip description" },
        },
        required: ["id", "name", "lat", "lng", "score", "type", "description"],
      },
    },
    polygons: {
      type: Type.ARRAY,
      description: "Polygonal zones for trade areas, risk zones, or catchments.",
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          name: { type: Type.STRING },
          type: { type: Type.STRING, enum: ["trade-area", "risk-zone", "catchment"] },
          coordinates: {
             type: Type.ARRAY,
             items: {
                 type: Type.ARRAY,
                 items: { type: Type.NUMBER }, // [lat, lng]
                 description: "Lat/Lng pair"
             },
             description: "List of coordinates forming the polygon loop."
          },
          description: { type: Type.STRING }
        },
        required: ["id", "name", "type", "coordinates", "description"]
      }
    },
    chartData: {
      type: Type.ARRAY,
      description: "Key metrics suitable for a bar or radar chart comparison.",
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "Name of the location or entity" },
          value: { type: Type.NUMBER, description: "Numeric value of the metric" },
          category: { type: Type.STRING, description: "Category of metric (e.g. ROI, Risk Score, Foot Traffic)" },
        },
        required: ["name", "value", "category"],
      },
    },
  },
  required: ["markdownResponse", "mapCenter", "zoomLevel", "locations", "chartData"],
};

export const sendMessageToGemini = async (
  history: ChatMessage[],
  newMessage: string,
  userLayers: UploadedLayer[] = [],
  image?: string // Base64 string of image
): Promise<AnalysisResult> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    // Prepare context from uploaded layers
    let dataContext = "";
    if (userLayers.length > 0) {
      dataContext = "\n\nUSER UPLOADED DATA CONTEXT (Use this to answer questions about specific user assets):\n";
      userLayers.forEach(layer => {
        if (layer.visible && layer.rawSnippet) {
          dataContext += `Layer: ${layer.name} (${layer.type})\nSample Data: ${layer.rawSnippet}\n---\n`;
        }
      });
      dataContext += "\nIf the user asks about their data, analyze the patterns in the samples provided above.\n";
    }

    // Filter history to only user and model, and map to API format
    // limiting history to last 6 messages to save context window
    const recentHistory = history.slice(-6).map((msg) => ({
      role: msg.role === MessageRole.USER ? 'user' : 'model',
      parts: [{ text: msg.text }],
    }));

    const chat = ai.chats.create({
      model: "gemini-3-pro-preview", // Upgraded to Gemini 3 Pro
      config: {
        systemInstruction: SYSTEM_PROMPT + dataContext,
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.4, // Keep it analytical
      },
      history: recentHistory,
    });

    let messagePayload: any = newMessage;

    if (image) {
        // Strip data:image/png;base64, prefix if present
        const base64Data = image.split(',')[1] || image;
        messagePayload = [
            { text: newMessage },
            { 
              inlineData: { 
                mimeType: 'image/png', // Assuming PNG or JPEG, API is flexible 
                data: base64Data 
              } 
            }
        ];
    }

    const result = await chat.sendMessage({
      message: messagePayload,
    });

    const text = result.text;
    if (!text) throw new Error("No response from AI");

    const parsed = JSON.parse(text) as AnalysisResult;
    return parsed;
  } catch (error) {
    console.error("Gemini API Error:", error);
    // Return a fallback error state so the UI doesn't crash
    return {
      markdownResponse: `**Error:** Unable to process request. \n\nDetails: ${error instanceof Error ? error.message : "Unknown error"}`,
      mapCenter: { lat: 0, lng: 0 },
      zoomLevel: 2,
      locations: [],
      chartData: []
    };
  }
};
