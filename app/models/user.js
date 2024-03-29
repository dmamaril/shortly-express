var db = require('../config');
var bcrypt = require('bcrypt-nodejs');
var Promise = require('bluebird');
var Session = require('./session.js');

var User = db.Model.extend({
  tableName: 'users',
  hasTimestampes: true,

  initialize: function () {
    this.on('creating', function (model, attrs, options) {

    });
  },

  sessions: function() {
    return this.hasMany(Session, 'username');
  }
});

module.exports = User;
