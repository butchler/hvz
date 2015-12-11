import * as three from "three";
import random from "pcg-random";
import {generateMaze} from "common/maze";
import * as util from "common/util";
import {updateState} from "common/update-state";

let renderer, camera, scene, cameraContainer;
let textureLoader = new three.TextureLoader();
let playerId, sendInput, isConnected;
let previousState, state, inputState, inputQueue, previousFrameTimestamp, lastStateTimestamp;
let playerMeshes = {};
let maze;

// Event handlers.
export default {
    init() {
        // Init renderer and camera.
        renderer = new three.WebGLRenderer({ antialias: true });
        renderer.setClearColor('black', 1.0);
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.shadowMap.enabled = true;
        document.body.appendChild(renderer.domElement);

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
        previousFrameTimestamp = window.performance.now();
    },
    connected(clientId, sendInputStateFunction, initialState) {
        isConnected = true;

        playerId = clientId;

        inputQueue = [];
        sendInput = (inputStateUpdate, updateTimestamp = true) => {
            inputStateUpdate.timestamp = updateTimestamp ? window.performance.now() : inputState.timestamp;
            sendInputStateFunction(inputStateUpdate);

            util.mergeDeep(inputState, inputStateUpdate);

            // Add to input queue to use client side prediction/server state reconcilation.
            /*inputQueue.push(util.cloneObject(inputState));

            // Make sure queue doesn't grow infinitely.
            if (inputQueue.length > 1000)
                inputQueue.shift();*/
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

        // TODO: Get client side prediction working.
        // Reconcile state received from server with user input that the server
        // hasn't received yet. lastInputTimestamp is the timestamp of the last
        // input update that the server received before sending this update.
        /*let lastInputTimestamp = newState.players[playerId].inputState.timestamp;
        let input = inputQueue.shift(), nextInput;
        let totalDelta = 0;
        while (nextInput = inputQueue.shift()) {
            // Throw away inputs that the server already received.
            if (input.timestamp < lastInputTimestamp) {
                input = nextInput;
                continue;
            }

            // Update the server's state with the input the server hasn't seen yet.
            newState.players[playerId].inputState = input;
            // The delta is the amount of time between the current input and
            // when the next input is received.
            let delta = (nextInput.timestamp - input.timestamp) / 1000;
            totalDelta += delta;
            updateState({ state: newState, maze }, delta);

            input = nextInput;
        }*/

        // Update the state one last time to bring it up to the previous frame
        // time with the latest inputState.
        /*newState.players[playerId].inputState = inputState;
        let delta = (previousFrameTimestamp - inputState.timestamp) / 1000;
        updateState({ state: newState, maze }, delta);*/

        // Do not overwrite the client's input state. The server is the
        // authority on the state of the game, except for each player's input
        // state.
        newState.players[playerId].inputState = inputState;
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
            sendInput(keyUpdate);
    },
    mouseMoved(movementX, movementY) {
        if (!isConnected)
            return;

        // Send the new mouse position to the server.
        sendInput({
            mouse: {
                x: inputState.mouse.x + movementX,
                y: inputState.mouse.y + movementY
            }
        });
    },
    render(delta, now) {
        if (!isConnected)
            return;

        //updateState({ state, maze }, delta);

        let player = state.players[playerId];

        if (player === undefined) {
            // Should never happen, but just in case.
            alert('You have been removed from the game');
            isConnected = false;
        }

        if (previousState && player.isZombie !== previousState.players[playerId].isZombie) {
            // The player has transformed.
            inputState.wantsToTransform = false;
        }

        // Resend the input state every frame just in case packets get dropped.
        sendInput(inputState, false);

        updateCamera(player);

        updateOtherPlayers();

        renderer.render(scene, camera);

        previousState = util.cloneObject(state);

        previousFrameTimestamp = window.performance.now();
    }
};

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
