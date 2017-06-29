/* --- Dependencies ---------------------------------- */

var express = require('express')
var Client = require('node-rest-client').Client
var i2cBus = require('i2c-bus')
var ws281x = require('rpi-ws281x-native')
var wpi = require("wiring-pi")
var stepperWiringPi = require("./stepper-wiringpi")

var client = new Client()

/* --- State variables ------------------------------- */

const stepRange = 200         // Number of steps for each separate motor run
var stepFactor = 162          // Factor for computing number of steps from %
var currentFlagPosition = 0   // Current flag position in steps
var topFlagPosition = 0       // Step count for top flag position
var nextFlagPosition = 0      // Flag position in steps
var flagStatus = 0            // 0=start cal bottom, 1=cal bottom, 2=start cal top, 3=cal top, 4=stopped, 5=moving

var ledFunction = {
  OFF: 'Off',
  ON: 'On',
  ROTATE: 'Rotate',
  BLINK: 'Blink'
}

const numberOfLeds = 19
const numberOfTopLeds = 3
const numberOfBottomLeds = 16

var topLedFunction = ledFunction.OFF
var bottomLedFunction = ledFunction.OFF

var topLedBlinkState = false
var topLedCurrent = 0

var bottomLedBlinkState = false
var bottomLedCurrent = 0

var ip = require("ip")
var os = require("os")


/* --- Color sets ---------------------------------- */

var definedColorSet = [
  colorCombine(255, 0, 0),
  colorCombine(0, 255, 0),
  colorCombine(0, 0, 255),
  colorCombine(255, 0, 0),
  colorCombine(0, 255, 0),
  colorCombine(0, 0, 255),
  colorCombine(255, 0, 0),
  colorCombine(0, 255, 0),
  colorCombine(0, 0, 255),
  colorCombine(255, 0, 0),
  colorCombine(0, 255, 0),
  colorCombine(0, 0, 255),
  colorCombine(255, 0, 0),
  colorCombine(0, 255, 0),
  colorCombine(0, 0, 255),
  colorCombine(255, 0, 0),
  colorCombine(0, 255, 0),
  colorCombine(0, 0, 255),
  colorCombine(255, 0, 0)
]

var currentColorSet = definedColorSet.slice()

/* --- Setup subsystems ------------------------------- */

// Setup web server
var app = express()
app.set('port', (process.env.PORT || 3002))

// Setup Leds
var pixelData = new Uint32Array(numberOfLeds)
ws281x.init(numberOfLeds)

// Setup sensors for detecting flag at bottom
var bottomsensorpin = 24
var topsensorpin = 25
wpi.pinMode(bottomsensorpin, wpi.INPUT)
wpi.pinMode(topsensorpin, wpi.INPUT)

// Setup stepper motor for flag
var pin1 = 17
var pin2 = 27
var pin3 = 22
var pin4 = 23
wpi.setup('gpio')
var motor1 = stepperWiringPi.setup(200, pin1, pin2, pin3, pin4)
motor1.setSpeed(200)

/* --- Common functions ------------------------------- */

// Generate integer from RGB value
function colorCombine(r, g, b) {
  return ((r & 0xff) << 16) + ((g & 0xff) << 8) + (b & 0xff)
}

// Extraxt color part (r,g,b) from integer
function colorExtract(color, name) {
  switch (name) {
    case "r":
      return (color >> 16) & 0xff
    case "g":
      return (color >> 8) & 0xff
    case "b":
      return color & 0xff
  }
  return 0
}

function parseColorsString(colorsString) {
  var strings = colorsString.split(",")
  var colors = []
  strings.forEach(function (colorString) {
    colors.push(parseInt(colorString, 10))
  })
  return colors
}

function parseLedFunctionEnum(value) {
  var parsedFunction = ledFunction.OFF
  switch (value) {
    case "Off":
      parsedFunction = ledFunction.OFF
      break
    case "On":
      parsedFunction = ledFunction.ON
      break
    case "Rotate":
      parsedFunction = ledFunction.ROTATE
      break
    case "Blink":
      parsedFunction = ledFunction.BLINK
      break
  }
  return parsedFunction
}

function getLedFunctionEnumString(value) {
  var functionString;
  switch (value) {
    case ledFunction.OFF:
      functionString = "Off"
      break;
    case ledFunction.ON:
      functionString = "On"
      break;
    case ledFunction.ROTATE:
      functionString = "Rotate"
      break;
    case ledFunction.BLINK:
      functionString = "Blink"
      break;
  }
  return functionString
}

