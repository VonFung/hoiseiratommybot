const Discord = require('discord.js');
const ytdl = require('ytdl-core');  //For music streaming
const Webhook = require('webhook-discord');
var mysql = require('mysql');

const hook = new Webhook(process.env.WEBHOOK_URL);

const client = new Discord.Client();

const db_host = "den1.mysql1.gear.host"; //gearhost mysql server
const db_user = "hoiseiratommybot";
const db_password = process.env.DB_PW;
const db_schema = "hoiseiratommybot";


var voiceChannel;          //===================
var stream;                //  For Play Music
var dispatcher = null;     //===================
var voice_conn = null;

var clear_command = false;

var music_loop = false;
var master_volume = 0.2;
var music_queue = [];
var now_playing_music = null;
var playlist_mode = "";
var random_playlist = false;
var playlist_playing_idx = -1;
var interupt_music = null;

var detail_message = "";
var playqueue_message = "";

const update_time = new Date().toLocaleString('en-US', { timeZone: 'Asia/Hong_Kong' });

var user_id_nickname;


//---Objects for functions---

/*                                      |   A template function object
                                        V
var func_template = {

    CODE : "CODE_NAME",                         //All letters MUST be in CAPITAL because all command would change to uppercase automatically
    
    DESCRIPTION : "Brief description for help",
    
    SYNTAX : "{$TEMPLATE | syntax}",            //Please use CAPITAL if the command is constant such as function code or additional parameter such as "-d"
    
    MANUAL: "Manual for user to understanding the parameters of command"    //You can reference with sample below to adjust format
    
    LOGIC : function(token, message) {
        *function logic here
        
        token: trim and splited input stream from user without $ (already toUpperCase in the main logic)
        message: the message object that trigger this function (details in Discord.js)
        
        Database access EXAMPLE:
        |===============================================================================
        V
        ExecuteSQL(sql).then((result) => {
            do something here with result
        }).catch((err) => {
            message.reply("Something error! Please refer to the log on Heroku");
            console.log(err);
        });
        ^
        |===============================================================================
    }
}
*/

