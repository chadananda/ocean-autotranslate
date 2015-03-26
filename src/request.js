var http = require('http')
var https = require('https');
var url = require('url');
var vendor = require('../vendor');
var Q = vendor.Q;

function proxy(opt) {
	var deferred = new Q.defer();


	if (!opt.host) {
		throw "missing host: " + opt;
	}
	
	/*opt.secure = false
	opt.host = "localhost"
	opt.port = 3000*/
	
	var options = {
		protocol: opt.secure? 'https' : 'http',
		hostname: opt.host,
		port: opt.port,
		pathname: opt.pathname || '/',
		query: opt.query
	};
	
	// console.log(url.format(options));

	var req = (opt.secure? https : http).get(url.format(options), function(res) {		
		var body = '';
		res.on('data', function (chunk) {
			body += chunk;
		});
		res.on('end', function () {		
			if (res.statusCode > 399) {
				deferred.reject({code: res.statusCode, body: body});
			} else {
				deferred.resolve(body);
			}
			
		})	  
	}).on('error', function(e) {
	  deferred.reject(e);
	});

	return deferred.promise;
}

function json_proxy(opt) {
	return proxy(opt).then(function (data) {
		return JSON.parse(data);
	})
}

module.exports = {
	proxy: proxy,
	json: json_proxy	
}