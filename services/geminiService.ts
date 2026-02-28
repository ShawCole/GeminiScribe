import { GoogleGenAI } from "@google/genai";

/**
 * Initializes the Gemini API client.
 * Note: In a production environment, API calls should often go through a backend 
 * to protect the API key, unless using an explicitly allowed domain-restricted key.
 */
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const transcribeAudioStream = async (
  base64Data: string,
  mimeType: string,
  onChunk: (text: string) => void
): Promise<string> => {
  try {
    const modelId = 'gemini-2.5-flash'; 
    
    /**
     * DIARIZATION & TRANSCRIPTION PROMPT
     * Explicitly defining Speaker 1 (Male) and Speaker 2 (Female) as requested.
     */
    const systemInstruction = `
You are a highly accurate audio transcription and speaker diarization engine.
Task: Transcribe the audio verbatim and label the speakers.

SPEAKER IDENTIFICATION:
- Identify the MALE voice as "Speaker 1".
- Identify the FEMALE voice as "Speaker 2".

TRANSCRIPTION RULES:
1. Every line must start with a timestamp in brackets.
2. Format: [MM:SS] Speaker X: Text
3. If the audio exceeds 60 minutes, use [HH:MM:SS] format.
4. Capture every word exactly as spoken.
5. Provide a new line and timestamp whenever the speaker changes.

DETERMINISM:
- Do not add conversational filler in your response.
- Only output the transcript.
`;

    const responseStream = await ai.models.generateContentStream({
      model: modelId,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Data
            }
          },
          {
            text: `Transcribe this audio file verbatim with speaker diarization. Speaker 1 is the male voice, and Speaker 2 is the female voice.`
          }
        ]
      },
      config: {
        systemInstruction: systemInstruction,
        thinkingConfig: { thinkingBudget: 0 },
        temperature: 0 // Maximizing determinism
      }
    });

    let fullText = "";

    for await (const chunk of responseStream) {
      const text = chunk.text;
      if (text) {
        fullText += text;
        onChunk(text);
      }
    }

    return fullText;

  } catch (error) {
    console.error("Gemini Transcription Error:", error);
    throw error;
  }
};