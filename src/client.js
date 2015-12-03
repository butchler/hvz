import * as three from "three";
import {generateMaze, printGrid} from "common/maze";
import random from "pcg-random";
import * as util from "common/util";
import Peer from "peerjs";


let {renderer, camera, scene} = util.initThree({ cameraFov: 65 });
let cameraContainer = undefined;

let textureLoader = new three.TextureLoader();

let gameState = undefined;
let inputState = {
    mouse: {
        x: 0,
        y: 0
    },
    forward: false,
    backward: false,
    right: false,
    left: false
};

//let client = new Peer({key: 'krk2f5egq95xko6r'});
let client = new Peer({host: 'localhost', port: 8000, path: '/peerjs'});
console.log('Created client peer.');
let connection = undefined;
let playerId = undefined;

client.on('open', (clientId) => {
    // The peer has connected to the PeerJS signalling server.
    playerId = clientId;

    // Try to connect to server peer.
    connection = client.connect('server', {reliable: false});

    connection.on('open', () => {
        // Successfully connected to server.
        connection.on('data', (data) => {
            console.log('Received state update', JSON.stringify(data));

            // Wait until first game state message has been received before
            // starting render loop.
            if (gameState === undefined) {
                gameState = data;
                init();
                util.animationLoop(render);
            } else {
                gameState = data;
            }
        });
    });
    connection.on('error', (error) => {
        console.log('There was an error connecting to the server.');
        throw error;
    });
    connection.on('close', () => {
        throw new Error('Disconnected from the server.');
    });
});

function init() {
    const width = 10, height = 10;
    const centerX = width / 2 - 0.5, centerY = height / 2 - 0.5;
    const wallWidth = 0.05;

    let rng = new random(gameState.randomSeed);
    let rngFunction = () => rng.number();

    let maze = generateMaze(width, height, rngFunction);

    // Build maze geometry.
    let mazeGeometry = new three.Geometry();
    let wallGeometry = new three.BoxGeometry(1, 1, wallWidth);
    let matrix = new three.Matrix4();
    for (let i = 0; i < maze.wallList.length; i++) {
        let wall = maze.wallList[i];

        if (wall.direction === 'vertical') {
            // Place vertical walls at left side of cell.
            matrix.makeRotationY(Math.PI / 2);
            matrix.setPosition(new three.Vector3(wall.x - 0.5, 0, wall.y));
        } else {
            // Place horizontal walls at bottom of cell.
            matrix.makeRotationY(0);
            matrix.setPosition(new three.Vector3(wall.x, 0, wall.y - 0.5));
        }

        mazeGeometry.merge(wallGeometry, matrix);
    }

    // Add maze object.
    let mazeMaterial = new three.MeshPhongMaterial({ map: textureLoader.load('images/concrete-red.jpg') });
    let mazeObject = new three.Mesh(mazeGeometry, mazeMaterial);
    scene.add(mazeObject);

    // Add lighting.
    //scene.add(new three.AmbientLight(0x444444));
    scene.add(new three.AmbientLight(0x333333));

    // Center light above maze.
    let light = new three.PointLight(0xffffff);
    light.position.set(centerX, 20, centerY);
    scene.add(light);

    // Add fog.
    scene.fog = new three.Fog(0x000000, 2, 5);

    // Add ground plane.
    let groundTexture = textureLoader.load('images/concrete-gray.jpg');
    groundTexture.wrapS = groundTexture.wrapT = three.RepeatWrapping;
    groundTexture.repeat.set(4, 4);
    let ground = new three.Mesh(
            new three.PlaneGeometry(width, height),
            new three.MeshPhongMaterial({
                map: groundTexture,
                color: 0x444444
            }));
    ground.rotateX(-Math.PI / 2);
    ground.position.set(centerX, -0.5, centerY);
    scene.add(ground);

    // Position camera.
    cameraContainer = new three.Object3D();
    cameraContainer.add(camera);
    cameraContainer.position.set(0, 0, 0);
    cameraContainer.rotateY(-Math.PI / 2);
    scene.add(cameraContainer);

    // Use pointerlock to move camera.
    let requestPointerLock = document.body.requestPointerLock || document.body.mozRequestPointerLock;
    document.addEventListener('click', (event) => requestPointerLock.call(document.body));

    //let mouse = {x: 0, y: 0};
    document.addEventListener('mousemove', (event) => {
        let movementX = event.movementX || event.mozMovementX || 0;
        let movementY = event.movementY || event.mozMovementY || 0;

        let mouseUpdate = {
            mouse: {
                x: inputState.mouse.x + movementX,
                y: inputState.mouse.y + movementY
            }
        };

        // Send the new mouse position to the server.
        connection.send(mouseUpdate);

        util.merge(inputState, mouseUpdate);

        // Rotate the camera based on mouse position.
        // Rotate camera horizontally.
        let horizontalAngle = -inputState.mouse.x * 0.002
        cameraContainer.rotation.y = horizontalAngle;

        // Rotate camera vertically.
        // Make it so that vertical rotation cannot loop.
        let verticalAngle = Math.max(-Math.PI / 2, Math.min(Math.PI /2, -inputState.mouse.y * 0.002));
        camera.rotation.x = verticalAngle;
    });

    let updateKeyState = (keyCode, isDown) => {
        let key = String.fromCharCode(keyCode).toLowerCase();
        let keyUpdate = undefined;

        if (key === 'w')
            keyUpdate = { forward: isDown };
        else if (key === 's')
            keyUpdate = { backward: isDown };
        else if (key === 'a')
            keyUpdate = { left: isDown };
        else if (key === 'd')
            keyUpdate = { right: isDown };

        // Send key state update to server if one of the movement keys were
        // pressed or released.
        if (keyUpdate !== undefined) {
            connection.send(keyUpdate);

            util.merge(inputState, keyUpdate);
        }
    };

    document.addEventListener('keydown', event => updateKeyState(event.keyCode, true));
    document.addEventListener('keyup', event => updateKeyState(event.keyCode, false));
}

let otherPlayers = {};
function render(delta, now) {
    let player = gameState.players[playerId];

    if (player === undefined)
        throw new Error('Player "' + playerId + '" does not exist.');

    // Move camera to player's position.
    cameraContainer.position.set(player.position.x, player.position.y, player.position.z);

    // Render other players.
    for (let otherPlayerId in gameState.players) {
        if (otherPlayerId === playerId)
            continue;

        let playerInfo = gameState.players[otherPlayerId];

        if (otherPlayers[otherPlayerId] === undefined) {
            let playerGeometry = new three.SphereGeometry(0.2, 16, 12);
            let playerMaterial = new three.MeshPhongMaterial({ color: playerInfo.color });
            let playerMesh = new three.Mesh(playerGeometry, playerMaterial);
            scene.add(playerMesh);

            otherPlayers[otherPlayerId] = playerMesh;
        }

        let playerMesh = otherPlayers[otherPlayerId];
        playerMesh.position.set(playerInfo.position.x, playerInfo.position.y, playerInfo.position.z);
    }

    // Remove disconnected players.
    for (let otherPlayerId in otherPlayers) {
        if (!(otherPlayerId in gameState.players)) {
            // The player is no longer in the game, so remove its mesh.
            scene.remove(otherPlayers[otherPlayerId]);
            delete otherPlayers[otherPlayerId];
        }
    }

    renderer.render(scene, camera);

    // Resend the input state every frame just in case packets get dropped.
    connection.send(inputState);
}
