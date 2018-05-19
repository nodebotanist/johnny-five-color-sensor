const util = require('util')
const events = require('events')
const tessel = require('tessel')

function ColorSensor(opts) {
  this.port = tessel.port[opts.port || 'A']
  this.address = opts.address || 0x49
}

ColorSensor.prototype.REGISTERS = {
  PERIPHERAL_STATUS: 0x00
}

ColorSensor.prototype.VIRTUAL_REGISTERS = {
    
}

ColorSensor.prototype.RX_VALID = 0x01

ColorSensor.prototype.init = function() {
  this.i2c = new this.port.I2C(this.address) // begin I2C comms

}

ColorSensor.prototype.virtualWrite = function(virtualRegister, value) {

}

ColorSensor.prototype.virtualRead = function(virtualRegister) {
  let status = this.i2c.transfer(Buffer.from([this.REGISTERS.PERIPHERAL_STATUS]), 1, (err, data) => {
    if(data & this.RX_VALID != 0x00) {
      // there is already data in the queue, clear it out.
    }
  })
}

util.inherits(ColorSensor, events.EventEmitter)

module.exports = ColorSensor