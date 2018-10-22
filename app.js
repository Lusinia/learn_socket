var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http, {});

app.get('/', function (req, res) {
  res.sendFile(__dirname + '/client/index.html');
});

http.listen(2000);
console.log('Server started');

var SOCKET_LIST = {};
var DEBUG = true;
var USERS = {
  'bob': 'asd',
  'bob2': 'asdf',
  'bob3': 'fff',
};

var isValidPassword = function (data, cb) {
 setTimeout(function () {
   cb(USERS[data.username] === data.password)
 }, 10)
};
var isUsernameTaken = function (data, cb) {
  setTimeout(function () {
    cb(USERS[data.username])
  }, 10);
};

var addUser = function (data, cb) {
  setTimeout(function () {
    USERS[data.username] = data.password;
    cb();
  }, 10);
};

var Entity = function () {
  var self = {
    x: 250,
    y: 250,
    id: '',
    spdX: 0,
    spdY: 0
  };
  self.update = function () {
    self.updatePosition();
  };
  self.updatePosition = function () {
    self.x += self.spdX;
    self.y += self.spdY;
  };
  self.getDistance = function (pt) {
    return Math.sqrt(Math.pow(self.x - pt.x, 2) + Math.pow(self.y - pt.y, 2));
  };
  return self;
};
var Bullet = function (parent, angle) {
  var self = new Entity();
  self.id = Math.random();
  self.spdX = Math.cos(angle / 180 * Math.PI) * 10;
  self.spdY = Math.sin(angle / 180 * Math.PI) * 10;
  self.parent = parent;

  self.timer = 0;
  var super_update = self.update;
  self.update = function () {
    if (self.timer++ > 100) {
      Bullet.remove(self.id);
    }
    super_update();
    for (var i in Player.list) {
      var p = Player.list[i];
      if (self.getDistance(p) < 32 && self.parent !== p.id) {
        Bullet.remove(self.id);
      }
    }
  };
  Bullet.list[self.id] = self;
  return self;
};

Bullet.list = {};
Bullet.remove = function (id) {
  delete Bullet.list[id];
};

Bullet.update = function () {

  var pack = [];

  for (var i in Bullet.list) {
    var bullet = Bullet.list[i];
    bullet.update();
    pack.push({ x: bullet.x, y: bullet.y });
  }
  return pack;
};

var Player = function (id) {
  var self = new Entity();
  self.id = id;
  self.number = '' + Math.floor(Math.random() * 10);
  self.pressRight = false;
  self.pressLeft = false;
  self.pressUp = false;
  self.pressDown = false;
  self.pressAttack = false;
  self.mouseAngle = 0;
  self.maxSpd = 10;

  var super_update = self.update;
  self.update = function () {
    self.updateSpd();
    super_update();

    if (self.pressAttack) {
      self.shootBullet(self.mouseAngle);
    }
  };


  self.shootBullet = function (angle) {
    var b = new Bullet(self.id, angle);
    b.x = self.x;
    b.y = self.y;
  };

  self.updateSpd = function () {
    if (self.pressRight) {
      self.spdX = self.maxSpd;
    }
    else if (self.pressLeft) {
      self.spdX = -self.maxSpd;
    }
    else {
      self.spdX = 0;
    }
    if (self.pressDown) {
      self.spdY = self.maxSpd;
    }
    else if (self.pressUp) {
      self.spdY = -self.maxSpd;
    } else {
      self.spdY = 0;
    }
  };
  Player.list[id] = self;
  return self;
};

Player.list = {};

Player.onConnect = function (socket) {
  var player = Player(socket.id);
  socket.on('keyPress', function (data) {
    if (data.input === 'left') {
      player.pressLeft = data.state;
    }
    else if (data.input === 'right') {
      player.pressRight = data.state;
    }
    else if (data.input === 'up') {
      player.pressUp = data.state;
    }
    else if (data.input === 'down') {
      player.pressDown = data.state;
    }
    else if (data.input === 'attack') {
      player.pressAttack = data.state;
    }
    else if (data.input === 'mouseAngle') {
      player.mouseAngle = data.state;
    }
  });
};

Player.onDisconnect = function (socket) {
  delete Player.list[socket.id];
};

Player.update = function () {
  var pack = [];

  for (var i in Player.list) {
    var player = Player.list[i];
    player.update();
    pack.push({ x: player.x, y: player.y, number: player.number });
  }
  return pack;
};

io.on('connection', function (socket) {
  socket.id = Math.random();
  SOCKET_LIST[socket.id] = socket;

  socket.on('signIn', function (data) {
    isValidPassword(data, function (res) {
      if (res) {
        Player.onConnect(socket);
        socket.emit('signInResponce', { success: true });
      } else {
        socket.emit('signInResponce', { success: false });
      }
    })
  });

  socket.on('signUp', function (data) {
    isUsernameTaken(data, function (res) {
      if (res){
        socket.emit('signUpResponce', { success: false });
      } else {
        addUser(data, function () {
          socket.emit('signUpResponce', { success: true });
        })
      }
    })
  });

  socket.on('disconnect', function () {
    delete SOCKET_LIST[socket.id];
    Player.onDisconnect(socket);
  });
  socket.on('sendMsgToServer', function (data) {
    var playerName = ('' + socket.id).slice(2, 7);
    for (var i in SOCKET_LIST) {
      SOCKET_LIST[i].emit('addToChat', playerName + 'joned');
    }
  });
  socket.on('evalServer', function (data) {
    if (!DEBUG) {
      return;
    }
    var res = eval(data);
    socket.emit('evalAnswer', res);
  });

});

setInterval(function () {
  var pack = {
    player: Player.update(),
    bullet: Bullet.update()
  };

  for (var a in SOCKET_LIST) {
    var socket = SOCKET_LIST[a];
    socket.emit('newPosition', pack);
  }
}, 1000 / 25);
