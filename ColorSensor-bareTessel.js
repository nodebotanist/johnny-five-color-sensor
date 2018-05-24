/* TODOS:
Stop race conditons on functions that use virtual read/write
*/

const util = require('util')
const events = require('events')
const tessel = require('tessel')
const async = require('async')

function ColorSensor(opts) {
  opts = opts || {}
  this.port = tessel.port[opts.port || 'A']
  this.address = opts.address || 0x49
}

util.inherits(ColorSensor, events.EventEmitter)

ColorSensor.prototype.REGISTERS = {
  PERIPHERAL_STATUS: 0x00,
  PERIPHERAL_READ: 0x02,
  PERIPHERAL_WRITE: 0x01
}

ColorSensor.prototype.VIRTUAL_REGISTERS = {
  HW_VERSION: 0x01,
  CONTROL_SETUP: 0x04,
  INTEGRATION_TIME: 0x05,
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

// MAX 8mA
ColorSensor.prototype.INDICATOR_CURRENT = 0b11

ColorSensor.prototype.GAIN = {
  ONE_X: 0b00,
  THREE_POINT_SEVEN_X: 0b01,
  SIXTEEN_X: 0b10,
  SIXTY_FOUR_X: 0b11
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
        console.log('Hardware version confirmed')
        callback(null, data)
      })
    },
    (callback) => {
      console.log('Set bulb current')
      this.setBulbCurrent(this.BULB_CURRENT.MINIMUM, callback)
    },
    (callback) => {
      console.log('Disable bulb')
      this.disableBulb(callback)
    },
    (callback) => {
      console.log('Set indicator current')
      this.setIndicatorCurrent(this.INDICATOR_CURRENT, callback)
    },
    (callback) => {
      console.log('Disable indicator')
      this.disableIndicator(callback)
    },
    (callback) => {
      console.log('Set integration time')
      this.setIntegrationTime(50, callback)
    },
    (callback) => {
      console.log('Set Gain')
      this.setGain(this.GAIN.SIXTY_FOUR_X, callback)
    }
  ], (err, data) => {
    if(err) { 
      console.log('Error during init: ', err)
    }
    console.log('Internal ready')
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

ColorSensor.prototype.setIndicatorCurrent = function(current, callback){
  let ledControl
  async.series([
    // read LED_CONTROL value
    (callback) => {
      this.virtualRead(this.VIRTUAL_REGISTERS.LED_CONTROL, (err, data) => {
        ledControl = data
        callback(err, null)
      })
    },
    // Set bits 2-3 to user value
    (callback) => {
      ledControl &= 0b11111001 // clears bits 5-6
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

ColorSensor.prototype.enableIndicator = function(callback) {
  let ledControl
  async.series([
    // read LED_CONTROL value
    (callback) => {
      this.virtualRead(this.VIRTUAL_REGISTERS.LED_CONTROL, (err, data) => {
        ledControl = data
        callback(err, null)
      })
    },
    // Set bit 1
    (callback) => {
      ledControl |= 1
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

ColorSensor.prototype.disableIndicator = function(callback) {
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
      ledControl &= 0b11111110
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

ColorSensor.prototype.setIntegrationTime = function (intTime, callback){
  intTime &= 0xFF // cap at 255
  this.virtualWrite(this.VIRTUAL_REGISTERS.INTEGRATION_TIME, intTime, callback)
}

ColorSensor.prototype.setGain = function(gain, callback) {
  let controlSetup
  async.series([
    // read CONTROL_SETUP value
    (callback) => {
      this.virtualRead(this.VIRTUAL_REGISTERS.CONTROL_SETUP, (err, data) => {
        controlSetup = data
        callback(err, null)
      })
    },
    // Set bits 5-6
    (callback) => {
      controlSetup &= 0b11001111
      controlSetup |= (gain << 4)
      callback(null, null)
    },
    // write to CONTROL_SETUP
    (callback) => {
      this.virtualWrite(this.VIRTUAL_REGISTERS.CONTROL_SETUP, controlSetup, (err) => {
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
        this.i2c.transfer(Buffer.from([this.REGISTERS.PERIPHERAL_READ]), 1, (err) => {
          if(err) callback(err, null)
          status = null
          callback(null, null)
        })
      } else {
        callback(null, null)
      }
    },
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
            return false
          } else {
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
        console.log('Data byte read from address ', virtualRegister, ': ', data[0])
        result = data[0]
        callback(null, data[0])
      })
    }
  ], (err, data) => {
    callback(err, result)
  })
}


module.exports = ColorSensor