import * as three from "three";
import random from "pcg-random";
import Peer from "peerjs";
import {generateMaze, printGrid} from "common/maze";
import * as util from "common/util";
import handlers from "client/event-handlers";

handlers.init();

// Init events.
connectToGameServer();
addInputEvents();

// Start animation loop.
util.animationLoop(handlers.render);

function connectToGameServer() {
    let clientPeer = new Peer({host: 'localhost', port: 8000, path: '/peerjs'});

    let disconnected = false;
    function onDisconnect(connection) {
        handlers.disconnected();

        // Destroy peer.
        if (clientPeer && !disconnected) {
            // Prevents recusion due to peer.destroy() calling
            // connection.on('close'), which calls onDisconnect().
            disconnected = true;

            clientPeer.destroy();
        }

        // Attempt to reconnect after 1 second.
        setTimeout(connectToGameServer, 1000);
    };

    clientPeer.on('open', (clientId) => {
        // The peer has connected to the PeerJS signalling server.
        console.log(`Connected to signalling server with ID: ${clientId}.`);

        // Try to connect to server peer.
        let connection = clientPeer.connect('server', {reliable: false});
        let initialState = true;

        connection.on('open', () => {
            // Successfully connected to server peer.
            console.log('Connected to peer server.');

            connection.on('data', (data) => {
                // TODO: Validate data received from server.

                if (initialState) {
                    // Call the connected() event handler when the initial state is received.
                    let sendInputStateFunction = inputState => connection.send(inputState);
                    handlers.connected(clientId, sendInputStateFunction, data);
                    initialState = false;
                } else {
                    handlers.receivedState(data);
                }
            });
        });

        // Handle connection errors.
        connection.on('error', (error) => {
            console.error('Error connecting to server peer:', error);

            onDisconnect(connection);
        });

        connection.on('close', () => {
            console.error('Disconnected from server peer.');

            onDisconnect(connection);
        });
    });

    // Handle peer errors.
    clientPeer.on('error', (error) => {
        console.error('Error connecting to signalling server:', error);

        onDisconnect();
    });

    clientPeer.on('disconnected', () => {
        console.error('Disconnected from signalling server.');

        onDisconnect();
    });

    clientPeer.on('close', () => {
        console.error('Peer was closed.');

        onDisconnect();
    });
}

function addInputEvents() {
    // Use pointerlock to move camera.
    let requestPointerLock = document.body.requestPointerLock || document.body.mozRequestPointerLock;
    document.addEventListener('click', event => requestPointerLock.call(document.body));
    // TODO: Handle pointerlock events.
    /*document.addEventListener('pointerlockchange', (event) => {});
      document.addEventListener('pointerlockerror', (event) => {});*/

    document.addEventListener('mousemove', event => {
        let movementX = event.movementX || event.mozMovementX || 0;
        let movementY = event.movementY || event.mozMovementY || 0;

        handlers.mouseMoved(movementX, movementY);
    });
    document.addEventListener('keydown', event => {
        handlers.keyPressedOrReleased(event.keyCode, String.fromCharCode(event.keyCode).toLowerCase(), true);
    });
    document.addEventListener('keyup', event => {
        handlers.keyPressedOrReleased(event.keyCode, String.fromCharCode(event.keyCode).toLowerCase(), false);
    });
}
