const tessel = require('tessel')
const ColorSensor = require('./ColorSensor-bareTessel')

let color = new ColorSensor()

color.init({
  mode: color.MEASUREMENT_MODES.MODE_TWO
})

color.on('ready', () => {
  console.log('Ready!')
  color.on('data', (event) => {
    console.log('Data recieved: ', event)
  })
  color.takeContinuousMeasurements(2000)
})

