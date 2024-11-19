// Import dotenv para cargar variables de entorno
import dotenv from "dotenv";
dotenv.config();

export class OpenAIOperations {
    constructor(file_context, history_length) {
        this.messages = [{ role: "system", content: file_context }];
        this.apiKey = process.env.OPENAI_API_KEY;
        this.model_name = process.env.MODEL_NAME;
        this.history_length = history_length;
        this.channelName = null; // Variable para guardar el nombre del canal
        this.file_context = file_context; // Contexto inicial del archivo
    }

    check_history_length() {
        console.log(`Conversations in History: ${((this.messages.length / 2) - 1)}/${this.history_length}`);
        if (this.messages.length > ((this.history_length * 2) + 1)) {
            console.log('Message amount in history exceeded. Removing oldest user and assistant messages.');
            this.messages.splice(1, 2);
        }
    }

    // Función para extraer el nombre del canal del mensaje recibido
    extractChannelName(text) {
        const channelRegex = /#(\w+)/; // Asume que el canal viene en formato "#channelName"
        const match = text.match(channelRegex);
        return match ? match[1] : null;
    }

    // Actualizar file_context con información adicional
    updateFileContext(info) {
        this.file_context += `\n${info}`;
        this.messages[0].content = this.file_context; // Actualizar el mensaje del sistema
    }

    async make_openrouter_call(text) {
        const maxRetries = 3;
        let attempts = 0;

        while (attempts < maxRetries) {
            try {
                // Extraer el nombre del canal y almacenarlo
                this.channelName = this.extractChannelName(text);
                if (this.channelName) {
                    console.log(`Nombre del canal extraído: ${this.channelName}`);
                } else {
                    console.log("No se pudo extraer el nombre del canal.");
                }

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
                        temperature: 0.3,
                        max_tokens: 100, // Reducir tokens para evitar problemas de límite
                        frequency_penalty: 0,
                        presence_penalty: 0,
                    }),
                });

                // Verificar si la respuesta fue exitosa
                if (!response.ok) {
                    console.error(`HTTP Error: ${response.status} - ${response.statusText}`);
                    throw new Error(`HTTP Error: ${response.status}`);
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
                    return "Tuve un problema para entender tu mensaje, por favor intenta más tarde.";
                }
            }
        }
    }

    async getStreamInfo() {
        if (!this.channelName) {
            console.error("Nombre del canal no disponible.");
            return;
        }

        const urls = [
            `https://decapi.me/twitch/title/${this.channelName}`,
            `https://decapi.me/twitch/game/${this.channelName}`,
            `https://decapi.me/twitch/viewercount/${this.channelName}`,
        ];

        try {
            const [titleResponse, gameResponse, viewerResponse] = await Promise.all(urls.map(url => fetch(url)));

            if (!titleResponse.ok || !gameResponse.ok || !viewerResponse.ok) {
                throw new Error('Network response was not ok');
            }

            const titulo = await titleResponse.text();
            const categoria = await gameResponse.text();
            const espectadores = await viewerResponse.text();

            console.log('Título del stream:', titulo);
            console.log('Categoría del stream:', categoria);
            console.log('Espectadores actuales del stream:', espectadores);

            // Construir mensaje con el formato requerido
            const streamInfo = `Mensaje recibido en el canal: ${this.channelName}, titulo del stream: ${titulo}, categoria del stream: ${categoria}, cantidad de espectadores: ${espectadores}.`;
            console.log(streamInfo);
            // Actualizar file_context
            this.updateFileContext(streamInfo);
        } catch (error) {
            console.error('Error al obtener la información del stream:', error);
        }
    }
}
