import {Vector3} from "three";

export function initState() {
    return {
        randomSeed: Math.floor(Math.random() * 1000000),
        players: {},
        secondsLeft: 60 * 5
    };
}

const playerColors = ['red', 'blue', 'green', 'yellow', 'purple', 'pink', 'black', 'white', 'brown', 'orange'];
let randomInt = (max) => Math.floor(Math.random()*max);
export function addPlayer({ state, mazeWidth, mazeHeight }, playerId) {
    state.players[playerId] = {
        position: [randomInt(mazeWidth), 0, randomInt(mazeHeight)],
        color: playerColors[randomInt(playerColors.length)],
        isZombie: false,
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

export function updateState({ state, maze }, delta, now) {
    for (let playerId in state.players) {
        let player = state.players[playerId];

        updatePlayer({ player, maze }, delta, now);

        if (player.isZombie)
            eatOtherPlayers(state.players, playerId);
    }
}

function updatePlayer({ player, maze }, delta, now) {
    if (player.inputState.wantsToTransform) {
        player.isZombie = !player.isZombie;
    }

    movePlayer({ player, maze }, delta, now);
}

function movePlayer({ player, maze }, delta, now) {
    const speed = player.isZombie ? 5 : 2;

    let position = new Vector3(...player.position);
    let up = new Vector3(0, 1, 0);

    let rotation = -player.inputState.mouse.x * 0.002;
    let forward = new Vector3(0, 0, -speed * delta);
    let right = new Vector3(speed * delta, 0, 0);

    forward.applyAxisAngle(up, rotation);
    right.applyAxisAngle(up, rotation);

    let row = Math.round(position.z);
    let column = Math.round(position.x);
    let walls = maze.wallGrid[row] && maze.wallGrid[row][column];

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

    const offset = 0.1;
    if (walls !== undefined) {
        if (walls.north)
            position.z = Math.min(position.z, row + 0.5 - offset);
        if (walls.south)
            position.z = Math.max(position.z, row - 0.5 + offset);
        if (walls.east)
            position.x = Math.min(position.x, column + 0.5 - offset);
        if (walls.west)
            position.x = Math.max(position.x, column - 0.5 + offset);
    }

    player.position = [position.x, position.y, position.z];
}

function eatOtherPlayers(players, playerId) {
    let player = players[playerId];
    let playerPosition = new Vector3(...player.position);

    // If the player is a zombie, check if they have eatend any other players.
    for (let otherPlayerId in players) {
        if (otherPlayerId === playerId)
            continue;

        let otherPlayer = players[otherPlayerId];
        let otherPlayerPosition = new Vector3(...otherPlayer.position);

        // Turn other players into zombies if they are too close.
        if (playerPosition.distanceTo(otherPlayerPosition) <= 0.2)
            otherPlayer.isZombie = true;
    }
}
