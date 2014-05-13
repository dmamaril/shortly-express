var db = require('../config');
var bcrypt = require('bcrypt-nodejs');
var Promise = require('bluebird');

var Session = db.Model.extend({
  tableName: 'sessions',
  hasTimestampes: true,

  initialize: function () {
    this.on('creating', function (model, attrs, options) {

    });
  }
});


module.exports = Session;
