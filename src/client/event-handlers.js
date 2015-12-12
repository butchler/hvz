import * as three from "three";
import random from "pcg-random";
import * as util from "common/util";
import {generateMaze} from "common/maze";
import {updatePlayer} from "common/update-state";
import {connectToMatchmakingServer, connectToGameServer} from "client/networking";

let renderer, camera, scene, cameraContainer;
let textureLoader = new three.TextureLoader();
let playerId, sendInput, isConnected;
let previousState, state, inputState, inputQueue, lastStateTimestamp;
let playerMeshes = {};
let maze;

// Matchmaking
let isConnectedToMatchmaking, sendMatchmakingMessage;
let playerName, currentLobby;

// Event handlers.
export default {
    init() {
        // Init renderer and camera.
        renderer = new three.WebGLRenderer({ antialias: true });
        renderer.setClearColor('black', 1.0);
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.shadowMap.enabled = true;
        document.getElementById('canvas-container').appendChild(renderer.domElement);

        camera = new three.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.001, 1000);

        // Resize canvas when window is resized.
        window.addEventListener('resize', function () {
            renderer.setSize(window.innerWidth, window.innerHeight);
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
        });

        // Init scene.
        scene = new three.Scene();

        scene.add(new three.AmbientLight(0x404040));
        scene.fog = new three.Fog(0x000000, 2, 5);

        // Init camera container. Used to make rotating the camera easier.
        cameraContainer = new three.Object3D();
        cameraContainer.add(camera);
        cameraContainer.position.set(0, 0, 0);
        cameraContainer.rotateY(-Math.PI / 2);
        scene.add(cameraContainer);


        isConnected = false;

        lastStateTimestamp = 0;

        // Matchmaking
        connectToMatchmakingServer();
        isConnectedToMatchmaking = false;
        playerName = currentLobby = null;
    },
    connected(clientId, sendInputStateFunction, initialState) {
        isConnected = true;

        playerId = clientId;

        inputQueue = [];
        sendInput = (delta) => {
            inputState.delta = delta;
            inputState.timestamp = window.performance.now();
            sendInputStateFunction(inputState);

            // Add to input queue to use client side prediction/server state reconcilation.
            // Make sure queue doesn't grow infinitely.
            if (inputQueue.length < 1000)
                inputQueue.push(util.cloneObject(inputState));
        };

        state = initialState;
        inputState = state.players[playerId].inputState;

        // Now that we have the random seed contained in the state from the
        // server, we can generate the maze.
        initMaze();
    },
    disconnected() {
        isConnected = false;
    },
    receivedState(newState) {
        // Ignore old/out of order state updates.
        if (newState.timestamp < lastStateTimestamp)
            return;
        else
            lastStateTimestamp = newState.timestamp;

        // When a state update is received from the server, bring the state up
        // to do with the latest inputs entered by the user during the round
        // trip time between the client/server. Part of client side prediction.
        let input, lastInputTimestamp = newState.players[playerId].inputState.timestamp;
        while (input = inputQueue.shift()) {
            if (input.timestamp < lastInputTimestamp)
                continue;

            newState.players[playerId].inputState = input;
            updatePlayer({ state: newState, maze }, playerId, input.delta);
        }

        // Unless there is a big difference between server and client state,
        // keep old player position so that there is no camera jerk from the
        // server's state being slightly off from the client's state.
        let oldPosition = new three.Vector3(...state.players[playerId].position);
        let newPosition = new three.Vector3(...newState.players[playerId].position);
        if (oldPosition.distanceTo(newPosition) < 1)
            newState.players[playerId].position = state.players[playerId].position;

        state = newState;
    },
    keyPressedOrReleased(keyCode, key, isPressed) {
        if (!isConnected)
            return;

        let keyUpdate = undefined;

        if (key === 'w')
            keyUpdate = { forward: isPressed };
        else if (key === 's')
            keyUpdate = { backward: isPressed };
        else if (key === 'a')
            keyUpdate = { left: isPressed };
        else if (key === 'd')
            keyUpdate = { right: isPressed };
        else if (key === ' ' && isPressed)
            keyUpdate = { wantsToTransform: true };

        // Send key state update to server if one of the movement keys were
        // pressed or released.
        if (keyUpdate !== undefined)
            util.merge(inputState, keyUpdate);
    },
    mouseMoved(movementX, movementY) {
        if (!isConnected)
            return;

        inputState.mouse.x += movementX;
        inputState.mouse.y += movementY;
    },
    render(delta, now) {
        if (!isConnected)
            return;

        // Simulate the state of the player given new inputs, regardless of the
        // server's state. Part of client side prediction.
        state.players[playerId].inputState = inputState;
        updatePlayer({ state, maze }, playerId, delta);

        let player = state.players[playerId];

        if (previousState && player.isZombie !== previousState.players[playerId].isZombie) {
            // The player has transformed.
            inputState.wantsToTransform = false;
        }

        sendInput(delta);

        updateCamera(player);

        // TODO: Add interpolation for other players' states.
        updateOtherPlayers();

        renderer.render(scene, camera);

        previousState = util.cloneObject(state);
    },
    connectedToMatchmakingServer(sendMessageFunction) {
        isConnectedToMatchmaking = true;
        sendMatchmakingMessage = sendMessageFunction;

        showSection('name-form');
    },
    matchmakingMessageReceived(message) {
        if (message.type === 'name-taken')
            document.getElementById('name-status').innerText = 'That name has already been taken.';
        else if (message.type === 'name-accepted')
            showSection('lobby-list');
        else if (message.type === 'lobbies-updated') {
            if (currentLobby !== null && !(currentLobby in message.lobbies)) {
                // The lobby has been destroyed, leave it.
                currentLobby = null;
                showSection('lobby-list');
            }

            // Update lobby list HTML.
            let lobbiesHtml = '';
            for (let creatorName in message.lobbies) {
                let numPlayersInLobby = message.lobbies[creatorName].players.length;

                lobbiesHtml += `
                    <li>
                        ${creatorName}'s lobby (${numPlayersInLobby} players)
                        <button class="join-lobby" data-lobby="${creatorName}">Join</button>
                    </li>
                `;
            }

            document.getElementById('lobby-list').innerHTML = `
                <h2>Lobbies</h2>

                <ul>
                  ${lobbiesHtml}
                </ul>

                <button class="create-lobby">Create new lobby</button>
            `;

            // If the player is in a lobby, update the lobby HTML.
            if (currentLobby !== null) {
                let lobby = message.lobbies[currentLobby];

                let playersHtml = '';
                lobby.players.forEach(playerName => {
                    playersHtml += `<li>${playerName}</li>`;
                });

                let lobbyHtml = `
                    <h2>${currentLobby}'s Lobby</h2>

                    <p>Players:</p>
                    <ul>
                        ${playersHtml}
                    </ul>

                    <button class="leave-lobby">Leave Lobby</button>
                `;

                // Allow the lobby creator to start the game whenever they want.
                if (playerName === currentLobby)
                    lobbyHtml += '<button class="start-game" id="start-game-button">Start Game</button>';

                document.getElementById('lobby').innerHTML = lobbyHtml;
            }
        } else if (message.type === 'game-started') {
            currentLobby = null;

            connectToGameServer(message.gameServerId, playerName);

            showSection('canvas-container');
        } else if (message.type === 'error') {
            console.error('Error from matchmaking server:', message.errorMessage);
        } else {
            console.error('Unknown matchmaking message:', message);
        }
    },
    nameEntered(name) {
        playerName = name;

        sendMatchmakingMessage({
            type: 'request-name',
            name
        });
    },
    createLobbyButton() {
        sendMatchmakingMessage({ type: 'create-lobby' });

        currentLobby = playerName;
        showSection('lobby');
    },
    joinLobbyButton(lobbyId) {
        sendMatchmakingMessage({ type: 'join-lobby', lobby: lobbyId });

        currentLobby = lobbyId;
        showSection('lobby');
    },
    leaveLobbyButton() {
        sendMatchmakingMessage({ type: 'leave-lobby' });

        currentLobby = null;
        showSection('lobby-list');
    },
    startGameButton() {
        sendMatchmakingMessage({ type: 'start-game' });

        document.getElementById('start-game-button').disabled = 'disabled';
        document.getElementById('start-game-button').innerText = 'Starting Game...';
    }
};

