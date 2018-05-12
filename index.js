const five = require("johnny-five")
const Tessel = require("tessel-io")
const board = new five.Board({
  io: new Tessel()
})
const ColorSensor = require('./ColorSensor')

board.on("ready", () => {
  let colorSensor = new ColorSensor({
    address: 0x49,
    bus: 'A'
  })
})