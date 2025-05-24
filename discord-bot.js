import 'dotenv/config';
import { CronJob } from 'cron';
import https from 'https';
import {
  Client,
  GatewayIntentBits,
  ActivityType,
  Partials,
  EmbedBuilder,
} from "discord.js";
import { OpenAI } from "openai";

// === BLOQUE KEEP ALIVE PARA RENDER ===
const render_url = process.env.RENDER_EXTERNAL_URL;
if (!render_url) {
  console.log("No RENDER_EXTERNAL_URL found. Please set it as environment variable.");
}
const job = new CronJob('*/14 * * * *', function () {
  console.log('Making keep alive call');
  https.get(render_url, (resp) => {
    if (resp.statusCode === 200) {
      console.log("Keep alive call successful");
    } else {
      console.log("Keep alive call failed");
    }
  }).on("error", (err) => {
    console.log("Error making keep alive call");
  });
});
job.start();
// === FIN BLOQUE KEEP ALIVE ===

const shapes_client = new OpenAI({
  apiKey: process.env.SHAPES_API_KEY,
  baseURL: "https://api.shapes.inc/v1",
});

const MODEL_ID = process.env.MODEL_NAME;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildEmojisAndStickers,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.DirectMessageTyping,
    GatewayIntentBits.GuildScheduledEvents,
  ],
  partials: [Partials.GuildMember],
});

let timer = 0;

client.on("ready", () => {
  console.log("🫡A la orden pal desorden.");
  client.user.setActivity("🫡A la orden pal desorden.", {
    type: ActivityType.Custom,
  });

  setInterval(async () => {
    timer++;
    const canal = client.channels.cache.get(process.env.GENERAL_ID);
    if (!canal) return;

    await canal.sendTyping();
    const prompt =
      "Eres un moderador del Discord RodentPlay. Escribe un mensaje divertido y corto de hasta 4 renglones para invitar a @everyone a hablar de sus videojuegos favoritos y logros.";

    const response = await shapes_client.chat.completions.create({
      model: MODEL_ID,
      messages: [
        { role: "user", content: prompt },
      ],
      max_tokens: 200,
    });

    canal.send({
      content: response.choices[0].message.content,
      allowedMentions: { parse: [] },
    });
  }, 21600000); // cada 6 horas
});

client.on("guildMemberAdd", async (member) => {
  try {
    const canal = client.channels.cache.get(process.env.GENERAL_ID);
    await canal.sendTyping();

    const prompt = `Un nuevo miembro se ha unido. Dale una bienvenida a @${member.user.username} en máximo 4 renglones.`;

    const response = await shapes_client.chat.completions.create({
      model: MODEL_ID,
      messages: [
        { role: "user", content: prompt },
      ],
      max_tokens: 200,
    });

    canal.send({
      content: response.choices[0].message.content,
      allowedMentions: { parse: [] },
    });
  } catch (error) {
    console.error("Error en bienvenida:", error);
  }
});

const userConversations = new Map();

client.on("messageCreate", async (message) => {
  try {
    // LOG para detectar ejecuciones dobles
    console.log(`[${message.id}] Mensaje recibido: "${message.content}" por ${message.author.username} (${message.author.id}) en canal ${message.channel.id}`);
    const ignoredChannels = process.env.CHANNEL_ID.split(",").map(id => id.trim());

    // Ignora mensajes de bots y comandos
    if (message.author.bot || message.content.startsWith("/") || message.author.id === client.user.id) return;
    // Ignora canales prohibidos
    if (ignoredChannels.includes(message.channel.id)) return;

    // Solo responde si mencionan al bot o usan palabra clave
    let debeResponder = message.mentions.has(client.user);
    if (!debeResponder) {
      const keywords = [
        "Ayuda",
        "Buenos dias",
        "Buenos días",
        "Buenas tardes",
        "Buenas noches",
        "Feliz Cumpleaños",
        "F",
        "efe",
        "Efisima",
        "Efesota",
        "nunchu2NunchuF",
        "buenas",
        "wenas",
        "suicidio",
        "help",
      ];
      debeResponder = keywords.some((kw) =>
        message.content.toLowerCase().includes(kw.toLowerCase())
      );
    }
    if (!debeResponder) return;

    await message.channel.sendTyping();

    if (message.content.toLowerCase().startsWith("!imagine")) {
      message.react("🎨");
    }

    const userId = message.author.id;
    const history = userConversations.get(userId) || [];

    history.push({
      role: "user",
      content: message.content,
      name: message.author.username,
      timestamp: message.createdTimestamp,
    });

    if (history.length > 4) {
      userConversations.set(userId, history.slice(-4));
    } else {
      userConversations.set(userId, history);
    }

    const contentArray = history.map((msg) => {
      const date = new Date(msg.timestamp).toLocaleString("es-MX", {
        timeZone: "America/Mexico_City",
        hour12: true,
      });
      return `${msg.content} - ${date}`;
    });

    const image = message.attachments.find((att) =>
      att.contentType?.startsWith("image")
    );

    const audio = message.attachments.find((att) =>
      att.contentType?.startsWith("audio")
    );

    let content = [
      {
        type: "text",
        text: `Historial de mensajes de ${message.author.username}: ${JSON.stringify(
          contentArray,
          null,
          2
        )}\nMensaje: ${message.content}`,
      },
    ];

    if (image) {
      message.react("👀");
      content.push({
        type: "image_url",
        image_url: { url: image.url },
      });
    }

    if (audio) {
      message.react("🎧");
      content.push({
        type: "audio_url",
        audio_url: { url: audio.url },
      });
    }

    const response = await shapes_client.chat.completions.create({
      model: MODEL_ID,
      messages: [
        { role: "user", content },
      ],
      max_tokens: 500,
    });
    
    // Responde solo una vez
    if (!message.replied) {
      await message.channel.send({
        content: response.choices[0].message.content,
        allowedMentions: { parse: [] },
});
    }
  } catch (error) {
    console.error("Error:", error);
    if (!message.replied) {
      message.reply("¡Ups! Algo salió mal. Intenta de nuevo más tarde.");
    }
  }
});

client.login(process.env.TOKEN);
