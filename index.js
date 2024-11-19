async function getStreamInfo(channel) {
    const urls = [
        `https://decapi.me/twitch/title/${channel}`,
        `https://decapi.me/twitch/game/${channel}`,
        `https://decapi.me/twitch/viewercount/${channel}`,
    ];

    try {
        const [titleResponse, gameResponse, viewerResponse] = await Promise.all(urls.map(url => fetch(url)));

        if (!titleResponse.ok || !gameResponse.ok || !viewerResponse.ok) {
            throw new Error('Network response was not ok');
        }

        const titulo = await titleResponse.text();
        const categoria = await gameResponse.text();
        const espectadores = await viewerResponse.text();

        return { titulo, categoria, espectadores };
    } catch (error) {
        console.error('Error al obtener la información del stream:', error);
        return null; // Maneja el error devolviendo null
    }
}

// Modifica el evento onMessage para usar getStreamInfo()
bot.onMessage(async (channel, user, message, self) => {
    if (self) return;

    const currentTime = Date.now();
    const elapsedTime = (currentTime - lastResponseTime) / 1000; // Tiempo en segundos

    if (ENABLE_CHANNEL_POINTS === 'true' && user['msg-id'] === 'highlighted-message') {
        console.log(`Highlighted message: ${message}`);
        if (elapsedTime < COOLDOWN_DURATION) {
            bot.say(channel, `PoroSad Por favor, espera ${COOLDOWN_DURATION - elapsedTime.toFixed(1)} segundos antes de enviar otro mensaje. NotLikeThis`);
            return;
        }
        lastResponseTime = currentTime;

        const streamInfo = await getStreamInfo(channel.replace('#', '')); // Obtener información del stream
        if (streamInfo) {
            fileContext += `\nMensaje recibido en el canal: ${channel}, titulo del stream: ${streamInfo.titulo}, categoria del stream: ${streamInfo.categoria}, cantidad de espectadores: ${streamInfo.espectadores}.\n`;
        }

        const response = await openaiOps.make_openrouter_call(message);
        bot.say(channel, response);
    }

    const command = commandNames.find(cmd => message.toLowerCase().startsWith(cmd));
    if (command) {
        if (elapsedTime < COOLDOWN_DURATION) {
            bot.say(channel, `PoroSad Por favor, espera ${COOLDOWN_DURATION - elapsedTime.toFixed(1)} segundos antes de enviar otro mensaje. NotLikeThis`);
            return;
        }
        lastResponseTime = currentTime;

        let text = message.slice(command.length).trim();
        if (SEND_USERNAME === 'true') {
            text = `Message from user ${user.username}: ${text}`;
        }

        const streamInfo = await getStreamInfo(channel.replace('#', '')); // Obtener información del stream
        if (streamInfo) {
            fileContext += `\nMensaje recibido en el canal: ${channel}, titulo del stream: ${streamInfo.titulo}, categoria del stream: ${streamInfo.categoria}, cantidad de espectadores: ${streamInfo.espectadores}.\n`;
        }

        const response = await openaiOps.make_openrouter_call(text);
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
