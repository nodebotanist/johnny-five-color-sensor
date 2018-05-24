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
  LED_CONTROL: 0x07,
  AS7262_V: 0x08,
  AS7262_B: 0x0A,
  AS7262_G: 0x0C,
  AS7262_Y: 0x0E,
  AS7262_O: 0x10,
  AS7262_R: 0x12
}

ColorSensor.prototype.RX_VALID = 0x01
ColorSensor.prototype.TX_VALID = 0x02
ColorSensor.prototype.DATA_AVAILABLE = 0x02

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

ColorSensor.prototype.MEASUREMENT_MODES = {
  MODE_ZERO: 0b00, //Mode 0: Continuous reading of VBGY (7262) / STUV (7263)
  MODE_ONE: 0b01, //Mode 1: Continuous reading of GYOR (7262) / RTUX (7263)
  MODE_TWO: 0b10, //Mode 2: Continuous reading of all channels (power-on default)
  MODE_THREE: 0b11 //Mode 3: One-shot reading of all channels
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
    },
    (callback) => {
      console.log('Set measurement mode')
      this.setMeasurementMode(this.MEASUREMENT_MODES.MODE_THREE, callback)
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
  this._setBitMask(this.VIRTUAL_REGISTERS.LED_CONTROL, 0b11001111, current, 4, callback)
}

ColorSensor.prototype.enableBulb = function(callback) {
  this._setBitMask(this.VIRTUAL_REGISTERS.LED_CONTROL, 0b11110111, 1, 3, callback)
}

ColorSensor.prototype.disableBulb = function(callback) {
  this._setBitMask(this.VIRTUAL_REGISTERS.LED_CONTROL, 0b11110111, 0, 3, callback)
}

ColorSensor.prototype.setIndicatorCurrent = function(current, callback){
  this._setBitMask(this.VIRTUAL_REGISTERS.LED_CONTROL, 0b11111001, current, 1, callback)
}

ColorSensor.prototype.enableIndicator = function(callback) {
  this._setBitMask(this.VIRTUAL_REGISTERS.LED_CONTROL, 0b11111110, 1, 0, callback)
}

ColorSensor.prototype.disableIndicator = function(callback) {
  this._setBitMask(this.VIRTUAL_REGISTERS.LED_CONTROL, 0b11111110, 0, 0, callback)
}

ColorSensor.prototype.setIntegrationTime = function (intTime, callback){
  intTime &= 0xFF // cap at 255
  this.virtualWrite(this.VIRTUAL_REGISTERS.INTEGRATION_TIME, intTime, callback)
}

ColorSensor.prototype.setGain = function(gain, callback) {
  this._setBitMask(this.VIRTUAL_REGISTERS.CONTROL_SETUP, 0b11001111, gain, 4, callback)
}

ColorSensor.prototype.setMeasurementMode = function (mode, callback) {
  this._setBitMask(this.VIRTUAL_REGISTERS.CONTROL_SETUP, 0b11110011, mode, 2, callback)
}

ColorSensor.prototype.takeMeasurement = function (bulbOn, callback) {
  let result
  async.series([
    (callback) => {
      if(bulbOn) {
        this.enableBulb(callback)
      } else {
        callback(null)
      }
    },
    this.clearData.bind(this),
    this.waitForMeasurementData.bind(this),
    this.getMeasurementData.bind(this),  
    (callback) => {
      if(bulbOn) {
        this.disableBulb(callback)
      } else {
        callback(null)
      }
    }
  ], () => {
    this.emit('data', [result])
  })
}

ColorSensor.prototype.clearData = function(callback) {
  this._setBitMask(this.VIRTUAL_REGISTERS.CONTROL_SETUP, 0b11111101, 0, 1, callback)
}

ColorSensor.prototype.waitForMeasurementData = function (callback) {
  let status = null
  async.until(
    () => {
      if(status == null) {
        return false
      } else {
        return ((status & this.DATA_AVAILABLE) == 0x02)
      }
    },
    (callback) => {
      this.virtualRead(this.VIRTUAL_REGISTERS.CONTROL_SETUP, (err, result) => {
        status = result
        callback(err)
      })
    },
    callback
  )
}

ColorSensor.prototype.getMeasurementData = function (callback) {
  let result = {}
  async.series([
    (callback) => {
      this.getChannelMeasurement(this.VIRTUAL_REGISTERS.AS7262_V, (err, data) => {
        result.violet = data
        callback(err)
      })
    }
  ], (err) => {
    callback(err, result)
  })
}

ColorSensor.prototype.getChannelMeasurement = function(channel, callback) {
  let result
  async.series([
    (callback) => {
      this.virtualRead(channel, (err, data) => {
        result = data << 8 // high byte
        callback(err)
      })
    },
    (callback) => {
      this.virtualRead(channel + 1, (err, data) => {
        result |= data // low byte
        callback(err)
      })
    }
  ], (err) => {
    this.emit('data', [result])
    callback(err, result)
  })
}

ColorSensor.prototype._setBitMask = function (virtualRegister, mask, value, shift, callback){
  let valueStorage
  async.series([
    // read virtualRegister value
    (callback) => {
      this.virtualRead(virtualRegister, (err, data) => {
        valueStorage = data
        callback(err, null)
      })
    },
    // Set bits 5-6
    (callback) => {
      valueStorage &= mask
      valueStorage |= (value << shift)
      callback(null, null)
    },
    // write to CONTROL_SETUP
    (callback) => {
      this.virtualWrite(virtualRegister, valueStorage, (err) => {
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