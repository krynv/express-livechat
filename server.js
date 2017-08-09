var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var port = process.env.PORT || 1337;
var path = require('path');
var favicon = require('serve-favicon');

server.listen(port, function () {
    console.log(`Server listening on port ${port}`);
});

app.use(express.static(path.join(__dirname, 'public')));
app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));



var numUsers = 0;

io.on('connection', (socket) => {
    var addedUser = false;

    socket.on('new message', (data) => {
        socket.broadcast.emit('new message', {
            username: socket.username,
            message: data,
        });
    });

    socket.on('add user', (username) => {
        if (addedUser) return;

        socket.username = username;
        ++numUsers;
        addedUser = true;

        socket.emit('login', {
            numUsers: numUsers,
        });

        socket.broadcast.emit('user joined', {
            username: socket.username,
            numUsers: numUsers,
        });
    });

    socket.on('typing', () => {
        socket.broadcast.emit('typing', {
            username: socket.username,
        });
    });

    socket.on('stop typing', () => {
        socket.broadcast.emit('stop typing', {
            username: socket.username,
        });
    });

    socket.on('disconnect', () => {
        if (addedUser) {
            --numUsers;

            socket.broadcast.emit('user left', {
                username: socket.username,
                numUsers: numUsers,
            });
        }
    });
});
