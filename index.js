import express from 'express';
import fs from 'fs';
import ws from 'ws';
import expressWs from 'express-ws';
import {job} from './keep_alive.js';
import {OpenAIOperations} from './openai_operations.js';
import {TwitchBot} from './twitch_bot.js';

import { setInfoCanal } from './sharedData.js';

// Start keep alive cron job
job.start();
console.log(process.env);

// Setup express app
const app = express();
const expressWsInstance = expressWs(app);

// Set the view engine to ejs
app.set('view engine', 'ejs');

// Load environment variables
const GPT_MODE = process.env.GPT_MODE || 'CHAT';
const HISTORY_LENGTH = process.env.HISTORY_LENGTH || 20;
const OPENAI_API_KEY_1 = process.env.OPENAI_API_KEY_1 || '';
const OPENAI_API_KEY_2 = process.env.OPENAI_API_KEY_2 || '';
const MODEL_NAME = process.env.MODEL_NAME || 'google/gemma-2-9b-it:free';
const TWITCH_USER = process.env.TWITCH_USER || 'RodentPlay';
const TWITCH_AUTH = process.env.TWITCH_AUTH || 'oauth:a34lxh7cbszmea7icbyxhtyeinvyoo';
const COMMAND_NAME = process.env.COMMAND_NAME || '@RodentPlay';
const CHANNELS = process.env.CHANNELS || 'AraxielFenix, Maritha_F, FooNess13, nunchuckya , soyyonotuxdjsjs';
const SEND_USERNAME = process.env.SEND_USERNAME || 'true';
const ENABLE_TTS = process.env.ENABLE_TTS || 'false';
const ENABLE_CHANNEL_POINTS = process.env.ENABLE_CHANNEL_POINTS || 'false';
const COOLDOWN_DURATION = parseInt(process.env.COOLDOWN_DURATION, 10) || 10; // Cooldown duration in seconds

let OPENAI_API_KEY = OPENAI_API_KEY_1;

let currentApiKey = 1; // 1 para la primera API key, 2 para la segunda

if (!OPENAI_API_KEY_1 && !OPENAI_API_KEY_2) {
    console.error('No se encontraron las API keys. Por favor, configúralas como variables de entorno.');
}

// Función para alternar entre las API keys
function toggleApiKey() {
    if (currentApiKey === 1 && OPENAI_API_KEY_2) {
        currentApiKey = 2;
        OPENAI_API_KEY = OPENAI_API_KEY_2;
        console.log('Cambiando a la segunda API key');
    } else if (currentApiKey === 2 && OPENAI_API_KEY_1) {
        currentApiKey = 1;
        OPENAI_API_KEY = OPENAI_API_KEY_1;
        console.log('Cambiando a la primera API key');
    }
}

const commandNames = COMMAND_NAME.split(',').map(cmd => cmd.trim().toLowerCase());
const channels = CHANNELS.split(',').map(channel => channel.trim());
const maxLength = 399;
let fileContext = 'You are a helpful Twitch Chatbot.';
let lastUserMessage = '';
let lastResponseTime = 0; // Track the last response time
let canal = "";

// Setup Twitch bot
console.log('Channels: ', channels);
const bot = new TwitchBot(TWITCH_USER, TWITCH_AUTH, channels, OPENAI_API_KEY, ENABLE_TTS);

// Setup OpenAI operations
fileContext = fs.readFileSync('./file_context.txt', 'utf8');
const toDay = new Date();
const horaCdmx = toDay.toLocaleString("es-MX", {timeZone: "America/Mexico_City"});

console.log(`La fecha y hora en la Ciudad de México es: ${horaCdmx}`);
fileContext += '\n La fecha y hora actual en la ciudad de México es: ' + horaCdmx;

fileContext += '\nPor favor, responde de manera resumida el mensaje del espectador: ';

const openaiOps = new OpenAIOperations(fileContext, OPENAI_API_KEY, MODEL_NAME, HISTORY_LENGTH);

let currentStreamInfo = '';

async function updateStreamInfo() {
    try {
        currentStreamInfo = await getStreamInfo(`#${TWITCH_USER}`);
        console.log('Información del stream actualizada:', currentStreamInfo);
    } catch (error) {
        console.error('Error al actualizar la información del stream:', error);
    }
}

// Setup Twitch bot callbacks
bot.onConnected((addr, port) => {
    console.log(`* Conectandome a ${addr}:${port}`);
    channels.forEach(channel => {
        console.log(`* Entrando al canal de ${channel}`);
        console.log(`* Correctamente presente con ${channel}`);
    });
});

bot.onDisconnected(reason => {
    console.log(`Disconnected: ${reason}`);
});

// Connect bot
bot.connect(
    () => {
        console.log('Bot connected!');
        updateStreamInfo();
        setInterval(updateStreamInfo, 60000);
    },
    error => {
        console.error('Bot couldn\'t connect!', error);
    }
);

