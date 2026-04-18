require('dotenv').config({ quiet: true });

const axios = require('axios');
const { Markup, Telegraf } = require('telegraf');

const token = process.env.BOT_TOKEN;
const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';
const userSessions = {};

if (!token) {
    console.error('BOT_TOKEN is missing in .env');
    process.exit(1);
}

const bot = new Telegraf(token);

bot.use(async (ctx, next) => {
    const incomingText = ctx.message?.text || ctx.callbackQuery?.data || '[non-text update]';
    console.log('INCOMING UPDATE:', incomingText);
    await next();
});

const safeReply = async (ctx, message, extra = {}) => {
    const chatId = ctx?.chat?.id;

    try {
        const result = await ctx.reply(message, extra);
        console.log('REPLY SENT (ctx.reply):', { chatId, message });
        return result;
    } catch (replyError) {
        console.error('ctx.reply failed:', replyError?.response?.description || replyError.message);

        if (!chatId) {
            throw replyError;
        }

        try {
            const result = await ctx.telegram.sendMessage(chatId, message, extra);
            console.log('REPLY SENT (telegram.sendMessage):', { chatId, message });
            return result;
        } catch (sendError) {
            console.error('telegram.sendMessage failed:', sendError?.response?.description || sendError.message);
            throw sendError;
        }
    }
};

const getTelegramId = (ctx) => String(ctx.from?.id || '').trim();

const fetchLinkedUser = async (telegramId) => {
    const response = await axios.get(`${backendUrl}/api/telegram/me`, {
        params: { telegramId },
    });

    return response.data?.user || null;
};

const fetchLattices = async (telegramId) => {
    const response = await axios.get(`${backendUrl}/api/telegram/lattices`, {
        params: { telegramId },
    });

    return Array.isArray(response.data?.lattices) ? response.data.lattices : [];
};

const ensureLinked = async (ctx) => {
    const telegramId = getTelegramId(ctx);

    if (!telegramId) {
        await safeReply(ctx, '❌ Please connect your account first using /login <token>');
        return null;
    }

    try {
        const user = await fetchLinkedUser(telegramId);
        if (!user) {
            await safeReply(ctx, '❌ Please connect your account first using /login <token>');
            return null;
        }

        return user;
    } catch (error) {
        if (error?.response?.status === 404) {
            await safeReply(ctx, '❌ Please connect your account first using /login <token>');
            return null;
        }

        console.error('Failed to verify Telegram linkage:', error?.response?.data || error.message);
        await safeReply(ctx, '❌ Failed to verify account. Try again.');
        return null;
    }
};

bot.start((ctx) => {
    safeReply(ctx, 'Welcome to Lattice Bot 🚀\nUse /login <token> to connect your account.\nThen use /lattices to pick a lattice and send me a link.');
});

bot.hears(/^\/login(?:@\w+)?\s+(.+)/, async (ctx) => {
    try {
        console.log('CTX MESSAGE:', ctx.message.text);
        console.log('EXTRACTED TOKEN:', ctx.match[1]);

        const loginToken = ctx.match[1].trim();

        console.log('LOGIN TRIGGERED');
        console.log('TOKEN:', loginToken);
        console.log('LOGIN TOKEN:', loginToken);

        const response = await axios.post(`${backendUrl}/api/telegram/link`, {
            token: loginToken,
            telegramId: ctx.from.id,
        });

        console.log('LINK RESPONSE:', response.data);

        await safeReply(ctx, '✅ Your account has been linked successfully!');
    } catch (err) {
        console.error('LOGIN ERROR:', err.response?.data || err.message);

        if (err.response?.status === 400) {
            await safeReply(ctx, '❌ Invalid or expired token');
            return;
        }

        await safeReply(ctx, '❌ Backend unavailable. Please try again in a moment.');
    }
});

