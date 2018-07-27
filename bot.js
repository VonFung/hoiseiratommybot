const Discord = require('discord.js');
const ytdl = require('ytdl-core');  //For music streaming
var mysql = require('mysql');

const client = new Discord.Client();

var voiceChannel;   //===================
var stream;         //  For Play Music
var dispatcher;     //===================
var url;

client.on('ready', () => {

    console.log('I am ready!');
    
});

client.on('message', message => {
    
    if(message.content.charAt(0) !== '$') {
        return;    
    }
    
    var token = new Array();
    token = message.content.substr(1).trim().split(' ');
    
    //===================================================
    //  ALL COMMAND WILL BE CONVERTED TO UPPER CASE!
    //===================================================
    
    switch(token[0].toUpperCase()) {
        case 'READY':    //For testing bot online
            message.reply('YES!');
            break;
        case 'PLAY':    //play music
            if(token.length < 2) {
                message.reply('Invalid command\n{$PLAY _MUSIC_NAME}');   
                return;
            }
            
            var youtubeOrNot = false;           //True if extract audio from youtube, false for direct url
            var volume = 0.5;                   //Default Volume (Change if specified files needed)
            
            switch(token[1].toUpperCase()) {    //Check music title tag
                case 'UNICORN':                 //Example for direct url
                    url = "http://67.159.62.2/anime_ost/gundam-uc-origianl-soundtrack/liiyfbxz/02%20-%20UNICORN.mp3";
                    break;
                case 'UNICORN2':                //Example for youtube
                    url = "https://www.youtube.com/watch?v=b40mZVnQCTs&t=40s";
                    youtubeOrNot = true;
                    break;
                case '2015SPRINGBOSS':
                    url = "https://vignette.wikia.nocookie.net/kancolle/images/1/1a/Sound_b_bgm_41.ogg/revision/latest?cb=20150430204040";
                    volume = 0.1;
                    break;
                case '2017SUMMERBOSS':
                    url = "https://vignette.wikia.nocookie.net/kancolle/images/8/85/Sound_b_bgm_100.ogg/revision/latest?cb=20170813110736";
                    volume = 0.1;
                    break;
                default:
                    message.reply("No such music");
                    return;
            }
                    
            voiceChannel = message.member.voiceChannel;
            if(youtubeOrNot) {
                voiceChannel.join().then(connection => {
                    console.log("joined channel");
                    stream = ytdl(url, {filter : 'audioonly'});
                    dispatcher = connection.playStream(stream, streamOptions);
                    dispatcher.setVolume(volume);
                    dispatcher.on("end", end => {
                        console.log("left channel");
                        voiceChannel.leave();
                    });
                }).catch(err => console.log(err));
            } else {
                voiceChannel.join().then(connection => {
                    console.log("joined channel");
                    dispatcher = connection.playArbitraryInput(url);
                    dispatcher.setVolume(volume);
                    dispatcher.on("end", end => {
                        console.log("left channel");
                        voiceChannel.leave();
                    });
                }).catch(err => console.log(err));
            }
          
            break;
        case 'STOP':    //stop music
            console.log("left channel");
            voiceChannel.leave();
            break;
        case 'LOGIN':   //Test database access
            var con = mysql.createConnection({
                host: "den1.mysql1.gear.host", //gearhost mysql server
                user: "hoiseiratommybot",
                password: process.env.DB_PW
            });
            
            con.connect(function(err) {
                if(err) throw err;
                console.log("Connected!");
            }
            break;
        default:
            message.reply('Invalid command');
            return;
    }
    
});





client.login(process.env.BOT_TOKEN);
