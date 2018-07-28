const Discord = require('discord.js');
const ytdl = require('ytdl-core');  //For music streaming
var mysql = require('mysql');

const client = new Discord.Client();

const db_host = "den1.mysql1.gear.host"; //gearhost mysql server
const db_user = "hoiseiratommybot";
const db_password = process.env.DB_PW;
const db_schema = "hoiseiratommybot";


var voiceChannel;   //===================
var stream;         //  For Play Music
var dispatcher;     //===================

//---Objects for functions---
var func_ready = {      //Ready function
    CODE : "READY",
    DESCRIPTION : "Test for the bot is online",
    SYNTAX : "{$ready}",
    LOGIC : function(token, message) {
        message.reply('YES!');
    }
};

var func_addmusic = {
    CODE : "ADDMUSIC",
    DESCRIPTION : "Add new music to the database",
    SYNTAX : "{$addmusic | music_code | URL | isYoutube?(bool:T/TRUE/F/FALSE) | default_volume(float,OPTIONAL)}",
    LOGIC : function(token, message) {
        if(token.length < 4) {
            message.reply("Incorrect Syntax!\n" + this.SYNTAX);
            return;
        }

        var con = mysql.createConnection({
            host: db_host,
            user: db_user,
            password: db_password,
            database: db_schema
        });

        con.connect(function(err) {
            if(err) throw err;
            var sql = "INSERT INTO playlist (CODE, URL, IS_YOUTUBE" + (token.length > 4?", " + token[4]:"") + ") VALUES ('"
                      + token[1].toUpperCase() + "', '" + token[2] + "', " + ((token[3].toUpperCase() === "T" || token[3].toUpperCase() === "TRUE")?"TRUE":"FALSE")
                       + (token.length > 4?", " + token[4]:"") + ")";

            console.log(sql);
            con.query(sql, function(err, result) {
                if(err) throw err;
                message.reply('ADDED SUCCESSFULLY');
            });
        });
    }
}

var func_play = {
    CODE : "PLAY",
    DESCRIPTION : "Play music",
    SYNTAX : "{$play | music_code}",
    LOGIC : function(token, message) {
        if(token.length < 2) {
            message.reply("Incorrent Syntax!\n" + this.SYNTAX);   
            return;
        }

        var con = mysql.createConnection({
            host: db_host,
            user: db_user,
            password: db_password,
            database: db_schema
        });

        con.connect(function(err) {
            if(err) throw err;
            console.log("Connected!");
            con.query("SELECT URL, IS_YOUTUBE, DEFAULT_VOLUME FROM playlist WHERE CODE = '" + token[1].toUpperCase() + "'", function (err, result, field) {
                if(err) throw err;
                if(result.length === 0) {
                    message.reply("No such music");
                    return;   
                } else {

                    var isYoutubeOrNot = result[0].IS_YOUTUBE;
                    var volume = result[0].DEFAULT_VOLUME;
                    var url = result[0].URL;

                    voiceChannel = message.member.voiceChannel;
                    if(isYoutubeOrNot) {
                        voiceChannel.join().then(connection => {
                            console.log("joined channel");
                            stream = ytdl(url, {filter : 'audioonly'});
                            dispatcher = connection.playStream(stream);
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

                }
            });
        });
    }
}

var func_stop = {
    CODE : "STOP",
    DESCRIPTION : "Stop playing music",
    SYNTAX : "{$stop}",
    LOGIC : function(token, message) {
        voiceChannel.leave();
    }
}

var func = [func_ready, func_addmusic, func_play, func_stop];
















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
    
    var i;
    
    for(i=0; i<func.length; i++) {
        if(token[0].toUpperCase() === func[i].CODE) {
            func[i].LOGIC(token, message);
            return;
        }
    }
    
    message.reply('Invalid command ($help to view commands)');
    
    /*switch(token[0].toUpperCase()) {
        case 'READY':    //For testing bot online
            message.reply('YES!');
            break;
        case 'ADDMUSIC':
            if(token.length < 4) {
                message.reply("Wrong Format\n{$ADDMUSIC | music_code | URL | isYoutube?(bool:T/TRUE/F/FALSE) | default_volume(float,OPTIONAL)}");
                return;
            }
            
            var con = mysql.createConnection({
                host: db_host,
                user: db_user,
                password: db_password,
                database: db_schema
            });
                
            con.connect(function(err) {
                if(err) throw err;
                var sql = "INSERT INTO playlist (CODE, URL, IS_YOUTUBE" + (token.length > 4?", " + token[4]:"") + ") VALUES ('"
                          + token[1].toUpperCase() + "', '" + token[2] + "', " + ((token[3].toUpperCase() === "T" || token[3].toUpperCase() === "TRUE")?"TRUE":"FALSE")
                           + (token.length > 4?", " + token[4]:"") + ")";
                
                console.log(sql);
                con.query(sql, function(err, result) {
                    if(err) throw err;
                    message.reply('ADDED SUCCESSFULLY');
                });
            });
            break;
        case 'PLAY':    //play music
            if(token.length < 2) {
                message.reply('Invalid command\n{$PLAY _MUSIC_NAME}');   
                return;
            }
       
            
            var con = mysql.createConnection({
                host: db_host,
                user: db_user,
                password: db_password,
                database: db_schema
            });
            
            con.connect(function(err) {
                if(err) throw err;
                console.log("Connected!");
                con.query("SELECT URL, IS_YOUTUBE, DEFAULT_VOLUME FROM playlist WHERE CODE = '" + token[1].toUpperCase() + "'", function (err, result, field) {
                    if(err) throw err;
                    if(result.length === 0) {
                        message.reply("No such music");
                        return;   
                    } else {
                        
                        var isYoutubeOrNot = result[0].IS_YOUTUBE;
                        var volume = result[0].DEFAULT_VOLUME;
                        var url = result[0].URL;
                        
                        voiceChannel = message.member.voiceChannel;
                        if(isYoutubeOrNot) {
                            voiceChannel.join().then(connection => {
                                console.log("joined channel");
                                stream = ytdl(url, {filter : 'audioonly'});
                                dispatcher = connection.playStream(stream);
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
                        
                    }
                });
            });
            
            break;
        case 'STOP':    //stop music
            console.log("left channel");
            voiceChannel.leave();
            break;
        default:
            message.reply('Invalid command');
            return;
    }*/
    
});





client.login(process.env.BOT_TOKEN);
