const Discord = require('discord.js');

const client = new Discord.Client();

var b = false;

client.on('ready', () => {

    console.log('I am ready!');
    
});

client.on('message', message => {
    
    var token = new Array();
    token = message.content.trim().split(' ');
    
    switch(token[0]) {
        case 'ping':
            message.reply('pong');
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