function lightsOffLeds() {
  currentColorSet.fill(colorCombine(0, 0, 0), 0, 19)
  ws281x.render(currentColorSet)
}

function readBottomPositionFlagSensor() {
  return wpi.digitalRead(bottomsensorpin)
}

function readTopPositionFlagSensor() {
  return wpi.digitalRead(topsensorpin)
}

function calibrateFlagBottom() {
  if (readBottomPositionFlagSensor() == 0) {
    motor1.step(stepRange, function () {
      if (readBottomPositionFlagSensor() == 0) {
        calibrateFlagBottom();
      }
      else {
        currentFlagPosition = 0
        flagStatus = 2
      }
    })
  }
  else {
    currentFlagPosition = 0
    flagStatus = 2
  }
}

function calibrateFlagTop() {
  if (readTopPositionFlagSensor() == 0) {
    motor1.step(-stepRange, function () {
      currentFlagPosition += stepRange
      if (readTopPositionFlagSensor() == 0) {
        calibrateFlagTop()
      }
      else {
        topFlagPosition = currentFlagPosition
        stepFactor = topFlagPosition / 100
        flagStatus = 4
      }
    })
  }
  else {
    topFlagPosition = currentFlagPosition
    stepFactor = topFlagPosition / 100
    flagStatus = 4
  }
}

function MoveFlagToPosition() {
  if (currentFlagPosition != nextFlagPosition) {
    var steps = (currentFlagPosition - nextFlagPosition);
    if (steps < 0) {
      if (steps < -stepRange) {
        steps = -stepRange
      }
      motor1.step(steps, function () {
        currentFlagPosition -= steps;
        if (readTopPositionFlagSensor() == 0) {
          MoveFlagToPosition()
        }
        else {
          flagStatus = 4
          topFlagPosition = currentFlagPosition;
        }
      })
    } else if (steps > 0) {
      if (steps > stepRange) {
        steps = stepRange
      }
      motor1.step(steps, function () {
        currentFlagPosition -= steps
        if (readBottomPositionFlagSensor() == 0) {
          MoveFlagToPosition()
        }
        else {
          flagStatus = 4;
          currentFlagPosition = 0
        }
      })
    }
  }
  else {
    flagStatus = 4
  }
}

function setTopLeds(ledFunction) {
  switch (ledFunction) {
    case "Off":
      currentColorSet.fill(colorCombine(0, 0, 0), 16, 19)
      break
    case "On":
      for (index = 16; index < 19; index++) {
        currentColorSet[index] = definedColorSet[index]
      }
      break
    case "Rotate":
      topLedCurrent = (topLedCurrent + 1) % numberOfTopLeds;
      for (ledIndex = 16; ledIndex < 19; ledIndex++) {
        var colorIndex = (topLedCurrent + ledIndex) % numberOfTopLeds;
        currentColorSet[ledIndex] = definedColorSet[16 + colorIndex]
      }
      break
    case "Blink":
      if (topLedBlinkState) {
        for (index = 16; index < 19; index++) {
          currentColorSet[index] = definedColorSet[index]
        }
        topLedBlinkState = false
      }
      else {
        currentColorSet.fill(colorCombine(0, 0, 0), 16, 19)
        topLedBlinkState = true
      }
      break
  }
}

function setBottomLeds(ledFunction) {
  switch (ledFunction) {
    case "Off":
      currentColorSet.fill(colorCombine(0, 0, 0), 0, 16)
      break
    case "On":
      for (index = 0; index < 16; index++) {
        currentColorSet[index] = definedColorSet[index]
      }
      break
    case "Rotate":
      bottomLedCurrent = (bottomLedCurrent + 1) % numberOfBottomLeds;
      for (ledIndex = 0; ledIndex < 16; ledIndex++) {
        var colorIndex = (bottomLedCurrent + ledIndex) % numberOfBottomLeds;
        currentColorSet[ledIndex] = definedColorSet[colorIndex]
      }
      break
    case "Blink":
      if (bottomLedBlinkState) {
        for (index = 0; index < 16; index++) {
          currentColorSet[index] = definedColorSet[index]
        }
        bottomLedBlinkState = false
      }
      else {
        currentColorSet.fill(colorCombine(0, 0, 0), 0, 16)
        bottomLedBlinkState = true
      }
      break
  }
}

