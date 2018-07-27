const Discord = require('discord.js');
const ytdl = require('ytdl-core');  //For music streaming

const client = new Discord.Client();

var voiceChannel;   //For play music
var stream;
var dispatcher;

const streamOptions = { seek: 0, volume: 1 };   //Music option

client.on('ready', () => {

    console.log('I am ready!');
    
});

client.on('message', message => {
    
    var token = new Array();
    token = message.content.trim().split(' ');
    
    switch(token[0]) {
        case 'play':    //play music
            voiceChannel = message.member.voiceChannel;
            voiceChannel.join().then(connection => {
                console.log("joined channel");
                stream = ytdl('http://67.159.62.2/anime_ost/gundam-uc-origianl-soundtrack/liiyfbxz/02%20-%20UNICORN.mp3', { filter : 'audioonly' });
                dispatcher = connection.playStream(stream, streamOptions);
                dispatcher.on("end", end => {
                    console.log("left channel");
                    voiceChannel.leave();
                });
            }).catch(err => console.log(err));
            break;
        case 'stop':    //stop music
            console.log("left channel");
            voiceChannel.leave();
            break;
    }
    
});





client.login(process.env.BOT_TOKEN);
