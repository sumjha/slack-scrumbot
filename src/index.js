'use strict';

import Slack from 'slack-client';
import pkg from '../package.json';
import moment from 'moment';
import Debug from 'debug';
import Checkin from './checkin';
let debug = Debug(pkg.name);
var schedule = require('node-schedule');
var os = require("os");

let time = (process.env.TIME).split(":")
var rule = new schedule.RecurrenceRule();
rule.dayOfWeek = [new schedule.Range(1, 5)];
rule.hour = time[0]; // UTC 
rule.minute = time[1]; // TimeZone
 



const hasBrackets = /^<(.+)>$/,
  slackToken = process.env.SCRUMBOT_TOKEN,
  script = {
    greeting: `Hello, it's time to start your daily standup._ Please provide a short (*one-line*) answer to each question._`,
    worked: 'What did you accomplish yesterday?',
    working: 'What are you working on right now?',
    blocking: 'What obstacles are impeding your progress?',
    thankyou: 'Alright. Thank you for this update!'
  },
  slack = new Slack(slackToken, true);

let toMe,
  checkin;

function bracketsToId(str) {
  let [, id] = str.trim().match(hasBrackets);
  return id;
}

slack.on('open', () => {
  debug(`Connected to ${slack.team.name} as ${slack.self.name}`);
  toMe = new RegExp(`^<@${slack.self.id}>`);
});

slack.on('goodbye', () => {
debug(`Good Bye received`);
slack.login();
});

slack.on('close', () => {
debug(`slack close`);
slack.login();
});

slack.on('error', (err) => {
  console.error(`Error ${err}`);
});

slack.on('message', (message) => {
  // events
  switch (message.subtype) {
  case 'group_join':
  case 'channel_join':
   let channel = slack.getChannelGroupOrDMByID(message.channel);
    if (slack.self.id === message.user) {
      let channel = slack.getChannelGroupOrDMByID(message.channel);
	  if(message.channel === (process.env.CHANNEL_ID).trim()) {
      channel.send(`Hi folks, @${slack.self.name} is here to help run pre-standup scrum.
	Say *@${slack.self.name} help* to get started.`);
	} else channel.send(`You are not authorized to use this bot in this channel`);
    }

    break;
  case 'message_changed':
    handleMessage(Object.assign({}, message, message.message));
    break;
  case undefined:
    handleMessage(message);
    break;
  default:
    break;
  }
});




function startScrum (channel){
	
if (checkin) {
          channel.send(`I'm already doing a scrum. It will be finished in ${moment.duration((checkin.start + checkin.timeout) - new Date()).humanize()} minutes.`);
        } else {
          //let inviter = slack.getUserByID(message.user);
          let users = process.env.SCRUM_USERS.split(" ");

          if (users.size <= 0) {
            channel.send(`Please give me some people to do a checkin with.`);
          } else {
            checkin = new Checkin({
              timeout: pkg.config.waitMinutes * 60 * 1000,
              channel: channel,
              users: Array.from(users)
            });

            checkin.on('end', finale);

            channel.send(`Alright, I'm going to start a pre-standup scrum.
I'll report back here when everyone replied or in ${moment.duration(checkin.timeout).humanize()}, whatever comes first.`);
           
            users.forEach((id) => {
              slack.openDM(id, (result) => {
                let dm = slack.getChannelGroupOrDMByID(result.channel.id);

                if (!dm) {
                  console.error(`Could not retrieve DM channel for user '${result.channel.id}'.`);
                } else {
					//console.log(id)
                    dm.send(`${script.greeting}`);
                    dm.send(`${script.worked}`);
                }
              });
            });
          }
        }	
	
}

