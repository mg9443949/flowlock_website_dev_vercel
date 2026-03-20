import { GoogleGenAI } from '@google/genai';
const ai = new GoogleGenAI({ apiKey: 'AIzaSyCF_t-wdjpwW_GhXwPxV-DClCiaAOa0UUM' });
async function test() {
  try {
    const response = await ai.models.list();
    for await (const model of response) {
      if (model.name.includes("embed") || model.supportedGenerationMethods?.includes("embedContent")) {
        console.log("Supported Embed Model:", model.name);
      }
    }
  } catch(e) { console.error(e); }
}
test();
