require('dotenv').config();

const axios = require('axios');
const express = require('express');
const bodyParser = require('body-parser');
const qs = require('querystring');
const tutor = require('./tutor');
const dialogs = require('./dialog');
const prompts = require('./prompt');
const action = require('./action');
const debug = require('debug')('slash-command-template:index');
const app = express();
const UserModel = require('./model/user');
const TutorModel = require('./model/tutor');
const ReservationModel = require('./model/reservation');
const SubjectModel = require('./model/subject');

/*
 * Parse application/x-www-form-urlencoded && application/json
 */

app.use(bodyParser.urlencoded({extended: true}));

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
var mongoStorage = require('botkit-storage-mongo')({
    mongoUri: process.env.MONGO_CONNECTION_STRING,
    tables: ['user', 'tutor', 'subject', 'reservation']
});
var os = require('os');

var controller = Botkit.slackbot({
    storage: mongoStorage,
});

var bot = controller.spawn({
    token: process.env.BOT_TOKEN
}).startRTM();

controller.hears(['hello', 'hi'], 'direct_message,direct_mention,mention', function (bot, message) {

    // controller.storage.users.get(message.user, function(err, user) {
    //     if (user && user.name) {
    //         bot.reply(message, 'Hello ' + user.name + '!!');
    //         //UserModel.create_new_user(message);
    //     } else {
    //         bot.reply(message, 'Hello.');
    //     }
    // });
});

controller.hears(['call me (.*)', 'my name is (.*)'], 'direct_message,direct_mention,mention', function (bot, message) {
    var name = message.match[1];
    controller.storage.users.get(message.user, function (err, user) {
        if (!user) {
            user = {
                id: message.user,
            };
        }
        user.name = name;
        controller.storage.users.save(user, function (err, id) {
            bot.reply(message, 'Got it. I will call you ' + user.name + ' from now on.');
        });
    });
});