function handleMessage (message) {
	
  let channel = slack.getChannelGroupOrDMByID(message.channel);

  switch ((message.channel || '').substr(0, 1).toUpperCase()) {
  case 'G':
    // group (private channel) message
  case 'C':
    // channel message
    if (toMe.test(message.text)) {
		if(message.channel !== (process.env.CHANNEL_ID).trim()) {
			channel.send(`You are not Authorized for this operation`);
			break;
	   }	
      // commands
      let cmd = message.text.split(' ').slice(1);

      switch (cmd[0]) {
      case 'scrum':
		startScrum (channel)
        break;
      case 'stop':
        if (checkin) {
          checkin.stop(true);
          checkin = null;

          channel.send(`Alright. Those answers are going to /dev/null.`);
        } else {
          channel.send(`I can't stop doing nothing.`);
        }

        break;
      case 'status':
        if (checkin) {
          let waitingUsers = checkin.getWaitingFor();

          channel.send(`I'm doing a checkin.
${waitingUsers.reduce((result, id, idx, all) => {
  let user = slack.getUserByID(id);

  if (user) {
    if (result) {
      if (idx === all.length - 1) {
        result = `${result} and @${user.name}`;
      } else {
        result = `${result}, @${user.name}`;
      }
    } else {
      result = `@${user.name}`;
    }
  }

  return result;
}, '')} still ${waitingUsers.length === 1 ? 'has' : 'have'} to answer.
I will wait ${moment.duration((checkin.start + checkin.timeout) - new Date()).minutes()} more minutes.`);
        } else {
          channel.send(`I'm not doing anything.`);
        }

        break;
      case 'help':
        channel.send(`There is only a _limited_ set of problems I can help you with.
That would currently be \`scrum\`, \`stop\` , \`status\`  and \`info\`.`);

        break;
      case 'info':
		let myStr = process.env.SCRUM_USERS
		var newStr = '<@'+myStr.replace(/ /g, "> <@")+'>';
        channel.send(`I will start pre standup scrum at: ${process.env.TIME} UTC \n I'll notify these guys for scrum updates: ${newStr} `);

        break;
      default:
        channel.send(`I don't understand this.`);

        break;
      }
    }

    break;
  case 'D':
    // direct message
    if (checkin && (message.user in checkin.responses)) {
      let response = checkin.responses[message.user];
      console.log(message.text)
      if (!('worked' in response)) {
        checkin.addResponse('worked', message.user, message.text);
        channel.send(`${script.working}`);
      } else if (!('working' in response)) {
        checkin.addResponse('working', message.user, message.text);
        channel.send(`${script.blocking}`);
      } else if (!('blocking' in response)) {
        checkin.addResponse('blocking', message.user, message.text);
        channel.send(script.thankyou);
      }
    } else {
		//slack.getUserByID(message.user)
		console.log(message.text)
		channel.send("Direct messaging is yet to be implemented.");
		
	}
     
    break;
  }
}

function finale () {
  let channel = checkin.channel;

  let listResult = (title, responses) => `>>>*${title}*\n${responses.join('\n')}`;
   // inviter = slack.getUserByID(checkin.inviter);

  channel.send(`Hey, daily standup complete`);

  let result = Object.keys(checkin.responses).reduce((result, id) => {
    let user = slack.getUserByID(id),
      response = checkin.responses[id];

    if (response.working) {
      result.working.push(`@${user.name}: ${response.working}`);
    }

    if (response.worked) {
      result.worked.push(`@${user.name}: ${response.worked}`);
    }

    if (response.blocking) {
      result.blocking.push(`@${user.name}: ${response.blocking}`);
    }

    return result;
  }, {
    working: [],
    worked: [],
    blocking: []
  });
  channel.send(listResult(script.worked, result.worked));
  channel.send(listResult(script.working, result.working));
  channel.send(listResult(script.blocking, result.blocking));
  
  let AbsentUsers = checkin.getNoReplyUsers();
  console.log(AbsentUsers.size)
  if (AbsentUsers.length > 0) {
  channel.send(`I didn't hear anything from
  ${AbsentUsers.reduce((result, id, idx, all) => {
    let user = slack.getUserByID(id);
  
    if (user) {
      if (result) {
        if (idx === all.length - 1) {
		result = `${result} and <@${id}>`;
        } else {
          result = `${result}, <@${id}>`;
        }
      } else {
        result = `<@${id}>`;
      }
    }
  
    return result;
  }, '')}`);
  } 
    
  
  checkin = null;
}

slack.login();

var j = schedule.scheduleJob(rule, function(){
  console.log('Scheduled scrum started....');
  let channel = slack.getChannelGroupOrDMByID(process.env.CHANNEL_ID);
  startScrum (channel);
});
