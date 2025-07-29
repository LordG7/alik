const { spawn } = require("child_process");

function startBot() {
    const bot = spawn("node", ["index.js"], { stdio: "inherit" });

    bot.on("close", (code) => {
        console.log(`Bot stopped with code ${code}, restarting...`);
        setTimeout(startBot, 5000); // Restart after 5 seconds
    });

    bot.on("error", (err) => {
        console.error("Bot encountered an error:", err);
        setTimeout(startBot, 5000);
    });
}

startBot();
