var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bcrypt = require('bcrypt-nodejs');
var passport = require('passport');
var GitHubStrategy = require('passport-github').Strategy;

debugger;
var db = require('./app/config');
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
  app.use(express.bodyParser());
  app.use(express.cookieParser());
  app.use(express.static(__dirname + '/public'));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(new GitHubStrategy({
    clientID: 'c18c036364286ea235fd',
    clientSecret: 'c196d1ae3749a4336ac69ef0b54adbb77a404420',
    callbackURL: 'http://shortl.azurewebsites.net/auth/github/callback'
  },
    function(accessToken, refreshToken, profile, done) {
      console.log("Authenticate!");
      process.nextTick(function() {
        done(null, profile);
      });
      // User.findOrCreate({ githubId: profile.id}, function (err, user){
      //   return done(err, user);
      // });
    }
  ));

  passport.serializeUser(function(user, done){
    console.log("serial!");
    done(null, user);
  });
  passport.deserializeUser(function(obj, done){
    console.log("deserial!");
    done(null, done);
  });

});
app.all('*', function(req, res, next){
  console.log(req);
  next();
});
app.get('/auth/github', passport.authenticate('github'));

app.get('/auth/github/callback', passport.authenticate('github', {
  successRedirect: '/success',
  failureRedirect: '/error'
}));

app.get('/success', function(req, res, next){
  console.log('Logged');
  res.end('Logged in!');
});

app.get('/error', function(req, res, next){
  console.log('Error');
  res.end('Error logging in');
});

app.get('/', function(req, res) {
  res.render('login');
});

app.get('/logout', function(req, res) {
  res.cookie('session', '');
  res.render('login');
});

app.get('/create', function(req, res) {
  app.queryCollection(req.cookies.session, function (authenticated){
    if (authenticated) {
      //console.log('authenticated');
      res.render('index');
    } else {
      res.render('login');
    }
  });
});

app.get('/links', function(req, res) {
  console.log("links ", req.cookies);
  app.queryCollection(req.cookies.session, function (authenticated){
    console.log("links ", authenticated);
    if (authenticated) {
      console.log('authenticated');
      Links.reset().fetch().then(function(links) {
        res.send(200, links.models);
      });
    } else {
      res.render('login');
    }
  });
});

app.get('/signup', function (req, res) {
  res.render('signup');
});

app.post('/login', function(req, res) {
  new User({
    username : req.body.username
  }).fetch().then(function(found) {

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

        res.cookie('session', sessionKey);
        session.save().then(function(session) {
          setTimeout(function(){
            session.set('active', false);
            session.save();
          }, 30000);
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
  app.queryCollection(req.cookies.session, function (authenticated){
    if (authenticated) {
      //console.log('authenticated');
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

    } else {
      res.render('login');
    }
  });
});

/************************************************************/
// Write your authentication routes here
/************************************************************/

app.queryCollection = function (sessionKey, callback) {

  Session.collection().fetch().then( function (found){
    if(found) {
      for(var i = 0; i < found.models.length; i++){
        if (found.models[i].attributes.active === 1 && found.models[i].attributes.session === sessionKey) {
          callback(true);
          return;
        }
      }
      callback(false);
    }
  });

};



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
var port = process.env.PORT||4568;
console.log(port);
app.listen(port);
