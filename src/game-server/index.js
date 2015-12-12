import Peer from "peerjs";
import * as util from "common/util";
import handlers from "game-server/event-handlers";

handlers.init();
startServer();
connectToMatchmakingServer();

{
    // Dirty hack using a web worker to get around the fact that
    // setTimeout/setInterval are throttled to 1 call per second if the page
    // isn't focused.
    //let workerCode = "onmessage = function() { setTimeout(function () { postMessage('tock'); }, 1000 / 30); };";
    let workerCode = "onmessage = function() { setTimeout(function () { postMessage('tock'); }, 1000 / 60); };";
    let workerURL = window.URL.createObjectURL(new Blob([workerCode]));
    let worker = new Worker(workerURL);

    var requestFrameWithWorker = callback => {
        worker.onmessage = callback;
        worker.postMessage('tick');
    };
};

util.animationLoop(handlers.update, requestFrameWithWorker);

function startServer() {
    let [serverId, creatorName] = window.location.hash.substr(1).split(',');
    if (!serverId) throw new Error('No server ID given in URL hash.');
    //let serverId = 'server', creatorName = 'creator';

    let serverPeer = new Peer(serverId, {host: 'localhost', port: 8000, path: '/peerjs'});

    let disconnected = false;
    function onDisconnect() {
        if (serverPeer && !disconnected) {
            // Prevents recusion due to peer.destroy() calling
            // connection.on('close'), which calls onDisconnect().
            disconnected = true;

            serverPeer.destroy();
        }

        // Attempt to reconnect to signalling server after 1 second.
        //setTimeout(startServer, 1000);
    };

    // Log connection status and errors.
    serverPeer.on('open', serverId => {
        console.log('Connected to signalling server with ID: ' + serverId);

        handlers.connected(serverId, creatorName);
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
    let socket = new WebSocket('ws://localhost:8000/ws');

    socket.onopen = event => {
        let sendMessageFunction = message => {
            socket.send(JSON.stringify(message));
        };

        handlers.connectedToMatchmakingServer(sendMessageFunction);
    };
}
