const { Telegraf, session, Markup } = require('telegraf');
require('dotenv').config();
const token = process.env.TOKEN
const bot = new Telegraf(token); // Use config_data for better security
bot.use(session());
bot.start((ctx) => {
  ctx.reply(
    'Bizimlə Əlaqə:',
    Markup.inlineKeyboard([
      Markup.button.url('Whatsapp', 'https://wa.me/79232874777'),
    ])
  );
});
bot.launch();
console.log('Bot is running...');

// Graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