/* --- Processing functions ---------------------------------- */

function reportUrl() {
  try {
    var link = 'http://' + ip.address() + ':3000';
    var url = 'https://buildflag-hub.herokuapp.com/api/updateTarget?name=' + os.hostname() + '&link=' + link
    client.get(url, function (data, response) {
    })
  } catch (error) {
    console.log("ReportUrl failed")
  }
}

function processFlag() {
  try {
    // Check for inital calibration
    if (flagStatus == 0) {
      flagStatus = 1
      calibrateFlagBottom()
    }

    if (flagStatus == 2) {
      flagStatus = 3
      calibrateFlagTop()
    }

    // Check for moving flag request
    if (flagStatus == 4 && (currentFlagPosition != nextFlagPosition)) {
      flagStatus = 5
      MoveFlagToPosition()
    }

    // Notify clients about positions
    notifyChangedFlagPosition()
  } catch (error) {
    console.log("Crashed in processFlag", error)
  }
}

function processLeds() {
  try {
    if (flagStatus < 4) {
      setTopLeds(ledFunction.ON)
      setBottomLeds(ledFunction.ON)
    } else {
      setTopLeds(topLedFunction)
      setBottomLeds(bottomLedFunction)
    }
    ws281x.render(currentColorSet)
  } catch (error) {
    console.log("Crashed in processLeds", error)
  }
}

/* --- Rest api ---------------------------------- */

// Get status, flag positions in %, rgb led function, leds function
app.get('/getStatus', function (req, res) {
  res.json({
    hostName: os.hostname(),
    flagPosition: {
      current: Math.round(currentFlagPosition / stepFactor),
      next: Math.round(nextFlagPosition / stepFactor)
    },
    topLed: getLedFunctionEnumString(topLedFunction),
    bottomLed: getLedFunctionEnumString(bottomLedFunction)
  })
})

// Set flag position in %
app.get('/setflag/:position', function (req, res) {
  nextFlagPosition = req.params.position * stepFactor
  notifyChangedFlagPosition()
  res.json('OK')
})

// Set top led function, function: Off, On, Rotate, Blink
app.get('/settopled/function/:function', function (req, res) {
  var functionValue = parseLedFunctionEnum(req.params.function)
  topLedFunction = functionValue
  notifyChangedTopLedFunction()
  res.json('OK')
})

// Set bottom led function, function: Off, On, Rotate, Blink
app.get('/setbottomled/function/:function', function (req, res) {
  var functionValue = parseLedFunctionEnum(req.params.function)
  bottomLedFunction = functionValue
  notifyChangedBottomLedFunction()
  res.json('OK')
})

// Set led colors
app.get('/setledcolors/:colors', function (req, res) {
  var colors = parseColorsString(req.params.colors)
  definedColorSet = colors
  res.json('OK')
})

/* --- System setup and processing loop ---------------------------------- */

var signals = {
  'SIGINT': 2,
  'SIGTERM': 15
};

function shutdown(signal, value) {
  lightsOffLeds();
  process.nextTick(function () {
    process.exit(0);
  });
}

Object.keys(signals).forEach(function (signal) {
  process.on(signal, function () {
    shutdown(signal, signals[signal])
  });
});

// Main processing loop, runs 2Hz
const server = app.listen(app.get('port'), () => {
  console.log(`Find the server at: http://localhost:${app.get('port')}/`) // eslint-disable-line no-console
  setInterval(function () {
    processFlag()
    processLeds()
  }, 500)
  setInterval(function () {
    reportUrl()
  }, 60 * 1000)
})

/* --- Client push setup and functions ---------------------------------- */

const io = require('socket.io')(server)

function notifyChangedFlagPosition() {
  io.emit("flagPosition", {
    current: Math.round(currentFlagPosition / stepFactor),
    next: Math.round(nextFlagPosition / stepFactor)
  })
}

function notifyChangedTopLedFunction() {
  io.emit("topLed", {
    topLed: getLedFunctionEnumString(topLedFunction),
  })
}

function notifyChangedBottomLedFunction() {
  io.emit("bottomLed", {
    bottomLed: getLedFunctionEnumString(bottomLedFunction),
  })
}
