/* 
 * A script translates html files using goolge translate APIs.
 * Author: nguyentruongminh8@gmail.com
 */

var path = require('path')
var fs = require('fs')
var log = console.log.bind(console);
var chalk = require('chalk')
var OceanTranslator = require('./src/ocean')
var async = require('./vendor').async;
var config = require('./config')
var presave = require('./presave')

/******************************************/
if (process.argv[2] === "-h") {
  log("A script translates html files using goolge translate APIs.")
  log("Contact nguyentruongminh8@gmail.com for support")
  process.exit(0)
}

/*********************************************/
var ocean = new OceanTranslator(config, presave)
var queue = async.queue(processFile, 1); // one file at a time
var logFile = path.join(__dirname, "log.json")

function writeLog(err) {
  err.time = new Date()
  fs.writeFileSync(logFile, JSON.stringify(err, null, ' '), {flag: 'a'})
  fs.writeFileSync(logFile, '\n', {flag: 'a'})
}

function processFile(file, cb) {
  var filename = chalk.gray(file)
  log('Processing', filename)
  ocean.Translate(file).done(function(result) {
    log(chalk.green('Ok'), filename)
    cb()
  }, function (err) {
    if (err.stack) {
      throw err
    }
    err.file = file
    
    log(chalk.red.bold('Fail'), filename)
    writeLog(err)  
    log("Error was written to ", logFile)
    queue.kill()
    log(chalk.gray('About to exit ... '))
    process.exit(1)
  })
}

var input = path.resolve(__dirname, config.input)
if (!fs.existsSync(input)) {
  log(chalk.red("input folder in config file"))
  throw Error("Input folder does not exist " + input )
}

var finder = require('findit')(config.input);
finder.on('file', function (file) {
  if (path.extname(file) !== '.html') {
    return
  }
  queue.push(file)
})
