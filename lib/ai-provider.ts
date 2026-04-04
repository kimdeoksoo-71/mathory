import { GoogleGenerativeAI } from '@google/generative-ai';

export interface AIProvider {
  complete(systemPrompt: string, userPrompt: string): Promise<string>;
}

class GeminiProvider implements AIProvider {
  private genAI: GoogleGenerativeAI;
  private modelName: string;

  constructor(apiKey: string, modelName: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.modelName = modelName;
  }

  async complete(systemPrompt: string, userPrompt: string): Promise<string> {
    const model = this.genAI.getGenerativeModel({
      model: this.modelName,
      systemInstruction: systemPrompt,
    });

    const result = await model.generateContent(userPrompt);
    return result.response.text();
  }
}

class ClaudeProvider implements AIProvider {
  async complete(): Promise<string> {
    throw new Error('ClaudeProvider not implemented');
  }
}

export function getAIProvider(): AIProvider {
  const provider = process.env.AI_PROVIDER || 'gemini';

  if (provider === 'gemini') {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY 환경변수가 설정되지 않았습니다');
    const model = process.env.AI_MODEL || 'gemini-2.5-flash';
    return new GeminiProvider(apiKey, model);
  }

  if (provider === 'claude') {
    return new ClaudeProvider();
  }

  throw new Error(`Unknown AI provider: ${provider}`);
}
