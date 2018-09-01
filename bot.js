const Discord = require('discord.js');
const ytdl = require('ytdl-core');  //For music streaming
const Webhook = require('webhook-discord');
var mysql = require('mysql');
var to_zh_tw = require('chinese-conv');

const hook = new Webhook(process.env.WEBHOOK_URL);

const client = new Discord.Client();

const db_host = "den1.mysql1.gear.host"; //gearhost mysql server
const db_user = "hoiseiratommybot";
const db_password = process.env.DB_PW;
const db_schema = "hoiseiratommybot";

const db4free_host = "db4free.net";
const db4free_user = "hoiseiratommy";
const db4free_password = process.env.DB_PW;
const db4free_dbname = "hoiseiratommy";


var voiceChannel;          //===================
var stream;                //  For Play Music
var dispatcher = null;     //===================
var voice_conn = null;

var clear_command = [];

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


var displaying_menu = null;


const update_time = new Date().toLocaleString('en-US', { timeZone: 'Asia/Hong_Kong' });

var users;


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
    
    DESCRIPTION : "{!help | code_name | ***[optional] -D***} for syntax of command",

    SYNTAX : "HELP | ***[optional] code_name***",

    MANUAL : "**code_name : **The target code name you want to know about."
         + "\n**-D : **Add -d if you need more details.",

    LOGIC : function(token, message) {
        if(token.length < 2) {
            var i;
            var msg = "**Functions List**";
            for(i=0; i<func.length; i++) {
                msg += "\n**" + func[i].NAME + " (All functions are startwith '" + func[i].STARTWITH + "')**";
                var j;
                for(j=0; j<func[i].FUNCTIONS.length; j++) {
                  msg += "\n" + func[i].STARTWITH + func[i].FUNCTIONS[j].CODE + "\t\t\t" + func[i].FUNCTIONS[j].DESCRIPTION;
                }
            }
            msg = msg + "\n\n**All commands are CASE INSENSITIVE**";
            sendMessageToChannel(message.channel, msg);
        } else {
            var i;
            for(i=0; i<func.length; i++) {
                var j;
                for(j=0; j<func[i].FUNCTIONS.length; j++) {
                  if(token[1].toUpperCase() === func[i].FUNCTIONS[j].CODE) {
                      if(token.length > 2 && token[2].toUpperCase() === "-D") {
                        message.reply("{" + func[i].STARTWITH + func[i].FUNCTIONS[j].SYNTAX + "}\n\n" + func[i].FUNCTIONS[j].MANUAL);
                      } else {
                        message.reply("{" + func[i].STARTWITH + func[i].FUNCTIONS[j].SYNTAX + "}");
                      }
                      return;
                  }
                }
            }
            message.reply("Command not found");
        }
    }
}

var func_ready = {      //Ready function
  
    CODE : "READY",
  
    DESCRIPTION : "Test for the bot is online",
  
    SYNTAX : "READY",
  
    MANUAL : "",
  
    LOGIC : function(token, message) {
        message.reply('YES!Updated time = ' + update_time);
    }
}

var func_addmusic = {
  
    CODE : "ADDMUSIC",
  
    DESCRIPTION : "Add new music to the database",
  
    SYNTAX : "ADDMUSIC | music_code | URL | ***[optional] default_volume(float between 0 to 1)***",
   
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
  
    SYNTAX : "SEARCHMUSIC | [optional] searching keyword",
  
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

            sendMessageToChannel(message.channel, display_str);
        }).catch((err) => {
            message.reply("Something error! Please refer to the log on Heroku");
            console.log(err);
        });
    }
  
}

var func_play = {
  
    CODE : "PLAY",
   
    DESCRIPTION : "Add music to the music queue and play if no music playing",
   
    SYNTAX : "PLAY | music_code | [optional] volume(float between 0 to 1)",

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
  
    SYNTAX : "ADDPLAYLIST | playlist_name",
  
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
  
    SYNTAX : "ADDMUSICTOPL | music_code | playlist_name",
  
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
  
    SYNTAX : "PLAYLIST | playlist_name | [optional]-RAND",
  
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
  
    SYNTAX : "PLAYQUEUE",
  
    MANUAL : "",
  
    LOGIC : function(token, message) {
        if(now_playing_music === null) {
          message.reply("No music playing"); 
        } else {
          if(playqueue_message) {
              playqueue_message.delete();
              playqueue_message = "";
          }
          sendMessageToChannel(message.channel, "Now loading");
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
  
    SYNTAX : "MUSICDETAIL | [optional]-CLEAR",
  
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
          sendMessageToChannel(message.channel, "Now loading");
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

    SYNTAX : "STOP",

    MANUAL : "",
  
    LOGIC : function(token, message) {
        music_queue = [];
        dispatcher.end();
    }
}

var func_next = {
  
    CODE : "NEXT",
  
    DESCRIPTION : "Play the next music in the queue. (Stop if no music in the queue)",
  
    SYNTAX : "NEXT",
  
    MANUAL : "",
  
    LOGIC : function(token, message) {
        dispatcher.end();
    }
  
}

var func_pause = {
    
    CODE : "PAUSE",
  
    DESCRIPTION : "Pause the music.",
  
    SYNTAX : "PAUSE",
  
    MANUAL : "",
  
    LOGIC : function(token, message) {
        dispatcher.pause(); 
    }
  
}

var func_resume = {
  
    CODE : "RESUME", 
  
    DESCRIPTION : "Resume playing music.",
  
    SYNTAX : "RESUME",
  
    MANUAL : "",
  
    LOGIC : function(token, message) {
        dispatcher.resume(); 
    }
  
}

var func_volume = {
 
    CODE : "VOLUME",
  
    DESCRIPTION : "Adjust master volume",
  
    SYNTAX : "VOLUME | volume(float between 0 to 1)",
  
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
  
    SYNTAX : "LOOP | isLoop(boolean:'T'/'TRUE'/'F'/'FALSE')",
  
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
  
    SYNTAX : "SETNAME | nickname",
  
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
            UpdateUsers();
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
  
    SYNTAX : "SHOWVOTE | [optional] -ALL",
  
    MANUAL : "***-ALL : ***[Optional] Add the command if you want to show expired votes",
  
    LOGIC : function(token, message) {
      
        var data = {
          expire: (token.length > 1 && token[1].toUpperCase() === "-ALL")?1:0
        }
        POSTtoPHP(data, "GetVote").then((res) => {
            var result = JSON.parse(res);
            //console.log("result=" + result);
            if(result.length === 0) {
                message.reply("No result");
                return;
            }
            var msg = "1)\t" + result[0].TITLE + "(" + result[0].id + ")\t" + result[0].EXPIRE_DATE + "\t" + result[0].DESCRIPTION;
            for(var i=2; i<=result.length; i++) {
                 msg = msg + "\n" + i + ")\t" + result[i-1].TITLE + "(" + result[i-1].id + ")\t" + result[i-1].EXPIRE_DATE + "\t"+ result[i-1].DESCRIPTION;
            }
            //console.log("msg=" + msg);
            sendMessageToChannel(message.channel, msg);
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
      
        var data = {
          title: token[1],
          expire_date: token[2],
          create_user_id: GetUserID(message.author.id)
        }
        if(token.length > 3) {
          data["max_vote"] = token[3]; 
        }
        POSTtoPHP(data, "NewVote").then((res) => {
            if(res === "success") {
              message.reply("New Vote added successfully!"); 
            } else {
              message.reply(res); 
            }
        }).catch((err) => {
            message.reply("Something error! Please refer to the log on Heroku");
            console.log(err);
        });
    }
  
}

var func_clear = {
 
    CODE : "CLEAR",
  
    DESCRIPTION : "Clear the commands and message that call bot or create by bot",
  
    SYNTAX : "CLEAR | [optional](amount(int) || ON/OFF ('T'/'TRUE'/'F'/'FALSE'))",
  
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
              var isCommand = false;
              var i;
              for(i=0; i<func.length; i++) {
                  if(msg.content.charAt(0) === func[i].STARTWITH) {
                      isCommand = true; 
                  }
              }
              if(isCommand || msg.author.id === client.user.id) {
                msg.delete();
                console.log("Message: \"" + msg.content + "\" deleted");
              }
            })
            message.delete();
          })
          .catch(console.error);
      } else if(token[1].toUpperCase() === 'T' || token[1].toUpperCase() === 'TRUE') {
        if(!clear_command.includes(message.channel.id)) {
          clear_command.push(message.channel.id); 
        }
      } else {
        if(clear_command.includes(message.channel.id)) {
          clear_command.splice(clear_command.indexOf(message.channel.id), 1); 
        }
      }
    }
  
}

