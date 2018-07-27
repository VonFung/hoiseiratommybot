const Discord = require('discord.js');
const ytdl = require('ytdl-core');  //For music streaming

const client = new Discord.Client();

var voiceChannel;   //===================
var stream;         //  For Play Music
var dispatcher;     //===================
var url;

const streamOptions = { seek: 0, volume: 1 };   //Music option

client.on('ready', () => {

    console.log('I am ready!');
    
});

client.on('message', message => {
    
    if(message.content.charAt(0) !== '#') {
        return;    
    }
    
    var token = new Array();
    token = message.content.substr(1).trim().split(' ');
    
    switch(token[0].toUpperCase()) {
        case 'READY':    //For testing bot online
            message.reply('YES!');
            break;
        case 'PLAY':    //play music
            var youtubeOrNot = false;           //True if extract audio from youtube, false for direct url
            switch(token[1].toUpperCase()) {    //Check music title tag
                case 'UNICORN':
                    url = "http://67.159.62.2/anime_ost/gundam-uc-origianl-soundtrack/liiyfbxz/02%20-%20UNICORN.mp3";
                    break;
                default:
                    message.channel.sendMessage("No such music");
                    return;
            }
                    
            voiceChannel = message.member.voiceChannel;
            if(youtubeOrNot) {
                voiceChannel.join().then(connection => {
                    console.log("joined channel");
                    stream = ytdl(url, {filter : 'audioonly'});
                    dispatcher = connection.playStream(stream, streamOptions);
                    dispatcher.on("end", end => {
                        console.log("left channel");
                        voiceChannel.leave();
                    });
                }).catch(err => console.log(err));
            } else {
                voiceChannel.join().then(connection => {
                    console.log("joined channel");
                    dispatcher = connection.playArbitraryInput(url);
                    dispatcher.on("end", end => {
                        console.log("left channel");
                        voiceChannel.leave();
                    });
                }).catch(err => console.log(err));
            }
          
            break;
        case 'stop':    //stop music
            console.log("left channel");
            voiceChannel.leave();
            break;
    }
    
});





client.login(process.env.BOT_TOKEN);
