import { getInfoCanal } from './sharedData.js';
import dotenv from "dotenv";
import { OpenAI } from "openai";
dotenv.config();

export class OpenAIOperations {
    constructor(file_context, history_length, infoCanal) {
        this.fileContext = file_context;
        this.history_length = history_length;
        this.messages = [{ role: "system", content: `${file_context}` }];

        // OpenAI/OpenRouter
        this.apiKey1 = process.env.OPENAI_API_KEY_1;
        this.apiKey2 = process.env.OPENAI_API_KEY_2;
        this.currentApiKey = 1;
        this.apiKey = this.apiKey1;
        this.model_name = process.env.MODEL_NAME;

        // Shapes
        this.shapesApiKey = process.env.SHAPES_API_KEY;
        this.shapesModel = process.env.SHAPES_MODEL;
        this.shapesClient = new OpenAI({
            apiKey: this.shapesApiKey,
            baseURL: "https://api.shapes.inc/v1"
        });

        if (!this.apiKey1 && !this.apiKey2) {
            console.error('No se encontraron las API keys. Por favor, configúralas como variables de entorno.');
        }
        if (!this.shapesApiKey) {
            console.error('No se encontró la SHAPES_API_KEY. Por favor, configúrala.');
        }
        if (!this.shapesModel) {
            console.error('No se encontró la SHAPES_MODEL. Por favor, configúrala.');
        }
    }

    toggleApiKey() {
        if (this.currentApiKey === 1 && this.apiKey2) {
            this.currentApiKey = 2;
            this.apiKey = this.apiKey2;
            console.log('Cambiando a la segunda API key');
        } else if (this.currentApiKey === 2 && this.apiKey1) {
            this.currentApiKey = 1;
            this.apiKey = this.apiKey1;
            console.log('Cambiando a la primera API key');
        }
    }

    check_history_length() {
        if (this.messages.length > ((this.history_length * 2) + 1)) {
            this.messages.splice(1, 2);
        }
    }

    // --- LLAMADA A OPENROUTER/OPENAI (igual que antes) ---
    async make_openrouter_call(text) {
        // ... (igual que ya lo tienes)
    }

    // --- LLAMADA A SHAPES ---
    async make_shapes_call(userMessage) {
        const infoCanal = getInfoCanal();
        const formattedText = `${infoCanal}\n${userMessage}`;
        this.messages.push({ role: "user", content: formattedText });
        this.check_history_length();

        try {
            const response = await this.shapesClient.chat.completions.create({
                model: this.shapesModel,
                messages: this.messages,
            });
            const agent_response = response.choices?.[0]?.message?.content || "No response";
            this.messages.push({ role: "assistant", content: agent_response });
            return agent_response;
        } catch (error) {
            console.error("Error during Shapes API call:", error);
            return "Tuve un problema para entender tu mensaje, por favor intenta más tarde.";
        }
    }
}
