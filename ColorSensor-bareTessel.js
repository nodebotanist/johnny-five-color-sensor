const util = require('util')
const events = require('events')
const tessel = require('tessel')
const async = require('async')

function ColorSensor(opts) {
  opts = opts || {}
  this.port = tessel.port[opts.port || 'A']
  this.address = opts.address || 0x49
}

ColorSensor.prototype.REGISTERS = {
  PERIPHERAL_STATUS: 0x00,
  PERIPHERAL_READ: 0x02
}

ColorSensor.prototype.VIRTUAL_REGISTERS = {
  HW_VERSION: 0x01
}

ColorSensor.prototype.RX_VALID = 0x01
ColorSensor.prototype.TX_VALID = 0x02

ColorSensor.prototype.init = function() {
  console.log('begin I2C comms')
  this.i2c = new this.port.I2C(this.address) // begin I2C comms
  this.virtualRead(this.VIRTUAL_REGISTERS.HW_VERSION, (err, data) => {
    if (err) console.log('Error Retrieving HW version: ', err)
    console.log('Hardware version: ', data)
  })
}

ColorSensor.prototype.virtualWrite = function(virtualRegister, value) {

}

ColorSensor.prototype.virtualRead = function(virtualRegister, callback) {
  let status = null, result = null
  console.log('Begin virtual read')
  async.series([
    (callback) => {
      this.i2c.transfer(Buffer.from([this.REGISTERS.PERIPHERAL_STATUS]), 1, (err, data) => {
        if (err) callback(err, null)
        console.log('Peripheral status byte: ', data)
        status = data[0]
        callback(null, null)
      })
    },
    (callback) => {
      if(status & this.RX_VALID !== 0x00) {
        // there is already data in the queue, clear it out.
        console.log('buffer backlog, clearing...')
        this.i2c.transfer(Buffer.from([this.REGISTERS.PERIPHERAL_READ]), 1, (err) => {
          if(err) callback(err, null)
          status = null
          callback(null, null)
        })
      } else {
        console.log('No backlog. Resuming...')
        callback(null, null)
      }
    },
    (callback) => {
      async.until(
        () => {
          if(status == null) {
            return false
          } else {
            console.log('status: ', status)
            return status & this.TX_VALID === 0x00
          }
        },
        (callback) => {
          this.i2c.transfer(Buffer.from([this.REGISTERS.PERIPHERAL_STATUS]), 1, (err, data) => {
            if(err) callback(err, null)
            console.log('Peripheral status byte 2: ', data)
            status = data[0]
            callback(null, null)
          })
        }
      )
    },
    (callback) => {
      this.i2c.send(Buffer.from([virtualRegister]), (err) => {
        if(err){
          callback(err, null)
        }
        status = null
        callback(null, null)
      })
    },
    (callback) => {
      async.until(
        () => {
          if(status == null) {
            return false
          } else {
            return status & this.RX_VALID === 0x00
          }
        },
        (callback) => {
          this.i2c.transfer(Buffer.from([this.REGISTERS.PERIPHERAL_STATUS]), 1, (err, data) => {
            if(err) callback(err, null)
            console.log('Peripheral status byte: ', data)
            status = data[0]
            callback(null, null)
          })
        }
      )
    },
    (callback) => {
      this.i2c.transfer(Buffer.from([this.REGISTERS.PERIPHERAL_READ]), 1, (err, data) => {
        if (err) callback(err, null)
        console.log('Peripheral data byte read: ', data)
        callback(null, data[0])
      })
    }
  ], (err, data) => {
    callback(err, data)
  })
}

util.inherits(ColorSensor, events.EventEmitter)

module.exports = ColorSensor