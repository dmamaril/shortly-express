var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bcrypt = require('bcrypt-nodejs');

var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');
var Session = require('./app/models/session');


var app = express();

app.configure(function() {
  app.set('views', __dirname + '/views');
  app.set('view engine', 'ejs');
  app.use(partials());
  app.use(express.bodyParser())
  app.use(express.static(__dirname + '/public'));
});

app.get('/', function(req, res) {
  res.render('login');
});

app.get('/create', function(req, res) {

  res.redirect('/login');
  res.render('index');
});

app.get('/links', function(req, res) {
  //res.redirect('/login');
  Links.reset().fetch().then(function(links) {
    res.send(200, links.models);
  });
});

app.get('/signup', function (req, res) {
  res.render('signup');
});

app.post('/login', function(req, res) {
  new User({
    username : req.body.username
  }).fetch().then(function(found) {

    //console.log(found);
    console.log(found.sessions);
    //console.log(found.sessions());
    if (found) {
      var hash = bcrypt.hashSync(req.body.password, found.attributes.salt);
      if (hash === found.attributes.password) {
        var sessionKey = bcrypt.genSaltSync(10);
        var session = new Session({
          session  : sessionKey,
          username : req.body.username,
          active   : true,
          createdat: (new Date).toString()
        });

        session.save().then(function(session) {
          setTimeout(function(){
            session.set('active', false);
            session.save();
          },10000);
        });
        res.render('index');
        return;
      }
      // think about rendering a <div> above form in red
      res.end('Incorrect password');

    } else {
      // think about rendering a <div> above form in red
      //res.end('Incorrect username, create an account');
      res.render('signup');
    }
  });
});

app.post('/signup', function(req, res) {
  new User({
    username : req.body.username
  }).fetch().then(function(found) {
    if (found) {
      res.end('User already exists, feck off');
    } else {
      var salt = bcrypt.genSaltSync(10);
      var hash = bcrypt.hashSync(req.body.password, salt);
      var user = new User({
        username : req.body.username,
        password : hash,
        salt     : salt
      });
      user.save().then(function(newUser){
        res.end(' account created');
      });
    }
  });
});

app.post('/links', function(req, res) {
  var uri = req.body.url;

  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.send(404);
  }

  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      res.send(200, found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.send(404);
        }

        var link = new Link({
          url: uri,
          title: title,
          base_url: req.headers.origin
        });

        link.save().then(function(newLink) {
          Links.add(newLink);
          res.send(200, newLink);
        });
      });
    }
  });
});

/************************************************************/
// Write your authentication routes here
/************************************************************/



/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        link_id: link.get('id')
      });

      click.save().then(function() {
        db.knex('urls')
          .where('code', '=', link.get('code'))
          .update({
            visits: link.get('visits') + 1,
          }).then(function() {
            return res.redirect(link.get('url'));
          });
      });
    }
  });
});

console.log('Shortly is listening on 4568');
app.listen(4568);
