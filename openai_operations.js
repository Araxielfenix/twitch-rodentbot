// Import dotenv para cargar variables de entorno
import dotenv from "dotenv";
dotenv.config();

export class OpenAIOperations {
    constructor(file_context, history_length) {
        this.messages = [{ role: "system", content: file_context }];
        this.apiKey = process.env.OPENAI_API_KEY;
        this.model_name = process.env.MODEL_NAME;
        this.history_length = history_length;
    }

    check_history_length() {
        console.log(`Conversations in History: ${((this.messages.length / 2) -1)}/${this.history_length}`);
        if (this.messages.length > ((this.history_length * 2) + 1)) {
            console.log('Message amount in history exceeded. Removing oldest user and assistant messages.');
            this.messages.splice(1, 2);
        }
    }

    async make_openrouter_call(text) {
        try {
            // Agregar mensaje del usuario a la historia
            this.messages.push({ role: "user", content: text });

            // Verificar si el historial ha excedido el límite
            this.check_history_length();

            // Llamada a la API de OpenRouter usando fetch
            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
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
                    temperature: 1,
                    max_tokens: 256,
                    top_p: 1,
                    frequency_penalty: 0,
                    presence_penalty: 0,
                }),
            });

            const data = await response.json();

            // Verificar si la respuesta tiene opciones
            if (data.choices && data.choices[0].message) {
                console.log("data");
                const agent_response = data.choices[0].message.content;
                console.log(`Agent Response: ${agent_response}`);
                this.messages.push({ role: "assistant", content: agent_response });
                return agent_response;
            } else {
                // Manejar el caso en que no se devuelvan opciones
                throw new Error("No choices returned from OpenRouter");
            }
        } catch (error) {
            // Manejo de errores
            console.error(error);
            return "NotLikeThis Tuve un problema para entender tu mensaje, por favor intenta mas tarde PoroSad";
        }
    }
}
