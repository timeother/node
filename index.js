var express = require('express');
var request = require('request');
var moment = require('moment');
const cheerio = require('cheerio');
const jsesc = require('jsesc');
const https = require('https');

var app = express();
var min_position = "";
var my_array = new Array();

app.get('/', function (req, res) {
  if (min_position) {
    res.send((new Date).toISOString() + ' ' + min_position);
  } else {
    res.send((new Date).toISOString() + ' waiting...');
  }
});

app.listen(process.env.PORT || 3000);

var customHeaderRequest = request.defaults({
    headers: {'User-Agent': process.env.USER_AGENT }
})

setInterval(function() {
  const update_options = {
    hostname: process.env.UPDATE_HOSTNAME,
    port: 443,
    path: process.env.UPDATE_PATH+encodeURIComponent(min_position),
    method: 'GET',
    headers: {
    'User-Agent': process.env.USER_AGENT
    }
  };
  const update_req = https.request(update_options, (res) => {
    res.setEncoding("utf8"); // makes sure that "chunk" is a string.
    let updateFullBody = "";
    res.on("data", data => {
    updateFullBody += data;
    });
    res.on("end", () => {
    try {
      var myObj = JSON.parse(updateFullBody);
      if (typeof myObj.max_position !== typeof undefined && myObj.max_position !== false) {
      min_position = myObj.max_position;
      if (typeof myObj.items_html !== typeof undefined && myObj.items_html !== false) {
        const $ = cheerio.load(myObj.items_html);
        $('.js-stream-tweet').each(function(i, elem) {
        var ReplyingToContextBelowAuthor = $(this).find(".ReplyingToContextBelowAuthor");
        var twitter_atreply = $(this).find(".twitter-atreply");
        if (ReplyingToContextBelowAuthor.length == 0 && twitter_atreply.length == 0) {
          var permalink_path = $(this).attr('data-permalink-path');
          var data_screen_name = $(this).attr('data-screen-name');
          var data_time_ms = parseInt($(this).find("small.time span.js-short-timestamp").attr("data-time-ms"));
          var items = {};
          $(this).find('a').each(function (index, element) {
          var data_expanded_url = $(element).attr('data-expanded-url');
          if (typeof data_expanded_url !== typeof undefined && data_expanded_url !== false) {
            items[data_expanded_url] = true;
          }
          });
          for(var i in items) {
          my_array.push({permalink_path:permalink_path, data_screen_name:data_screen_name, data_time_ms:data_time_ms, data_expanded_url:i});
          }
        }
        });
      }
      }
    } catch(e) {
    }
    });
  });
  update_req.on('error', (e) => {
    console.error(e);
  });
  update_req.end();
}, 30000); // every 30 seconds (30000)