controller.hears(['find', 'need a tutor', 'find a tutor', 'want a tutor', 'select a tutor'],
    'direct_message,direct_mention,mention', function (bot, message) {

        //TODO put in a method
        var sub_list = '';
        controller.storage.subject.all(function (err, subjects) {
            //console.log(subjects);
            //Commenting old plain text logic of subjects
            for (var temp in subjects) {
                sub_list = sub_list + subjects[temp].name.toString() + '\n ';
            }
            //TODO- how to handle the error-string statement?
            if (err) {
                throw new Error(err);
            }

            var subjects_display_list = 'Choose one of the subjects :-' + '\n' + sub_list;
            //for(var sub in subjects) {
            var reply_with_attachments = {
                'attachments': [
                    {
                        fields: [
                            {
                                value: subjects_display_list,//subjects[sub].name,
                                short: true,
                            },]

                    }
                ],
            }

            // bot.reply(message, reply_with_attachments);
            //}

            //console.log(subjects_display_list);
            // bot.reply(message, subjects_display_list);
            bot.startConversation(message, function (err, convo) {

                convo.addQuestion(reply_with_attachments, function (response, convo) {
                    //  console.log(response.text);


                    //convo.say was not working
                    isValidSubject(response.text, function (flag) {
                        if (flag == true) {
                            bot.reply(convo.source_message, 'Cool, you selected: ' + response.text);
                            getTutorsForSubject(response.text, function (json_file) {
                                var count = 0;
                                for (var i in json_file) {
                                    count = count + 1;
                                }
                                console.log("Json file length");
                                console.log(count);
                                if (count == 0) {
                                    bot.reply(message, "Sorry! There are no tutor avaible for this course");
                                }
                                else {
                                    for (var i in json_file) {
                                        bot.reply(message,
                                            {
                                                attachments:
                                                    [
                                                        {
                                                            fields:
                                                                [
                                                                    {
                                                                        title: 'Name',
                                                                        value: json_file[i].name,
                                                                        short: true,
                                                                    },
                                                                    {
                                                                        title: 'Email',
                                                                        value: json_file[i].email,
                                                                        short: true,
                                                                    },
                                                                    {
                                                                        title: 'Major',
                                                                        value: json_file[i].major,
                                                                        short: true,
                                                                    },
                                                                    {
                                                                        title: 'Degree',
                                                                        value: json_file[i].degree,
                                                                        short: true,
                                                                    },
                                                                    {
                                                                        title: 'Summary',
                                                                        value: json_file[i].summary,
                                                                        short: true,
                                                                    },
                                                                    {
                                                                        title: 'Rate',
                                                                        value: json_file[i].rate,
                                                                        short: true,
                                                                    },

                                                                ]
                                                        }
                                                    ]
                                            });
                                    }
                                }
                            });
                        }
                        else {
                            bot.reply(convo.source_message, 'Please select a valid subject.');
                            convo.repeat();
                        }
                    });

                    //TODO this method directly prints the list of tutors, TODO get name based on user id
                    //getTutorsForSubject(response.text);

                    //console.log(tutorList);
                    convo.next();
                }, {}, 'default');
                //});
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
    bot.reply(message, prompts.become_tutor_prompt);
});

var session_over = ['session a over','rate the tutor','add review','review']
controller.hears('review', 'direct_message', function(bot, message) {
    bot.reply(message, prompts.add_review_prompt);
});


app.get('/', (req, res) => {
    res.send('<h2>The Slash Command and Dialog app is running</h2> <p>Follow the' +
    ' instructions in the README to configure the Slack App and your environment variables.</p>');
})
;

app.post('/message', (req, res) => {

  var payload = JSON.parse(req.body.payload);
  var callback_id = payload.callback_id;
  const token = payload.token;
  const trigger_id = payload.trigger_id;
  if (token === process.env.SLACK_VERIFICATION_TOKEN) {

    if(callback_id=='become_tutor_prompt'){
      //console.log(payload);
      var checkValue = payload.actions[0].value;
      if (checkValue == 'no') {
        var text = 'Ok, you can enroll to become a tutor anytime.';
        action.send_message(payload.channel.id,text,[]);
      }
      else {
          // Yes on become a tutor prompt
          const dialog = {
          token: process.env.SLACK_ACCESS_TOKEN,
          trigger_id,
          dialog: JSON.stringify(dialogs.submit_tutor_info_dialog),
        };
        // open the dialog by calling dialogs.open method and sending the payload
        action.open_dialog(dialog,res);
        } // End of Else
      } // End of If

    else if(callback_id=='submit_tutor_info_dialog'){
      // immediately respond with a empty 200 response to let
      // Slack know the command was received
      action.send_message(payload.channel.id,'Thanks for submitting form',prompts.add_more_subjects_prompt);
      // create a tutor
      TutorModel.create_new_tutor(payload);
      //tutor.create(payload.user.id, payload.submission);
      res.send('');
    } // End of else if for submit tutor info
    else if (callback_id =='add_more_subjects_prompt') {
      var checkValue = payload.actions[0].value;
      if (checkValue == 'no') {
        // Get the availibility Prompt
        action.send_message(payload.channel.id,'Ok.',prompts.add_availability_prompt);
      } else {
        // Dialog for Adding a subject
        const dialog = {
        token: process.env.SLACK_ACCESS_TOKEN,
        trigger_id,
        dialog: JSON.stringify(dialogs.add_more_subjects_dialog),
        };
        // open the dialog by calling dialogs.open method and sending the payload
        action.open_dialog(dialog,res);
        //res.send('');
        // TODO Store in database subjects
      } // End of else for add more subjects
    } // End of else if for tutor add subjects
    else if (callback_id=='add_more_subjects_dialog') {
      action.send_message(payload.channel.id,'Additional subjects added',prompts.add_more_subjects_prompt);
      // TODO Store add more subjects
      TutorModel.add_more_subjects(payload);
      res.send('');
    }
    else if (callback_id=='add_availability_prompt') {
      const dialog = {
      token: process.env.SLACK_ACCESS_TOKEN,
      trigger_id,
      dialog: JSON.stringify(dialogs.add_availability_dialog),
      }
      // open the dialog by calling dialogs.open method and sending the payload
      action.open_dialog(dialog,res);
      //res.send('');
    } // End of else if for add more availability
    else if (callback_id=='add_availability_dialog') {
      // Add availability to Database
      TutorModel.add_availability(payload);
      // Get the availibility Prompt
      action.send_message(payload.channel.id,'Availability added.',prompts.add_more_availability_prompt);
      res.send('');
    } // End of else if of add availability dialog
    else if (callback_id=='add_more_availability_prompt') {
      var checkValue = payload.actions[0].value;
      if (checkValue == 'no') {
        action.send_message(payload.channel.id,'Ok. Thank you for enrolling as a tutor.')
      } else {
        // TutorModel.add_availability(payload);
        const dialog = {
        token: process.env.SLACK_ACCESS_TOKEN,
        trigger_id,
        dialog: JSON.stringify(dialogs.add_availability_dialog),
        }
        // open the dialog by calling dialogs.open method and sending the payload
        action.open_dialog(dialog,res);
      }
    } // End of else if of add more availability prompt
    else if(callback_id=='add_review_prompt'){
      const dialog = {
      token: process.env.SLACK_ACCESS_TOKEN,
      trigger_id,
      dialog: JSON.stringify(dialogs.add_review_dialog),
      }
      // open the dialog by calling dialogs.open method and sending the payload
      action.open_dialog(dialog,res);
    }// End of else if of add_review_prompt
    else if(callback_id=='add_review_dialog'){
      // TODO Store review and rating into database
      TutorModel.add_review(payload);
      action.send_message(payload.channel.id,'Thank you so much. #GoPack',[]);
      res.send('');
    }
    else {
      console.log('Reached Else');
      console.log(payload);
    }
  } else {
    debug('Verification token mismatch');
    console.log('Failed Here');
    res.sendStatus(403);
}});


app.post('/botactivity', (req, res) => {
    console.log(req['body']['event']['text']);
// Will need to verify the challenge parameter first
res.send("I am here");
//console.log(req['body']['event']['text']);
//res.send("I am here");
const query = req.body.event.text;
console.log(query);
if (query.match(/become a tutor/i)) {
    console.log('Yes He wants to bocome a Tutor');
}
else {
    console.log('No ');
}
console.log(req['body']);
res.send(req.body.challenge);
// console.log(req);
// res.send('');
})
;


app.listen(process.env.PORT, () => {
    console.log(`App listening on port ${process.env.PORT}!`);
})
;


function isValidSubject(mysubject, callback) {
    var flag = false;
    controller.storage.subject.find({name: {$regex: new RegExp(mysubject.toString(), "i")}/*subject.toString()*/},
        function (error, subject) {
            if (error) {
                //return false;
            }
            console.log(subject);
            if (subject.length > 0 && mysubject.toString().toLowerCase() == subject[0].name.toLowerCase()) {
                console.log('valid subject');
                flag = true;
            }

            callback(flag);
        });

}

function getUserForSubject(json_file, callback) {

    // console.log(json_file);
    // console.log("++++++++++++++++++++++");
    controller.storage.user.all(function (err, users) {
        for (var i in users) {
            // console.log(users[i]._id);
            for (var j in json_file) {
                if (json_file[j].user_id == users[i]._id) {
                    json_file[j].name = users[i].name;
                    json_file[j].email = users[i].email;
                }
            }
        }
        // console.log(json_file);
        callback(json_file);
    });

}

function getTutorsForSubject(subject, callback) {
    controller.storage.tutor.all(function (err, tutors) {
        //var tutorList = [];
        var json_file = {};
        //tutorList.push('Hello');
        // console.log(tutors);
        // console.log("------------------------------------");
        for (var i in tutors) {
            // console.log(i);

            //Iterate through all the subjects to check if that subject is in tutor list or not
            for (var j in tutors[i].subjects) {
                // console.log("++++++++++++++++++++++++++++");
                // console.log(j);
                //Check if that subject is taught by the tutor or not
                if (tutors[i].subjects[j].name == subject) {
                    //  tutorList.push(tutors[i].user_id);
                    // tutorList.push(tutors[i].user_id);

                    json_temp =
                        {
                            user_id: tutors[i].user_id,
                            major: tutors[i].major,
                            degree: tutors[i].degree,
                            summary: tutors[i].summary,
                            rate: tutors[i].overall_rating
                        }
                    json_file[tutors[i].user_id] = json_temp;
                }
            }
        }
        // for(var i in json_file)
        // {
        //  console.log(json_file[i].major);
        //  json_file[i].aaroh = "Aaroh";

        // }
        // console.log(json_file);
        // console.log("++++++++++++++++++++++++++");
        getUserForSubject(json_file, function (json_file) {
            // console.log(json_file);
            callback(json_file);
        });
    });
}

const sendConfirmation = (tutor) => {
    console.log("In confirmation");
    axios.post('https://slack.com/api/chat.postMessage', qs.stringify({
        token: process.env.SLACK_ACCESS_TOKEN,
        channel: tutor.userId,
        text: 'Tutor created!',
        attachments: JSON.stringify([
            {
                title: `Tutor profile created for ${tutor.userName}`,
                // Get this from the 3rd party helpdesk system
                //title_link: 'http://example.com',
                text: tutor.text,
                fields: [
                    {
                        title: 'Major',
                        value: tutor.major,
                        short: true,
                    },
                    {
                        title: 'Degree',
                        value: tutor.degree,
                        short: true,
                    },
                    {
                        title: 'Subjects',
                        value: tutor.subject,
                        short: true,
                    },
                    {
                        title: 'Rate',
                        value: tutor.rate,
                    },
                    {
                        title: 'Summary',
                        value: tutor.summary || 'None provided',
                    },
                ],
            },
        ]),
    })).then((result) => {
        debug('sendConfirmation: %o', result.data
)
    ;
}).
    catch((err) => {
        debug('sendConfirmation error: %o', err
)
    ;
    console.error(err);
})
    ;
}
;

//Added test method- to be removed.
controller.hears(['slots'], 'direct_message,direct_mention,mention', function (bot, message) {

    // start a conversation to handle this response.
    bot.startConversation(message, function (err, convo) {
        console.log('mongo');
        getAvailableSlotsTutor("5a760a1f734d1d3bd58c8d16", 1, function (reservationSlots) {//user_id from tutor information
            if (avl == '') {
                convo.addQuestion('No tutor information available', function (response, convo) {

                    // bot.reply('Cool, you said: ' + response.text);
                    convo.next();

                }, {}, 'default');
            }
            console.log(avl);

        });
        console.log('mongo');

    })

});
//TODO my reservations option 14
function getAvailableSlotsTutor(tutorId, userId, callback) {
    //TODO reward points
    //**Check reward points of the user/tutee trying to reserve, give an error if he is left with insufficent points
    //**Get the availabilty of tutor
    controller.storage.tutor.find({user_id: tutorId}, function (error, tutor) {
        //no chances of invalid tutor id
        //console.log(tutor);
        if (tutor.length == 0) {
            //avl = 'No tutor found';
            return;//is return ok? or should I throw an exception?
        }
        else
            var avl = tutor[0].availability;
        //TODO remove it
        userId = '5a760a1f734d1d3bd58c8d16';//using dummy user id

        //**get availabilities of the tutor for the tutee

        var currentDate = new Date();
        var currentDay = currentDate.getDay();
        var currentDateOnly = currentDate.getDate()
        //console.log(currentDate+' '+currentDay+' '+currentDateOnly);

        var dayMap = {};
        dayMap[0] = {day: 'Sunday'};
        dayMap[1] = {day: 'Monday'};
        dayMap[2] = {day: 'Tuesday'};
        dayMap[3] = {day: 'Wednesday'};
        dayMap[4] = {day: 'Thursday'};
        dayMap[5] = {day: 'Friday'};
        dayMap[6] = {day: 'Saturday'};

        //console.log('dayMap[5]'+dayMap[5].day);

        var dayNumMap = {};
        dayNumMap['Sunday'] = {day: '0'};
        dayNumMap['Monday'] = {day: '1'};
        dayNumMap['Tuesday'] = {day: '2'};
        dayNumMap['Wednesday'] = {day: '3'};
        dayNumMap['Thursday'] = {day: '4'};
        dayNumMap['Friday'] = {day: '5'};
        dayNumMap['Saturday'] = {day: '6'};

        //console.log('dayNumMap[Friday]'+dayNumMap['Friday'].day);

        var reservationSlots = {};
        //dummy entry of date TODO REMOVE
        //TODO test with starting day as wednesday
        //reservationSlots[currentDate.toString()+''+currentDate.getDay()]={Date:futureDate,Day:futureDay, from:'1900',to:'2000',available:'yes'};
        console.log(currentDate.toString() + '' + currentDate.getDay());
        for (var i in avl) {
            var availableDay = avl[i].day;
            var numberOfDays = (7 - currentDay + dayNumMap[availableDay].day) % 7;
            var futureDay = dayMap[numberOfDays].day;
            var futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + numberOfDays);
            //console.log(currentDate+' '+currentDay+' '+numberOfDays+' '+futureDate+' '+futureDay);
            console.log('future time stamp ' + futureDate.toString() + '' + futureDay);
            reservationSlots[futureDate.toString() + '' + futureDay] = {
                Date: futureDate,
                Day: futureDay,
                from: avl[i].from,
                to: avl[i].to,
                available: 'yes'
            };
        }

        //**Get existing reservation for the tutor, (what if tutee is busy at that time as per his old
        //reservation-tutee is busy at that time)

        controller.storage.reservation.find({tutorid: tutorId, active: 'yes'}, function (error, reservations) {
            //TODO null check for reservations
            //if(reservations.length==0)
            if (reservations.length > 0) {
                //console.log(reservations);
                for (var i in reservations) {
                    //TODO mark reservations as active:'No' when a user reviews an old reservation
                    //when you pull out reservations, make sure to mark the inactive ones as no, check current date and
                    //if the reservation date has passed mark them inactive.
                    /* if (reservations[i].date.getTime() < currentDate.getTime()) {
                         console.log('inactive yes');
                         //update old reservation, i.e. make it inactive
                         controller.storage.reservation.save
                     }*/

                    //find that reservation in my list of reservations and mark as available to no,
                    //we can make reservation slots as hashmap and easily search for a reservation based on
                    //date+day concatanated string

                    var reservationDay = new Date(reservations[i].date.toString());

                    var existingReservationTimeStamp = reservationDay.toString() + '' + reservationDay.getDay();
                    //console.log('existingReservationTimeStamp :' + existingReservationTimeStamp);
                    if (reservationSlots[existingReservationTimeStamp] != null) {
                        reservationSlots[existingReservationTimeStamp].available = 'No';
                        //console.log('Match as implanted!');
                    } //else
                    //console.log('Yikes!');
                    //return reservation logs
                }
            }
        });
        console.log('I am beyond save of reservation');
        callback(reservationSlots);
    });
}

//save reservation if user clicks on book button
function saveReservation(userId, tutorId, date, day, from, to) {
    //does not save if you donot send an id, if this id is sent as the same, old reservation is overwritten,[TBC]
    var reservation = {
        id: '5a80931df36d28314de95a74', tutorid: tutorId, userid: userId, date: currentDate, from: '0900', to: '1030',
        active: 'yes'
    };
    controller.storage.reservation.save(reservation, function (error) {
        if (error)
            console.log('There is an error');
    });

}

//bot.reply(message, {
//  attachments:
//  [
//    {
//    fields: [
//            {
//                title: 'Major',
//                value: tutors[i].subjects,
//                short:true,
//        },
//        {
//                title: 'Degree',
//                value: tutors[i].degree,
//                short:true,
//        }

//      ]
//    }
//  ]
// });


// controller.storage.tutor.all(function(err,tutors){
// for(var i in tutors) {
//  console.log(i);
//  //console.log("+++++++++++++++++++++++++++++++++++++++++++++++");
//  // console.log(tutors[i].subjects);
//  //sendConfirmation(tutors);
//  for(var j in tutors[i].subjects)
//  {
//    // console.log(tutors[i].subjects[j].name);
//    if (tutors[i].subjects[j].name == response.text)
//    {
//      var user_details;
//      controller.storage.user.all(function(err,users){
//        // console.log("+++++++++++++++++++++++++++++++++++++++++++++++");
//        // console.log(tutors[i]);
//        for (var ids in users)
//        {
//          // console.log(tutors[i].user_id);
//          // console.log(users[ids]._id);
//          if (tutors[i].user_id == users[ids]._id)
//          {
//            user_details = users[ids];
//            console.log("---------------------------------------");
//            console.log(user_details);
//            break;
//          }
//        }
//      });
//      console.log(user_details);
//      //console.log(users[ids]);
//      bot.reply(message, {
//        attachments:
//        [
//          {
//          fields: [
//                  {
//                      title: 'Major',
//                      value: tutors[i].subjects,
//                      short:true,
//              },
//              {
//                      title: 'Degree',
//                      value: tutors[i].degree,
//                      short:true,
//              }

//            ]
//          }
//        ]
//      });
//    }
//  }
// }
// });