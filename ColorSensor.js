const util = require('util')
const events = require('events')

const Board = require('./node_modules/johnny-five/lib/board')

// This is used to hold our sensor's state
let priv = new Map()

let Controllers = {
    AS7262: {
        ADDRESS: {
            value: [0x49]
        },
        REGISTERS: {
            value: {
                PERIPHERAL_STATUS: 0x00,
                PERIPHERAL_RX_VALID: 0x01,
                PERIPHERAL_READ: 0x02,
                PERIPHERAL_TX_VALID: 0x02,
                PERIPHERAL_WRITE: 0x01,
                VIRTUAL_HW_VERSION: 0x01
            }
        },
        readVirtualRegister: {
            value: function(address, virtualRegister, cb) {
                this.io.i2cWrite(address, [this.REGISTERS.PERIPHERAL_STATUS])
                this.io.i2cRead(address, 1, (data) => {
                    cb(data)
                })
            }
        },
        writeVirtualRegister: {
            value: function(address, virtualRegister, value) {

            }
        },
        initialize: {
            value: function(opts, cb) {
                let address = opts.address || this.ADDRESS.value[0]
                let state = priv.get(this)

                opts.address = address

                console.log(opts.address)

                this.io.i2cConfig(opts)
                this.readVirtualRegister(opts.address, this.REGISTERS.VIRTUAL_HW_VERSION, (err, data)=> {
                })
            }
        }
    }
}

function ColorSensor(opts) {
    if(!this instanceof ColorSensor){
        return new ColorSensor(opts)
    }

    Board.Component.call(this, opts = Board.Options(opts))

    controller = Controllers.AS7262

    Board.Controller.call(this, controller, opts)

    state = {

    }
    priv.set(this, state)

    if (typeof this.initialize === "function") {
        this.initialize(opts, function(data) {
            state.value = data
        })
    }
}

util.inherits(ColorSensor, events.EventEmitter)

module.exports = ColorSensor