setInterval(function() {
  var temp_obj = my_array.pop();
  if (temp_obj != undefined) {
    var temp_data_expanded_url = temp_obj.data_expanded_url;
    if (temp_data_expanded_url.startsWith(process.env.URL_FILTER) && temp_data_expanded_url.includes('tag')) {
      var d = new Date(temp_obj.data_time_ms);
      var h = d.getHours();
      var re = /.*tag=(.*?)&.*/;
      var hashtag = temp_obj.data_expanded_url.replace(re, "$1");
      if (hashtag && hashtag != 'Y8LRCLVC' && h >= 12) {
        var player_profile =
          "<" + encodeURI(process.env.SR_URL+hashtag) + ">\n" +
          "<" + encodeURI(process.env.DS_URL+hashtag) + ">\n" +
          "<" + encodeURI(process.env.RA_URL+hashtag) + ">";
        var friend_link = encodeURI(temp_obj.data_expanded_url);
        var goqrme = encodeURI(process.env.QR_URL)+encodeURIComponent(temp_obj.data_expanded_url);
        var player_post =
            "<" + encodeURI(process.env.UPDATE_URL_DOMAIN+"/"+temp_obj.data_screen_name) + ">\n" +
            encodeURI(process.env.UPDATE_URL_DOMAIN+temp_obj.permalink_path);
        customHeaderRequest.get(process.env.RA_URL+hashtag, function(err, resp, bdy){
          var url = process.env.WEBHOOK_FILTERED_URL;
          var player_name = "";
          var trophies = "N/A";
          var best_season = "N/A";
          var best_season_rank = "N/A";
          var best_season_date = "N/A";
          var previous_season = "N/A";
          var previous_season_best = "";
          var max_wins = "N/A";
          var cards_won = "N/A";
          var experience = "N/A";
          if (err){
            url = process.env.WEBHOOK_UNKNOWN_URL;
            console.log(err);
          } else {
            const $ = cheerio.load(bdy);
            var text_header = $('h1.header').first().text();
            if (typeof text_header !== typeof undefined && text_header !== false) {
              player_name = text_header.trim() + ' ';
            }
            var text_item = $('div.horizontal').first().children().first().text();
            if (typeof text_item !== typeof undefined && text_item !== false) {
              trophies = text_item.trim().replace(/\s{2,}/g,' ');
            }
            var text_td_best_season_rank = $("img[src$='rank.png']").first().parent().find('tr').eq(2).find('td').eq(1).text();
            if (typeof text_td_best_season_rank !== typeof undefined && text_td_best_season_rank !== false) {
              best_season_rank = text_td_best_season_rank.trim().replace(/\s{2,}/g,' ');
            }
            var text_td_best_season = $("img[src$='rank.png']").first().parent().find('tr').eq(3).find('td').eq(1).text();
            if (typeof text_td_best_season !== typeof undefined && text_td_best_season !== false) {
              best_season = text_td_best_season.trim().replace(/\s{2,}/g,' ');
            }
            var text_td_best_season_date = $("img[src$='rank.png']").first().parent().find('tr').eq(4).find('td').eq(1).text();
            if (typeof text_td_best_season_date !== typeof undefined && text_td_best_season_date !== false) {
              best_season_date = text_td_best_season_date.trim().replace(/\s{2,}/g,' ');
            }
            var text_td_previous_season = $("img[src$='rank.png']").first().parent().find('tr').eq(-2).find('td').eq(1).text();
            if (typeof text_td_previous_season !== typeof undefined && text_td_previous_season !== false) {
              previous_season = text_td_previous_season.trim().replace(/\s{2,}/g,' ');
            }
            var text_td_previous_season_best = $("img[src$='rank.png']").first().parent().find('tr').eq(-1).find('td').eq(1).text();
            if (typeof text_td_previous_season_best !== typeof undefined && text_td_previous_season_best !== false) {
              previous_season_best = " / " + text_td_previous_season_best.trim().replace(/\s{2,}/g,' ');
            }
            var text_td_max_wins = $("img[src$='tournament.png']").first().parent().find('tr').eq(1).find('td').eq(1).text();
            if (typeof text_td_max_wins !== typeof undefined && text_td_max_wins !== false) {
              max_wins = text_td_max_wins.trim().replace(/\s{2,}/g,' ');
            }
            var text_td_cards_won = $("img[src$='tournament.png']").first().parent().find('tr').eq(2).find('td').eq(1).text();
            if (typeof text_td_cards_won !== typeof undefined && text_td_cards_won !== false) {
              cards_won = text_td_cards_won.trim().replace(/\s{2,}/g,' ');
            }
            var text_td_experience = $("img[src$='cards.png']").first().parent().find('tr').eq(0).find('td').eq(1).text();
            if (typeof text_td_experience !== typeof undefined && text_td_experience !== false) {
              experience = text_td_experience.trim().replace(/\s{2,}/g,' ');
            }
          }
          if (trophies.includes('7,') || trophies.includes('8,') || trophies.includes('N/A')) {
            request({
              url: url,
              method: "POST",
              json: {
                "username": "Tweet",
                "avatar_url": "https://i.imgur.com/0w906h7.png",
                "embeds": [
                  {
                    "author": {
                      "name": player_name + "#" + hashtag,
                      "icon_url": "https://i.imgur.com/nMRazCT.png"
                    },
                    "color": 5746931,
                    "timestamp": moment(temp_obj.data_time_ms).format('YYYY-MM-DD[T]HH:mm:ss.SSS') + "Z",
                    "fields": [
                      {
                        "name": "Trophies",
                        "value": trophies
                      },
                      {
                        "name": "Best Season Rank",
                        "value": best_season_rank
                      },
                      {
                        "name": "Best Season Trophies",
                        "value": best_season
                      },
                      {
                        "name": "Best Season Date",
                        "value": best_season_date
                      },
                      {
                        "name": "Previous Season",
                        "value": previous_season + previous_season_best
                      },
                      {
                        "name": "Max Wins",
                        "value": max_wins
                      },
                      {
                        "name": "Cards Won",
                        "value": cards_won
                      },
                      {
                        "name": "Experience",
                        "value": experience
                      },
                      {
                        "name": "Player Profile",
                        "value": player_profile
                      },
                      {
                        "name": "Post",
                        "value": player_post
                      },
                      {
                        "name": "Friend Link",
                        "value": friend_link
                      }
                    ],
                    "image": {
                      "url": goqrme
                    },
                    "footer": {
                      "text": moment(temp_obj.data_time_ms).format('YYYY-MM-DD[T]HH:mm:ss.SSS') + "Z"
                    }
                  }
                ]
              }
            }, function (error, response, body) {
              if (error){
                console.log(error);
                //my_array.unshift(temp_obj);
              }
            });
          }
        });
      }
    }
  }
}, 6457); // every 6.457 seconds (6457)

setInterval(function() {
  var d = new Date((new Date).getTime());
  var h = d.getHours();
  if ( h < 12) {
    customHeaderRequest.get(process.env.AM_URL, function(err, resp, body){});
  } else {
    customHeaderRequest.get(process.env.PM_URL, function(err, resp, body){});
  }
  if ( h == 23) {
    customHeaderRequest.get(process.env.AM_URL, function(err, resp, body){});
  }
  if ( h == 11) {
    customHeaderRequest.get(process.env.PM_URL, function(err, resp, body){});
  }
}, 300000); // every 5 minutes (300000)
