
const http = require("http");
const https = require("https");
const jsdom = require("jsdom");
const jquery = require("jquery");
const xml2js = require("xml2js");
const url = require('url');
const port = process.env.PORT || 8000;

let weatherMapUrl = "";
let weatherInfo = {};
let weathers = [];
let news = [];
let whatDays = [];
let regionCode = undefined;
let isHttps = false;

const getWeatherMapPromise = _ => new Promise((resolve, reject) => {
	https.get("https://www.jma.go.jp/bosai/weather_map/data/list.json", res => {
		let body = "";
		res.on("data", chunk => body += chunk);
		res.on("end", _ => {
			try {
				let json = JSON.parse(body);
				weatherMapUrl = "https://www.jma.go.jp/bosai/weather_map/data/png/" + json["near"]["now"][json["near"]["now"].length - 1];
				resolve();
				// https.get(weatherMapUrl, res2 => {
				// 	let body2 = [];
				// 	res2.on("data", chunk2 => body2.push(chunk2));
				// 	res2.on("end", _ => {
				// 		weatherMapUrl = "data:image/png;charset=utf-8;base64," + Buffer.concat(body2).toString('base64');
				// 		resolve();
				// 	});
				// }).on("error", error2 => {
				// 	console.error(error2.message);
				// 	reject(error);
				// });
			} catch (error) {
				console.error(error);
				reject(error);
			}
		});
	}).on("error", error => {
		console.error(error);
		reject(error);
	})
});

const getWeatherPromise = _ => new Promise((resolve, reject) => {
	if (regionCode == undefined) {
		regionCode = 130000;
	}
	https.get("https://www.jma.go.jp/bosai/forecast/data/forecast/" + regionCode + ".json", res => {
		let body = "";
		res.on("data", chunk => body += chunk);
		res.on("end", _ => {
			try {
				let json = JSON.parse(body);
				weatherInfo = {
					region: json[1]["timeSeries"][1]["areas"][0]["area"]["name"],
					date: json[0]["reportDatetime"]
				};
				weathers = [];
				for (let i = 0; i < json[0]["timeSeries"][0]["timeDefines"].length; i++) {
					let weather = {
						date: json[0]["timeSeries"][0]["timeDefines"][i],
						name: json[0]["timeSeries"][0]["areas"][0]["weathers"][i],
						temperature: "--"
					};
					let dateDefined = new Date(json[0]["timeSeries"][0]["timeDefines"][i]);
					for (let j = 0; j < json[1]["timeSeries"][0]["timeDefines"].length; j++) {
						let dateCurrent = new Date(json[1]["timeSeries"][0]["timeDefines"][j]);
						if (dateDefined.getYear() === dateCurrent.getYear() && dateDefined.getMonth() === dateCurrent.getMonth() && dateDefined.getDate() === dateCurrent.getDate()) {
							if (json[1]["timeSeries"][1]["areas"][0]["tempsMin"][j] === ''
								|| json[1]["timeSeries"][1]["areas"][0]["tempsMax"][j] === '') {
								 continue;
							}
							weather.temperature = json[1]["timeSeries"][1]["areas"][0]["tempsMin"][j] + "℃ / " + json[1]["timeSeries"][1]["areas"][0]["tempsMax"][j] + "℃";
							break;
						}
					}
					weathers.push(weather);
				}
				if (json[0]["timeSeries"][2]["areas"][0]["temps"].length >= 4) {
					weathers[0].temperature = "-- / " + json[0]["timeSeries"][2]["areas"][0]["temps"][1] + "℃";
					weathers[1].temperature = json[0]["timeSeries"][2]["areas"][0]["temps"][2] + "℃ / " + json[0]["timeSeries"][2]["areas"][0]["temps"][3] + "℃";
				} else {
					weathers[1].temperature = json[0]["timeSeries"][2]["areas"][0]["temps"][0] + "℃ / " + json[0]["timeSeries"][2]["areas"][0]["temps"][1] + "℃";
				}
				resolve();
			} catch (error) {
				regionCode = undefined;

				console.error(error);
				reject(error);
			}
		});
	}).on("error", error => {
		console.error(error);
		reject(error);
	})
});

const getWarningPromise = _ => new Promise((resolve, reject) => {
	https.get("https://www.jma.go.jp/bosai/warning/data/warning/" + regionCode + ".json", res => {
		let body = "";
		res.on("data", chunk => body += chunk);
		res.on("end", _ => {
			try {
				let json = JSON.parse(body);
				warning = json.headlineText;
				resolve();
			} catch (error) {
				console.error(error);
				reject(error);
			}
		});
	}).on("error", error => {
		console.error(error);
		reject(error);
	})
});

const getNewsPromise = _ => new Promise((resolve, reject) => {
	https.get("https://news.yahoo.co.jp/rss/topics/top-picks.xml", res => {
		let body = "";
		res.on("data", chunk => body += chunk);
		res.on("end", _ => {
			xml2js.parseString(body, (error, result) => {
				if (error) {
					console.error(error);
					reject(error);
				} else {
					news = [];
					for (let i = 0; i < result['rss']['channel'][0]['item'].length; i++) {
						let item = {
							date: result['rss']['channel'][0]['item'][i]['pubDate'],
							title: result['rss']['channel'][0]['item'][i]['title']
						};
						news.push(item);
					}
					resolve();
				}
			});
		});
	}).on("error", error => {
		console.error(error);
		reject(error);
	})
});

