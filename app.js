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
var PLAYER_LIST = {};
var Player = function (id) {
  var self = {
    x: 250,
    y: 250,
    id: id,
    number: '' + Math.floor(Math.random() * 10),
    pressRight: false,
    pressLeft: false,
    pressUp: false,
    pressDown: false,
    maxSpeed: 10
  };
  self.updatePosiotion = function () {
    if (self.pressRight) {
      self.x += self.maxSpeed;
    }
    if (self.pressLeft) {
      self.x -= self.maxSpeed;
    }
    if (self.pressDown) {
      self.y += self.maxSpeed;
    }
    if (self.pressUp) {
      self.y -= self.maxSpeed;
    }
  };
  return self;
};

io.on('connection', function (socket) {
  socket.id = Math.random();
  SOCKET_LIST[socket.id] = socket;
  var player = Player(socket.id);
  PLAYER_LIST[socket.id] = player;
  socket.on('disconnect', function () {
    delete SOCKET_LIST[socket.id];
  });
  socket.on('keyPress', function (data) {
    if(data.input === 'left') {
      player.pressLeft = data.state;
    }
    else if(data.input === 'right') {
      player.pressRight = data.state;
    }
    else if(data.input === 'up') {
      player.pressUp = data.state;
    }
    else if(data.input === 'down') {
      player.pressDown = data.state;
    }
  });
});

setInterval(function () {
  var pack = [];
  for (var i in PLAYER_LIST) {
    var player = PLAYER_LIST[i];
    player.updatePosiotion();
    pack.push({ x: player.x, y: player.y, number: player.number });
  }
  for (var a in SOCKET_LIST) {
    var socket = SOCKET_LIST[a];
    socket.emit('newPosition', pack);
  }
 }, 1000 / 25);
