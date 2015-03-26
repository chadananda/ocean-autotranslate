var path = require("path");
var fs = require("fs");
var cheerio = require('cheerio');

var vendor = require('../vendor')
var Q = vendor.Q;
var _ = vendor._;
var mkdirp = vendor.mkdirp;
var GoogleTranslator = require('./google')
var log = console.log.bind(console);
var entities = require("entities");

function OceanTranslator(config, presave) {
	if (config.google_key === undefined) {
		throw Error("google api key is missing")
	}

	this.translator = new GoogleTranslator(config.google_key, config.parallel)
	this.presave = presave
	var xpath = config.xpath || {
		"unit": '.translation',
		"source": ".english",
		"dest": ".alt_lang"
	}

	this.xpath = xpath

	if (config.output === undefined) {
		throw Error("output folder is missing")
	}


	this.output = config.output

	var languageFile = path.join(__dirname, "..", config.language_file)
	var languages
	try {
		languages = require(languageFile)
		log('Loaded languages ', languageFile)
	} catch (err) {
		log("Fail to load language file: ", languageFile)
		throw err
	}

	var languageOptions = []
	_.forEach(languages, function (v, name) {
		var code, dir
		if (_.isString(v)) {
			code = v
			dir = 'ltf'
		} else {
			code = v.code
			dir = v.dir
		}
		languageOptions.push({
			language: name,
			code: code,
			dir: dir
		})
	})
	this.languages = languageOptions
}


// Translate a given file to target languages
// return: a promise saying that all translated versions will be done
// @param:
// - file: the given file having english text
// - languages: the languages


OceanTranslator.prototype.Translate =  function (file) {
	var languages = this.languages
	var ext = path.extname(file)
	var name = path.basename(file, ext).replace(/,tr/, '')
	var output = path.resolve(this.output, name)
	mkdirp.sync(output)

	function MakeOutputFile(code) {
		return path.resolve(output, name + ',' + code + ext)
	}

	var self = this
	var deferred = new Q.defer()
	// Step 1: Read file
	return Q.nfcall(fs.readFile, file)
	.then(function (text) {
		var promises = []
		_.forEach(languages, function (target) {
			var outputFile = MakeOutputFile(target.code)
			if (!fs.existsSync(outputFile)) {
				promises.push(self.FileTranslate(text, target, outputFile))
			}
		})

		return Q.all(promises)
	})
}

// Traverse all parapgrah marked with .translation
// Translate them, then write the result to file
// @return: a promise hoping the text will be translated and written to the sepcified file
// @params:
// - text: the input text
// - target: language option
// - output: file to write out the translated version


OceanTranslator.prototype.FileTranslate = function (text, target, output) {
	var $ = cheerio.load(text, {decodeEntities: true})
	var promises = []
	var self = this

	log('File translation to: '+ output)

	$(self.xpath.unit).each(function () {
		promises.push(self.UnitTranslate($(this), target))
	})

	return Q.all(promises)
	// Step 4: Write the whole file
	.spread(function() {
		var html = self.presave(entities.decodeHTML($.html()), target)
		return Q.nfcall(fs.writeFile, output, html)
	}, function (err) {
		if (!_.isObject(err)) err = new Error(err)
		err.language = target.language
		throw err
	})
}



// Read the unit like a paragraph, translate it, then attach the result
// The purpose of making request per unit is to
// 	satisfy the length limit of a http request accepted by google APIs
// return: a promise promising the text will be translated
// @param:
// - unit: the jquery object of the unit
// - target: the target language option

OceanTranslator.prototype.UnitTranslate = function (unit, target) {
	var xpath = this.xpath
	var source = unit.children(xpath.source)
	if (source.text().length < 1) {
		return Q()
	}
	// Step 2: Http Request
	return this.translator.Translate(source, target.code)
	// Step 3: Append to html
	.then(function (trans) {
		unit.children(xpath.dest)
			.addClass(target.language)
			.attr('lang', target.code).attr('dir', target.dir)
			.append(trans)
	}, function (err) {
		if (!_.isObject(err)) err = new Error(err)
		err.unit_id = unit.attr('id')
		throw err
	})
}

module.exports = OceanTranslator