const getWhatDayIsTodayPromise = _ => new Promise((resolve, reject) => {
	let today = new Date();
	https.get("https://ja.wikipedia.org/w/api.php?format=json&utf8&action=query&prop=revisions&rvprop=content&titles=Wikipedia:今日は何の日_" + (today.getMonth() + 1) + "月", res => {
		let body = "";
		res.on("data", chunk => body += chunk);
		res.on("end", _ => {
			try {
				let json = JSON.parse(body);

				let pageid = [];
				for( var id in json.query.pages ) {
				  pageid.push( id );
				}

				let content = json.query.pages[pageid[0]].revisions[0]['*'];
				let contentSplit = content.split("\n");
				let isCurrentDate = false;
				whatDays = [];
				for (let i = 0; i < contentSplit.length; i++) {
					if (isCurrentDate == false) {
						if (contentSplit[i].indexOf("[[" + (today.getMonth() + 1) + "月" + today.getDate() + "日]]") >= 0) {
							isCurrentDate = true;
						}
					} else {
						if (contentSplit[i].length == 0) {
							break;
						}
						whatDays.push(contentSplit[i].replaceAll("* ", "").replaceAll(/\[\[.*\|/g, "").replaceAll("[", "").replaceAll("]", ""));
					}
				}
				console.dir(whatDays);
				resolve();
			} catch (error) {
				console.error(error);
				reject(error);
			}

			resolve();
		});
	}).on("error", error => {
		console.error(error);
		reject(error);
	})
});

const dateLabels = ['日', '月', '火', '水', '木', '金', '土'];
const stemLabels = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const branchLabels = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

function getDefaultContent() {
	let today = new Date();
	let todayJST = new Date(new Date().toLocaleString({ timeZone: 'Asia/Tokyo' }));

	let content = `
<head>
<meta charset="UTF-8">
<title>Dumb Portal</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0, minimin-scale=0.1, user-scalable=yes">
<style>td{padding:0;}</style>
</head>
<body style="background:#aaa; position: relative; min-width: 720px; min-height:500px; text-align: center;">
<div id="content" style="width:720px; height:500px; margin: auto; background:#fff; position: absolute; top:0; bottom:0; left:0; right:0; z-index: 1; text-align: center;">
<table style="width: 100%; height: 100%; border:0; border-spacing:0; text-shadow:1px 1px 3px #8884;">
<tr style="background:#111;">
<th colspan="2" style="color: white; background:#111 linear-gradient(#111, #222); height:60px;">
<div>
<span id="time" style="font-size: xx-large; vertical-align: middle;"></span>
&nbsp;&nbsp;
<span id="lunar" style="background: yellow; width:24px; height: 24px; border-radius: 24px; color: black; font-size: small; display: inline-block; text-align: center; vertical-align: middle; line-height: 24px;">
${(((((today.getYear() + 1900 - 2009) % 19) * 11 + (today.getMonth() + 1) + today.getDate()) +1) % 30)}
</span> 
<span id="stem" style="background: brown; width:24px; height: 24px; color: white; font-size: small; display: inline-block; text-align: center; vertical-align: middle; line-height: 24px;">
${stemLabels[Math.floor(todayJST.getTime() / 1000 / 60 / 60 / 24 + 7) % 10]}
</span> 
<span id="branch" style="background: green; width:24px; height: 24px; color: white; font-size: small; display: inline-block; text-align: center; vertical-align: middle; line-height: 24px;">
${branchLabels[Math.floor(todayJST.getTime() / 1000 / 60 / 60 / 24 + 5) % 12]}
</span>
</div>
</th>
</tr>
<tr>
<td style="text-align: center; vertical-align: middle;">
<img width="288px" height="288px" style="max-width: 288px; max-height: 288px;" src="/weather_map.png">
<marquee style="font-size: medium; text-align: left; padding: 2px; color: red;">${warning}</marquee>
</td>
<td>
<table style="width: 360px; height: 320px; border-spacing:0; background: #bbb;">
${news.map(n => "<tr><td style='background: #bbb linear-gradient(#bbb, #ccc); height:40px; font-size: large;'><span style='padding:2px 8px;'>" + n.title + "</span></td></tr>").join('')}
</table>
</td>
</tr>
<tr>
<td colspan="2">
<table style="font-size: medium; width: 720px; height:92px; text-align: left; border:0; background: #eee linear-gradient(#eee, #fff); border-spacing: 0;">
<tr>
<th rowspan="3" style="text-align: center; background: #ddd;">
${(new Date(weatherInfo.date).getMonth() + 1) + "/" + (new Date(weatherInfo.date).getDate()) + " (" + dateLabels[new Date(weatherInfo.date).getDay()] + ")" + " 発表"}<br />
${weatherInfo.region} の天気
</th>
${weathers.map(w => "<th style='padding: 2px 8px; white-space: nowrap;'>" + ((new Date(w.date)).getMonth() + 1) + "/" + (new Date(w.date)).getDate() + " (" + dateLabels[(new Date(w.date)).getDay()] + ")" + "</th>" + "<td style='white-space: nowrap; text-overflow: ellipsis;'>" + w.name.replaceAll('　',' ') + "</td>" + "<td style='white-space: nowrap;'>" + w.temperature + "</td></tr><tr>").join('')}
</tr>
</table>
</td>
</tr>
<tr>
<td colspan="2">
<div style="background: #444; color: white; text-align: center; font-size: small; height: 28px; line-height: 27px;">Powered by <a href="https://www.jma.go.jp/jma/index.html" target="_blank" style="color: white;">Japan Meteorological Agency</a> & <a href="https://news.yahoo.co.jp/" target="_blank" style="color: white;">Yahoo! News</a></div>
</td>
</tr>
</table>
</div>
<script>
var dateLabels=['日','月','火','水','木','金','土'];function printTime(){setTimeout(printTime, 1000); var date = new Date(); document.getElementById('time').innerText=''+(date.getFullYear())+'/'+('00'+(date.getMonth()+1)).slice(-2)+'/'+('00'+(date.getDate())).slice(-2)+'('+dateLabels[date.getDay()]+')'+' '+date.getHours()+':'+('00'+date.getMinutes()).slice(-2)+':'+('00'+date.getSeconds()).slice(-2);}printTime();
</script>
</body>
	`;

	return content;
}

function getMobileContent() {
	let today = new Date();
	let todayJST = new Date(new Date().toLocaleString({ timeZone: 'Asia/Tokyo' }));

	let content = `
<head>
<meta charset="UTF-8">
<title>Dumb Portal</title>
</head>
<body>
<p>${(today.getFullYear())+'/'+('00'+(today.getMonth()+1)).slice(-2)+'/'+('00'+(today.getDate())).slice(-2)+'('+dateLabels[today.getDay()]+')'}</p>
<p id="time"></p>
<h1>ニュース</h1>
${news.map(n => "<p>" + n.title + "</p>").join('')}
<h1>天気</h1>
${weathers.map(w => "<h2>" + ((new Date(w.date)).getMonth() + 1) + "/" + (new Date(w.date)).getDate() + " (" + dateLabels[(new Date(w.date)).getDay()] + ")" + "</h2>" + "<p>" + w.name.replaceAll('　',' ') + "</p>" + "<p>" + w.temperature + "</p>").join('')}
<script>
function printTime(){setTimeout(printTime, 1000); var date = new Date(); document.getElementById('time').innerText=''+date.getHours()+':'+('00'+date.getMinutes()).slice(-2)+':'+('00'+date.getSeconds()).slice(-2);}printTime();
</script>
</body>
	`;

	return content;
}

const server = http.createServer((request, response) => {
	isHttps = request.url.indexOf("https://") == 0;

	let parsedUrl = url.parse(request.url, true);
	if (parsedUrl.query.region != undefined) {
		regionCode = parsedUrl.query.region;
	}

	if (parsedUrl.pathname == '/') {
		const allPromise = Promise.all([getWeatherPromise(), getNewsPromise(), getWarningPromise()]).then(_ => {
			response.writeHead(200, {
				"Content-Type": "text/html"
			});

			let content = getDefaultContent();

		    response.end(content);
		    // console.log(`Sent a response : ${content}`);
		}).catch(error => {
			response.writeHead(500, {
				"Content-Type": "text/html"
			});
			response.end(error.message);
		});
		return;
	}

	if (parsedUrl.pathname == '/mobile') {
		const allPromise = Promise.all([getWeatherPromise(), getNewsPromise(), getWarningPromise()]).then(_ => {
			response.writeHead(200, {
				"Content-Type": "text/html"
			});

			let content = getMobileContent();

		    response.end(content);
		    // console.log(`Sent a response : ${content}`);
		}).catch(error => {
			response.writeHead(500, {
				"Content-Type": "text/html"
			});
			response.end(error.message);
		});
		return;
	}

	if (parsedUrl.pathname == '/weather_map.png') {
		const allPromise = Promise.all([getWeatherMapPromise()]).then(_ => {
			https.get(weatherMapUrl, res2 => {
				let body2 = [];
				res2.on("data", chunk2 => {
					body2.push(chunk2);
				});
				res2.on("end", _ => {
					let concatBody2 = Buffer.concat(body2);
					response.writeHead(200, {
						"Content-Type": "image/png",
        				"Content-Length": concatBody2.length
					});
					response.end(concatBody2);
				});
				res2.on("error", error2 => {
					console.error(error2.message);
				})
			}).on("error", error2 => {
				console.error(error2.message);
			});
		}).catch(error => {
			response.writeHead(500, {
				"Content-Type": "text/html"
			});
			response.end(error.message);
		});
		return;
	}

	response.writeHead(404);
	response.end();
	return;
});

server.listen(port);
console.log("Server started on port " + port);


