import Peer from "peerjs";
import {generateMaze} from "common/maze";
import random from "pcg-random";
import * as three from "three";
import * as util from "common/util";

// Generate maze using a random seed that will be sent to clients, so that the
// maze will be the same for all players. However, JavaScript's built in
// Math.random() does not allow you to set a seed for the random number
// generator, so we have to use a custom RNG (in this case PCG random).
const randomSeed = Math.floor(Math.random() * 1000000);
const width = 10, height = 10;

let rng = new random(randomSeed);
let rngFunction = () => rng.number();

let maze = generateMaze(width, height, rngFunction);

// Create a "peer" that acts as the server using PeerJS/WebRTC. We use WebRTC
// so that we can use unreliable data connections (i.e. UDP instead of TCP) so
// that there is less latency in sending messages to/from the server, because
// low latency is very important for fast-paced applications like multiplayer
// games.

// Use PeerJS's public api key to allow peers to discover each other.
//let server = new Peer('server', {key: 'krk2f5egq95xko6r'});
let server = new Peer('server', {host: 'localhost', port: 8000, path: '/peerjs'});
console.log('Created server peer.');

// Log status and quit if there is an error.
server.on('open', serverId => {
    console.log('Server connected to PeerJS signalling server with ID: ' + serverId);
});
server.on('disconnected', () => {
    console.log('Server disconnected from PeerJS signalling server, attempting to reconnect.');
    server.reconnect();
});
server.on('close', () => {
    throw new Error('Server peer destroyed.');
});
server.on('error', error => {
    console.log('Server encountered a PeerJS error: ' + error.type);
    throw error;
});

// Handle incoming client connections.
let players = [];
server.on('connection', dataConnection => {
    dataConnection.on('open', () => {
        // Connection is ready to send/receive data.

        // Add a new player with a random position and color.
        let player = createPlayer(dataConnection);

        players.push(player);

        // Remove player when they disconnect.
        dataConnection.on('close', () => {
            console.log('Player disconnected: ' + dataConnection.peer);
            players.splice(players.indexOf(player), 1);
        });

        // Quit if there is an error.
        dataConnection.on('error', (error) => {
            console.log('There was an error with one of the peer connections: ' + error.message);
            throw error;
        });

        // Receive input events from the player.
        dataConnection.on('data', (data) => {
            console.log('Received input update', JSON.stringify(data));

            util.merge(player.inputState, data);
        });
    });
});

function createPlayer(dataConnection) {
    let colors = ['red', 'blue', 'green', 'yellow', 'purple', 'pink', 'black', 'white', 'brown', 'orange'];

    return {
        position: new three.Vector3(rng.integer(width), 0, rng.integer(height)),
        inputState: {
            mouse: {
                x: 0,
                y: 0
            },
            forward: false,
            backward: false,
            right: false,
            left: false
        },
        color: colors[rng.integer(colors.length)],
        connection: dataConnection,
        id: dataConnection.peer
    };
}

{
    // Dirty hack using a web worker to get around the fact that
    // setTimeout/setInterval are throttled to 1 call per second if the page
    // isn't focused.
    let workerCode = "onmessage = function() { setTimeout(function () { postMessage('tock'); }, 1000 / 60); };";
    let workerURL = window.URL.createObjectURL(new Blob([workerCode]));
    let worker = new Worker(workerURL);

    var requestFrame = (callback) => {
        worker.onmessage = callback;
        worker.postMessage('tick');
    };
};

util.animationLoop(update, requestFrame);

function update(delta, now) {
    players.forEach((player) => updatePlayer(player, delta, now));

    // Send copy of game state to players each frame.
    let gameState = { players: {}, randomSeed };
    players.forEach(player => {
        gameState.players[player.id] = {
            position: {
                x: player.position.x,
                y: player.position.y,
                z: player.position.z
            },
            color: player.color
        };
    });

    players.forEach(player => {
        player.connection.send(gameState);
    });
}

function updatePlayer(player, delta, now) {
    const speed = 2;

    let rotation = -player.inputState.mouse.x * 0.002;
    let forward = new three.Vector3(0, 0, -speed * delta);
    let up = new three.Vector3(0, 1, 0);
    forward.applyAxisAngle(up, rotation);
    let right = new three.Vector3(speed * delta, 0, 0);
    right.applyAxisAngle(up, rotation);

    let row = Math.round(player.position.z);
    let column = Math.round(player.position.x);
    let walls = maze.wallGrid[row] && maze.wallGrid[row][column];

    // Move forward and backward.
    if (player.inputState.forward)
        player.position.add(forward);
    else if (player.inputState.backward)
        player.position.sub(forward);
    // Move left and right.
    if (player.inputState.right)
        player.position.add(right);
    else if (player.inputState.left)
        player.position.sub(right);

    if (walls !== undefined) {
        if (walls.north)
            player.position.z = Math.min(player.position.z, row + 0.3);
        if (walls.south)
            player.position.z = Math.max(player.position.z, row - 0.3);
        if (walls.east)
            player.position.x = Math.min(player.position.x, column + 0.3);
        if (walls.west)
            player.position.x = Math.max(player.position.x, column - 0.3);
    }
}
