const tessel = require('tessel')
const ColorSensor = require('./ColorSensor-bareTessel')

let color = new ColorSensor()

color.init()

color.on('ready', () => {
  console.log('Ready!')
  color.enableBulb(() => { color.enableIndicator(() => {}) })
  setTimeout(() => { 
    color.disableBulb(() => { color.disableIndicator(() => {} )})
  }, 1000)
})