bot.onMessage(async (channel, user, message, self) => {
    if (self) return; // Ignorar los mensajes del bot
    
    const currentTime = Date.now();
    const elapsedTime = (currentTime - lastResponseTime) / 1000; // Tiempo transcurrido en segundos

    // Verificar si el mensaje es destacado (channel points)
    if (ENABLE_CHANNEL_POINTS === 'true' && user['msg-id'] === 'highlighted-message') {
        console.log(`Highlighted message: ${message}`);
        if (elapsedTime < COOLDOWN_DURATION) {
            bot.say(channel, `PoroSad Por favor, espera ${COOLDOWN_DURATION - elapsedTime.toFixed(1)} segundos antes de enviar otro mensaje. NotLikeThis`);
            return;
        }
        lastResponseTime = currentTime; // Actualizar tiempo del último mensaje

        // Obtener información del stream
        const response = await openaiOps.make_openrouter_call(`${currentStreamInfo}\n\n${message}`);
        bot.say(channel, response);
    }

    // Verificar si el mensaje contiene un comando reconocido
    const command = commandNames.find(cmd => message.toLowerCase().includes(cmd.toLowerCase()));
    if (command) {
        updateStreamInfo()
        setInfoCanal(await getStreamInfo(channel));
        if (elapsedTime < COOLDOWN_DURATION) {
            bot.say(channel, `PoroSad Por favor, espera ${COOLDOWN_DURATION - elapsedTime.toFixed(1)} segundos antes de enviar otro mensaje. NotLikeThis`);
            return;
        }
        lastResponseTime = currentTime; // Actualizar tiempo del último mensaje

        let text = message.slice(command.length).trim();
        if (SEND_USERNAME === 'true') {
            text = `Message from user ${user.username}: ${text}`;
        }

        // Obtener información del stream
        const streamInfo = await updateStreamInfo();
        
        // Pasar la información del canal como contexto
        const response = await openaiOps.make_openrouter_call(`${streamInfo}\n\n${text}`);
        if (response.length > maxLength) {
            const messages = response.match(new RegExp(`.{1,${maxLength}}`, 'g'));
            messages.forEach((msg, index) => {
                setTimeout(() => {
                    bot.say(channel, msg);
                }, 1000 * index);
            });
        } else {
            bot.say(channel, response);
        }

        if (ENABLE_TTS === 'true') {
            try {
                const ttsAudioUrl = await bot.sayTTS(channel, response, user['userstate']);
                notifyFileChange(ttsAudioUrl);
            } catch (error) {
                console.error('TTS Error:', error);
            }
        }
    }
});

const messages = [{role: 'system', content: 'You are a helpful Twitch Chatbot.'}];
console.log('GPT_MODE:', GPT_MODE);
console.log('History length:', HISTORY_LENGTH);
console.log('OpenAI API Key:', OPENAI_API_KEY);
console.log('Model Name:', MODEL_NAME);

app.use(express.json({extended: true, limit: '1mb'}));
app.use('/public', express.static('public'));

app.all('/', (req, res) => {
    console.log('Received a request!');
    res.render('pages/index');
});

if (GPT_MODE === 'CHAT') {
    fs.readFile('./file_context.txt', 'utf8', (err, data) => {
        if (err) throw err;
        console.log('Reading context file and adding it as system-level message for the agent.');
        messages[0].content = data;
    });
} else {
    fs.readFile('./file_context.txt', 'utf8', (err, data) => {
        if (err) throw err;
        console.log('Reading context file and adding it in front of user prompts:');
        fileContext = data;
    });
}

app.get('/gpt/:text', async (req, res) => {
    const text = req.params.text;

    let answer = '';
    try {
        if (GPT_MODE === 'CHAT') {
            answer = await openaiOps.make_openrouter_call(text);
        } else if (GPT_MODE === 'PROMPT') {
            const prompt = `${fileContext}\n\nUser: ${text}\nAgent:`;
            answer = await openaiOps.make_openrouter_call_completion(prompt);
        } else {
            throw new Error('GPT_MODE is not set to CHAT or PROMPT. Please set it as an environment variable.');
        }

        res.send(answer);
    } catch (error) {
        console.error('Error generating response:', error);
        res.status(500).send('An error occurred while generating the response.');
    }
});

const server = app.listen(3000, () => {
    console.log('Server running on port 3000');
});

const wss = expressWsInstance.getWss();
wss.on('connection', ws => {
    ws.on('message', message => {
        // Handle client messages (if needed)
    });
});

function notifyFileChange() {
    wss.clients.forEach(client => {
        if (client.readyState === ws.OPEN) {
            client.send(JSON.stringify({updated: true}));
        }
    });
}

async function getStreamInfo(channel) {
    canal = channel.substring(1); // Eliminar el prefijo "#" del nombre del canal
    const urls = [
        `https://decapi.me/twitch/title/${canal}`,
        `https://decapi.me/twitch/game/${canal}`,
        `https://decapi.me/twitch/viewercount/${canal}`,
    ];

    try {
        const [titleResponse, gameResponse, viewerResponse] = await Promise.all(urls.map(url => fetch(url)));

        if (!titleResponse.ok || !gameResponse.ok || !viewerResponse.ok) {
            throw new Error('Network response was not ok');
        }

        const titulo = await titleResponse.text();
        const categoria = await gameResponse.text();
        const espectadores = await viewerResponse.text();

        return `\nMensaje recibido en el canal: ${canal}\nTitulo del stream: ${titulo}\nCategoria del stream: ${categoria}\nCantidad de espectadores: ${espectadores}\n`;
    } catch (error) {
        console.error('Error al obtener la información del stream:', error);
        return `\nMensaje recibido en el canal: ${canal}\nNo se pudo obtener la información del stream.\n`;
    }
}
