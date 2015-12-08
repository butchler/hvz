import * as three from "three";
import random from "pcg-random";
import {generateMaze} from "common/maze";
import * as util from "common/util";
import {updateState} from "common/update-state";

let textureLoader = new three.TextureLoader();

let renderer, camera, scene, cameraContainer;
let previousState, state, targetState;
let playerId, sendInput, isConnected = false;
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
    },
    connected(clientId, sendInputState, initialState) {
        isConnected = true;

        playerId = clientId;
        sendInput = sendInputState;
        previousState = { players: {} };
        state = targetState = initialState;

        initMaze();
    },
    disconnected() {
        isConnected = false;
    },
    receivedState(newState) {
        // Do not overwrite the client's input state. The server is the
        // authority on the state of the game, except for each player's input
        // state.
        newState.players[playerId].inputState = state.players[playerId].inputState;
        targetState = newState;
    },
    keyPressedOrReleased(keyCode, key, isDown) {
        if (!isConnected)
            return;

        let keyUpdate = undefined;

        if (key === 'w')
            keyUpdate = { forward: isDown };
        else if (key === 's')
            keyUpdate = { backward: isDown };
        else if (key === 'a')
            keyUpdate = { left: isDown };
        else if (key === 'd')
            keyUpdate = { right: isDown };
        else if (key === ' ' && isDown)
            keyUpdate = { zombie: !state.players[playerId].inputState.zombie };

        // Send key state update to server if one of the movement keys were
        // pressed or released.
        if (keyUpdate !== undefined) {
            sendInput(keyUpdate);

            util.merge(state.players[playerId].inputState, keyUpdate);
        }
    },
    mouseMoved(movementX, movementY) {
        if (!isConnected)
            return;

        let inputState = state.players[playerId].inputState;
        inputState.mouse.x += movementX;
        inputState.mouse.y += movementY;

        // Send the new mouse position to the server.
        sendInput({
            mouse: {
                x: inputState.mouse.x,
                y: inputState.mouse.y
            }
        });
    },
    render(delta, now) {
        if (!isConnected)
            return;

        // TODO: Base delta and now on the server's simulation time instead of the client's?
        updateState({ state: targetState, maze }, delta, now);

        interpolateObjects(state, targetState, 0.3);

        // TODO: Handle error if playerId is not in state for some reason?
        let player = state.players[playerId];

        // Resend the input state every frame just in case packets get dropped.
        sendInput(player.inputState);

        // Rotate the camera based on mouse position.
        // Rotate camera horizontally.
        let horizontalAngle = -player.inputState.mouse.x * 0.002
        cameraContainer.rotation.y = horizontalAngle;

        // Rotate camera vertically.
        // Make it so that vertical rotation cannot loop.
        let maxMouseY = Math.PI / 2 / 0.002;
        player.inputState.mouse.y = Math.max(-maxMouseY, Math.min(maxMouseY, player.inputState.mouse.y));
        let verticalAngle = -player.inputState.mouse.y * 0.002;
        camera.rotation.x = verticalAngle;

        // Move camera to player's position.
        let playerPosition = new three.Vector3(...player.position);
        cameraContainer.position.copy(playerPosition);

        // Narrow FOV if player is a zombie.
        camera.fov = player.inputState.zombie ? 45 : 65;
        camera.updateProjectionMatrix();

        // Update other player meshes.
        util.onDiff(previousState.players, state.players, {
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
            addOrChange(playerId, playerState) {
                let playerMesh = playerMeshes[playerId];
                let playerPosition = new three.Vector3(...playerState.position);
                playerMesh.position.copy(playerPosition);
            }
        });

        renderer.render(scene, camera);
        previousState = state;
    }
};

function interpolateObjects(fromObject, toObject, t) {
    for (let key in toObject) {
        let fromValue = fromObject[key], toValue = toObject[key];
        if (isNumeric(fromValue) && isNumeric(toValue)) {
            // Interpolate values if they are both numbers.
            fromObject[key] = fromValue + (toValue - fromValue) * t;
        } else if (Array.isArray(fromValue) && Array.isArray(toValue)) {
            interpolateArrays(fromValue, toValue, t);
        } else if (isObject(fromValue) && isObject(toValue)) {
            interpolateObjects(fromValue, toValue, t);
        } else {
            fromObject[key] = toValue;
        }
    }
}

function interpolateArrays(fromArray, toArray, t) {
    for (let i = 0; i < toArray.length; i++) {
        let fromValue = fromArray[i], toValue = toArray[i];
        if (isNumeric(fromValue) && isNumeric(toValue)) {
            // Interpolate values if they are both numbers.
            fromArray[i] = fromValue + (toValue - fromValue) * t;
        } else if (Array.isArray(fromValue) && Array.isArray(toValue)) {
            interpolateArrays(fromValue, toValue, t);
        } else if (isObject(fromValue) && isObject(toValue)) {
            interpolateObjects(fromValue, toValue, t);
        } else {
            fromArray[i] = toArray[i];
        }
    }
}

function isNumeric(n) {
    return !isNaN(parseFloat(n)) && isFinite(n);
}

function isObject(obj) {
    return obj !== null && typeof obj === 'object';
}

function initMaze() {
    const width = 10, height = 10;
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
