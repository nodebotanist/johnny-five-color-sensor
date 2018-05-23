const tessel = require('tessel')
const ColorSensor = require('./ColorSensor-bareTessel')

let color = new ColorSensor()

color.on('ready', () => {
  console.log('Ready!')
  color.enableBulb(() => {})
  setTimeout(() => { color.disableBulb(() => {}) }, 1000)
})

color.init()

