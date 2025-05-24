import { getInfoCanal } from './sharedData.js';
// Import dotenv para cargar variables de entorno
import dotenv from "dotenv";
dotenv.config();

export class OpenAIOperations {
    constructor(file_context, history_length, infoCanal) {
        this.messages = [{ role: "system", content: `${file_context}` }];
        //this.apiKey = process.env.OPENAI_API_KEY;this.apiKey1 = process.env.OPENAI_API_KEY_1;
        //this.apiKey2 = process.env.OPENAI_API_KEY_2;
        //this.currentApiKey = 1; // Indica qué clave está activa
        //this.apiKey = this.apiKey1; // Inicializa con la primera clave
        this.apiKey = process.env.SHAPES_API_KEY;
        this.model_name = process.env.MODEL_NAME;
        this.history_length = history_length;

        if (!this.apiKey1 && !this.apiKey2) {
            console.error('No se encontraron las API keys. Por favor, configúralas como variables de entorno.');
        }
    }

    // Lógica para alternar entre las API keys
    //toggleApiKey() {
    //    if (this.currentApiKey === 1 && this.apiKey2) {
    //        this.currentApiKey = 2;
    //        this.apiKey = this.apiKey2;
    //        console.log('Cambiando a la segunda API key');
    //    } else if (this.currentApiKey === 2 && this.apiKey1) {
    //        this.currentApiKey = 1;
    //        this.apiKey = this.apiKey1;
    //        console.log('Cambiando a la primera API key');
    //    }
    //}

    // Verificar si el historial ha excedido el límite
    check_history_length() {
        console.log(`Conversations in History: ${((this.messages.length / 2) - 1)}/${this.history_length}`);
        if (this.messages.length > ((this.history_length * 2) + 1)) {
            console.log('Message amount in history exceeded. Removing oldest user and assistant messages.');
            this.messages.splice(1, 2);
        }
    }
    
// Método principal para realizar la llamada a OpenAI con manejo del error 401
// Agregar el contexto del canal al prompt enviado a OpenRouter
async make_openrouter_call(userMessage) {
    const completePrompt = `${this.fileContext}\n\n${userMessage}`;
    const response = await this.callOpenRouter(completePrompt);
    return response;
}

// Otra función para manejar contextos por canal
async make_openrouter_call_with_context(userMessage, streamContext) {
    const completePrompt = `${this.fileContext}\n\n${streamContext}\n\n${userMessage}`;
    const response = await this.callOpenRouter(completePrompt);
    return response;
}
    
    async make_openrouter_call(text) {
        const maxRetries = 3;
        let attempts = 0;

        while (attempts < maxRetries) {
            try {
                const infoCanal = getInfoCanal(); // Obtener el valor actualizado de infoCanal
                // Agregar infoCanal al mensaje del usuario a la historia
                const formattedText = `${infoCanal}\n${text}`;
                this.messages.push({ role: "user", content: formattedText });
                
                // Verificar si el historial ha excedido el límite
                this.check_history_length();

                // Llamada a la API de OpenRouter usando fetch
                const response = await fetch("https://api.shapes.inc/v1", {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${this.apiKey}`,
                        "HTTP-Referer": process.env.YOUR_SITE_URL || "", // Opcional
                        "X-Title": process.env.YOUR_SITE_NAME || "", // Opcional
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        model: this.model_name,
                        messages: this.messages,
                        temperature: 0.8,
                        max_tokens: 65, // Reducir tokens para evitar problemas de límite
                        frequency_penalty: 0.6,
                        presence_penalty: 0.6,
                    }),
                });

                // Verificar si la respuesta fue exitosa
                if (!response.ok) {
                    console.error(`HTTP Error: ${response.status} - ${response.statusText}`);
                    
                    // Manejo de error 401 para cambiar la API key
                    if (response.status === 401 || response.status === 429) {
                        console.log("API key inválida o se ha alcanzado el limite de tokens. Cambiando a una nueva API key...");
                        //this.toggleApiKey(); // Cambiar a la siguiente clave
                        continue; // Reintentar con la nueva clave
                    } else {
                        throw new Error(`HTTP Error: ${response.status}`);
                    }
                }

                const data = await response.json();

                // Verificar si la respuesta tiene opciones
                if (data.choices && data.choices[0].message) {
                    const agent_response = data.choices[0].message.content;
                    console.log(`Agent Response: ${agent_response}`);
                    this.messages.push({ role: "assistant", content: agent_response });
                    return agent_response;
                } else {
                    // Manejar el caso en que no se devuelvan opciones
                    console.error("Unexpected response from OpenRouter:", data);
                    throw new Error("No choices returned from OpenRouter");
                }
            } catch (error) {
                // Manejo de errores y reintento
                console.error("Error during OpenRouter call:", error);
                attempts += 1;
                if (attempts >= maxRetries) {
                    console.log("Tuve un problema para entender tu mensaje, por favor intenta más tarde.");
                }
            }
        }
    }
}
