/* --- Dependencies ---------------------------------- */

var wpi = require("node-wiring-pi")


/* --- Setup subsystems ------------------------------- */

var client = new Client()
wpi.setup('gpio')

// Setup sensors for detecting flag at bottom
var bottomsensorpin = 24
var topsensorpin = 25
wpi.pinMode(bottomsensorpin, wpi.INPUT)
wpi.pinMode(topsensorpin, wpi.INPUT)


/* --- Common functions ------------------------------- */


function readBottomPositionFlagSensor() {
  return wpi.digitalRead(bottomsensorpin)
}

function readTopPositionFlagSensor() {
  return wpi.digitalRead(topsensorpin)
}


/* --- System setup and processing loop ---------------------------------- */

var signals = {
  'SIGINT': 2,
  'SIGTERM': 15
};

function shutdown(signal, value) {
  process.nextTick(function () {
    process.exit(0);
  });
}

Object.keys(signals).forEach(function (signal) {
  process.on(signal, function () {
    shutdown(signal, signals[signal])
  });
});

function readSensors() {
  var topPosition = readTopPositionFlagSensor();
  var bottomPosition = readBottomPositionFlagSensor();
  console.log("Top: ", topPosition)
  console.log("Bot: ", bottomPosition)
}

reportUrl()
setInterval(function () {
  readSensors()
}, 500)