var func_sql = {
 
    CODE : "SQL",
  
    DESCRIPTION : "Direct execute SQL",
  
    SYNTAX : "SQL | sql_command",
  
    MANUAL : "**sql_command : **The SQL command you want to execute"
            +"\n**The display of SELECT will be in JSON format"
            +"\n**This command can only apply on 'hoiseiratommybot' database, but no the fleet one",
  
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
              /*result_str = "";
              for(let a=0; a<result.length; a++) {
                  result_str = result_str + decodeURIComponent(JSON.stringify(result[i])); 
              }
              message.channel.send(result_str);*/
              //message.channel.send(JSON.stringify(result).replace(/%22/g, '"'));
              sendMessageToChannel(message.channel, JSON.stringify(result).replace(/"/g, ' " ').replace(/},{/g, '}\n{'));
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
  
    SYNTAX : "TEST",
  
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
        /*var data = {
          expire: (token[1] && token[1] === "T")?1:0
        }
        POSTtoPHP(data, "GetVote").then((res) => {
            var result = JSON.parse(res);
            //console.log("result=" + result);
            if(result.length === 0) {
                message.reply("No result");
                return;
            }
            var msg = "1)\t" + result[0].TITLE + "(" + result[0].id + ")\t"+ result[0].DESCRIPTION;
            for(var i=2; i<=result.length; i++) {
                 msg = msg + "\n" + i + ")\t" + result[i-1].TITLE + "(" + result[i-1].id + ")\t" + result[i-1].DESCRIPTION;
            }
            //console.log("msg=" + msg);
            sendMessageToChannel(message.channel, msg);
        }).catch((err) => {
            message.reply("Something error! Please refer to the log on Heroku");
            console.log(err);
        });;*/
        /*httpRequest("http://api.kcwiki.moe/ship/1").then((res) => {
            console.log(res);
            let temp_array = JSON.parse(res);
            console.log("temp_array.name=" + temp_array.name);
        }).catch((err) => {
            console.log(err);
        });*/
        console.log("Guild id: " + message.guild.id);

    }
  
}

var func_createfleet = {
 
    CODE : "CREATEFLEET",
  
    DESCRIPTION : "Create a new fleet to store the fleet info",
  
    SYNTAX : "CREATEFLEET | fleet_name | [optional]tag(s)",
  
    MANUAL : "**fleet_name : **The name of the fleet."
            +"\n***tag(s) : ***[Optional] You can add tags to the fleet for searching (Max: 5tags).",
  
    LOGIC : function(token, message) {
        if(token.length < 2) {
            message.reply("Incorrect Syntax!\n" + this.SYNTAX);
            return;
        }
        
        var sql = "INSERT INTO Fleet (`name`, provider) VALUES ('" + token[1] + "', '" + message.author.id + "')"/*; SELECT id FROM Fleet ORDER BY id DESC LIMIT 1"*/;
        DB4FREE(sql).then((res) => {
            var fleet_id = res.insertId;
            if(token.length > 2) {
                var sql2 = "INSERT INTO Fleet_Tag (tag, fleet_id) VALUES ('" + token[2] + "', " + fleet_id + ")";
                var i;
                for(i=3; i<token.length && i<7; i++) {
                    sql2 += "; INSERT INTO Fleet_Tag (tag, fleet_id) VALUES ('" + token[i] + "', " + fleet_id + ")";
                }
                DB4FREE(sql2).then((res2) => {
                    message.reply("Create successully! The fleet id is " + fleet_id + ".");
                }).catch((err) => {
                    message.reply("Something error! Please refer to the log on Heroku");
                    console.log(err);
                });
            } else {
                message.reply("Create successully! The fleet id is " + fleet_id + ".");
            }
        }).catch((err) => {
            message.reply("Something error! Please refer to the log on Heroku");
            console.log(err);
        });
    }
  
}

var func_addfleet = {
 
    CODE : "ADDFLEET",
  
    DESCRIPTION : "Add fleet in JSON format(such as provided by poooi)",
  
    SYNTAX : "ADDFLEET | fleet_name | [json_file(without space)] | tag(s)",
  
    MANUAL : "**fleet_name : **The name of the fleet."
            +"\n*json_file : **The input file of fleet in JSON format(do not exceed 2000 characters)."
            +"\n***tag(s) : ***[Optional] You can add tags to the fleet for searching (Max: 5tags)."
            +"\nJSON Format: [{fleets : [[{ship1_in_fleet1(id, lv, slots:[{slot1, slot2..}]), {ship2}..], "
            +"[{ship1_in_fleet2}, {ship2}..]]}]",
  
    LOGIC : function(token, message) {
        if(token.length < 3) {
            message.reply("Incorrect Syntax!\n" + this.SYNTAX);
            return;
        }
      
        var sql = "INSERT INTO Fleet (`name`, provider) VALUES ('" + token[1] + "', '" + message.author.id + "')"
        DB4FREE(sql).then((res) => {
            var fleet_id = res.insertId;
            var json_data = JSON.parse(token[2]).fleets;
            var i, j, k;
            var sql2 = "";
            for(i=0; i<json_data.length; i++) {
                if(i !== 0) {
                    sql2 += "; ";
                }
                for(j=0; j<json_data[i].length; j++) {
                    sql2 += "INSERT INTO Fleet_Member(ship_id, ship_lv, fleet_id, item1, item1lv, item1alv"
                          +", item2, item2lv, item2alv, item3, item3lv, item3alv, item4, item4lv, item4alv"
                          +", item5, item5lv, item5alv) VALUES (" + json_data[i][j].id
                          +", " + json_data[i][j].lv + ", " + fleet_id;
                    for(k=0; k<5; i++) {
                        if(j < json_data[i][j].slot.length) {
                            sql2 += ", " + json_data[i][j].slot[k].id + ", " + json_data[i][j].slot[k].lv;
                            if(json_data[i].slot[k].alv !== undefined) {
                                sql2 += ", " + json_data[i][j].slot[k].alv;   
                            } else {
                                sql2 += ", 0";
                            }
                        } else {
                            sql2 += ", null, null, null";   
                        }
                    }
                }
            }
            
            if(token.length > 3) {
                for(i=3; i<token.length && i<8; i++) {
                    sql2 += "; INSERT INTO Fleet_Tag (tag, fleet_id) VALUES ('" + token[i] + "', " + fleet_id + ")";
                }
            }
            DB4FREE(sql2).then((res2) => {
                message.reply("Create successully! The fleet id is " + fleet_id + ".");
            }).catch((err) => {
                message.reply("Something error! Please refer to the log on Heroku");
                console.log(err);
            });
        }).catch((err) => {
            message.reply("Something error! Please refer to the log on Heroku");
            console.log(err);
        });
    }
  
}

var func_editfleettag = {
 
    CODE : "EDITFLEETTAG",
  
    DESCRIPTION : "Edit the tags of fleet",
  
    SYNTAX : "EDITFLEETTAG | fleet_id | (+/-)tag(s)",
  
    MANUAL : "**fleet_id : **The internal id of fleet in database.(You can find by %searchfleet)"
            +"\n**(+/-)tag(s) : **Add new or Delete existing Tag with prefix(+ OR -)."
            +"\nYou can edit at most 5, at least 1 tag(s) at same time.",
  
    LOGIC : function(token, message) {
        if(token.length < 3) {
            message.reply("Incorrect Syntax!\n" + this.SYNTAX);
            return;
        }
        
        var i;
        var sql = "";
        for(i=2; i<token.length && i<7; i++) {
            if(i !== 2) {
                sql += "; ";
            }
            if(token[i].charAt(0) === "+") {
                sql += "INSERT INTO Fleet_Tag (tag, fleet_id) VALUES ('" + token[i].substring(1) + "', " + token[1] + ")";
            } else if (token[i].charAt(0) === "-") {
                sql += "DELETE FROM Fleet_Tag WHERE tag = '" + token[i].substring(1) + "' AND fleet_id = " + token[1];
            } else {
                throw "Please use prefix (+/-)!"; 
            }
        }
        DB4FREE(sql).then((res) => {
            message.reply("Tags edited successfully!");
        }).catch((err) => {
            message.reply("Something error! Please refer to the log on Heroku");
            console.log(err);
        });
    }
  
}

var func_searchship = {
  
    CODE : "SEARCHSHIP",
  
    DESCRIPTION : "Search the ship database by id or name",
  
    SYNTAX : "SEARCHSHIP | id/name(in kanji, romaji, hiragana or in traditional chinese)",
  
    MANUAL : "**id/name : **The keyword to search from database."
            +"\n**The whole keyword will be convert to number will counted as id. If you want to search with some name in number,"
            +" please start the keyword with '%'. For example, search ro-500 with '%500' instead of '500' and you can also"
            +" use this wildcard '%' in searching such as 'Sara%Mod.2' to search for 'Saratoga Mk.II Mod.2' instead of only"
            +" 'Saratoga Mk.II'.**",
  
    LOGIC : function(token, message) {
        if(token.length < 2) {
            message.reply("Incorrect Syntax!\n" + this.SYNTAX);
            return;
        }
        var sql = "";
        if(isNaN(token[1])) {
            sql = "SELECT id, ja_jp, ja_kana, ja_romaji, zh_tw FROM Ship WHERE "
                  +"ja_jp LIKE '%" + token[1] + "%' OR "
                  +"ja_kana LIKE '%" + token[1] + "%' OR "
                  +"ja_romaji LIKE '%" + token[1] + "%' OR "
                  +"zh_tw LIKE '%" + token[1] + "%'";
        } else {
            sql = "SELECT id, ja_jp, ja_kana, ja_romaji, zh_tw FROM Ship WHERE id = " + parseInt(token[1]);
        }
        sql += " ORDER BY LENGTH(ja_jp) ASC";
        DB4FREE(sql).then((res) => {
            var display_str = "";
            if(res.length === 0) {
                message.reply("No result!"); 
            } else {
                display_str += "[" + res[0].id + "]" + res[0].ja_jp + "(" + res[0].ja_kana + "/" + res[0].ja_romaji + "/" + res[0].zh_tw + ")"; 
            }
            var i;
            for(i=1; i<res.length; i++) {
                display_str += "\n[" + res[i].id + "]" + res[i].ja_jp + "(" + res[i].ja_kana + "/" + res[i].ja_romaji + "/" + res[i].zh_tw + ")";
            }
            sendMessageToChannel(message.channel, display_str);
        }).catch((err) => {
            message.reply("Something error! Please refer to the log on Heroku");
            console.log(err);
        })
    }
  
}

var func_searchitem = {
  
    CODE : "SEARCHITEM",
  
    DESCRIPTION : "Search the item database by id or name",
  
    SYNTAX : "SEARCHITEM | id/name(in kanji, romaji, hiragana or in traditional chinese)",
  
    MANUAL : "**id/name : **The keyword to search from database."
            +"\n**The whole keyword can be convert to number will counted as id, if you want to search with some name in number,"
            +" please start the keyword with '%'. For example, search Re.2005 改 with '%2005' instead of '2005' and you can also"
            +" use this wildcard '%' in searching such as '零%観' to search for '零式水上観測機' skipping some of the words.**",
  
    LOGIC : function(token, message) {
        if(token.length < 2) {
            message.reply("Incorrect Syntax!\n" + this.SYNTAX);
            return;
        }
        var sql = "";
        if(isNaN(token[1])) {
            sql = "SELECT id, ja_jp FROM Item WHERE ja_jp LIKE '%" + token[1] + "%'";
        } else {
            sql = "SELECT id, ja_jp FROM Item WHERE id = " + parseInt(token[1]);
        }
        sql += " ORDER BY LENGTH(ja_jp) ASC";
        DB4FREE(sql).then((res) => {
            var display_str = "";
            if(res.length === 0) {
                message.reply("No result!"); 
            } else {
                display_str += "[" + res[0].id + "]" + res[0].ja_jp; 
            }
            var i;
            for(i=1; i<res.length; i++) {
                display_str += "\n[" + res[i].id + "]" + res[i].ja_jp;
            }
            sendMessageToChannel(message.channel, display_str);
        }).catch((err) => {
            message.reply("Something error! Please refer to the log on Heroku");
            console.log(err);
        })
    }
  
}

var func_searchfleet = {
 
    CODE : "SEARCHFLEET",
    
    DESCRIPTION : "Search the fleet database by name or tag",
  
    SYNTAX : "SEARCHFLEET | [optional]keyword",
  
    MANUAL : "***keyword : ***[Optional] keyword for searching.",
  
    LOGIC : function(token, message) {
        var sql = "SELECT Fleet.id, Fleet.name, Fleet.provider, Fleet_Tag.tag FROM Fleet LEFT JOIN Fleet_Tag ON Fleet.id = Fleet_Tag.fleet_id";
        if(token.length > 1) {
          sql += " WHERE Fleet.name LIKE '%" + token[1] + "%' OR Fleet.id in (SELECT fleet_id FROM Fleet_Tag WHERE tag LIKE '%" + token[1] + "%')";
        }
        sql += " ORDER BY Fleet.id ASC";
        DB4FREE(sql).then((res) => {
            var fleets = [];
            var i, j, k
            for(i=0; i<res.length; i++) {
                j = -1;
                for(k=0; k<fleets.length; k++) {
                    if(res[i].id === fleets[k].id) {
                        j = k; 
                    }
                }
                if(j + 1) {
                  fleets[j].tags.push(...[res[i].tag]);
                } else {
                  let new_fleet = [{ id: res[i].id, name: res[i].name, provider: GetUserName(res[i].provider)}];
                  let tags;
                  if(res[i].tag === null) {
                      tags = null;
                  } else {
                      tags = [res[i].tag]; 
                  }
                  new_fleet[0].tags = tags;
                  fleets.push(...new_fleet);
                }
            }
            if(fleets.length > 0) {
              var display_str = "**Please choose one fleet**";
              for(i=0; i<fleets.length; i++) {
                  display_str += "\n" + (i+1) + ")\t[" + fleets[i].id + "]" + fleets[i].name;
                  if(fleets[i].tags !== null) {
                      display_str += "(" + fleets[i].tags[0];
                      for(j=1; j<fleets[i].tags.length; j++) {
                          display_str += "/" + fleets[i].tags[j]; 
                      }
                      display_str += ")";
                  }
                  display_str += " BY " + fleets[i].provider;
              }
              sendMessageToChannel(message.channel, display_str).then((res2) => {
                displaying_menu = { MESSAGE: res2,
                                    FLEET: fleets,
                                    CHANNEL_ID: message.channel.id,
                                    LOGIC: function(token2, msg) {
                                      if(isNaN(token2)) {
                                        msg.delete();
                                        //console.log("res3=" + util.inspect(this.MESSAGE,{depth:null}));
                                        this.MESSAGE.delete();
                                        return;
                                      } else {
                                        var option = parseInt(token2);
                                        if(option < 1 || option > this.FLEET.length) {
                                          msg.delete();
                                          //console.log("res3=" + util.inspect(this.MESSAGE,{depth:null}));                                        
                                          this.MESSAGE.delete();
                                          return;
                                        } else {
                                          var selected_fleet = this.FLEET[option-1];
                                          var sql2 = "SELECT s.ja_jp, m.ship_lv, s.slot, s.los ship_los, s.los_max ship_los_max, "
                                                    +"s1.ja_jp item1, s1.type item1type, s1.aa item1aa, s1.los item1los, m.item1lv, m.item1alv, "
                                                    +"s2.ja_jp item2, s2.type item2type, s2.aa item2aa, s2.los item2los, m.item2lv, m.item2alv, "
                                                    +"s3.ja_jp item3, s3.type item3type, s3.aa item3aa, s3.los item3los, m.item3lv, m.item3alv, "
                                                    +"s4.ja_jp item4, s4.type item4type, s4.aa item4aa, s4.los item4los, m.item4lv, m.item4alv, "
                                                    +"s5.ja_jp item5, s5.type item5type, s5.aa item5aa, s5.los item5los, m.item5lv, m.item5alv, "
                                                    +"s6.ja_jp item6, s6.type item6type, s6.aa item6aa, s6.los item6los, m.item6lv, m.item6alv"
                                                    +" FROM Fleet_Member m INNER JOIN Ship s ON m.ship_id = s.id "
                                                    +" LEFT JOIN Item s1 ON m.item1 = s1.id"
                                                    +" LEFT JOIN Item s2 ON m.item2 = s2.id"
                                                    +" LEFT JOIN Item s3 ON m.item3 = s3.id"
                                                    +" LEFT JOIN Item s4 ON m.item4 = s4.id"
                                                    +" LEFT JOIN Item s5 ON m.item5 = s5.id"
                                                    +" LEFT JOIN Item s6 ON m.item6 = s6.id"
                                                    +" WHERE fleet_id = " + selected_fleet.id;
                                          DB4FREE(sql2).then((res3) => {
                                            var tags = "";
                                            let a;
                                            for(a=0; a<selected_fleet.tags.length; a++) {
                                              tags += selected_fleet.tags[a] + " ";
                                            }
                                            var embed_msg = {
                                                                embed:{
                                                                    color: 3447003,
                                                                    author: {name: client.user.username},
                                                                    title: selected_fleet.name,
                                                                    description: tags,
                                                                    fields: []
                                                                 }
                                                            }
                                            var ship;
                                            let los_ship = 0;
                                            let los_item = 0;
                                            let aa = 0;
                                            let min_aa = 0;
                                            let max_aa = 0;
                                            for(a=0; a<res3.length; a++) {
                                                ship = {
                                                        name: (a+1) + ")\t" + res3[a].ja_jp + (res3[a].ship_lv === null?"":" LV" + res3[a].ship_lv),
                                                        value: ""
                                                       }
                                                let slot_token = res3[a].slot.split("/");
                                                los_ship += Math.sqrt((res3[a].ship_los_max - res3[a].ship_los) * (res3[a].ship_lv === null?1:res3[a].ship_lv) / 99 + res3[a].ship_los);
                                                if(res3[a].item1 !== null) {
                                                  ship.value += "[" + checkStringUndefined(slot_token[0]) + "]" + res3[a].item1 + ((res3[a].item1lv > 0)?" \u2606" + res3[a].item1lv:"") + convertALVtoSymbol(res3[a].item1alv);
                                                  los_item += getLosByItem(res3[a].item1type, res3[a].item1los, res3[a].item1lv);
                                                  aa += getAAByItem(slot_token[0], res3[a].item1type, res3[a].item1aa, res3[a].item1lv, res3[a].item1alv);
                                                  min_aa += getMinAAByItem(slot_token[0], res3[a].item1type, res3[a].item1aa, res3[a].item1lv, res3[a].item1alv);
                                                  max_aa += getMaxAAByItem(slot_token[0], res3[a].item1type, res3[a].item1aa, res3[a].item1lv, res3[a].item1alv);
                                                  if(res3[a].item2 !== null) {
                                                    ship.value += "\n[" + checkStringUndefined(slot_token[1]) + "]" + res3[a].item2 + ((res3[a].item2lv > 0)?" \u2606" + res3[a].item2lv:"") + convertALVtoSymbol(res3[a].item2alv);
                                                    los_item += getLosByItem(res3[a].item2type, res3[a].item2los, res3[a].item2lv);
                                                    aa += getAAByItem(slot_token[1], res3[a].item2type, res3[a].item2aa, res3[a].item2lv, res3[a].item2alv);
                                                    min_aa += getMinAAByItem(slot_token[1], res3[a].item2type, res3[a].item2aa, res3[a].item2lv, res3[a].item2alv);
                                                    max_aa += getMaxAAByItem(slot_token[1], res3[a].item2type, res3[a].item2aa, res3[a].item2lv, res3[a].item2alv);
                                                    if(res3[a].item3 !== null) {
                                                      ship.value += "\n[" + checkStringUndefined(slot_token[2]) + "]" + res3[a].item3 + ((res3[a].item3lv > 0)?" \u2606" + res3[a].item3lv:"") + convertALVtoSymbol(res3[a].item3alv);
                                                      los_item += getLosByItem(res3[a].item3type, res3[a].item3los, res3[a].item3lv);
                                                      aa += getAAByItem(slot_token[2], res3[a].item3type, res3[a].item3aa, res3[a].item3lv, res3[a].item3alv);
                                                      min_aa += getMinAAByItem(slot_token[2], res3[a].item3type, res3[a].item3aa, res3[a].item3lv, res3[a].item3alv);
                                                      max_aa += getMaxAAByItem(slot_token[2], res3[a].item3type, res3[a].item3aa, res3[a].item3lv, res3[a].item3alv);
                                                      if(res3[a].item4 !== null) {
                                                        ship.value += "\n[" + checkStringUndefined(slot_token[3]) + "]" + res3[a].item4 + ((res3[a].item4lv > 0)?" \u2606" + res3[a].item4lv:"") + convertALVtoSymbol(res3[a].item4alv);
                                                        los_item += getLosByItem(res3[a].item4type, res3[a].item4los, res3[a].item4lv);
                                                        aa += getAAByItem(slot_token[3], res3[a].item4type, res3[a].item4aa, res3[a].item4lv, res3[a].item4alv);
                                                        min_aa += getMinAAByItem(slot_token[3], res3[a].item4type, res3[a].item4aa, res3[a].item4lv, res3[a].item4alv);
                                                        max_aa += getMaxAAByItem(slot_token[3], res3[a].item4type, res3[a].item4aa, res3[a].item4lv, res3[a].item4alv);
                                                        if(res3[a].item5 !== null) {
                                                          ship.value += "\n[" + checkStringUndefined(slot_token[4]) + "]" + res3[a].item5 + ((res3[a].item5lv > 0)?" \u2606" + res3[a].item5lv:"") + convertALVtoSymbol(res3[a].item5alv);
                                                          los_item += getLosByItem(res3[a].item5type, res3[a].item5los, res3[a].item5lv);
                                                          aa += getAAByItem(slot_token[4], res3[a].item5type, res3[a].item5aa, res3[a].item5lv, res3[a].item5alv);
                                                          min_aa += getMinAAByItem(slot_token[4], res3[a].item5type, res3[a].item5aa, res3[a].item5lv, res3[a].item5alv);
                                                          max_aa += getMaxAAByItem(slot_token[4], res3[a].item5type, res3[a].item5aa, res3[a].item5lv, res3[a].item5alv);
                                                          if(res3[a].item6 !== null) {
                                                            ship.value += "\n[" + checkStringUndefined(slot_token[5]) + "]" + res3[a].item6 + ((res3[a].item6lv > 0)?" \u2606" + res3[a].item6lv:"") + convertALVtoSymbol(res3[a].item6alv);
                                                            los_item += getLosByItem(res3[a].item6type, res3[a].item6los, res3[a].item6lv);
                                                          }
                                                        }
                                                      }
                                                    }   
                                                  }
                                                }
                                                embed_msg.embed.fields.push(ship);
                                            }
                                            let no_of_ship = embed_msg.embed.fields.length;
                                            embed_msg.embed.fields.push({name: "索敵(33式):", value: (los_ship + los_item - 48 + 2 * (6 - no_of_ship)).toFixed(2) + "(n=1)/"
                                                             +(los_ship + 3 * los_item - 48 + 2 * (6 - no_of_ship)).toFixed(2) + "(n=3)/"
                                                             +(los_ship + 4 * los_item - 48 + 2 * (6 - no_of_ship)).toFixed(2) + "(n=4)"});
                                            embed_msg.embed.fields.push({name: "制空:", value: Math.floor(aa) + "(" + Math.floor(min_aa) + "~" + Math.floor(max_aa) + ")"});
                                            this.MESSAGE.delete();
                                            msg.channel.send(embed_msg);
                                            msg.delete();
                                          }).catch((err) => {
                                            msg.reply("Something error! Please refer to the log on Heroku");
                                            msg.delete();
                                            console.log(err)  ;
                                          })
                                        }
                                      }
                                    }
                                  }
              }).catch((err) => {
                message.reply("Something error! Please refer to the log on Heroku");
                console.log(err);
              });
            } else {
              sendMessageToChannel(message.channel, "No result");
            }
        }).catch((err) => {
            message.reply("Something error! Please refer to the log on Heroku");
            console.log(err);
        });
    }
  
}

var func_editfleetmember = {
  
    CODE : "EDITFLEETMEMBER",
  
    DESCRIPTION : "Add, delete or modify member(s) of a fleet",
  
    SYNTAX : "EDITFLEETMEMBER | fleet_id | [[(+/-/~)member1 | item1 | item2 ...] [(+/-/~)member2 | item1 | item2 ...]...]",
  
    MANUAL : "**fleet_id : **The internal id of fleet in database.(You can find by %searchfleet)"
            +"\n**(+/-/~)member(s) : **Add new, delete or modify existing member from fleet. Manual below : "
            +"\nFor delete members(-): Only need to add internal ship_id(in kancolle db) or part/full name of ship which can identify the ship name."
            +" Also, you can use a bracket ({}) to indicate the fleet number (1 ~ 7) of a fleet. No need to input items."
            +"\n***For example: -呂500 OR -436LV OR -{2}(which indicates the second member of this fleet)***"
            +"\nFor add members(+): You can append the item id or part/fullname of item which can identify th item name in the following format:"
            +"\n**+[ship] [item1] [item2]...**"
            +"\nYou can put LV after the ship searching keyword the set the level of member, which is useful for los calculation."
            +"\nUse @ to identify the \u2606 and (|OR\\\\OR>>) to identify the skill level of flight(Please use '\\' instead of '/')"
            +"\n***For example: +大淀改LV127 (3号)@9 (3号)@9 零式水上観@10>> WG42 +%500LV99 8門 8門***"
            +"\nFor modify members: Please use a bracket ({}) to indicate which member you need to modify. Then, input the information as "
            +"adding member except the (+) prefix. Last, if the information is no need to change in specify column, you can put a (=) instead."
            +"\n***For example: ~{2} = = = 53型@10>> = = This will only change the third item of second member in the fleet***"
            +"\n**Please remember to put (=) after the column you want to modify. Otherwise, the column doesn't put a (=) will change to null(item not set)**"
            +"\n\n**You can put wildcard '%' into name you want to search such as 零%観, system will default search like '%keyword%' "
            +"and will save the item with the shortest name in japanese if mulitple results provide by the confusing searching keyword"
            +"\n**For example: search by '16inch%Mk.7' will give '16inch三連装砲 Mk.7' and '16inch三連装砲 Mk.7+GFCS'. By default sorting"
            +", the system will take it as '16inch三連装砲 Mk.7' since it has a shorter length in name.**",
  
    LOGIC : function(input_token, message) {
        var token = input_token;
        if(token.length < 3) {
            message.reply("Incorrect Syntax!\n" + this.SYNTAX);
            return;
        }
        
        var sql = "";
        var fleet_id = token[1];
        var i;
        for(i=2; i<token.length; i++) {
            token [i] = token[i].replace(/&&/g, ' ');
        }
        for(i=2; i<token.length; i++) {
            var j;        
            if(token[i].charAt(0) === "-") {
                if(i !== 2) {
                    sql += "; ";
                }
                if(token[i].includes("{") && token[i].includes("}")) {
                  let no = parseInt(token[i].substring(token[i].indexOf("{")+1, token[i].indexOf("}")));
                  sql += "DELETE FROM Fleet_Member WHERE fleet_id = " + fleet_id
                        +" AND fleet_id IN (SELECT id FROM (SELECT id FROM Fleet WHERE provider = '" + message.author.id + "') tmp)"
                        +" AND id IN (SELECT id FROM (SELECT id FROM Fleet_Member WHERE fleet_id = " + fleet_id
                        +" ORDER BY id ASC LIMIT " + (no-1) + ", 1) tm2)";
                } else if(isNaN(token[i].substring(1))) {
                  let fleet_name = token[i].substring(1);
                  sql += "DELETE FROM Fleet_Member WHERE fleet_id = " + fleet_id 
                        +" AND fleet_id IN (SELECT id FROM (SELECT id FROM Fleet WHERE provider = '" + message.author.id + "') tmp)"
                        +" AND ship_id IN (SELECT id FROM (SELECT id FROM Ship WHERE ja_jp LIKE '%" + fleet_name + "%' OR"
                        +" ja_kana LIKE '%" + fleet_name + "%' OR ja_romaji LIKE '%" + fleet_name + "%' OR"
                        +" zh_tw LIKE '%" + fleet_name + "%') tmp2)";
                } else {
                  sql += "DELETE FROM Fleet_Member WHERE ship_id = " + parseInt(token[i].substring(1)) + " AND fleet_id = " + fleet_id;
                }
            } else if (token[i].charAt(0) === "+") {
                if(i !== 2) {
                   sql += "; ";
                }
                var nextShipIdx = token.length;
                for(j=token.length-1; j>i+1; j--) {
                   if(token[j].charAt(0) === "+" || token[j].charAt(0) === "-" || token[j].charAt(0) === "~") {
                      nextShipIdx = j;
                   }
                }
                var ship_name_token = token[i].substring(1).split("LV");
                sql += "INSERT INTO Fleet_Member (fleet_id, ship_id, ship_lv";
                for(j=1; j<nextShipIdx-i; j++) {
                    sql += ", item" + j + ", item" + j + "lv, item" + j + "alv";
                }
                sql += ") SELECT " + fleet_id + ", s.id, " + (ship_name_token[1] === undefined?null:ship_name_token[1]);
                var table_name = ['a', 'b', 'c', 'd', 'e', 'f'];
                for(j=i+1; j<nextShipIdx; j++) {
                    let alv = 0;
                    if(token[j].includes(">>")) {
                       alv = 7; 
                       token [j] = token[j].replace(">>", "");
                    } else if (token[j].includes("\\\\\\")) {
                       alv = 6;
                       token [j] = token[j].replace("\\\\\\", "");
                    } else if (token[j].includes("\\\\")) {
                       alv = 5;
                       token [j] = token[j].replace("\\\\", "");
                    } else if (token[j].includes("\\")) {
                       alv = 4;
                       token [j] = token[j].replace("\\", "");
                    } else if (token[j].includes("|||")) {
                       alv = 3;
                       token [j] = token[j].replace("|||", "");
                    } else if (token[j].includes("||")) {
                       alv = 2;
                       token [j] = token[j].replace("||", "");
                    } else if (token[j].includes("|")) {
                       alv = 1;
                       token [j] = token[j].replace("|", "");
                    }    //Convert air level symbol to int
                    var temp = token[j].split("@");  //Split item name from level if it has
                    token[j] = temp[0];
                    sql += ", " + table_name[j-i-1] + ".id, " + (temp[1] === undefined?0:parseInt(temp[1])) + ", " + alv;
                }
                sql += " FROM Ship s, Fleet fl";
                for(j=i+1; j<nextShipIdx; j++) {
                    sql += ", Item " + table_name[j-i-1];
                }
                if(isNaN(ship_name_token[0])) {
                  sql += " WHERE (s.ja_jp LIKE '%" + ship_name_token[0] + "%' OR"
                        +" s.ja_kana LIKE '%" + ship_name_token[0] + "%' OR"
                        +" s.ja_romaji LIKE '%" + ship_name_token[0] + "%' OR"
                        +" s.zh_tw LIKE '%" + ship_name_token[0] + "%')";   //Search ship by name in different format
                } else {
                  sql += " WHERE s.id = " + parseInt(ship_name_token[0], 10);
                }
                for(j=i+1; j<nextShipIdx; j++) {
                     if(isNaN(token[j])) {
                       sql += " AND (" + table_name[j-i-1] + ".ja_jp LIKE '%" + token[j] + "%' OR "
                         + table_name[j-i-1] + ".zh_tw LIKE '%" + token[j] + "%')";    //Search item by ja_jp name or zh_tw name
                     } else {
                       sql += " AND " + table_name[j-i-1] + ".id = " + parseInt(token[j], 10);   //Search item by id
                     }
                }
                sql += " AND fl.provider = '" + message.author.id + "' ORDER BY LENGTH(s.ja_jp)";
                for(j=i+1; j<nextShipIdx; j++) {
                    sql += ", LENGTH(" + table_name[j-i-1] + ".ja_jp) "; 
                }
                sql += " ASC LIMIT 1";
                i = nextShipIdx - 1;
            } else if(token[i].charAt(0) === "~") {
                if(i !== 2) {
                   sql += "; ";
                }
                let no = parseInt(token[i].substring(token[i].indexOf("{")+1, token[i].indexOf("}")));
                var nextShipIdx = token.length;
                for(j=token.length-1; j>i+1; j--) {
                   if(token[j].charAt(0) === "+" || token[j].charAt(0) === "-" || token[j].charAt(0) === "~") {
                      nextShipIdx = j;
                   }
                }
                sql += "UPDATE Fleet_Member fm, Fleet fl";
                j = i + 1;
                if(token[j] !== "=") {
                    sql += ", Ship s";
                }
                var table_name = ['a', 'b', 'c', 'd', 'e', 'f'];
                for(j=i+2; j<nextShipIdx; j++) {
                    if(token[j] !== "=") {
                      sql += ", Item " + table_name[j-i-2];
                    }
                }
                sql += " SET fm.ship_id = fm.ship_id";
                j = i + 1;
                var ship_name_token;
                if(token[j] !== "=") {
                    ship_name_token = token[j].split("LV");
                    sql += ", fm.ship_id = s.id, fm.ship_lv = " + (ship_name_token[1] === undefined?null:ship_name_token[1]);
                }
                for(j=i+2; j<i+8; j++) {
                    if(j >= nextShipIdx) {
                        sql += ", fm.item" + (j-i-1) + " = null, fm.item" + (j-i-1) + "lv = null, fm.item" + (j-i-1) + "alv = null"; 
                    } else if(token[j] !== "=") {
                        let alv = 0;
                        if(token[j].includes(">>")) {
                           alv = 7; 
                           token [j] = token[j].replace(">>", "");
                        } else if (token[j].includes("\\\\\\")) {
                           alv = 6;
                           token [j] = token[j].replace("\\\\\\", "");
                        } else if (token[j].includes("\\\\")) {
                           alv = 5;
                           token [j] = token[j].replace("\\\\", "");
                        } else if (token[j].includes("\\")) {
                           alv = 4;
                           token [j] = token[j].replace("\\", "");
                        } else if (token[j].includes("|||")) {
                           alv = 3;
                           token [j] = token[j].replace("|||", "");
                        } else if (token[j].includes("||")) {
                           alv = 2;
                           token [j] = token[j].replace("||", "");
                        } else if (token[j].includes("|")) {
                           alv = 1;
                           token [j] = token[j].replace("|", "");
                        }    //Convert air level symbol to int
                        var temp = token[j].split("@");  //Split item name from level if it has
                        token[j] = temp[0];
                        sql += ", fm.item" + (j-i-1) + " = " + table_name[j-i-2] + ".id, fm.item" + (j-i-1) + "lv = "
                              +(temp[1] === undefined?0:parseInt(temp[1])) + ", fm.item" + (j-i-1) + "alv = " + alv;
                    }
                }
                sql += " WHERE fm.id IN (SELECT id FROM (SELECT id FROM Fleet_Member WHERE fleet_id = " + fleet_id
                      +" ORDER BY id ASC LIMIT " + (no-1) + ", 1) tmp )";
                j = i + 1;
                if(token[j] !== "=") {
                    if(isNaN(ship_name_token[0])) {
                      sql += " AND s.id IN (SELECT id FROM (SELECT id FROM Ship WHERE ja_jp LIKE '%" + ship_name_token[0] + "%' OR"
                            +" ja_kana LIKE '%" + ship_name_token[0] + "%' OR"
                            +" ja_romaji LIKE '%" + ship_name_token[0] + "%' OR"
                            +" zh_tw LIKE '%" + ship_name_token[0] + "%' ORDER BY LENGTH(ja_jp) ASC LIMIT 1) tmp)";   //Search ship by name in different format
                    } else {
                      sql += " AND s.id = " + parseInt(ship_name_token[0], 10);
                    }
                }
                for(j=i+2; j<nextShipIdx; j++) {
                    if(token[j] !== "=") {
                        if(isNaN(token[j])) {
                          sql += " AND " + table_name[j-i-2] + ".id IN (SELECT id FROM (SELECT id FROM Item WHERE ja_jp LIKE '%" + token[j] + "%' OR "
                            +"zh_tw LIKE '%" + token[j] + "%' ORDER BY LENGTH(ja_jp) ASC LIMIT 1) tmp)";    //Search item by ja_jp name or zh_tw name
                        } else {
                          sql += " AND " + table_name[j-i-2] + ".id = " + parseInt(token[j], 10);   //Search item by id
                        }
                    }
                }
                sql += " AND fl.provider = '" + message.author.id + "'";
                i = nextShipIdx - 1;
            }
            console.log("i=" + i);
        }
      
        DB4FREE(sql).then((res) => {
            if(res.insertId !== 0 || res.affectedRows !== 0) {
              message.reply("Fleet Member added or modified successfully!");
            } else {
              message.reply("No record added or modified, maybe something is wrong or you are not the provider of this fleet"); 
            }
        }).catch((err) => {
            message.reply("Something error! Please refer to the log on Heroku");
            console.log(err);
        });
    }
  
}

var func_updateship = {
   
    CODE : "UPDATESHIP",
  
    DESCRIPTION : "Update the ship database from api provide by whocallsthefleet",
  
    SYNTAX : "UPDATESHIP",
  
    MANUAL : "**DO NOT USE SO FREQUENTLY**",
  
    LOGIC : function(token, message) {
        if(message.author.id !== process.env.ADMIN_ID) {
            message.reply("You have no permission to update"); 
            return;
        }
      
        httpsRequest("https://raw.githubusercontent.com/TeamFleet/WhoCallsTheFleet-DB/master/db/ships.nedb").then((res) => {
              var res_json = "[" + res.replace(/(?:\r\n|\r|\n)/g, ",").replace(/.$/, "]");
              let anchor = 0;
              anchor = res_json.indexOf("\ufffd",anchor);
              while (anchor !== -1) {
                  console.log("indexOf('\ufffd')[" + anchor + "]:" + res_json.substring(Math.max(0, anchor-30), anchor+30));
                  anchor = res_json.indexOf("\ufffd",anchor+1);
              }
              var shipdata = JSON.parse(res_json);
              var i;
              let sql = "REPLACE INTO Ship (id, ja_jp, ja_kana, ja_romaji, zh_tw, asw, asw_max, los, los_max, speed"
                        +", fuel_consum, ammo_consum, slot, type) VALUES ? ";
              var values = [];
              for(i=0; i<shipdata.length; i++) {
                  let slot_str = "";
                  if(shipdata[i].slot !== null) {
                    let j;
                    slot_str += shipdata[i].slot[0];
                    for(j=1; j<shipdata[i].slot.length ;j++) {
                      slot_str += "/" + shipdata[i].slot[j];
                    }
                  }
                  let temp_value = [[shipdata[i].id, addShipSuffix(shipdata[i].name.ja_jp, 0, shipdata[i].name.suffix), 
                                     addShipSuffix(shipdata[i].name.ja_kana, 1, shipdata[i].name.suffix), 
                                     addShipSuffix(shipdata[i].name.ja_romaji, 2, shipdata[i].name.suffix), 
                                     addShipSuffix(to_zh_tw.tify(shipdata[i].name.zh_cn), 3, shipdata[i].name.suffix), 
                                     shipdata[i].stat.asw, shipdata[i].stat.asw_max, 
                                     shipdata[i].stat.los, shipdata[i].stat.los_max, shipdata[i].stat.speed, 
                                     shipdata[i].consum.fuel, shipdata[i].consum.ammo, slot_str, 
                                     shipdata[i].type]];
                  values.push(...temp_value);
                  //console.log("Appended: " + i);
              }
              DB4FREEWITHVALUES(sql, values).then((res) => {
                  message.reply("Update complete!");
              }).catch((err) => {
                message.reply("Something error! Please refer to the log on Heroku");
                console.log(err);
              });
      
        }).catch((err) => {
          message.reply("Something error! Please refer to the log on Heroku");
          console.log(err);
        });
    }
  
}

var func_updateitem = {
   
    CODE : "UPDATEITEM",
  
    DESCRIPTION : "Update the item database from api provide by whocallsthefleet",
  
    SYNTAX : "UPDATEITEM",
  
    MANUAL : "**DO NOT USE SO FREQUENTLY**",
  
    LOGIC : function(token, message) {
        if(message.author.id !== process.env.ADMIN_ID) {
            message.reply("You have no permission to update"); 
            return;
        }
      
        httpsRequest("https://raw.githubusercontent.com/TeamFleet/WhoCallsTheFleet-DB/master/db/items.nedb").then((res) => {
              var res_json = "[" + res.replace(/(?:\r\n|\r|\n)/g, ",").replace(/.$/, "]");
              let anchor = 0;
              anchor = res_json.indexOf("\ufffd",anchor);
              while (anchor !== -1) {
                  console.log("indexOf('\ufffd')[" + anchor + "]:" + res_json.substring(Math.max(0, anchor-30), anchor+30));
                  anchor = res_json.indexOf("\ufffd",anchor+1);
              }
              var itemdata = JSON.parse(res_json);
              var i;
              let sql = "REPLACE INTO Item (id, ja_jp, zh_tw, type, aa, asw, los) VALUES ? ";
              var values = [];
              for(i=0; i<itemdata.length; i++) {
                  let temp_value = [[itemdata[i].id, itemdata[i].name.ja_jp, to_zh_tw.tify(itemdata[i].name.zh_cn), itemdata[i].type, 
                                     itemdata[i].stat.aa, itemdata[i].stat.asw, itemdata[i].stat.los]];
                  values.push(...temp_value);
                  //console.log("Appended: " + i);
              }
              DB4FREEWITHVALUES(sql, values).then((res) => {
                  message.reply("Update complete!");
              }).catch((err) => {
                message.reply("Something error! Please refer to the log on Heroku");
                console.log(err);
              });
        }).catch((err) => {
            message.reply("Something error! Please refer to the log on Heroku");
            console.log(err);
        });
      
    }
}

//Register new function to this func array
var common_func = { STARTWITH : "!",
                    NAME : "Common functions",
                    AVAILABLE: [],
                    FUNCTIONS : [func_help, func_ready, func_clear]
                  }

var hoiseiratommy_func = { STARTWITH : "$", 
                    NAME : "Hoiseiratommy functions",
                    AVAILABLE: [process.env.HOISEIRATOMMY_GUILD_ID],
                    FUNCTIONS : [func_addmusic, func_searchmusic, func_play, func_addplaylist, func_addmusictopl, 
                                func_playlist, func_playqueue, func_musicdetail, func_stop, 
                                func_next, func_pause, func_resume, func_volume, func_loop,
                                func_setname, func_vote, func_showvote, func_addvote,
                                func_sql, func_test]
                  }

var kancolle_func = { STARTWITH : "%", 
                      NAME : "Kancolle functions",
                      AVAILABLE: [process.env.HOISEIRATOMMY_GUILD_ID, process.env.KANCOLLEFLEET_GUILD_ID],
                      FUNCTIONS : [func_createfleet, func_editfleettag, func_searchship, func_searchitem,
                                   func_searchfleet, func_editfleetmember, func_updateship, func_updateitem]
                    }

var func = [common_func, hoiseiratommy_func, kancolle_func];














//==========Discord client logic===========

client.on('ready', () => {

    console.log('I am ready!');
  
    UpdateUsers();
  
    /*client.users.forEach((id, user) => {
        console.log(id + ": " + user.id);  
    });*/
    /*client.guilds.forEach((id, guild) => {
        console.log("Guild id: " + id + "/" + guild.id);
    });*/
});

client.on('message', message => {
  
    var func_group_no = -1;
  
    if(displaying_menu !== null && message.channel.id === displaying_menu.CHANNEL_ID) {
        displaying_menu.LOGIC(message.content, message);
        displaying_menu = null;
    }
  
    var i;
  
    for(i=0; i<func.length; i++) {
        if(message.content.charAt(0) === func[i].STARTWITH && (func[i].AVAILABLE.length === 0 || func[i].AVAILABLE.indexOf(message.guild.id) !== -1)) {
            func_group_no = i; 
        }
    }
    if(!(func_group_no + 1)) {
        return; 
    }
    
    var token = new Array();
    token = message.content.substr(1).trim().split(' ');
    
    //===================================================
    //  ALL COMMAND SHOULD BE CONVERTED TO UPPER CASE!
    //===================================================
    
    
    for(i=0; i<func[func_group_no].FUNCTIONS.length; i++) {
        if(token[0].toUpperCase() === func[func_group_no].FUNCTIONS[i].CODE) {
            try {
              func[func_group_no].FUNCTIONS[i].LOGIC(token, message);
            } catch (err) {
              //message.reply("Oops! Something goes wrong. Please refer to the console log on heroku");
              message.reply(err);
              console.log(err);
            }
            if(clear_command.includes(message.channel.id)) {
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


  if(oldUserChannel === undefined && newUserChannel !== undefined/* && newUserChannel.id === '261140017894785026'*/) {

     // User Joins a voice channel
    console.log("'" + newMember.id + "' has joined the voice channel!(" + newMember.voiceChannel.id + ")");
    for(let i=0; i<users.length; i++) {
        //console.log("!DISCORD = " + !users[i].DISCORD + " id===DISCORD " + (newMember.id === users[i].DISCORD) + " BGM = " + users[i].BGM);
        if(users[i].DISCORD && newMember.id === users[i].DISCORD && users[i].BGM) {
            interupt_music = {
                code : users[i].NAME + "'s BGM",
                url : users[i].BGM,
                volume : users[i].BGM_VOLUME
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
    }
  } else if(newUserChannel === undefined){

    // User leaves a voice channel
    console.log("'" + newMember.id + "' has left the voice channel!(" + oldMember.voiceChannel.id + ")");
  }
})



function UpdateUsers() {
  
    var sql = "SELECT id, NAME, DISCORD, BGM, BGM_VOLUME FROM user";
  
    ExecuteSQL(sql).then((result) => {
        users = result;
        console.log("UpdateUsers SQL success");
    }).catch((err) => {
        message.reply("Something error! Please refer to the log on Heroku");
        console.log(err);
    });
  
    console.log("User nickname<>ID updated");
  
    
    
}

function GetUserID(discordID) {
    for(var i=0; i<users.length; i++) {
        if(users[i].DISCORD === discordID) {
            return users[i].id; 
        }
    }
    return -1;
}

function GetUserName(discordID) {
    for(var i=0; i<users.length; i++) {
        if(users[i].DISCORD === discordID) {
            return users[i].NAME; 
        }
    }
    return discordID;
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
        //database: db_dbname
    });
 
    return new Promise((resolve, reject) => {
        con.connect(function(err) {
            if(err) {
                reject(err);
            } else {
              con.query(sql, function(err, result) {
                  if(err) {
                      reject(err); 
                      console.log("ExecuteSQL error: " + err);
                  } else {
                      resolve(result);
                      console.log("SQL: '" + sql + "' success");
                      console.log("result: '" + JSON.stringify(result) + "'");
                  }
                  con.end();
              });
            }
        });
    });
    
}

function DB4FREE(sql) {
     var con = mysql.createConnection({
        host: db4free_host,
        user: db4free_user,
        password: db4free_password,
        database: db4free_dbname,
        multipleStatements: true
    });
 
    return new Promise((resolve, reject) => {
        con.connect(function(err) {
            if(err) {
                reject(err);
            } else {
              console.log("sql = " + sql);
              con.query(sql, function(err, result) {
                  if(err) {
                      reject(err); 
                      console.log("ExecuteSQL error: " + err);
                  } else {
                      resolve(result);
                      console.log("SQL: '" + sql + "' success");
                      console.log("result: '" + JSON.stringify(result) + "'");
                  }
                  con.end();
              });
            }
        });
    });
    
}

function DB4FREEWITHVALUES(sql, values) {
     var con = mysql.createConnection({
        host: db4free_host,
        user: db4free_user,
        password: db4free_password,
        database: db4free_dbname,
        multipleStatements: true
    });
 
    return new Promise((resolve, reject) => {
        con.connect(function(err) {
            if(err) {
                reject(err);
            } else {
              con.query(sql, [values], function(err, result) {
                  if(err) {
                      reject(err); 
                      console.log("ExecuteSQL error: " + err);
                  } else {
                      resolve(result);
                      console.log("SQL: '" + sql + "' success");
                      console.log("result: '" + JSON.stringify(result) + "'");
                  }
                  con.end();
              });
            }
        });
    });
    
}

function POSTtoPHP(data, php_script) {
  var http = require('http');
  var querystring = require("querystring");
  var qs = querystring.stringify(data);
  var qslength = qs.length;
  var options = {
      hostname: "hoiseiratommy.gearhostpreview.com",
      port: 80,
      path: "/db_access/" + php_script + ".php",
      method: 'POST',
      headers:{
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': qslength
      }
  };
  
  return new Promise((resolve, reject) => {
    var buffer = "";
    var req = http.request(options, function(res) {
        res.on('data', function (chunk) {
           buffer+=chunk;
        });
        res.on('end', function() {
            console.log(buffer);
            resolve(buffer);
        });
        req.on('error', function (e) {
            console.log(e);
            reject(e);
        });
    });

    req.write(qs);
    req.end();
  });

}

function httpRequest(url) {
  var http = require('http');

  return new Promise((resolve, reject) => {
    http.get(url, (resp) => {
      let data = '';

      // A chunk of data has been recieved.
      resp.on('data', (chunk) => {
        data += chunk;
      });

      // The whole response has been received. Print out the result.
      resp.on('end', () => {
        resolve(data);
      });

    }).on("error", (err) => {
      console.log(err);
      reject(err);
    });
  });
}

function httpsRequest(url) {
  var https = require('https');

  return new Promise((resolve, reject) => {
    https.get(url, (resp) => {
      let data = '';

      // A chunk of data has been recieved.
      resp.on('data', (chunk) => {
        data += chunk;
      });

      // The whole response has been received. Print out the result.
      resp.on('end', () => {
        resolve(data);
      });

    }).on("error", (err) => {
      console.log(err);
      reject(err);
    });
  });
}

function sendMessageToChannel(channel, msg) {
    var index, temp_msg;
    while (msg.length > 2000) {
      index = msg.lastIndexOf("\n", 2000);
      temp_msg = msg.substring(0, index);
      channel.send(temp_msg);
      msg = msg.substring(index + 1);
    }
    return new Promise((resolve, reject) => {
      channel.send(msg).then((msg) => {
        resolve(msg);
      }).catch((err) => {
        reject(err);
      });
    });
}

function convertALVtoSymbol(alv) {
    if(alv === 7) {
      return ">>"; 
    } else if (alv === 6) {
      return "\\\\\\";
    } else if (alv === 5) {
      return "\\\\"; 
    } else if (alv === 4) {
      return "\\"; 
    } else if (alv === 3) {
      return "|||"; 
    } else if (alv === 2) {
      return "||"; 
    } else if (alv === 1) {
      return "|"; 
    }
    return "";
}

const ship_suffix = [["改", "かい", "kai", "改"], 
                     ["改二", "かいに", "kaini", "改二"],
                     ["甲", "こう", "kou", "甲"],
                     ["航", "こう", "kou", "航"],
                     ["航改", "こうかい", "koukai", "航改"],
                     ["航改二", "こうかいに", "koukaini", "航改二"],
                     [" zwei", " zwei", "", " zwei"],
                     [" drei", " drei", "", " drei"],
                     ["改二甲", "かいにこう", "kainikou", "改二甲"],
                     ["改二乙", "かいにおつ", "kainiotsu", "改二乙"],
                     ["改二丁", "かいにちょう", "kainichou", "改二丁"],
                     [" due", " due", "", " due"],
                     ["改母", "かいぶ", "kaibu", "改母"],
                     [" два", " два", "", " два"],
                     [" Mk.II", " Mk.II", "", " Mk.II"],
                     [" Mk.II Mod.2", " Mk.II Mod.2", "", " Mk.II Mod.2"],
                     ["乙改", "おつかい", "otsukai", "乙改"],
                     ["丁改", "ちょうかい", "choukai", "丁改"]]

function addShipSuffix(shipname, name_language, suffix_type) {
    if(suffix_type === null ) {
        return shipname; 
    }
    return "" + shipname + ship_suffix[suffix_type-1][name_language];
}

function getLosByItem(type, los, improvement) {
    var result = los;
    switch(type) {
      case 15:
        result += Math.sqrt(improvement) * 1.2;
        break;
      case 24:
        result += Math.sqrt(improvement) * 1.25;
        break;
      case 25:
      case 47:
        result += Math.sqrt(improvement) * 1.4;
        break;
    }
    switch(type) {
      case 18:
      case 20:
      case 23:
      case 24:
      case 25:
      case 27:
      case 36:
      case 37:
      case 39:
      case 43:
      case 45:
      case 46:
      case 47:
      case 51:
      case 55:
      case 58:
      case 60:
        return result * 0.6;
      case 19:
      case 61:
        return result * 0.8;
      case 21:
      case 50:
        return result;
      case 17:
        return result * 1.1;
      case 15:
      case 16:
        return result * 1.2;
      default:
        return 0;
    }
}

const aa_const = [[0, 1, 2, 3, 4, 5, 7, 10],
                  [0, 0, 2, 5, 9, 14, 14, 22],
                  [0, 0, 1, 1, 1, 3, 3, 6]];

function getAAByItem(slot, type, aa, improvement, alv) {
    var temp_slot, temp_aa;
    if(slot === null) {
      temp_slot = 0; 
    } else {
      temp_slot = parseInt(slot); 
    }
    temp_aa = aa;
    switch(type) {
      case 18:
      case 51:
      case 60:
        temp_aa += improvement * 0.2;
        break;
      case 20:
        temp_aa += improvement * 0.25;
        break;
    }
    switch(type) {
      case 18:  //艦戰
      case 51:  //水戰
      case 60:  //夜戰
        return temp_aa * Math.sqrt(temp_slot) + Math.sqrt(aa_const[0][alv]) + aa_const[1][alv];
      case 17:  //水爆
        return temp_aa * Math.sqrt(temp_slot) + Math.sqrt(aa_const[0][alv]) + aa_const[2][alv];
      case 19:  //艦攻
      case 20:  //艦爆
      case 45:  //大艇
      case 55:  //噴射機
      case 61:  //夜攻
        return temp_aa * Math.sqrt(temp_slot) + Math.sqrt(aa_const[0][alv]);
      default:
        return 0;
    }
}

function getMinAAByItem(slot, type, aa, improvement, alv) {
    switch (type) {
      case 18:
      case 51:
      case 60:
        return getAAByItem(slot, type, aa, improvement, alv);
      case 17:
      case 19:
      case 20:
      case 45:
      case 55:
      case 61:
        return getAAByItem(slot, type, aa, improvement, 0);
      default:
        return 0;
    }
}

function getMaxAAByItem(slot, type, aa, improvement, alv) {
    switch (type) {
      case 18:
      case 51:
      case 60:
        return getAAByItem(slot, type, aa, improvement, alv);
      case 17:
      case 19:
      case 20:
      case 45:
      case 55:
      case 61:
        return getAAByItem(slot, type, aa, improvement, 7);
      default:
        return 0;
    }
}

function checkStringUndefined(input) {
    if(input === undefined) {
        return "-"; 
    }
    return input;
}


client.login(process.env.BOT_TOKEN);
