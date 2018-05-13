const util = require('util')
const events = require('events')
const tessel = require('tessel')

function ColorSensor(opts) {

}

ColorSensor.prototype.REGISTERS = {

}

ColorSensor.prototype.VIRTUAL_REGISTERS = {
    
}

ColorSensor.prototype.virtualWrite = function(virtualRegister, value) {

}

ColorSensor.prototype.virtualRead = function(virtualRegister) {

}

util.inherits(ColorSensor, events.EventEmitter)

module.exports = ColorSensor