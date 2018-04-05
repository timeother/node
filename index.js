var express = require('express');
var request = require('request');
const cheerio = require('cheerio');

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
  if (min_position) {
    customHeaderRequest.get(process.env.UPDATE_URL+min_position, function(err, resp, body){
      try {
        var myObj = JSON.parse(body);
        if (typeof myObj.max_position !== typeof undefined && myObj.max_position !== false) {
          min_position = myObj.max_position;
          if (typeof myObj.items_html !== typeof undefined && myObj.items_html !== false) {
            const $ = cheerio.load(myObj.items_html);
            $('.js-stream-tweet').each(function(i, elem) {
              var ReplyingToContextBelowAuthor = $(this).find(".ReplyingToContextBelowAuthor");
              var twitter_atreply = $(this).find(".twitter-atreply");
              if (ReplyingToContextBelowAuthor.length == 0 && twitter_atreply.length == 0) {
                var permalink_path = $(this).attr('data-permalink-path');
                var data_time_ms = parseInt($(this).find("small.time span.js-short-timestamp").attr("data-time-ms"));
                $(this).find('a').each(function (index, element) {
                  var data_expanded_url = $(element).attr('data-expanded-url');
                  if (typeof data_expanded_url !== typeof undefined && data_expanded_url !== false) {
                    my_array.push({permalink_path:permalink_path, data_time_ms:data_time_ms, data_expanded_url:data_expanded_url});
                  }
                });
              }
            });
          }
        }
      } catch(e) {
      }
    });
  } else {
    customHeaderRequest.get(process.env.SEARCH_URL, function(err, resp, body){
      const $ = cheerio.load(body);
      var attr_min_pos = $('.stream-container').attr('data-min-position');
      if (typeof attr_min_pos !== typeof undefined && attr_min_pos !== false) {
        min_position = attr_min_pos;
      }
    });
  }
}, 30000); // every 30 seconds (30000)


setInterval(function() {
  var temp_obj = my_array.pop();
  if (temp_obj != undefined) {
    var temp_data_expanded_url = temp_obj.data_expanded_url;
    if (temp_data_expanded_url.startsWith(process.env.URL_FILTER) && temp_data_expanded_url.includes('tag')) {
      var d = new Date(temp_obj.data_time_ms);
      var h = d.getHours();
      var time_stamp = d.toISOString();
      var re = /.*tag=(.*?)&.*/;
      var hashtag = temp_obj.data_expanded_url.replace(re, "$1");
      if (hashtag && hashtag != 'Y8LRCLVC' && hashtag != 'LY8LJYU9' && h >= 12) {
        var player_profile =
          "<" + encodeURI(process.env.SR_URL+hashtag) + ">\n" +
          "<" + encodeURI(process.env.DS_URL+hashtag) + ">\n" +
          "<" + encodeURI(process.env.RA_URL+hashtag) + ">";
        var friend_link = encodeURI(temp_obj.data_expanded_url);
        var goqrme = encodeURI(process.env.QR_URL)+encodeURIComponent(temp_obj.data_expanded_url);
        var player_post = encodeURI(process.env.UPDATE_URL_DOMAIN+temp_obj.permalink_path);
        customHeaderRequest.get(process.env.RA_URL+hashtag, function(err, resp, bdy){
          var url = process.env.WEBHOOK_FILTERED_URL;
          var player_name = "";
          var trophies = "N/A";
          if (err){
            url = process.env.WEBHOOK_UNKNOWN_URL;
            console.log(err);
          } else {
            const $ = cheerio.load(bdy);
            var text_header = $('h1.header').first().text();
            if (typeof text_header !== typeof undefined && text_header !== false) {
              player_name = text_header.trim() + " ";
            }
            var text_item = $('.horizontal').first().children().first().text();
            if (typeof text_item !== typeof undefined && text_item !== false) {
              trophies = text_item.trim().replace(/\s{2,}/g,' ');
            }
          }
          if (trophies.includes('5,2') || trophies.includes('5,3') || trophies.includes('5,4') || trophies.includes('5,5') || trophies.includes('5,6') || trophies.includes('5,7') || trophies.includes('5,8') || trophies.includes('5,9') || trophies.includes('6,') || trophies.includes('7,') || trophies.includes('N/A')) {
            request({
              url: url,
              method: "POST",
              json: {
                "username": "Tweet",
                "avatar_url": "https://i.imgur.com/0w906h7.png",
                "embeds": [
                  {
                    "author": {
                      "name":  player_name + "#" + hashtag,
                      "icon_url": "https://i.imgur.com/nMRazCT.png"
                    },
                    "color": 5746931,
                    "timestamp": time_stamp,
                    "fields": [
                      {
                        "name": "Trophies",
                        "value": trophies
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
                    }
                  }
                ]
              }
            }, function (error, response, body) {
              if (error){
                console.log(error);
                my_array.push(temp_obj);
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
