require('dotenv').config();

const axios = require('axios');
const express = require('express');
const bodyParser = require('body-parser');
const qs = require('querystring');
const tutor = require('./tutor');
const debug = require('debug')('slash-command-template:index');

const app = express();

/*
 * Parse application/x-www-form-urlencoded && application/json
 */
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

if (!process.env.BOT_TOKEN) {
    console.log('Error: Specify token in environment');
    process.exit(1);
}
/*

var Botkit = require('./lib/Botkit.js');
var os = require('os');

var controller = Botkit.slackbot({
    debug: true,
});
*/

var Botkit = require('botkit');
var mongoStorage = require('botkit-storage-mongo')({mongoUri: 'mongodb://seprojuser:seprojuser123@ds123728.mlab.com:23728/wolftutor', tables: ['user','tutor','subject']});
var os = require('os');

var controller = Botkit.slackbot({
    storage: mongoStorage,
});

var bot = controller.spawn({
    token: process.env.BOT_TOKEN
}).startRTM();

controller.hears(['hello', 'hi'], 'direct_message,direct_mention,mention', function(bot, message) {

    bot.api.reactions.add({
        timestamp: message.ts,
        channel: message.channel,
        name: 'robot_face',
    }, function(err, res) {
        if (err) {
            bot.botkit.log('Failed to add emoji reaction :(', err);
        }
    });


    controller.storage.users.get(message.user, function(err, user) {
        if (user && user.name) {
            bot.reply(message, 'Hello ' + user.name + '!!');
        } else {
            bot.reply(message, 'Hello.');
        }
    });
});

controller.hears(['call me (.*)', 'my name is (.*)'], 'direct_message,direct_mention,mention', function(bot, message) {
    var name = message.match[1];
    controller.storage.users.get(message.user, function(err, user) {
        if (!user) {
            user = {
                id: message.user,
            };
        }
        user.name = name;
        controller.storage.users.save(user, function(err, id) {
            bot.reply(message, 'Got it. I will call you ' + user.name + ' from now on.');
        });
    });
});


controller.hears(['find','need a tutor', 'find a tutor', 'want a tutor', 'select a tutor' ],
    'direct_message,direct_mention,mention', function(bot, message) {

        controller.storage.user.all(function(err,users) {
            console.log(users)
            if (err) {
                throw new Error(err);
            }
        });

        bot.startConversation(message,function(err,convo) {
            var subs="";
            controller.storage.subjects.all(function(error, subjects){
                for(var s in subjects)
                    console.log(s);
            });
        });
    });

function formatUptime(uptime) {
    var unit = 'second';
    if (uptime > 60) {
        uptime = uptime / 60;
        unit = 'minute';
    }
    if (uptime > 60) {
        uptime = uptime / 60;
        unit = 'hour';
    }
    if (uptime != 1) {
        unit = unit + 's';
    }

    uptime = uptime + ' ' + unit;
    return uptime;
}

controller.hears('become a tutor', 'direct_message', function(bot, message) {
    bot.reply(message, {
        attachments:[
            {
                title: 'Do you want become a tutor',
                callback_id: 'become_tutor_prompt',
                attachment_type: 'default',
                actions: [
                    {
                        "name":"yes",
                        "text": "Yes",
                        "value": "yes",
                        "type": "button",
                    },
                    {
                        "name":"no",
                        "text": "No",
                        "value": "no",
                        "type": "button",
                    }
                ]
            }
        ]
    });
});

// receive an interactive message, and reply with a message that will replace the original
// controller.on('interactive_message_callback', function(bot, message) {

