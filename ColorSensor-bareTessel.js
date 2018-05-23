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
  PERIPHERAL_READ: 0x02,
  PERIPHERAL_WRITE: 0x01
}

ColorSensor.prototype.VIRTUAL_REGISTERS = {
  HW_VERSION: 0x01,
  LED_CONTROL: 0x07
}

ColorSensor.prototype.RX_VALID = 0x01
ColorSensor.prototype.TX_VALID = 0x02

ColorSensor.prototype.BULB_CURRENT = {
  TWELVE_POINT_FIVE: 0b00,
  TWENTY_FIVE: 0b01,
  FIFTY: 0b10,
  ONE_HUNDRED: 0b11
}

ColorSensor.prototype.init = function() {
  this.i2c = new this.port.I2C(this.address) // begin I2C comms
  async.series([
    (callback) => { 
      this.virtualRead(this.VIRTUAL_REGISTERS.HW_VERSION, (err, data) => {
        if (err) console.error('Error Retrieving HW version: ', err)
        if(data !== 0x3E && data !== 0x3F) {
          console.error('Error: hardware version expected 0x3E or 0x3F, got ', data)
          callback(new Error('Error: hardware version expected 0x3E or 0x3F, got ', data), null)
        }
        callback(null, data)
      })
    },
    (callback) => {
      this.setBulbCurrent(this.BULB_CURRENT.MINIMUM, callback)
    },
    (callback) => {
      this.disableBulb(callback)
    }
  ], (err, data) => {
    this.emit('ready')
  })
}

ColorSensor.prototype.setBulbCurrent = function(current, callback) {
  let ledControl
  async.series([
    // read LED_CONTROL value
    (callback) => {
      this.virtualRead(this.VIRTUAL_REGISTERS.LED_CONTROL, (err, data) => {
        ledControl = data
        callback(err, null)
      })
    },
    // Set bits 5-6 to user value
    (callback) => {
      ledControl &= 0b11001111 // clears bits 5-6
      ledControl |= (current << 4)// sets bits 5-6 to current
      callback(null, null)
    },
    // write to LED_CONTROL
    (callback) => {
      this.virtualWrite(this.VIRTUAL_REGISTERS.LED_CONTROL, ledControl, (err) => {
        callback(err, null)
      })
    }
  ], callback)
}

ColorSensor.prototype.enableBulb = function(callback) {
  let ledControl
  async.series([
    // read LED_CONTROL value
    (callback) => {
      this.virtualRead(this.VIRTUAL_REGISTERS.LED_CONTROL, (err, data) => {
        ledControl = data
        callback(err, null)
      })
    },
    // Set bit 3
    (callback) => {
      ledControl |= (1 << 3)
      callback(null, null)
    },
    // write to LED_CONTROL
    (callback) => {
      this.virtualWrite(this.VIRTUAL_REGISTERS.LED_CONTROL, ledControl, (err) => {
        callback(err, null)
      })
    }
  ], callback)
}

ColorSensor.prototype.disableBulb = function(callback) {
  let ledControl
  async.series([
    // read LED_CONTROL value
    (callback) => {
      this.virtualRead(this.VIRTUAL_REGISTERS.LED_CONTROL, (err, data) => {
        ledControl = data
        callback(err, null)
      })
    },
    // Clear bit 3
    (callback) => {
      ledControl &= 0b11110111
      callback(null, null)
    },
    // write to LED_CONTROL
    (callback) => {
      this.virtualWrite(this.VIRTUAL_REGISTERS.LED_CONTROL, ledControl, (err) => {
        callback(err, null)
      })
    }
  ], callback)
}

ColorSensor.prototype.virtualWrite = function(virtualRegister, value, callback) {
  let status = null
  async.series([
    // wait for write bit to be clear
    (callback) => {
      async.until(
        () => {
          if(status == null) {
            return false
          } else {
            return ((status & this.TX_VALID) == 0)
          }
        },
        (callback) => {
          this.i2c.transfer(Buffer.from([this.REGISTERS.PERIPHERAL_STATUS]), 1, (err, data) => {
            if(err) callback(err, null)
            status = data[0]
            callback(null, null)
          })
        },
        callback
      )
    },
    // set virtual register address (set bit 7 to indicate a write)
    (callback) => {
      this.i2c.send(Buffer.from([this.REGISTERS.PERIPHERAL_WRITE, (0x80 | virtualRegister)]), (err) => {
        if(err){
          callback(err, null)
        }
        status = null
        callback(null, null)
      })
    },
    // wait for write register to be empty
    (callback) => {
      async.until(
        () => {
          if(status == null) {
            return false
          } else {
            return ((status & this.TX_VALID) == 0)
          }
        },
        (callback) => {
          this.i2c.transfer(Buffer.from([this.REGISTERS.PERIPHERAL_STATUS]), 1, (err, data) => {
            if(err) callback(err, null)
            status = data[0]
            callback(null, null)
          })
        },
        callback
      )
    },
    // send data
    (callback) => {
      this.i2c.send(Buffer.from([this.REGISTERS.PERIPHERAL_WRITE, value]), (err) => {
        if(err){
          callback(err, null)
        }
        status = null
        callback(null, null)
      })
    }
  ], callback)
}

ColorSensor.prototype.virtualRead = function(virtualRegister, callback) {
  let status = null, result = null
  console.log('Begin virtual read')
  async.series([
    (callback) => {
      this.i2c.transfer(Buffer.from([this.REGISTERS.PERIPHERAL_STATUS]), 1, (err, data) => {
        if (err) callback(err, null)
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
            console.log('status NULL')
            return false
          } else {
            return ((status & this.TX_VALID) == 0)
          }
        },
        (callback) => {
          this.i2c.transfer(Buffer.from([this.REGISTERS.PERIPHERAL_STATUS]), 1, (err, data) => {
            if(err) callback(err, null)
            status = data[0]
            callback(null, null)
          })
        },
        callback
      )
    },
    (callback) => {
      this.i2c.send(Buffer.from([this.REGISTERS.PERIPHERAL_WRITE, virtualRegister]), (err) => {
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
            console.log('Status null')
            return false
          } else {
            console.log('Status Read: ', status)
            return (status & this.RX_VALID) != 0
          }
        },
        (callback) => {
          this.i2c.transfer(Buffer.from([this.REGISTERS.PERIPHERAL_STATUS]), 1, (err, data) => {
            if(err) callback(err, null)
            status = data[0]
            callback(null, null)
          })
        },
        callback
      )
    },
    (callback) => {
      this.i2c.transfer(Buffer.from([this.REGISTERS.PERIPHERAL_READ]), 1, (err, data) => {
        if (err) callback(err, null)
        console.log('Peripheral data byte read: ', data[0])
        result = data[0]
        callback(null, data[0])
      })
    }
  ], (err, data) => {
    callback(err, result)
  })
}

util.inherits(ColorSensor, events.EventEmitter)

module.exports = ColorSensor