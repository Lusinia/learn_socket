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
  return self;
};
var Bullet = function (angle) {
  var self = new Entity();
  self.id = Math.random();
  self.spdX = Math.cos(angle / 180 * Math.PI) * 10;
  self.spdY = Math.sin(angle / 180 * Math.PI) * 10;

  self.timer = 0;
  self.toRemove = false;
  var super_update = self.update;
  self.update = function () {
    if (self.timer++ > 100) {
      self.toRemove = true;
    }
    super_update();
  };
  Bullet.list[self.id] = self;
  return self;
};

Bullet.list = {};

Bullet.update = function () {
  if (Math.random() < 0.1){
   new Bullet(Math.random()*360);
  }
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
  self.maxSpd = 10;

  var super_update = self.update;
  self.update = function () {
    self.updateSpd();
    super_update();
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
  });
};

Player.onDisconnect = function (socket) {
  console.log('Player.list', Player.list);

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
  Player.onConnect(socket);
  socket.on('disconnect', function () {
    delete SOCKET_LIST[socket.id];
    Player.onDisconnect(socket);

  });
});

setInterval(function () {
  var pack = {
    player:  Player.update(),
    bullet: Bullet.update()
  };

  for (var a in SOCKET_LIST) {
    var socket = SOCKET_LIST[a];
    socket.emit('newPosition', pack);
  }
}, 1000 / 25);
