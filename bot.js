const Discord = require('discord.js');
const ytdl = require('ytdl-core');  //For music streaming
const Webhook = require('webhook-discord');

const hook = new Webhook(process.env.WEBHOOK_URL);
var mysql = require('mysql');

const client = new Discord.Client();

const db_host = "den1.mysql1.gear.host"; //gearhost mysql server
const db_user = "hoiseiratommybot";
const db_password = process.env.DB_PW;
const db_schema = "hoiseiratommybot";


var voiceChannel;          //===================
var stream;                //  For Play Music
var dispatcher = null;     //===================

var clear_command = false;

var music_loop = false;
var master_volume = 1;
var music_queue = [];
var now_playing_music = null;

const update_time = new Date().toLocaleString('en-GB', { timeZone: 'Asia/Hongkong' });


//---Objects for functions---

/*                                      |   A template function object
                                        V
var func_template = {

    CODE : "CODE_NAME",                         //All letters MUST be in CAPITAL because all command would change to uppercase automatically
    
    DESCRIPTION : "Brief description for help",
    
    SYNTAX : "{$TEMPLATE | syntax}",            //Please use CAPITAL if the command is constant such as function code or additional parameter such as "-d"
    
    MANUAL: "Manual for user to understanding the parameters of command"    //You can reference with sample below to adjust format
    
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
    
    DESCRIPTION : "{$help | code_name | ***[optional] -D***} for syntax of command",

    SYNTAX : "{$HELP | ***[optional] code_name***}",

    MANUAL : "**code_name : **The target code name you want to know about."
         + "\n**-D : **Add -d if you need more details.",

    LOGIC : function(token, message, func) {
        if(token.length < 2) {
            var i;
            var msg = func[0].CODE + "\t\t\t" + func[0].DESCRIPTION;
            for(i=1; i<func.length; i++) {
                msg = msg + "\n" + func[i].CODE + "\t\t\t" + func[i].DESCRIPTION;
            }
            msg = msg + "\n\n**All commands are CASE INSENSITIVE**";
            message.channel.send(msg);
        } else {
            var j;
            for(j=0; j<func.length; j++) {
                if(token[1].toUpperCase() === func[j].CODE) {
                    if(token.length > 2 && token[2].toUpperCase() === "-D") {
                      message.reply(func[j].SYNTAX + "\n\n" + func[j].MANUAL);
                    } else {
                      message.reply(func[j].SYNTAX);
                    }
                    return;
                }
            }
            message.reply("Command not found");
        }
    }
}

var func_ready = {      //Ready function
  
    CODE : "READY",
  
    DESCRIPTION : "Test for the bot is online",
  
    SYNTAX : "{$READY}",
  
    MANUAL : "",
  
    LOGIC : function(token, message, func) {
        message.reply('YES!Updated time = ' + update_time);
    }
}

var func_addmusic = {
  
    CODE : "ADDMUSIC",
  
    DESCRIPTION : "Add new music to the database",
  
    SYNTAX : "{$ADDMUSIC | music_code | URL | isYoutube?(bool:T/TRUE/F/FALSE) | ***[optional] default_volume(float between 0 to 1)***}",
   
    MANUAL : "**music_code : **Define a new code that you want to play this music."
              + "\n**URL : **Provide an URL which this bot can get the music."
              + "\n**isYoutube : **Please choose 'T' or 'TRUE' if the source is from youtube."
              + "\n***default_volume : ***[Optional] Set the default volume to this music (Default is 0.5 if not set).",
    
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
            var sql = "INSERT INTO musiclist (CODE, URL, IS_YOUTUBE" + (token.length > 4?", DEFAULT_VOLUME":"") + ") VALUES ('"
                      + token[1].toUpperCase() + "', '" + token[2] + "', " + ((token[3].toUpperCase() === "T" || token[3].toUpperCase() === "TRUE")?"TRUE":"FALSE")
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
   
    DESCRIPTION : "Add music to the music queue and play if no music playing",
   
    SYNTAX : "{$PLAY | music_code | [optional] volume(float between 0 to 1)}",

    MANUAL : "**music_code : **The code of music you want to play."
              + "\n***volume : ***[Optional] Play the music in this volume.",

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
          
            var sql = "SELECT URL, IS_YOUTUBE, DEFAULT_VOLUME FROM musiclist WHERE CODE = '" + token[1].toUpperCase() + "'";
            console.log(sql);
            
            con.query(sql, function (err, result, field) {
                if(err) throw err;
                if(result.length === 0) {
                    message.reply("No such music");
                    return;   
                } else {
                    
                    var music_instance = {
                      code : token[1].toUpperCase(),
                      url : result[0].URL,
                      isYoutubeOrNot : result[0].IS_YOUTUBE,
                      volume : token.length > 2?token[2]:result[0].DEFAULT_VOLUME
                    };
                  
                    music_queue.push(music_instance);
                  
                    if(dispatcher === null && music_queue.length === 1) {
                      voiceChannel = message.member.voiceChannel;
                      voiceChannel.join().then(connection => {
                        PlayMusicInQueue(connection);
                        console.log("end loop");
                      }).catch(err => console.log(err));
                    } else {
                      message.reply("Added to playlist. Now playing is : " + now_playing_music.code);
                    }

                }
            });
        });
    }
}

var func_playlist = {
  
    CODE : "PLAYLIST",
  
    DESCRIPTION : "Show the playlist queue",
  
    SYNTAX : "{$PLAYLIST}",
  
    MANUAL : "",
  
    LOGIC : function(token, message, func) {
        var msg = "**" + now_playing_music.code + "** <- now playing";
        var i;
        for(i=0; i<music_queue.length; i++) {
            msg = msg + "\n" + music_queue[i].code;
        }
        message.channel.send(msg);
    }
  
}

var func_musicdetail = {
 
    CODE : "MUSICDETAIL",
  
    DESCRIPTION : "Show the detail of music player",
  
    SYNTAX : "{$MUSICDETAIL}",
  
    MANUAL : "",
  
    LOGIC : function(token, message, func) {
        if(now_playing_music === null) {
          message.reply("No music playing");
        } else {
          message.reply("**" + now_playing_music.code + "**  VOLUME = " + master_volume + " LOOP = " + (music_loop?"TRUE":"FALSE"));
        }
    }
  
}

var func_stop = {

    CODE : "STOP",
  
    DESCRIPTION : "Stop playing music and CLEAR all music in the queue",

    SYNTAX : "{$stop}",

    MANUAL : "",
  
    LOGIC : function(token, message, func) {
        music_queue = [];
        voiceChannel.leave();
    }
}

var func_volume = {
 
    CODE : "VOLUME",
  
    DESCRIPTION : "Adjust master volume",
  
    SYNTAX : "{$VOLUME | volume(float between 0 to 1)}",
  
    MANUAL : "**volume : **Adjust master volume, all music will play in [play volume in list * master volume]",
  
    LOGIC : function(token, message, func) {
      
        if(token.length < 2) {
            message.reply("Incorrent Syntax!\n" + this.SYNTAX);   
            return;
        }
      
        if(token[1] <= 0 || token[1] > 1) {
            message.reply("Invalid volume!(Should between 0 to 1)");
            return;
        }
        var old_volume = master_volume;
        master_volume = token[1];
        if(dispatcher !== null) {
           dispatcher.setVolume(now_playing_music.volume * master_volume);
        }
        
        message.reply("The volume has been changed : " + old_volume + " -> " + master_volume);
    }
  
}

var func_loop = {
  
    CODE : "LOOP",
  
    DESCRIPTION : "Set music looping",
  
    SYNTAX : "{$LOOP | isLoop(boolean:'T'/'TRUE'/'F'/'FALSE')}",
  
    MANUAL : "**isLoop : **Set true will loop for the current playing music.(Music in playlist will not destory but will not play until disable looping",
  
    LOGIC : function(token, message, func) {
      
        if(token.length < 2) {
            message.reply("Incorrent Syntax!\n" + this.SYNTAX);   
            return; 
        }
      
        if(token[1].toUpperCase() === 'T' || token[1].toUpperCase() === 'TRUE') {
            music_loop = true; 
            message.reply("Loop is set to true");
        } else {
            music_loop = false; 
            message.reply("Loop is set to false");
        }
     
    }
  
}

var func_vote = {
  
    CODE : "VOTE",
  
    DESCRIPTION : "Temporarily an empty function for future implement",
  
    SYNTAX : "{$VOTE}",
  
    MANUAL : "",
  
    LOGIC : function(token, message, func) {
      
    }
    
}

var func_clear = {
 
    CODE : "CLEAR",
  
    DESCRIPTION : "Clear the commands and message that call bot or create by bot",
  
    SYNTAX : "{$CLEAR | [optional]ON/OFF ('T'/'TRUE'/'F'/'FALSE')}",
  
    MANUAL : "***ON/OFF : ***[Optional]True to turn on auto clear command mode."
         +"\n**Toggling ON/OFF will not trigger the clear command that clear the command or message created by to in 100 message above.**",
  
    LOGIC : function(token, message, func) {
      if(token.length < 2) {
        message.channel.fetchMessages({limit : 100})
          .then(messages => {
            messages.forEach(function(message) {
              if(message.content.charAt(0) === '$' || message.author.id === client.user.id) {
                message.delete();
                console.log("Message: \"" + message.content + "\" deleted");
              }
            })
          })
          .catch(console.error);
      } else if(token[1].toUpperCase() === 'T' || token[1].toUpperCase() === 'TRUE') {
        clear_command = true;
      } else {
        clear_command = false; 
      }
    }
  
}

var func_test = {
  
    CODE : "TEST",
  
    DESCRIPTION : "A test function to test new features",
  
    SYNTAX : "{$TEST}",
  
    MANUAL : "",
  
    LOGIC : function(token, message, func) {
        //hook.info("HoiseiraTommy", "Test Content");
        message.channel.fetchMessages({limit : 100})
          .then(messages => {
            messages.forEach(function(message) {
              console.log(message.content);
            })
          })
          .catch(console.error);
    }
  
}

//Register new function to this func array
var func = [func_help, func_ready, func_addmusic, func_play, func_playlist, func_musicdetail, func_stop, func_volume, func_loop, func_vote, func_clear, func_test];














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
    //  ALL COMMAND SHOULD BE CONVERTED TO UPPER CASE!
    //===================================================
    
    var i;
    
    for(i=0; i<func.length; i++) {
        if(token[0].toUpperCase() === func[i].CODE) {
            try {
              func[i].LOGIC(token, message, func);
            } catch (err) {
              message.reply("Oops! Something goes wrong. Please refer to the console log on heroku");
              console.log(err);
            }
            if(clear_command) {
              message.delete("Clean view")
                .then(msg => console.log('Command Deleted'))
                .catch(console.error);
            }
            return;
        }
    }
    
    message.reply('Invalid command ($help to view commands)');
    
});



function PlayMusicInQueue(connection) {
    
    if(music_queue.length === 0) {
      voiceChannel.leave();
      return;
    }
  
    now_playing_music = music_queue.shift();

    if(now_playing_music.isYoutubeOrNot) {
        stream = ytdl(now_playing_music.url, {filter : 'audioonly'});
        dispatcher = connection.playStream(stream);
        dispatcher.setVolume(now_playing_music.volume * master_volume);
        dispatcher.on("end", end => {
             dispatcher = null;
             if(music_loop) {
                music_queue.unshift(now_playing_music); 
             }
             now_playing_music = null;
             PlayMusicInQueue(connection);
        });
    } else {
        dispatcher = connection.playArbitraryInput(now_playing_music.url);
        dispatcher.setVolume(now_playing_music.volume * master_volume);
        dispatcher.on("end", end => {
             dispatcher = null;
             if(music_loop) {
                music_queue.unshift(now_playing_music); 
             }
             now_playing_music = null;
             PlayMusicInQueue(connection);
        });
    }
  
}





client.login(process.env.BOT_TOKEN);
