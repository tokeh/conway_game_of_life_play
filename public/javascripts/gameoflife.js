/*jslint browser: true*/
/*global $, jQuery, WebSocket, console*/

var Highscore = (function () {
    'use strict';

    /*
     A highscore plugin
     */
    function Highscore(settings) {
        this.settings = $.extend({}, settings);
        this.$form = $(this.settings.selector).find('form');
    }

    Highscore.prototype.enable = function () {
        this.addEventListener();
    };

    Highscore.prototype.addEventListener = function () {
        var hs = this;

        this.$form.submit(function (e) {
            e.preventDefault();

            var player, score;

            player = $(this).find('input[name="player"]').val();
            score = $(hs.settings.generationsSelector).html();

            hs.submitHighscore(player, score);
        });
    };

    Highscore.prototype.submitHighscore = function (playerName, highscore) {
        var data, hs;

        hs = this;

        data = {
            game: this.settings.gameName,
            player: playerName,
            score: highscore
        };

        $.ajax(this.settings.url, {
            contentType: 'application/json',
            type: 'POST',
            data: JSON.stringify(data),
            success: function () {
                hs.$form.find('.response').html("highscore added");
            }
        });
    };

    return Highscore;

}());

var Game = (function () {
    'use strict';

    /*
     A generic logger.
     */
    function Logger(debug) {
        this.debug = debug;
    }

    Logger.prototype.log = function (msg) {
        if (this.debug) {
            console.log(msg);
        }
    };

    /*
     The web socket for communication

     settings = {
     url, timeout, maxReconnectAttempts, debug
     }
     */
    function Socket(settings) {
        this.settings = $.extend({}, settings);
        this.socket = {};
        this.reconnectAttempts = 0;
        var logger = new Logger(settings.debug);
        this.log = logger.log.bind(logger);

        this.connect();

        this.log("Socket created");
    }

    Socket.prototype.connect = function () {
        this.socket = new WebSocket(this.settings.url, ['json']);

        // bind socket events
        this.socket.onclose = this.onclose.bind(this);
        this.socket.onopen = this.onopen.bind(this);
    };

    Socket.prototype.onclose = function () {
        this.log("socket closed. reconnecting in " + this.settings.timeout + " ms");

        if (this.reconnectAttempts < this.settings.maxReconnectAttempts) {
            setTimeout(this.connect.bind(this), this.settings.timeout);
            this.reconnectAttempts += 1;
        }
    };

    Socket.prototype.onopen = function () {
        this.log('socket open');
    };

    Socket.prototype.sendJson = function (msg) {
        var jsonMessage = JSON.stringify(msg);
        this.log('sending over socket: ' + jsonMessage);
        this.socket.send(jsonMessage);
    };

    Socket.prototype.setOnMessage = function (callback) {
        this.socket.onmessage = callback;
    };


    /*
     The main game communication
     */
    function Game(settings) {
        this.settings = $.extend(true, {}, settings);

        this.socket = {};
        this.cells = [[]];
        this.rows = 0;
        this.columns = 0;
        this.generationStrategy = '';

        var logger = new Logger(settings.debug);
        this.log = logger.log.bind(logger);

        this.$grid = $(this.settings.selectors.grid);
        this.$status = $(this.settings.selectors.status);
        this.templateCell = $(this.settings.selectors.cellTemplate).html();
    }

    Game.prototype.start = function () {
        this.log("Game starting.");
        this.tweakMouseEvent();
        this.setupControls();
        this.bindGridEvents();
        this.socket = new Socket(this.settings.socket);
        this.socket.setOnMessage(this.drawGrid.bind(this));
    };


    // to detect if mouse is pressed while hovering.
    Game.prototype.tweakMouseEvent = function () {
        var leftButtonDown;

        $(document).mousedown(function (e) {
            if (e.which === 1) {
                leftButtonDown = true;
            }
        });
        $(document).mouseup(function (e) {
            if (e.which === 1) {
                leftButtonDown = false;
            }
        });
        $(document).mousemove(function (e) {
            if (e.which === 1 && !leftButtonDown) {
                e.which = 0;
            }
        });
    };

    Game.prototype.setupControls = function () {
        // sliders
        var options = {
                min: 1,
                max: 50,
                step: 1,
                value: 1,
                tooltip: 'hide'
            },
            game = this,
            rowsOptions = $.extend({}, options),
            columnsOptions = $.extend({}, options);

        rowsOptions.orientation = 'vertical';
        columnsOptions.orientation = 'horizontal';

        $(this.settings.selectors.sliderRows).slider(rowsOptions).on('change', function (rowsEvent) {
            var columns = game.columns,
                rows = rowsEvent.value.newValue;
            game.sendCommand('s', [rows, columns]);
        });

        $(this.settings.selectors.sliderColumns).slider(columnsOptions).on('change', function (columnsEvent) {
            var rows = game.rows,
                columns = columnsEvent.value.newValue;
            game.sendCommand('s', [rows, columns]);
        });

        // buttons
        $(this.settings.selectors.clear).click(function () {
            game.sendCommand('c');
        });
        $(this.settings.selectors.stepOneBtn).click(function () {
            game.sendCommand('n');
        });
        $(this.settings.selectors.stepNBtn).click(function () {
            var steps = $(this).data('steps'),
                speed = $(this).data('speed');
            game.animate(steps, speed);
        });
        $(this.settings.selectors.figure).click(function () {
            var figure = $(this).data('figure');
            game.spawnFigure(figure);
        });
    };

    Game.prototype.sendCommand = function (cmd, args) {
        var completeCommand = cmd;

        if (args === undefined || args === null) {
            args = [];
        }

        args.forEach(function (arg) {
            completeCommand += ' ' + arg;
        });

        this.socket.sendJson({
            command: completeCommand
        });
    };

    Game.prototype.spawnFigure = function (figure) {
        var hoverClass = 'spawn-hovered',
            $cells,
            game = this;

        this.setStatus('choose spawn point');

        $cells = this.$grid.find(this.settings.selectors.cell);

        $cells.on('mouseenter.spawn', function () {
            $(this).addClass(hoverClass);
        });

        $cells.on('mouseleave.spawn', function () {
            $(this).removeClass(hoverClass);
        });

        $cells.on('click.spawn', function () {
            var $cell = $(this),
                rowColumn = game.getRowAndColumnFromId($cell.attr('id'));

            $cells.off('.spawn');
            $cell.removeClass(hoverClass);
            game.setStatus('');
            game.sendCommand('t', [rowColumn.row, rowColumn.column]);
            game.sendCommand(figure, [rowColumn.row, rowColumn.column]);
        });
    };

    Game.prototype.animate = function (steps, speed) {
        var game = this,
            frames = steps,
            enqueueFrame,
            singleStep;

        enqueueFrame = function () {
            setTimeout(function () {
                singleStep();
            }, speed);
        };

        singleStep = function () {
            if (frames === 0) {
                game.setStatus('');
            } else {
                frames -= 1;
                game.setStatus('animation - frames left: ' + frames);
                game.sendCommand('n');
                enqueueFrame();
            }
        };

        enqueueFrame();
    };

    Game.prototype.setStatus = function (status) {
        this.$status.html(status);
    };

    // Drawing grid
    Game.prototype.drawGrid = function (msg) {
        var data;

        data = JSON.parse(msg.data);
        this.log(data);
        this.cells = data.cells;

        if (this.generationStrategy !== data.generationStrategy) {
            this.generationStrategy = data.generationStrategy;
            $(this.settings.selectors.generationStrategy).html(this.generationStrategy);
        }

        $(this.settings.selectors.steppedGenerations).html(data.numberOfSteppedGenerations);

        if (this.isGridDimensionDifferent()) {
            this.rows = this.cells.length;
            this.columns = this.cells[0].length;
            this.createGridDom();
        }

        this.updateCells();
    };

    Game.prototype.isGridDimensionDifferent = function () {
        return this.rows !== this.cells.length
            || this.columns !== this.cells[0].length;
    };

    Game.prototype.createGridDom = function () {
        this.log('creating dom');

        var rows = this.rows,
            columns = this.columns,
            i,
            j,
            $cell,
            $row;

        this.$grid.html('');

        for (i = 0; i < rows; i += 1) {
            $row = this.createRow();
            for (j = 0; j < columns; j += 1) {
                $cell = this.createCell(i, j);
                $row.append($cell);
            }
            this.$grid.append($row);
        }
    };

    Game.prototype.createRow = function () {
        return $('<div></div>');
    };

    Game.prototype.createCell = function (row, column) {
        var $cell = $(this.templateCell);
        $cell.attr('id', 'cell-' + row + '-' + column);

        return $cell;
    };

    Game.prototype.bindGridEvents = function () {
        var game = this;

        function toggleCell(event) {
            if (event.which === 1) {
                var rowColumn = game.getRowAndColumnFromId($(this).attr('id'));

                game.sendCommand('t', [rowColumn.row, rowColumn.column]);
            }
        }

        this.$grid.on('mousedown', this.settings.selectors.cell, toggleCell);
        this.$grid.on('mouseenter', this.settings.selectors.cell, toggleCell);
    };

    Game.prototype.getRowAndColumnFromId = function (id) {
        var parts = id.split('-');

        return {
            row: parts[1],
            column: parts[2]
        };
    };

    Game.prototype.updateCells = function () {
        var i,
            j;

        for (i = 0; i < this.rows; i += 1) {
            for (j = 0; j < this.columns; j += 1) {
                this.updateCell(i, j, this.cells[i][j]);
            }
        }

        $(this.settings.selectors.sliderRows).slider('setValue', this.rows);
        $(this.settings.selectors.sliderColumns).slider('setValue', this.columns);
    };

    Game.prototype.updateCell = function (row, column, isAlive) {
        var $cell = $('#cell-' + row + '-' + column);

        if (isAlive) {
            $cell.addClass(this.settings.cellAliveClass);
        } else {
            $cell.removeClass(this.settings.cellAliveClass);
        }
    };

    return Game;

}());

$(document).ready(function () {
    'use strict';

    var gameId, game, highscore;

    gameId = $('#grid').data('game-id');

    game = new Game({
        debug: false,
        socket: {
            debug: false,
            url: 'ws://' + window.location.host + '/games/' + gameId + '/socket',
            timeout: 1500,
            maxReconnectAttempts: 3
        },
        selectors: {
            grid: '#grid',
            cellTemplate: '#template-cell',
            cell: '.cell',
            sliderRows: '.slider-rows',
            sliderColumns: '.slider-columns',
            clear: '.clear',
            stepOneBtn: '.step-1',
            stepNBtn: '.step-n',
            status: '.status',
            generationStrategy: '.world',
            figure: '.spawn-figure',
            steppedGenerations: '.stepped-generations'
        },
        cellAliveClass: 'alive'
    });

    game.start();

    highscore = new Highscore({
        url: '/highscores',
        generationsSelector: '.stepped-generations',
        selector: '#highscore',
        gameName: 'Game of Life'
    });

    highscore.enable();
});
