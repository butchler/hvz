import Peer from "peerjs";
import * as util from "common/util";
import handlers from "game-server/event-handlers";
import * as config from "common/config";

handlers.init();
startServer();
connectToMatchmakingServer();

{
    // Dirty hack using a web worker to get around the fact that
    // setTimeout/setInterval are throttled to 1 call per second if the page
    // isn't focused.
    let workerCode = `onmessage = function() { setTimeout(function () { postMessage('tock'); }, 1000 / ${config.gameServerFrameRate}); };`;
    let workerURL = window.URL.createObjectURL(new Blob([workerCode]));
    let worker = new Worker(workerURL);

    var requestFrameWithWorker = callback => {
        worker.onmessage = callback;
        worker.postMessage('tick');
    };
};

util.animationLoop(handlers.update, requestFrameWithWorker);

function startServer() {
    let gameServerId = 'server' + ('' + Math.random()).substr(2);
    let serverPeer = new Peer(gameServerId, config.signallingServerConfig);

    let disconnected = false;
    function onDisconnect() {
        // Reload the server when disconnected from the signalling server.
        setTimeout(_ => window.location.reload(), 2000);
    };

    // Log connection status and errors.
    serverPeer.on('open', serverId => {
        console.log('Connected to signalling server with ID: ' + serverId);

        handlers.connected(gameServerId);
    });
    serverPeer.on('disconnected', () => {
        console.error('Disconnected from signalling server.');

        onDisconnect();
    });
    serverPeer.on('close', () => {
        console.error('Peer was closed.');

        onDisconnect();
    });
    serverPeer.on('error', error => {
        console.error('Error connecting to signalling server:', error);

        onDisconnect();
    });

    // Handle incoming client connections.
    serverPeer.on('connection', connection => {
        console.log('Got connection from client:', connection.peer);

        connection.on('open', () => {
            console.log('Connection to client ready:', connection);

            let playerId = connection.peer;

            let sendStateFunction = state => connection.send(state);
            handlers.playerConnected(playerId, connection.metadata.playerName, sendStateFunction);

            connection.on('close', () => {
                console.log('Client disconnected:', connection.peer);

                handlers.playerDisconnected(playerId);
            });
            connection.on('error', error => {
                handlers.playerDisconnected(playerId);
            });

            connection.on('data', data => {
                handlers.receivedInput(playerId, data);
            });
        });

        connection.on('error', error => {
            console.error('Error connecting to client:', error);
        });
    });
}

function connectToMatchmakingServer() {
    let socket = new WebSocket(config.matchmakingServerUrl);

    socket.onopen = event => {
        let sendMessageFunction = message => {
            socket.send(JSON.stringify(message));
        };

        handlers.connectedToMatchmakingServer(sendMessageFunction);
    };

    socket.onmessage = event => {
        let messageString = event.data, message = null;
        try {
            message = JSON.parse(messageString);
        } catch (error) {
            console.error(`Could not parse message "${messageString}": ${error}`);
            return;
        }

        if (message.type === 'start-game') {
            handlers.startGame(message.creator, message.numPlayers);
        } else {
            console.error('Unknown message:', messageString);
        }
    };
}
