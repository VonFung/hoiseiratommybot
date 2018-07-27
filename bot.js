const Discord = require('discord.js');

const client = new Discord.Client();

const token = 'NDcyMzEyMjM1NDE1NTY4NDA2.DjxjHw.xvZ9SCz41Tx-_kUYKZC9bfcRQMU';

client.on('ready', () => {

    console.log('I am ready!');
    
});

client.on('message', message => {

    if(message.content === 'ping') {
    
        message.reply('pong');
    }
    
}





client.login(token);