const handleLatticesCommand = async (ctx) => {
    console.log('LATTICES TRIGGERED:', ctx.message?.text || 'no text');

    await safeReply(ctx, '⏳ Loading your lattices...');

    const user = await ensureLinked(ctx);
    if (!user) {
        return;
    }

    const telegramId = getTelegramId(ctx);

    try {
        const lattices = await fetchLattices(telegramId);

        if (!lattices.length) {
            await safeReply(ctx, 'No lattices found for your account.');
            return;
        }

        const keyboard = Markup.inlineKeyboard(
            lattices.map((lattice) => [
                Markup.button.callback(lattice.name, `lattice:${lattice.id}`),
            ])
        );

        await safeReply(ctx, 'Select a lattice:', keyboard);
    } catch (error) {
        console.error('Failed to fetch lattices:', error?.response?.data || error.message);
        await safeReply(ctx, '❌ Failed to load lattices. Try again.');
    }
};

bot.command('lattices', handleLatticesCommand);
bot.hears(/^\/lattices(?:@\w+)?(?:\s+.*)?$/i, handleLatticesCommand);

bot.action(/^lattice:(.+)$/, async (ctx) => {
    const user = await ensureLinked(ctx);
    if (!user) {
        await ctx.answerCbQuery();
        return;
    }

    const telegramId = getTelegramId(ctx);
    const selectedLatticeId = String(ctx.match[1] || '').trim();

    try {
        const lattices = await fetchLattices(telegramId);
        const lattice = lattices.find((entry) => String(entry.id) === selectedLatticeId);

        if (!lattice) {
            await ctx.answerCbQuery('Lattice not found', { show_alert: true });
            return;
        }

        userSessions[telegramId] = {
            selectedLatticeId: lattice.id,
            selectedLatticeName: lattice.name,
        };

        await ctx.answerCbQuery('Lattice selected');
        await safeReply(ctx, `📌 Selected: ${lattice.name}\nSend me a link to save.`);
    } catch (error) {
        console.error('Failed to select lattice:', error?.response?.data || error.message);
        await ctx.answerCbQuery('Failed to select lattice', { show_alert: true });
    }
});

bot.hears(/https?:\/\/\S+/i, async (ctx) => {
    const user = await ensureLinked(ctx);
    if (!user) {
        return;
    }

    const telegramId = getTelegramId(ctx);
    const session = userSessions[telegramId];

    if (!session?.selectedLatticeId) {
        await safeReply(ctx, '❌ Please select a lattice first using /lattices');
        return;
    }

    const urlMatch = String(ctx.message?.text || '').match(/https?:\/\/\S+/i);
    const url = urlMatch ? urlMatch[0] : '';

    if (!url) {
        await safeReply(ctx, '❌ Failed to save link. Try again.');
        return;
    }

    try {
        await axios.post(`${backendUrl}/api/telegram/add-link`, {
            telegramId,
            latticeId: session.selectedLatticeId,
            url,
        });

        await safeReply(ctx, '✅ Link saved successfully!');
    } catch (error) {
        console.error('Failed to save Telegram link:', error?.response?.data || error.message);
        await safeReply(ctx, '❌ Failed to save link. Try again.');
    }
});

bot.help((ctx) => {
    safeReply(ctx, 'Available commands:\n/start - Start the bot\n/help - Show this help message\n/login - Connect your account\n/lattices - Select lattice for saving links');
});

// bot.on('text', (ctx) => {
//     ctx.reply('Message received!');
// });

bot.catch((err, ctx) => {
    console.error('Telegram bot error:', err);
    if (ctx && ctx.chat?.id) {
        safeReply(ctx, 'Something went wrong. Please try again later.').catch(() => { });
    }
});

function isConflictError(err) {
    return err && err.response && err.response.error_code === 409;
}

function launchBot() {
    bot.launch()
        .then(async () => {
            const me = await bot.telegram.getMe();
            console.log('Telegram bot is running...');
            console.log('BOT IDENTITY:', {
                id: me.id,
                username: me.username,
                pid: process.pid,
                backendUrl,
            });
        })
        .catch((err) => {
            if (isConflictError(err)) {
                console.error('Launch conflict (409): another bot instance is using this token. Stop all duplicate bot.js processes and restart once.');
                process.exit(1);
                return;
            }

            console.error('Failed to launch Telegram bot:', err);
            setTimeout(launchBot, 5000);
        });
}

launchBot();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