//     // check message.actions and message.callback_id to see what action to take...
//     console.log(message);
//     bot.replyInteractive(message, {
//         text: 'yes',
//         attachments: [
//             {
//                 title: 'My buttons',
//                 callback_id: '123',
//                 attachment_type: 'default',
//                 actions: [
//                     {
//                         "name":"yes",
//                         "text": "Yes!",
//                         "value": "yes",
//                         "type": "button",
//                     },
//                     {
//                        "text": "No!",
//                         "name": "no",
//                         "value": "delete",
//                         "style": "danger",
//                         "type": "button",
//                         "confirm": {
//                           "title": "Are you sure?",
//                           "text": "This will do something!",
//                           "ok_text": "Yes",
//                           "dismiss_text": "No"
//                         }
//                     }
//                 ]
//             }
//         ]
//     });

// });



app.get('/', (req, res) => {
  res.send('<h2>The Slash Command and Dialog app is running</h2> <p>Follow the' +
  ' instructions in the README to configure the Slack App and your environment variables.</p>');
});

app.post('/message', (req, res) => {
  var payload = JSON.parse(req.body.payload);
  var callbackId = payload.callback_id;
  const token = payload.token;
  const trigger_id = payload.trigger_id;
  if (token === process.env.SLACK_VERIFICATION_TOKEN) {

    if(callbackId=='become_tutor_prompt'){
      var checkValue = payload.actions[0].value;
      if (checkValue == 'no') {
        axios.post('https://slack.com/api/chat.postMessage', qs.stringify({
          token: process.env.SLACK_ACCESS_TOKEN,
          channel: payload.channel.id,
        })).then((result) => {
          debug('sendConfirmation: %o', result.data);
        }).catch((err) => {
          debug('sendConfirmation error: %o', err);
          console.error(err);
        });
      }
      else {
          // Yes on become a tutor prompt
          const dialog = {
          token: process.env.SLACK_ACCESS_TOKEN,
          trigger_id,
          dialog: JSON.stringify({
            title: 'Become a Tutor',
            callback_id: 'submit_tutor_info',
            submit_label: 'Submit',
            elements: [
              {
                label: 'Major',
                type: 'select',
                name: 'major',
                options: [
                  { label: 'Computer Science', value: 'Computer Science' },
                  { label: 'Computer Engineering', value: 'Computer Engineering' },
                  { label: 'Electrical Engineering', value: 'Electrical Engineering' },
                  { label: 'Mechanical Engineering', value: 'Mechanical Engineering' },
                  { label: 'Chemical Engineering', value: 'Chemical Engineering' },
                ],
              },
              {
                label: 'Degree',
                type: 'select',
                name: 'degree',
                options: [
                  { label: 'Bachelors', value: 'Bachelors' },
                  { label: 'Masters', value: 'Masters' },
                  { label: 'Associate', value: 'Associate' },
                  { label: 'High School GED', value: 'High School GED' },
                ],
              },
              {
                label: 'Subjects',
                type: 'select',
                name: 'subject',
                hint: 'You can add more subjects later',
                options: [
                  { label: 'Operating Systems', value: 'Operating Systems' },
                  { label: 'Algorithms', value: 'Algorithms' },
                  { label: 'Software Engineering', value: 'Software Engineering' },
                  { label: 'Processor Design', value: 'Processor Design' },
                ],
              },
              {
                label: 'Rate',
                type: 'text',
                subtype: 'number',
                name: 'rate',
                hint: 'If you want to tutor for free then type 0 above',
              },
              // {
              //   label: 'Availability',
              //   type: 'select',
              //   name: 'availability',
              //   options: [
              //     { label: 'Monday', value: 'Monday' },
              //     { label: 'Tuesday', value: 'Tuesday' },
              //     { label: 'Wednesday', value: 'Wednesday' },
              //     { label: 'Thursday', value: 'Thursday' },
              //     {label: 'Friday', value: 'Friday'},
              //     {label: 'Saturday', value: 'Saturday'},
              //     {label: 'Sunday', value: 'Saturday'},
              //   ],
              // },

              {
                label: 'Summary',
                type: 'textarea',
                name: 'summary',
                optional: true,
              },
            ],
          }),
        };

        // open the dialog by calling dialogs.open method and sending the payload
        axios.post('https://slack.com/api/dialog.open', qs.stringify(dialog))
          .then((result) => {
            debug('dialog.open: %o', result.data);
            console.log("Dialog Opened sucessful");
            res.send('');
          }).catch((err) => {
            debug('dialog.open call failed: %o', err);
            res.sendStatus(500);
          });
        } // End of Else
      } // End of If

    else if(callbackId='submit_tutor_info'){
      // immediately respond with a empty 200 response to let
      // Slack know the command was received
      res.send('');
      axios.post('https://slack.com/api/chat.postMessage', qs.stringify({
        token: process.env.SLACK_ACCESS_TOKEN,
        channel: payload.channel.id,
        // Edit the text that you want to send to the bot
        //text: 'OK',
        attachments:JSON.stringify([
            {
                title: 'Do you want to add more Subjects?',
                callback_id: 'tutor_add_subjects',
                attachment_type: 'default',
                actions: [
                    {
                        "name":"yes",
                        "text": "Yes",
                        "value": "yes",
                        "type": "button",
                    },
                    {
                        "name":"no",
                        "text": "No",
                        "value": "no",
                        "type": "button",
                    }
                ]
            }
        ]),
      })).then((result) => {
        debug('sendConfirmation: %o', result.data);
      }).catch((err) => {
        debug('sendConfirmation error: %o', err);
        console.error(err);
      });
      // create tutor
      tutor.create(payload.user.id, payload.submission);
    } // End of else if for submit tutor info
    else if (callback_id ='tutor_add_subjects') {
      var checkValue = payload.actions[0].value;
      if (checkValue == 'no') {
        // Get the availibility Prompt
        axios.post('https://slack.com/api/chat.postMessage', qs.stringify({
          token: process.env.SLACK_ACCESS_TOKEN,
          channel: payload.channel.id,
          // Edit the text that you want to send to the bot
          //text: 'OK',
          attachments:JSON.stringify([
              {
                  title: 'Do you want to add your availibility?',
                  callback_id: 'tutor_add_availibility',
                  attachment_type: 'default',
                  actions: [
                      {
                          "name":"yes",
                          "text": "Yes",
                          "value": "yes",
                          "type": "button",
                      },
                      {
                          "name":"no",
                          "text": "No",
                          "value": "no",
                          "type": "button",
                      }
                  ]
              }
          ]),
        })).then((result) => {
          debug('sendConfirmation: %o', result.data);
        }).catch((err) => {
          debug('sendConfirmation error: %o', err);
          console.error(err);
        });
      } else {
        // Dialog for Adding a subject
      }
    } // End of else if for tutor_add_subjects
    else if (callback_id = 'tutor_add_availibility') {
      var checkValue = payload.actions[0].value;
      if (checkValue == 'no') {
        // Everything is done
        axios.post('https://slack.com/api/chat.postMessage', qs.stringify({
          token: process.env.SLACK_ACCESS_TOKEN,
          channel: payload.channel.id,
        })).then((result) => {
          debug('sendConfirmation: %o', result.data);
        }).catch((err) => {
          debug('sendConfirmation error: %o', err);
          console.error(err);
        });
      } else {
        const dialog = {
        token: process.env.SLACK_ACCESS_TOKEN,
        trigger_id,
        dialog: JSON.stringify({
            title: 'Enter Availability',
            callback_id: 'add_more_tutor_availibility',
            submit_label: 'Submit',
            elements: [
              {
                label: 'Day',
                type: 'select',
                name: 'day1',
                options: [
                  { label: 'Monday', value: 'Monday' },
                  { label: 'Tuesday', value: 'Tuesday' },
                  { label: 'Wednesday', value: 'Wednesday' },
                  { label: 'Thursday', value: 'Thursday' },
                  { label: 'Friday', value: 'Friday' },
                  { label: 'Saturday', value: 'Saturday' },
                  { label: 'Sunday', value: 'Sunday' },
                ],
              },
              {
                label: 'From Hour',
                type: 'select',
                name: 'from_time_hour',
                options: [
                  { label: '7:00', value: '7:00' },
                  { label: '8:00', value: '8:00' },
                  { label: '9:00', value: '9:00' },
                  { label: '10:00', value: '10:00' },
                  { label: '11:00', value: '11:00' },
                  { label: '12:00', value: '12:00' },
                  { label: '13:00', value: '13:00' },
                  { label: '14:00', value: '14:00' },
                  { label: '15:00', value: '15:00' },
                  { label: '16:00', value: '16:00' },
                  { label: '17:00', value: '17:00' },
                  { label: '18:00', value: '18:00' },
                  { label: '19:00', value: '19:00' },
                  { label: '20:00', value: '20:00' },
                  { label: '21:00', value: '21:00' },
                  { label: '22:00', value: '22:00' },
                ],
              },
              {
                label: 'From Min',
                type: 'select',
                name: 'from_time_min',
                options: [
                  { label: '15', value: '15' },
                  { label: '30', value: '30' },
                  { label: '45', value: '45' },
                ],
              },
              {
                label: 'To Hour',
                type: 'select',
                name: 'to_time_hour',
                options: [
                  { label: '7:00', value: '7:00' },
                  { label: '8:00', value: '8:00' },
                  { label: '9:00', value: '9:00' },
                  { label: '10:00', value: '10:00' },
                  { label: '11:00', value: '11:00' },
                  { label: '12:00', value: '12:00' },
                  { label: '13:00', value: '13:00' },
                  { label: '14:00', value: '14:00' },
                  { label: '15:00', value: '15:00' },
                  { label: '16:00', value: '16:00' },
                  { label: '17:00', value: '17:00' },
                  { label: '18:00', value: '18:00' },
                  { label: '19:00', value: '19:00' },
                  { label: '20:00', value: '20:00' },
                  { label: '21:00', value: '21:00' },
                  { label: '22:00', value: '22:00' },
                ],
              },
              {
                label: 'To Min',
                type: 'select',
                name: 'to_time_min',
                options: [
                  { label: '15', value: '15' },
                  { label: '30', value: '30' },
                  { label: '45', value: '45' },
                ],
              },
            ],
          }),
      }
    } // End of else if for tutor_add_subjects
    else if (callback_id = 'add_more_tutor_availibility') {

    } // End of else if for add_more_tutor_availibility
  } else {
    debug('Verification token mismatch');
    console.log('Failed Here');
    res.sendStatus(403);
  }
});

/*
 * Endpoint to receive the dialog submission. Checks the verification token
 * and creates a Helpdesk tutor
 */
// app.post('/interactive-component', (req, res) => {
//   const body = JSON.parse(req.body.payload);
//
//   // check that the verification token matches expected value
//   if (body.token === process.env.SLACK_VERIFICATION_TOKEN) {
//     //debug(`Form submission received: ${body.submission.trigger_id}`);
//
//     // immediately respond with a empty 200 response to let
//     // Slack know the command was received
//     res.send('');
//
//     // create tutor
//     tutor.create(body.user.id, body.submission);
//   } else {
//     debug('Token mismatch');
//     res.sendStatus(500);
//   }
// });

app.post('/botactivity', (req, res) => {
  console.log(req['body']['event']['text']);
  // Will need to verify the challenge parameter first
  res.send("I am here");
  //console.log(req['body']['event']['text']);
  //res.send("I am here");
  const query = req.body.event.text;
  console.log(query);
  if(query.match(/become a tutor/i)) {
    console.log('Yes He wants to bocome a Tutor');
  }
  else {
    console.log('No ');
  }
  console.log(req['body']);
  res.send(req.body.challenge);
  // console.log(req);
  // res.send('');
});


app.listen(process.env.PORT, () => {
  console.log(`App listening on port ${process.env.PORT}!`);
});
