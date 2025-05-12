import { genkit, z } from 'genkit/beta';
import { googleAI, gemini20Flash, gemini25FlashPreview0417 } from '@genkit-ai/googleai';
import { textEmbedding004, vertexAI } from '@genkit-ai/vertexai';

export const ai = genkit({
    plugins: [
        googleAI(), // automatically look for GOOGLE_API_KEY in your environment.
        vertexAI()
    ],
    promptDir: './llm_prompts',
    model: gemini25FlashPreview0417// gemini20Flash,
})