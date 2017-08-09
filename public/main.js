$(() => {
    var FADE_TIME = 150; // in ms
    var TYPING_TIMER_LENGTH = 400;
    var COLORS = [
        '#e21400', '#91580f', '#f8a700', '#f78b00',
        '#58dc00', '#287b00', '#a8f07a', '#4ae8c4',
        '#3b88eb', '#3824aa', '#a700ff', '#d300e7',
    ];

    var $window = $(window);
    var $usernameInputBox = $('.usernameInput'); 
    var $messagePool = $('.messages'); 
    var $inputMessageBox = $('.inputMessage');

    var $loginPage = $('.login.page'); 
    var $chatPage = $('.chat.page');

    var username;
    var connected = false;
    var typing = false;
    var lastTypingTime;
    var $currentUserInput = $usernameInputBox.focus();

    var socket = io();

    function addParticipantsMessage(data) {
        var message = '';
        
        if (data.numUsers === 1) {
            message += "1 member remaining";
        } else {
            message += `${data.numUsers} members remaining`;
        }

        log(message);
    }

    function setUsername() {
        // stop markup injections
        username = cleanInput($usernameInputBox.val().trim());

        // if the username is valid
        if (username) {
            $loginPage.fadeOut();
            $chatPage.show();
            $loginPage.off('click');
            $currentUserInput = $inputMessageBox.focus();

            // tell the server
            socket.emit('add user', username);
        }
    }

    function sendMessage() {
        var message = $inputMessageBox.val();
        message = cleanInput(message);

        // check for valid message & client connection 
        if (message && connected) {
            $inputMessageBox.val(''); // reset the input box
            addChatMessage({
                username: username,
                message: message,
            });

            // send the message
            socket.emit('new message', message);
        }
    }

    function log(message, options) {
        var $element = $('<li>').addClass('log').text(message);
        addMessageElement($element, options);
    }

    function addChatMessage(data, options) {

        var $typingMessages = getTypingMessages(data);

        options = options || {};

        if ($typingMessages.length !== 0) {
            options.fade = false;
            $typingMessages.remove();
        }

        var $username = $('<span class="username"/>')
            .text(data.username)
            .css('color', getUsernameColor(data.username));

        var $messageBody = $('<span class="messageBody">').text(data.message);

        var typingClass = data.typing ? 'typing' : '';

        var $message = $('<li class="message"/>')
            .data('username', data.username)
            .addClass(typingClass)
            .append($username, $messageBody);

        addMessageElement($message, options);
    }

    function addChatTyping(data) {
        data.typing = true;
        data.message = 'is typing';

        addChatMessage(data);
    }

    function removeChatTyping(data) {
        getTypingMessages(data).fadeOut(function () {
            $(this).remove();
        });
    }

    function addMessageElement(givenElement, options) {
        var $element = $(givenElement);

        // defaults
        if (!options) {
            options = {};
        }
        if (typeof options.fade === 'undefined') {
            options.fade = true;
        }
        if (typeof options.prepend === 'undefined') {
            options.prepend = false;
        }

        // set the options
        if (options.fade) {
            $element.hide().fadeIn(FADE_TIME);
        }
        if (options.prepend) {
            $messagePool.prepend($element);
        } 
        else {
            $messagePool.append($element);
        }

        $messagePool[0].scrollTop = $messagePool[0].scrollHeight;
    }

    function cleanInput(input) {
        return $('<div/>').text(input).text();
    }

    function updateTyping() {
        if (connected) {
            // if not typing, explicitly invert the typing state and tell the server
            if (!typing) {
                typing = true;
                socket.emit('typing');
            }

            lastTypingTime = (new Date()).getTime();

            setTimeout(function () {
                var typingTimer = (new Date()).getTime();
                var timeDiff = typingTimer - lastTypingTime;
                if (timeDiff >= TYPING_TIMER_LENGTH && typing) {
                    socket.emit('stop typing');
                    typing = false;
                }
            }, TYPING_TIMER_LENGTH);
        }
    }

    function getTypingMessages(data) {
        return $('.typing.message').filter(function (i) {
            return $(this).data('username') === data.username;
        });
    }

    function getUsernameColor(username) {
        var hash = 7;

        for (var i = 0; i < username.length; i++) {
            hash = username.charCodeAt(i) + (hash << 5) - hash;
        }

         // calculate colour based on generated hash
        var index = Math.abs(hash % COLORS.length);

        return COLORS[index];
    }

    // MARK: Keyboard Events

    $window.keydown(function (event) {
        // auto-focus input when a key is pressed by user
        if (!(event.ctrlKey || event.metaKey || event.altKey)) {
            $currentUserInput.focus();
        }

        // enter
        if (event.which === 13) {
            if (username) {
                sendMessage();
                socket.emit('stop typing');
                typing = false;
            } 
            else {
                setUsername();
            }
        }
    });

    $inputMessageBox.on('input', function () {
        updateTyping();
    });

    // MARK: Click Events

    // focus on the input when you click anywhere on the page
    $loginPage.click(function () {
        $currentUserInput.focus();
    });

    // focus on the input box when clicking on the message input's border
    $inputMessageBox.click(function () {
        $inputMessageBox.focus();
    });

    // MARK: Socket Events

    // log the login message whenever a user logs in
    socket.on('login', function (data) {
        connected = true;

        var message = "A chat client created by Vitaliy Krynytskyy";
        
        log(message, {
            prepend: true,
        });

        addParticipantsMessage(data);
    });

    // Whenever the server emits 'new message', update the chat body
    socket.on('new message', function (data) {
        addChatMessage(data);
    });

    // Whenever the server emits 'user joined', log it in the chat body
    socket.on('user joined', function (data) {
        log(data.username + ' joined');
        addParticipantsMessage(data);
    });

    // Whenever the server emits 'user left', log it in the chat body
    socket.on('user left', function (data) {
        log(data.username + ' left');
        addParticipantsMessage(data);
        removeChatTyping(data);
    });

    // Whenever the server emits 'typing', show the typing message
    socket.on('typing', function (data) {
        addChatTyping(data);
    });

    // Whenever the server emits 'stop typing', kill the typing message
    socket.on('stop typing', function (data) {
        removeChatTyping(data);
    });

    socket.on('disconnect', function () {
        log('you have been disconnected');
    });

    socket.on('reconnect', function () {
        log('you have been reconnected');
        if (username) {
            socket.emit('add user', username);
        }
    });

    socket.on('reconnect_error', function () {
        log('attempt to reconnect has failed');
    });

});
