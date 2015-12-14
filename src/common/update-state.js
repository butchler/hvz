import {Vector3} from "three";
import * as config from "common/config";

export function initState() {
    return {
        randomSeed: Math.floor(Math.random() * 0xffffffff),
        players: {},
        secondsRemaining: config.gameLength,
        winner: null
    };
}

let randomInt = (max) => Math.floor(Math.random()*max);
export function addPlayer({ state, maze }, playerId, isZombie = false) {
    // Find an unoccupied position in the maze to place the player.
    let x, y;
    do {
        x = randomInt(maze.width), y = randomInt(maze.height);
    } while (maze.grid[y][x] === true);

    state.players[playerId] = {
        position: [x, 0, y],
        isZombie,
        inputState: {
            mouse: {
                x: 0,
                y: 0
            },
            forward: false,
            backward: false,
            right: false,
            left: false
        }
    };
}

export function updateState({ state, maze }, delta) {
    for (let playerId in state.players) {
        updatePlayer({ state, maze }, playerId, delta);
    }

    // Decrement seconds remaining.
    state.secondsRemaining = Math.max(0, state.secondsRemaining - delta);

    // Check for win.
    if (state.winner === null) {
        // Zombies win if all humans are turned into zombies.
        let allZombies = true;
        for (let playerId in state.players) {
            if (!state.players[playerId].isZombie) {
                allZombies = false;
                break;
            }
        }

        if (allZombies) {
            state.winner = 'zombie';
        // Humans win when the time runs out.
        } else if (state.secondsRemaining <= 0) {
            state.winner = 'human';
        }
    }
}

export function updatePlayer({ state, maze }, playerId, delta) {
    let player = state.players[playerId];

    movePlayer({ player, maze }, delta);

    if (player.isZombie)
        eatOtherPlayers(state, playerId);
}

function movePlayer({ player, maze }, delta) {
    const speed = player.isZombie ? config.zombieSpeed : config.humanSpeed;

    let position = new Vector3(...player.position);
    let up = new Vector3(0, 1, 0);

    let rotation = -player.inputState.mouse.x * config.mouseSensitivity;
    let forward = new Vector3(0, 0, -speed * delta);
    let right = new Vector3(speed * delta, 0, 0);

    forward.applyAxisAngle(up, rotation);
    right.applyAxisAngle(up, rotation);

    // Calculate grid position before moving in order to check for collisions with walls.
    let previousRow = Math.round(position.z);
    let previousColumn = Math.round(position.x);

    // Move forward and backward.
    if (player.inputState.forward)
        position.add(forward);
    else if (player.inputState.backward)
        position.sub(forward);
    // Move left and right.
    if (player.inputState.right)
        position.add(right);
    else if (player.inputState.left)
        position.sub(right);

    // Check for collisions with walls.
    const offset = 0.1;

    // North wall
    if (maze.grid[previousRow + 1] && maze.grid[previousRow + 1][previousColumn])
        position.z = Math.min(position.z, previousRow + 0.5 - offset);
    // South wall
    if (maze.grid[previousRow - 1] && maze.grid[previousRow - 1][previousColumn])
        position.z = Math.max(position.z, previousRow - 0.5 + offset);
    // East wall
    if (maze.grid[previousRow] && maze.grid[previousRow][previousColumn + 1])
        position.x = Math.min(position.x, previousColumn + 0.5 - offset);
    // West wall
    if (maze.grid[previousRow] && maze.grid[previousRow][previousColumn - 1])
        position.x = Math.max(position.x, previousColumn - 0.5 + offset);

    player.position = [position.x, position.y, position.z];
}

function eatOtherPlayers(state, playerId) {
    let player = state.players[playerId];
    let playerPosition = new Vector3(...player.position);

    // If the player is a zombie, check if they have eatend any other players.
    for (let otherPlayerId in state.players) {
        if (otherPlayerId === playerId)
            continue;

        let otherPlayer = state.players[otherPlayerId];
        let otherPlayerPosition = new Vector3(...otherPlayer.position);

        // Turn other players into zombies if they are too close.
        if (playerPosition.distanceTo(otherPlayerPosition) <= 0.5)
            otherPlayer.isZombie = true;
    }
}
