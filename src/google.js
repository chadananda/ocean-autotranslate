var request = require('./request')
var vendor = require('../vendor')
var _ = vendor._
var Q = vendor.Q
var async = vendor.async

function GoogleTranslator(key, parallel) {
	this.maxQueryLength = 5000; // google api limits it
	this.key = key
	
	var self = this
	var waitTime = 0
	var maxWaitTime = 8000

	var queue = async.queue(doJob, parallel || 1)
	function doJob(job, cb) {
		// Step 2: Http Request
		request.json(job.opts).then(function (resp) {
			return resp.data.translations;
		}).done(function (trans){
			
			if (waitTime > 0 && queue.paused) {
				waitTime = 0
				queue.resume() // continue the queue
			}
			job.deferred.resolve(trans);
			// next job
			cb();
		}, function (err) {
			// check the error 
			// if we should continue, wait for a specified amount of time
			if (err && err.code === 403 && waitTime < maxWaitTime) {
				if (!queue.paused) {
					queue.pause()
					waitTime += 1000
					if (waitTime > 2000) {
						console.log("Usage limit reached. Waiting for ", waitTime / 1000, " seconds")
					}
				}
				
				setTimeout(function() {
					doJob(job, cb)
				}, waitTime)				 
			}  else {
				if (err && err.code != undefined && err.body) {
					var body = err.body
					try {
						err.body = JSON.parse(body)
					} catch(e) {
						err.body = body
					}
				}
				// code 400: invlaid key
				// other error
				job.deferred.reject(err);
				// Should the queue stop here?
				queue.kill()
			}
		});
	}
	this.queue = queue; 
}


GoogleTranslator.prototype.push = function (query, target) {
	var deferred = new Q.defer()	
	// create a new job
	var opts = {
		secure: true,
		host: "www.googleapis.com",
		pathname: "/language/translate/v2",
		query: {
			target: target,
			source: "en",
			format: "html",
			q: query,
			key: this.key
		}
	}
	this.queue.push({deferred: deferred, opts: opts})
	return deferred.promise;	
}


GoogleTranslator.prototype.Translate  = function (source, target) {
	var self = this;
	var text = source.text()
	var html = source.html()
	// Step 1: Ensure the text length is bellow the limit
	if (text.length < self.maxQueryLength) {
		// return a promise which will be resolve rightly after the job is done
		return self.push(html, target).then(function(trans) {
			return trans[0].translatedText
		});
	} else {
		// break the text into pieces
		var len = 0;
		var promises = []
		var pieces = []
		
		function addPiece() {
			promises.push(self.push(pieces.join('. '), target))
			pieces = []
			len = 0
		}
		
		var parts = html.split('. ');
		_.forEach(parts, function(sentence) {
			var newlen = sentence.length + 2;
			if (sentence.length > self.maxQueryLength) {
				throw Error("too long sentence " + sentence) 
			}
			if (newlen + len > self.maxQueryLength) {
				addPiece()
			}
			len += newlen
			pieces.push(sentence)
		})

		if (pieces.length > 0) {
			addPiece()
		}

		return Q.all(promises).spread(function () {
			var res = []
			_.forEach(arguments, function (v) {
				_.forEach(v, function (t) {
					// decode 
					res.push(t.translatedText)
				})

			})
			return res.join('. ')
		})
	}
}

module.exports = GoogleTranslator;