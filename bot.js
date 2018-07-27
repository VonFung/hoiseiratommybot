const Discord = require('discord.js');

const client = new Discord.Client();

client.on('ready', () => {

    console.log('I am ready!');
    
});

client.on('message', message => {
    
    switch(message.content) {
        case 'ping':
            message.reply('pong');
            break;
        case 'pong':
            message.reply('pang');
            break;
    }
    
});





client.login(process.env.BOT_TOKEN);
