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

/*                                      |   A template function object
                                        V
var func_template = {
    CODE : "CODE_NAME",
    DESCRIPTION : "Description for help",
    SYNTAX : "{$template | syntax}",
    LOGIC : function(token, message, func) {
        *function logic here
        
        token: trim and splited input stream from user without $ (already toUpperCase in the main logic)
        message: the message object that trigger this function (details in Discord.js)
        func: the functions array (mainly for display help message)
    }
}
*/

var func_help = {
    CODE : "HELP",
    DESCRIPTION : "{$help | code_name} for syntax of command",
    SYNTAX : "{$help | ***[optional] code_name***}",
    LOGIC : function(token, message, func) {
        if(token.length < 2) {
            var i;
            var msg = func[0].CODE + "\t\t\t" + func[0].DESCRIPTION;
            for(i=1; i<func.length; i++) {
                msg = msg + "\n" + func[i].CODE + "\t\t\t" + func[i].DESCRIPTION;
            }
            message.channel.send(msg);
        } else {
            var j;
            for(j=0; j<func.length; j++) {
                if(token[1].toUpperCase() === func[j].CODE) {
                    message.reply(func[j].SYNTAX);   
                    return;
                }
            }
            message.reply("Command not found");
        }
    }
};

var func_ready = {      //Ready function
    CODE : "READY",
    DESCRIPTION : "Test for the bot is online",
    SYNTAX : "{$ready}",
    LOGIC : function(token, message, func) {
        message.reply('YES!');
    }
};

var func_addmusic = {
    CODE : "ADDMUSIC",
    DESCRIPTION : "Add new music to the database",
    SYNTAX : "{$addmusic | music_code | URL | isYoutube?(bool:T/TRUE/F/FALSE) | ***[optional] default_volume(float between 0 to 1)***}",
    LOGIC : function(token, message, func) {
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
                      + token[1] + "', '" + token[2] + "', " + ((token[3] === "T" || token[3] === "TRUE")?"TRUE":"FALSE")
                       + (token.length > 4?", " + token[4]:"") + ")";

            //console.log(sql);
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
    SYNTAX : "{$play | music_code | [optional] volume(float between 0 to 1)}",
    LOGIC : function(token, message, func) {
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
          
            var sql = "SELECT URL, IS_YOUTUBE, DEFAULT_VOLUME FROM playlist WHERE CODE = '" + token[1] + "'";
            console.log(sql);
            
            con.query(sql, function (err, result, field) {
                if(err) throw err;
                if(result.length === 0) {
                    message.reply("No such music");
                    return;   
                } else {

                    var isYoutubeOrNot = result[0].IS_YOUTUBE;
                    var volume = token.length > 2?token[2]:result[0].DEFAULT_VOLUME;
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
    LOGIC : function(token, message, func) {
        voiceChannel.leave();
    }
}

//Register new function to this func array
var func = [func_help, func_ready, func_addmusic, func_play, func_stop];














//==========Discord client logic===========

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
  
    for(i=0; i<token.length; i++) {
      token[i] = token[i].toUpperCase(); 
    }
    
    for(i=0; i<func.length; i++) {
        if(token[0] === func[i].CODE) {
            func[i].LOGIC(token, message, func);
            return;
        }
    }
    
    message.reply('Invalid command ($help to view commands)');
    
});





client.login(process.env.BOT_TOKEN);