var func_help = {
    
    CODE : "HELP",
    
    DESCRIPTION : "{$help | code_name | ***[optional] -D***} for syntax of command",

    SYNTAX : "{$HELP | ***[optional] code_name***}",

    MANUAL : "**code_name : **The target code name you want to know about."
         + "\n**-D : **Add -d if you need more details.",

    LOGIC : function(token, message) {
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
  
    LOGIC : function(token, message) {
        message.reply('YES!Updated time = ' + update_time);
    }
}

var func_addmusic = {
  
    CODE : "ADDMUSIC",
  
    DESCRIPTION : "Add new music to the database",
  
    SYNTAX : "{$ADDMUSIC | music_code | URL | ***[optional] default_volume(float between 0 to 1)***}",
   
    MANUAL : "**music_code : **Define a new code that you want to play this music."
              + "\n**URL : **Provide an URL which this bot can get the music."
              + "\n***default_volume : ***[Optional] Set the default volume to this music (Default is 0.5 if not set).",
    
    LOGIC : function(token, message, func) {
        if(token.length < 3) {
            message.reply("Incorrect Syntax!\n" + this.SYNTAX);
            return;
        }
      
        var sql = "INSERT INTO musiclist (CODE, URL" + (token.length > 3?", DEFAULT_VOLUME":"") + ") VALUES ('"
                + token[1].toUpperCase() + "', '" + token[2]
                 + (token.length > 3?"', " + token[3]:"'") + ")";

        ExecuteSQL(sql).then((result) => {
            message.reply('ADDED SUCCESSFULLY');
            console.log("result = \n" + result);
        }).catch((err) => {
            message.reply("Something error! Please refer to the log on Heroku");
            console.log(err);
        });
    }
}

var func_searchmusic = {
 
    CODE : "SEARCHMUSIC",
  
    DESCRIPTION : "Search all music in the database",
  
    SYNTAX : "{$SEARCHMUSIC | [optional] searching keyword}",
  
    MANUAL : "***searching keyword : ***[Optional] **ONE** keyword you want to search with SQL %keyword%.",
  
    LOGIC : function(token, message) {
        var sql;
        if(token.length < 2) {
            sql = "SELECT CODE FROM musiclist ORDER BY id ASC";
        } else {
            sql = "SELECT CODE FROM musiclist WHERE CODE LIKE '%" + token[1].toUpperCase() + "%' ORDER BY id ASC";
        }
      
      
        ExecuteSQL(sql).then((result) => {
            if(result.length === 0) {
                message.reply("No result");
                return;
            }
            let i=2;
            let display_str = "1)\t" + result[0].CODE;
          
            for( ; i<=result.length; i++) {
                display_str = display_str + "\n" + i + ")\t" + result[i-1].CODE;
            }

            message.channel.send(display_str);
        }).catch((err) => {
            message.reply("Something error! Please refer to the log on Heroku");
            console.log(err);
        });
    }
  
}

var func_play = {
  
    CODE : "PLAY",
   
    DESCRIPTION : "Add music to the music queue and play if no music playing",
   
    SYNTAX : "{$PLAY | music_code | [optional] volume(float between 0 to 1)}",

    MANUAL : "**music_code : **The code of music you want to play."
              + "\n***volume : ***[Optional] Play the music in this volume.",

    LOGIC : function(token, message) {
        if(token.length < 2) {
            message.reply("Incorrent Syntax!\n" + this.SYNTAX);   
            return;
        }
      
        if(playlist_mode) {
            message.reply("The bot is playing in playlist mode!");
            return;
        }
      
        var sql = "SELECT URL, DEFAULT_VOLUME FROM musiclist WHERE CODE = '" + token[1].toUpperCase() + "'";
      
        ExecuteSQL(sql).then((result) => {
            if(result.length === 0) {
                message.reply("No such music");
                return;   
            } else {

                var music_instance = {
                  code : token[1].toUpperCase(),
                  url : result[0].URL,
                  volume : token.length > 2?token[2]:result[0].DEFAULT_VOLUME
                };

                music_queue.push(music_instance);

                if(dispatcher === null && music_queue.length === 1) {
                  voiceChannel = message.member.voiceChannel;
                  voiceChannel.join().then(connection => {
                    voice_conn = connection;
                    PlayMusicInQueue();
                  }).catch(err => console.log(err));
                } else {
                  message.reply("Added to playlist. Now playing is : " + now_playing_music.code);
                }
            }
        }).catch((err) => {
            message.reply("Something error! Please refer to the log on Heroku");
            console.log(err);
        });
    }
}

var func_addplaylist = {
 
    CODE : "ADDPLAYLIST",
  
    DESCRIPTION : "Add a new playlist",
  
    SYNTAX : "{$ADDPLAYLIST | playlist_name}",
  
    MANUAL : "**playlist_name : **The name of playlist."
            +"\n**Please use $ADDMUSICTOPL to add new music into an exist playlist**",
  
    LOGIC : function(token, message) {
        if(token.length < 2) {
            message.reply("Incorrent Syntax!\n" + this.SYNTAX);   
            return;
        }
        
        var sql = "INSERT INTO playlist (NAME) VALUES ('" + token[1].toUpperCase() + "')";
      
        ExecuteSQL(sql).then((result) => {
            message.reply("Added successfully!");
        }).catch((err) => {
            message.reply("Something error! Please refer to the log on Heroku");
            console.log(err);
        });
        
    }
  
}

var func_addmusictopl = {
 
    CODE : "ADDMUSICTOPL",
  
    DESCRIPTION : "Add music by code to an exist playlist",
  
    SYNTAX : "{$ADDMUSICTOPL | music_code | playlist_name}",
  
    MANUAL : "**music_code : **The code of music."
            +"\n**playlist_name : **The name of playlist."
            +"\n**The order of added music to playlist will be the default playing order(CANNOT BE CONVERTED)**",
  
    LOGIC : function(token, message) {
        if(token.length < 3) {
            message.reply("Incorrent Syntax!\n" + this.SYNTAX);   
            return;
        }
      
        var sql = "INSERT INTO playlist_music (MUSIC_ID, PLAYLIST_ID) "
                    +"SELECT musiclist.id, playlist.id FROM musiclist, playlist WHERE musiclist.CODE = '"
                    + token[1].toUpperCase() + "' AND playlist.NAME = '" + token[2].toUpperCase() + "'";
      
        ExecuteSQL(sql).then((result) => {
            message.reply("Added successfully!");
        }).catch((err) => {
            message.reply("Something error! Please refer to the log on Heroku");
            console.log(err);
        });
    }
  
}

var func_playlist = {
    
    CODE : "PLAYLIST",
  
    DESCRIPTION : "Play music in playlist mode by a defined playlist",
  
    SYNTAX : "{$PLAYLIST | playlist_name | [optional]-RAND}",
  
    MANUAL : "**playlist_name : **The name of playlist."
            +"\n***-RAND : ***[Optional] Play the playlist in random order."
            +"\n**Please stop all music before playing a playlist**",
  
    LOGIC : function(token, message) {
        if(token.length < 2) {
            message.reply("Incorrent Syntax!\n" + this.SYNTAX);   
            return;
        }
      
        if(music_queue.length > 0) {
            message.reply("Please stop all music before playing a playlist");
            return;
        }
      
        var sql = "SELECT CODE, URL, DEFAULT_VOLUME FROM musiclist WHERE id IN "
                    +"(SELECT a.MUSIC_ID FROM playlist_music a INNER JOIN playlist b WHERE a.PLAYLIST_ID = b.id AND "
                    +"b.NAME = '" + token[1].toUpperCase() + "') ORDER BY id ASC";
      
        if(token.length > 2 && token[2].toUpperCase() === '-RAND') {
            //sql = sql + " ORDER BY rand()";
            random_playlist = true;
        } else {
            //sql = sql + " ORDER BY id ASC";
            random_playlist = false; 
        }
        
        ExecuteSQL(sql).then((result) => {
            for(var i=0; i<result.length; i++) {
                var music_instance = {
                  code : result[i].CODE,
                  url : result[i].URL,
                  volume : result[i].DEFAULT_VOLUME
                };
                music_queue.push(music_instance);
            }
            
            voiceChannel = message.member.voiceChannel;
            voiceChannel.join().then(connection => {
              voice_conn = connection;
              playlist_mode = token[1].toUpperCase();
              PlayMusicInQueue();
            }).catch(err => console.log(err));
        }).catch((err) => {
            message.reply("Something error! Please refer to the log on Heroku");
            console.log(err);
        });
    }
  
}

var func_playqueue = {
  
    CODE : "PLAYQUEUE",
  
    DESCRIPTION : "Show the music playing queue OR the whole playlist in playlist mode",
  
    SYNTAX : "{$PLAYQUEUE}",
  
    MANUAL : "",
  
    LOGIC : function(token, message) {
        if(now_playing_music === null) {
          message.reply("No music playing"); 
        } else {
          if(playqueue_message) {
              playqueue_message.delete();
              playqueue_message = "";
          }
          message.channel.send("Now loading");
          message.channel.fetchMessages({ limit: 10, after: message.id})
            .then(messages => {
                messages.forEach(function(msg) {
                  if(msg.author.id === client.user.id && msg.content === "Now loading") {
                    playqueue_message = msg;
                    UpdatePlayQueue();
                  }
                });
            })
            .catch(console.log("Some error in playqueue"));
        }
    }
  
}

var func_musicdetail = {
 
    CODE : "MUSICDETAIL",
  
    DESCRIPTION : "Show the detail of music player",
  
    SYNTAX : "{$MUSICDETAIL | [optional]-CLEAR}",
  
    MANUAL : "***-CLEAR : ***[Optional]If you want to delete the detail message.",
  
    LOGIC : function(token, message) {
        if(token.length > 1 && token[1].toUpperCase() === "-CLEAR") {
            detail_message.delete();
            detail_message = "";
            return;
        }
        if(now_playing_music === null) {
          message.reply("No music playing");
        } else {
          if(detail_message) {
              detail_message.unpin();
              detail_message.delete();
              detail_message = "";
          }
          message.channel.send("Now loading");
          message.channel.fetchMessages({ limit: 10, after: message.id})
            .then(messages => {
                messages.forEach(function(msg) {
                  if(msg.author.id === client.user.id && msg.content === "Now loading") {
                    detail_message = msg;
                    detail_message.pin();
                    UpdateMusicDetail();
                  }
                });
            })
            .catch(console.log("Some error in music detail"));
        }
    }
  
}

var func_stop = {

    CODE : "STOP",
  
    DESCRIPTION : "Stop playing music and CLEAR all music in the queue",

    SYNTAX : "{$STOP}",

    MANUAL : "",
  
    LOGIC : function(token, message) {
        music_queue = [];
        dispatcher.end();
    }
}

var func_next = {
  
    CODE : "NEXT",
  
    DESCRIPTION : "Play the next music in the queue. (Stop if no music in the queue)",
  
    SYNTAX : "{$NEXT}",
  
    MANUAL : "",
  
    LOGIC : function(token, message) {
        dispatcher.end();
    }
  
}

var func_pause = {
    
    CODE : "PAUSE",
  
    DESCRIPTION : "Pause the music.",
  
    SYNTAX : "{$PAUSE}",
  
    MANUAL : "",
  
    LOGIC : function(token, message) {
        dispatcher.pause(); 
    }
  
}

var func_resume = {
  
    CODE : "RESUME", 
  
    DESCRIPTION : "Resume playing music.",
  
    SYNTAX : "{$RESUME}",
  
    MANUAL : "",
  
    LOGIC : function(token, message) {
        dispatcher.resume(); 
    }
  
}

var func_volume = {
 
    CODE : "VOLUME",
  
    DESCRIPTION : "Adjust master volume",
  
    SYNTAX : "{$VOLUME | volume(float between 0 to 1)}",
  
    MANUAL : "**volume : **Adjust master volume, all music will play in [play volume in list * master volume]",
  
    LOGIC : function(token, message) {
      
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
  
    LOGIC : function(token, message) {
      
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

var func_setname = {
  
    CODE : "SETNAME",
  
    DESCRIPTION : "Link your Discord ID to a nickname",
  
    SYNTAX : "{$SETNAME | nickname}",
  
    MANUAL : "**nickname : **The nickname you want to set. Create a new user account if your Discord ID hasn't in the database. "
            +"You can change your nickname if your Discord ID is registered in the database. "
            +"\n**Line and Browser Version can link with your Discord ID with the same nickname (future, maybe)**",
  
    LOGIC : function(token, message) {
        if(token.length < 2) {
            message.reply("Incorrect Syntax!\n" + this.SYNTAX);
            return;
        }
      
        var sql = "INSERT INTO user (NAME, DISCORD) VALUES ('" + token[1] + "', " + message.author.id + ") "
                 +"ON DUPLICATE KEY UPDATE NAME = '" + token[1] + "'";
      
        ExecuteSQL(sql).then((result) => {
            message.reply('Your nickname now is ' + token[1]);
        }).catch((err) => {
            message.reply("Something error! Please refer to the log on Heroku");
            console.log(err);
        });
    }
  
}

var func_vote = {
  
    CODE : "VOTE",
  
    DESCRIPTION : "Temporarily an empty function for future implement",
  
    SYNTAX : "{$VOTE}",
  
    MANUAL : "",
  
    LOGIC : function(token, message) {
      
    }
    
}

var func_showvote = {
 
    CODE : "SHOWVOTE", 
  
    DESCRIPTION : "Show all votes that are currently available or expired if needed",
  
    SYNTAX : "{$SHOWVOTE | [optional] -ALL}",
  
    MANUAL : "***-ALL : ***[Optional] Add the command if you want to show expired votes",
  
    LOGIC : function(token, message) {
      
        var sql = "SELECT id, TITLE, DESCRIPTION FROM vote WHERE HIDED = FALSE";
      
        if(!(token.length > 1 && token[1].toUpperCase() === "-ALL")) {
            sql = sql + " AND EXPIRE_DATE >= DATE(CURDATE())";
        }
        sql = sql + " ORDER BY ID DESC";
      
        ExecuteSQL(sql).then((result) => {
            if(result.length === 0) {
                message.reply("No result");
                return;
            }
            var msg = "1)\t" + result[0].TITLE + "(" + result[0].id + ")\t" + result[0].DESCRIPTION;
            for(var i=2; i<=result.length; i++) {
                 msg = msg + "\n" + i + ")\t" + result[i-1].TITLE + "(" + result[i-1].id + ")\t" + result[i-1].DESCRIPTION;
            }
            message.channel.send(msg);
        }).catch((err) => {
            message.reply("Something error! Please refer to the log on Heroku");
            console.log(err);
        });
    }
  
}

var func_addvote = {
 
    CODE : "ADDVOTE",
  
    DESCRIPTION : "Add new vote",
  
    SYNTAX : "{$ADDVOTE | title | expire_date(format:'yyyy-mm-dd') | [optional] max_choice}",
  
    MANUAL : "**title : **The title of the vote."
            +"\n**expire_date : **The expire date of the vote."
            +"\n***max_choice : ***[Optional] Maximum choices for the vote (default is 1)",
  
    LOGIC : function(token, message) {

        if(token.length < 3) {
            message.reply("Incorrect Syntax!\n" + this.SYNTAX);
            return;
        }
      
        if(GetUserID(message.author.id) === -1) {
            message.reply("You have not register you discord ID into the database!");
            return;
        }
      
        var sql = "INSERT INTO vote (TITLE, " + ((token.length > 3)?"MAX_VOTE, ":"") + "EXPIRE_DATE, CREATE_USER_ID) VALUES ('"
                + token[1] + "', " + ((token.length > 3)?token[3] + ", ":"") + "'" + token[2] + "', "
                + GetUserID(message.author.id) + ")";
      
        ExecuteSQL(sql).then((result) => {
            message.reply("Added successfully");
        }).catch((err) => {
            message.reply("Something error! Please refer to the log on Heroku");
            console.log(err);
        });
    }
  
}

var func_clear = {
 
    CODE : "CLEAR",
  
    DESCRIPTION : "Clear the commands and message that call bot or create by bot",
  
    SYNTAX : "{$CLEAR | [optional](amount(int) || ON/OFF ('T'/'TRUE'/'F'/'FALSE'))}",
  
    MANUAL : "***amount : ***[Optional]The amount of message(s) want to delete(Limit: 100)."
         +"\n***ON/OFF : ***[Optional]True to turn on auto clear command mode."
         +"\n**Toggling ON/OFF will not trigger the clear command that clear the command or message created by to in 100 message above.**"
         +"\n**amount and ON/OFF cannot be both trigger!**",
  
    LOGIC : function(token, message) {
      if(token.length < 2 || !isNaN(parseInt(token[1]))) {
        let amount = (token.length < 2)?100:parseInt(token[1]);
        if(amount < 1) amount = 1;
        if(amount > 100) amount = 100;
        message.channel.fetchMessages({limit : amount, before : message.id})
          .then(messages => {
            messages.forEach(function(msg) {
              if(msg.content.charAt(0) === '$' || msg.author.id === client.user.id) {
                msg.delete();
                console.log("Message: \"" + msg.content + "\" deleted");
              }
            })
            message.delete();
          })
          .catch(console.error);
      } else if(token[1].toUpperCase() === 'T' || token[1].toUpperCase() === 'TRUE') {
        clear_command = true;
      } else {
        clear_command = false; 
      }
    }
  
}

var func_sql = {
 
    CODE : "SQL",
  
    DESCRIPTION : "Direct execute SQL",
  
    SYNTAX : "{$SQL | sql_command}",
  
    MANUAL : "**sql_command : **The SQL command you want to execute"
            +"\n**The display of SELECT will be in JSON format",
  
    LOGIC : function(token, message) {
        if(token.length < 2) {
            message.reply("Incorrect Syntax!\n" + this.SYNTAX);
            return;
        } else {
          var sql = token[1];
          var i;
          for(i=2; i<token.length; i++) {
              sql = sql + " " + token[i];
          }
          ExecuteSQL(sql).then((result) => {
              message.channel.send(JSON.stringify(result));
          }).catch((err) => {
              message.reply("Something error! Please refer to the log on Heroku");
              console.log(err);
          });
        }
    }
  
}

var func_test = {
  
    CODE : "TEST",
  
    DESCRIPTION : "A test function to test new features",
  
    SYNTAX : "{$TEST}",
  
    MANUAL : "",
  
    LOGIC : function(token, message) {
        //hook.info("HoiseiraTommy", "Test Content");
        /*message.channel.fetchMessages({limit : 100})
          .then(messages => {
            messages.forEach(function(message) {
              console.log(message.content);
            })
          })
          .catch(console.error);*/
        //message.reply("Your id is " + GetUserID(message.author.id));
        //message.channel.send("$TESTREPLY");
        /*var conn;
        client.voiceConnections.forEach((id, vc) => {
            if(id === '261140017894785025') {
            //if(id === 'HoiseiraTommy_Discord群') {
                conn = vc; 
            }
        });*/
        /*
        var new_dispatcher = voice_conn.playArbitraryInput('https://vignette.wikia.nocookie.net/kancolle/images/a/ab/Sound_se_18.ogg/revision/latest?cb=20150615152815');
        new_dispatcher.setVolume(0.1);
        new_dispatcher.on("end", end => {
            new_dispatcher = null;            
        });*/
    }
  
}

//Register new function to this func array
var func = [func_help, func_ready, func_addmusic, func_searchmusic, func_play, func_addplaylist, func_addmusictopl, 
            func_playlist, func_playqueue, func_musicdetail, func_stop, 
            func_next, func_pause, func_resume, func_volume, func_loop,
            func_setname, func_vote, func_showvote, func_addvote, func_clear, func_sql, func_test];














//==========Discord client logic===========

client.on('ready', () => {

    console.log('I am ready!');
  
    UpdateUserNicknameID();
    /*client.users.forEach((id, user) => {
        console.log(id + ": " + user.id);  
    });*/
    /*client.guilds.forEach((id, guild) => {
        console.log("Guild id: " + id + "/" + guild.id);
    });*/
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
              func[i].LOGIC(token, message/*, func*/);
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

client.on('voiceStateUpdate', (oldMember, newMember) => {
  let newUserChannel = newMember.voiceChannel
  let oldUserChannel = oldMember.voiceChannel


  if(oldUserChannel === undefined && newUserChannel !== undefined && newUserChannel.id === '261140017894785026') {

     // User Joins a voice channel
    console.log("'" + newMember.id + "' has joined the voice channel!(" + newMember.voiceChannel.id + ")");
    if(newMember.id === "340126981905448962") {   //社長ID
        interupt_music = {
          code : 'TESTING',
          url : 'https://www.youtube.com/watch?v=0nc6lx2i4-Q',
          volume : 0.8
        };
        if(now_playing_music) {
          if(!playlist_mode) {
            let temp_loop = music_loop;
            music_loop = true;
            dispatcher.end();
            music_loop = temp_loop;
          } else {
            dispatcher.end(); 
          }
        } else {
          voiceChannel = newMember.voiceChannel;
          voiceChannel.join().then(connection => {
            voice_conn = connection;
            PlayMusicInQueue();
          }).catch(err => console.log(err));
        }
    }
    /*if(newMember.id === "340127083848269834") {
        interupt_music = {
          code : 'TESTING',
          url : 'https://www.youtube.com/watch?v=0nc6lx2i4-Q',
          volume : 0.8
        };
        if(now_playing_music) {
          if(!playlist_mode) {
            let temp_loop = music_loop;
            music_loop = true;
            dispatcher.end();
            music_loop = temp_loop;
          } else {
            dispatcher.end(); 
          }
        } else {
          voiceChannel = newMember.voiceChannel;
          voiceChannel.join().then(connection => {
            voice_conn = connection;
            PlayMusicInQueue();
          }).catch(err => console.log(err));
        }
    }*/
  } else if(newUserChannel === undefined){

    // User leaves a voice channel
    console.log("'" + newMember.id + "' has left the voice channel!(" + oldMember.voiceChannel.id + ")");
  }
})



function UpdateUserNicknameID() {
  
    var sql = "SELECT id, NAME, DISCORD FROM user";
  
    ExecuteSQL(sql).then((result) => {
        user_id_nickname = result;
        console.log("UpdateUserNicknameID SQL success");
    }).catch((err) => {
        message.reply("Something error! Please refer to the log on Heroku");
        console.log(err);
    });
  
    console.log("User nickname<>ID updated");
  
    
    
}

function GetUserID(discordID) {
    for(var i=0; i<user_id_nickname.length; i++) {
        if(user_id_nickname[i].DISCORD === discordID) {
            return user_id_nickname[i].id; 
        }
    }
    return -1;
}


function PlayMusicInQueue() {
    if(interupt_music) {
      now_playing_music = interupt_music;
      if((interupt_music.url.indexOf('https://www.youtube.com/') + 1) || 
         (interupt_music.url.indexOf('https://youtu.be/') + 1)) {
          stream = ytdl(interupt_music.url, {filter : 'audioonly'});
          dispatcher = voice_conn.playStream(stream);
          dispatcher.setVolume(interupt_music.volume * master_volume);
          dispatcher.on("end", end => {
               dispatcher = null;
               interupt_music = null;
               PlayMusicInQueue();
          });
      } else {
          dispatcher = voice_conn.playArbitraryInput(interupt_music.url);
          dispatcher.setVolume(interupt_music.volume * master_volume);
          dispatcher.on("end", end => {
               dispatcher = null;
               interupt_music = null;
               PlayMusicInQueue();
          });
      }
      return; 
    }
    
    if(music_queue.length === 0) {
      voiceChannel.leave();
      playlist_mode = "";
      random_playlist = false;
      playlist_playing_idx = -1;
      interupt_music = null;
      now_playing_music = null;
      UpdateMusicDetail();
      UpdatePlayQueue();
      return;
    }
  
    if(playlist_mode) {
      if(now_playing_music) {
        now_playing_music = music_queue[playlist_playing_idx];
      } else if(random_playlist) {
        var i;
        do {
          i = Math.floor(Math.random() * music_queue.length);
        } while (music_queue.length > 1 && i === playlist_playing_idx);
        playlist_playing_idx = i;
        now_playing_music = music_queue[playlist_playing_idx];
      } else {
        playlist_playing_idx = (playlist_playing_idx+1)%music_queue.length;
        now_playing_music = music_queue[playlist_playing_idx];
      }
      
      if((now_playing_music.url.indexOf('https://www.youtube.com/') + 1) || 
         (now_playing_music.url.indexOf('https://youtu.be/') + 1)) {
          stream = ytdl(now_playing_music.url, {filter : 'audioonly'});
          dispatcher = voice_conn.playStream(stream);
          dispatcher.setVolume(now_playing_music.volume * master_volume);
          dispatcher.on("end", end => {
               dispatcher = null;
               now_playing_music = null;
               PlayMusicInQueue();
          });
      } else {
          dispatcher = voice_conn.playArbitraryInput(now_playing_music.url);
          dispatcher.setVolume(now_playing_music.volume * master_volume);
          dispatcher.on("end", end => {
               dispatcher = null;
               now_playing_music = null;
               PlayMusicInQueue();
          });
      }
      
    } else {
  
      now_playing_music = music_queue.shift();

      if((now_playing_music.url.indexOf('https://www.youtube.com/') + 1) || 
         (now_playing_music.url.indexOf('https://youtu.be/') + 1)) {
          stream = ytdl(now_playing_music.url, {filter : 'audioonly'});
          dispatcher = voice_conn.playStream(stream);
          dispatcher.setVolume(now_playing_music.volume * master_volume);
          dispatcher.on("end", end => {
               dispatcher = null;
               if(music_loop) {
                  music_queue.unshift(now_playing_music); 
               }
               now_playing_music = null;
               PlayMusicInQueue();
          });
      } else {
          dispatcher = voice_conn.playArbitraryInput(now_playing_music.url);
          dispatcher.setVolume(now_playing_music.volume * master_volume);
          dispatcher.on("end", end => {
               dispatcher = null;
               if(music_loop) {
                  music_queue.unshift(now_playing_music); 
               }
               now_playing_music = null;
               PlayMusicInQueue();
          });
      }
    }
    if(detail_message) {
       UpdateMusicDetail();
    }
    if(playqueue_message) {
       UpdatePlayQueue(); 
    }
}

function UpdateMusicDetail() {
      if(!detail_message) {
        return;
      } else if(now_playing_music === null) {
        detail_message.unpin();
        detail_message.delete();
        detail_message = "";
      } else if (detail_message.deleted) {
        detail_message.unpin();
        detail_message = "";
      } else {
        detail_message.edit("**\u266A" + now_playing_music.code + ((playlist_mode)?"(" + playlist_mode + ")":"") + "**")
              .then(edited_msg => {console.log("UpdateMusicDetail success!")})
              .catch(console.log("UpdateMusicDetail error"));;
      }
}

function UpdatePlayQueue() {
      if(!playqueue_message) {
          return;
      } else if(now_playing_music === null) {
          playqueue_message.delete();
          playqueue_message = "";
      } else if (playqueue_message.deleted) {
          playqueue_message = "";
      } else {
          var msg = "";
          if(playlist_mode) {
              msg = msg + "**PLAYLIST: " + playlist_mode;
              if(random_playlist) {
                  msg = msg + "(Random mode)";
              }
              msg = msg + "**\n";
              var i;
              for(i=0; i<music_queue.length; i++) {
                  msg = msg + "\n" + ((i === playlist_playing_idx)?"**=>\u266A":"") + music_queue[i].code
                    + ((i === playlist_playing_idx)?"<= Now Playing**":""); 
                  /*if(i === playlist_playing_idx) {
                      msg = msg + "**=>\u266A"; 
                  }
                  msg = msg + music_queue[i].code;
                  if(i === playlist_playing_idx) {
                      msg = msg + "<=Now Playing**";
                  }*/
              }
          } else {
              msg = msg + "**" + now_playing_music.code + "** <- now playing";
              var i;
              for(i=0; i<music_queue.length; i++) {
                  msg = msg + "\n" + music_queue[i].code;
              }
          }
          playqueue_message.edit(msg)
              .then(edited_msg => {console.log("UpdatePlayQueue success!")})
              .catch(console.log("UpdatePlayQueue error"));
      }
}

function ExecuteSQL(sql) {
     var con = mysql.createConnection({
        host: db_host,
        user: db_user,
        password: db_password,
        database: db_schema
    });
 
    return new Promise((resolve, reject) => {
        con.connect(function(err) {
            if(err) {
                reject(err);
            } else {
              con.query(sql, function(err, result) {
                  if(err) {
                      reject(err); 
                  } else {
                      resolve(result);
                      console.log("SQL: '" + sql + "' success");
                  }
                  con.end();
              });
            }
        });
    });
    
}


client.login(process.env.BOT_TOKEN);