// Hide all other HTML sections and only show the one with the given id.
function showSection(id) {
    let sections = document.getElementsByTagName('section');
    for (let i = 0; i < sections.length; i++) {
        sections[i].style.display = 'none';
    }

    document.getElementById(id).style.display = 'block';
}

function initMaze() {
    //const width = 10, height = 10;
    const width = 5, height = 5;
    const centerX = width / 2 - 0.5, centerY = height / 2 - 0.5;
    const wallWidth = 0.05;

    let rng = new random(state.randomSeed);
    let rngFunction = () => rng.number();

    maze = generateMaze(width, height, rngFunction);

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
    ground.rotateX(-Math.PI / 2); // Make ground lay flat on XZ plane.
    ground.position.set(centerX, -0.5, centerY);

    // Center a light above the maze.
    let light = new three.PointLight(0xffffff);
    light.position.set(centerX, 20, centerY);

    scene.add(mazeObject);
    scene.add(ground);
    scene.add(light);
}

function updateCamera(player) {
    // Rotate the camera based on mouse position.
    // Rotate camera horizontally.
    let horizontalAngle = -inputState.mouse.x * 0.002
        cameraContainer.rotation.y = horizontalAngle;

    // Rotate camera vertically.
    // Make it so that vertical rotation cannot loop.
    let maxMouseY = Math.PI / 2 / 0.002;
    inputState.mouse.y = Math.max(-maxMouseY, Math.min(maxMouseY, inputState.mouse.y));
    let verticalAngle = -inputState.mouse.y * 0.002;
    camera.rotation.x = verticalAngle;

    // Move camera to player's position.
    let playerPosition = new three.Vector3(...player.position);
    cameraContainer.position.copy(playerPosition);

    // Narrow FOV if player is a zombie.
    camera.fov = player.isZombie ? 45 : 65;
    camera.updateProjectionMatrix();
}

function updateOtherPlayers() {
    // Update other player meshes.
    util.onDiff(previousState ? previousState.players : {}, state.players, {
        add(playerId, playerState) {
            let playerGeometry = new three.SphereGeometry(0.2, 16, 12);
            let playerMaterial = new three.MeshPhongMaterial({ color: playerState.color });
            let playerMesh = new three.Mesh(playerGeometry, playerMaterial);
            scene.add(playerMesh);

            playerMeshes[playerId] = playerMesh;
        },
        remove(playerId, playerState) {
            scene.remove(playerMeshes[playerId]);
            delete playerMeshes[playerId];
        },
        exists(playerId, playerState) {
            let playerMesh = playerMeshes[playerId];
            let playerPosition = new three.Vector3(...playerState.position);
            playerMesh.position.copy(playerPosition);
        }
    });
}
