const Discord = require('discord.js');

const client = new Discord.Client();

var b = false;

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
        case 'turn true':
            b = true;
            message.reply('mission completed');
            break;
        case 'turn false':
            b = false;
            message.reply('mission completed');
            break;
        case 'b':
            message.reply('b='+ b);
            break;
           
    }
    
});





client.login(process.env.BOT_TOKEN);
