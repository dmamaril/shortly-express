var db = require('../config');
var Session = require('../models/session');

var Sessions = new db.Collection();

Sessions.model = Session;

module.exports = Sessions;
