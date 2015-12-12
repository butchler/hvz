import {Vector3} from "three";

export function initState() {
    return {
        randomSeed: Math.floor(Math.random() * 0xffffffff),
        players: {},
        // TODO: End game after a certain time limit.
        secondsLeft: 60 * 5
    };
}

const playerColors = ['red', 'blue', 'green', 'yellow', 'purple', 'pink', 'black', 'white', 'brown', 'orange'];
let randomInt = (max) => Math.floor(Math.random()*max);
export function addPlayer({ state, maze }, playerId, isZombie = false) {
    // Find an unoccupied position in the maze.
    let x, y;
    do {
        x = randomInt(maze.width), y = randomInt(maze.height);
    } while (maze.grid[y][x] === true);

    state.players[playerId] = {
        position: [x, 0, y],
        color: playerColors[randomInt(playerColors.length)],
        isZombie,
        inputState: {
            mouse: {
                x: 0,
                y: 0
            },
            forward: false,
            backward: false,
            right: false,
            left: false,
            wantsToTransform: false
        }
    };
}

export function updateState({ state, maze }, delta) {
    for (let playerId in state.players) {
        updatePlayer({ state, maze }, playerId, delta);
    }
}

export function updatePlayer({ state, maze }, playerId, delta) {
    let player = state.players[playerId];

    if (player.inputState.wantsToTransform) {
        player.isZombie = !player.isZombie;
    }

    movePlayer({ player, maze }, delta);

    if (player.isZombie)
        eatOtherPlayers(state, playerId);
}

function movePlayer({ player, maze }, delta) {
    const speed = player.isZombie ? 5 : 2;

    let position = new Vector3(...player.position);
    let up = new Vector3(0, 1, 0);

    let rotation = -player.inputState.mouse.x * 0.002;
    let forward = new Vector3(0, 0, -speed * delta);
    let right = new Vector3(speed * delta, 0, 0);

    forward.applyAxisAngle(up, rotation);
    right.applyAxisAngle(up, rotation);

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
    let row = Math.round(position.z);
    let column = Math.round(position.x);

    // North wall
    if (maze.grid[row + 1] && maze.grid[row + 1][column])
        position.z = Math.min(position.z, row + 0.5 - offset);
    if (maze.grid[row - 1] && maze.grid[row - 1][column])
        position.z = Math.max(position.z, row - 0.5 + offset);
    if (maze.grid[row] && maze.grid[row][column + 1])
        position.x = Math.min(position.x, column + 0.5 - offset);
    if (maze.grid[row] && maze.grid[row][column - 1])
        position.x = Math.max(position.x, column - 0.5 + offset);

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
