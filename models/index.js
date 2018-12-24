const mongoose = require('mongoose')

const DATABASE_URL = process.env.DATABASE_URL || 'mongodb://localhost/event-schedule-manager-bot'
mongoose.connect(DATABASE_URL, { useNewUrlParser: true })

exports.Event = require('./event')
exports.Image = require('./image')
