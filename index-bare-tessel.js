const tessel = require('tessel')
const ColorSensor = require('./ColorSensor-bareTessel')

let color = new ColorSensor()

color.on('ready', () => {})

color.init()

