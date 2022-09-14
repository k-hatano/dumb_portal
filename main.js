
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
let regionCode = 130000;

const getWeatherMapPromise = _ => new Promise((resolve, reject) => {
	https.get("https://www.jma.go.jp/bosai/weather_map/data/list.json", res => {
		let body = "";
		res.on("data", chunk => body += chunk);
		res.on("end", _ => {
			try {
				let json = JSON.parse(body);
				weatherMapUrl = "https://www.jma.go.jp/bosai/weather_map/data/png/" + json["near"]["now"][json["near"]["now"].length - 1];
				resolve();
			} catch (error) {
				console.error(error.message);
				reject();
			}
		});
	}).on("error", erro => {
		console.error(error.message);
		reject();
	})
});

const getWeatherPromise = _ => new Promise((resolve, reject) => {
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
					for (let j = 0; j < json[1]["timeSeries"][0]["timeDefines"][0].length; j++) {
						if (json[1]["timeSeries"][0]["timeDefines"][j] === json[0]["timeSeries"][0]["timeDefines"][i]) {
							if (json[1]["timeSeries"][1]["areas"][0]["tempsMin"][j] === ''
								|| json[1]["timeSeries"][1]["areas"][0]["tempsMax"][j] === '') {
								 break;
							}
							weather.temperature = json[1]["timeSeries"][1]["areas"][0]["tempsMax"][j] + "℃ / " + json[1]["timeSeries"][1]["areas"][0]["tempsMin"][j] + "℃";
							break;
						}
					}
					weathers.push(weather);
				}
				resolve();
			} catch (error) {
				console.error(error.message);
				reject();
			}
		});
	}).on("error", erro => {
		console.error(error.message);
		reject();
	})
});

const getNewsPromise = _ => new Promise((resolve, reject) => {
	https.get("https://news.yahoo.co.jp/rss/topics/top-picks.xml", res => {
		let body = "";
		res.on("data", chunk => body += chunk);
		res.on("end", _ => {
			xml2js.parseString(body, (error, result) => {
				if (error) {
					console.error(error.message);
					reject();
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
	}).on("error", erro => {
		console.error(error.message);
		reject();
	})
});

const dateLabels = ['日', '月', '火', '水', '木', '金', '土'];

const server = http.createServer((request, response) => {
	let parsedUrl = url.parse(request.url, true);
	if (parsedUrl.query.region != undefined) {
		regionCode = parsedUrl.query.region;
	}

	const allPromise = Promise.all([getWeatherMapPromise(), getWeatherPromise(), getNewsPromise()]).then(_ => {
		response.writeHead(200, {
			"Content-Type": "text/html"
		});
		let today = new Date();
		let content = "";
		content += "<head>";
		content += "<meta charset=\"UTF-8\">";
		content += "<title>Dumb Portal</title>";
		content += "<style>td{padding:0;}</style>";
		content += "</head>";
		content += "<body style=\"background:#aaa; position: relative;\">";
		content += "<div id=\"content\" style=\"width:960px; height:720px; margin: auto; background:#fff; position: absolute; top:0; bottom:0; left:0; right:0;\">";
		content += "<table style=\"width: 100%; border:0; border-spacing:0; text-shadow:1px 1px 3px #8884;\">";
		content += "<tr>";
		content += "<th colspan=\"2\" style=\"color: white; background: #111 linear-gradient(#111, #222); height:60px;\">";
		content += "<div>";
		content += "<span id=\"time\" style=\"font-size: xx-large; vertical-align: middle;\"></span>";
		content += "&nbsp;&nbsp;";
		content += "<span id=\"lunar\" style=\"background: yellow; width:24px; height: 24px; border-radius: 24px; color: black; font-size: small; display: inline-block; text-align: center; vertical-align: middle; line-height: 24px;\">";
		content += "" + (((((today.getYear() + 1900 - 2009) % 19) * 11 + (today.getMonth() + 1) + today.getDate()) +1) % 30);
		content += "</span>";
		content += "</div>";
		content += "</th>";
		content += "</tr>";
		content += "<tr>";
		content += "<td style=\"text-align: center; vertical-align: middle;\">";
		content += "<img style=\"max-width: 480px; max-height: 560px;\" src=\"" + weatherMapUrl + "\">";
		content += "</td>";
		content += "<td>";
		content += "<table style=\"width: 480px; height: 560px; border-spacing:0;\">";
		for (let i = 0; i < news.length; i++) {
			content += "<tr><td style=\"background: #bbb linear-gradient(#bbb, #ccc); height:48px; font-size: x-large;\"><span style=\"padding:8px;\">" + news[i].title + "</span></td></tr>";
		}
		content += "</table>";
		content += "</td>";
		content += "</tr>";
		content += "<tr>";
		content += "<td colspan=\"2\">";
		content += "<table style=\"font-size: large; width: 960px; height:84px; text-align: center; border:0; background: #eee linear-gradient(#eee, #fff);\">";
		content += "<tr>";
		content += "<th rowspan=\"3\">";
		content += (new Date(weatherInfo.date).getMonth() + 1) + "/" + (new Date(weatherInfo.date).getDate()) + " (" + dateLabels[new Date(weatherInfo.date).getDay()] + ")" + " 発表<br />";
		content += weatherInfo.region + " の天気";
		content += "</th>";
		for (let i = 0; i < weathers.length; i++) {
			let date = new Date(weathers[i].date);
			content += "<th>" + (date.getMonth() + 1) + "/" + date.getDate() + " (" + dateLabels[date.getDay()] + ")" + "</th>";
		}
		content += "</tr>";
		content += "<tr>";
		for (let i = 0; i < weathers.length; i++) {
			content += "<td>" + weathers[i].name + "</td>";
		}
		content += "</tr>";
		content += "<tr>";
		for (let i = 0; i < weathers.length; i++) {
			content += "<td>" + weathers[i].temperature + "</td>";
		}
		content += "</tr>";
		content += "</table>";
		content += "</td>";
		content += "</tr>";
		content += "</table>";
		content += "</div>";
		content += "<div style=\"z-index: -1; width: 100%; position: absolute; bottom: 0; color: black; text-align: center;\">Powered by <a href=\"https://www.jma.go.jp/jma/index.html\" target=\"_blank\">Japan Meteorological Agency</a> & <a href=\"https://news.yahoo.co.jp/\" target=\"_blank\">Yahoo! News</a></div>";
		content += "<script>";
		content += "var dateLabels=['日','月','火','水','木','金','土'];function printTime(){var date = new Date(); document.getElementById('time').innerText=''+(1900+date.getYear())+'/'+('00'+(date.getMonth()+1)).slice(-2)+'/'+('00'+(date.getDate())).slice(-2)+'('+dateLabels[date.getDay()]+')'+' '+date.getHours()+':'+('00'+date.getMinutes()).slice(-2)+':'+('00'+date.getSeconds()).slice(-2);  setTimeout(printTime, 1000);}printTime();";
		content += "</script>";
		content += "</body>";
	    response.end(content);
	    // console.log(`Sent a response : ${content}`);
	});
});

server.listen(port);
console.log("Server started on port " + port);


