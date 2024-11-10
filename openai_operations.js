// Import modules
import OpenAI from "openai";

export class OpenAIOperations {
    constructor(file_context, openai_key, model_name, history_length) {
        this.messages = [{ role: "system", content: file_context }];
        this.openai = new OpenAI({
            baseURL: "https://openrouter.ai/api/v1",
            apiKey: openai_key,
            defaultHeaders: {
                "HTTP-Referer": "https://yourapp.com", // Reemplaza con la URL de tu aplicación
                "X-Title": "Your App Name", // Reemplaza con el nombre de tu aplicación
            }
        });
        this.model_name = model_name;
        this.history_length = history_length;
    }

    check_history_length() {
        console.log(`Conversations in History: ${((this.messages.length / 2) - 1)}/${this.history_length}`);
        if (this.messages.length > ((this.history_length * 2) + 1)) {
            console.log("Message amount in history exceeded. Removing oldest user and agent messages.");
            this.messages.splice(1, 2);
        }
    }

    async make_openai_call(text) {
        try {
            this.messages.push({ role: "user", content: text });
            this.check_history_length();

            const response = await this.openai.chat.completions.create({
                model: this.model_name,
                messages: this.messages,
                temperature: 1,
                max_tokens: 256,
                top_p: 1,
                frequency_penalty: 0,
                presence_penalty: 0,
            });

            if (response.choices) {
                const agent_response = response.choices[0].message.content;
                console.log(`Agent Response: ${agent_response}`);
                this.messages.push({ role: "assistant", content: agent_response });
                return agent_response;
            } else {
                throw new Error("No choices returned from OpenRouter");
            }
        } catch (error) {
            console.error(error);
            return "Sorry, something went wrong. Please try again later.";
        }
    }

    async make_openai_call_completion(text) {
        try {
            const response = await this.openai.completions.create({
                model: "this.model_name",
                prompt: text,
                temperature: 1,
                max_tokens: 256,
                top_p: 1,
                frequency_penalty: 0,
                presence_penalty: 0,
            });

            if (response.choices) {
                const agent_response = response.choices[0].text;
                console.log(`Agent Response: ${agent_response}`);
                return agent_response;
            } else {
                throw new Error("No choices returned from OpenRouter");
            }
        } catch (error) {
            console.error(error);
            return "Sorry, something went wrong. Please try again later.";
        }
    }
}
