import {Vector3} from "three";

export default function updateState({ state, maze }, delta, now) {
    for (let playerId in state.players) {
        updatePlayer({ player: state.players[playerId], maze }, delta, now);
    }
}

function updatePlayer({ player, maze }, delta, now) {
    console.log('delta', delta);

    const speed = 2;

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

    if (walls !== undefined) {
        if (walls.north)
            position.z = Math.min(position.z, row + 0.3);
        if (walls.south)
            position.z = Math.max(position.z, row - 0.3);
        if (walls.east)
            position.x = Math.min(position.x, column + 0.3);
        if (walls.west)
            position.x = Math.max(position.x, column - 0.3);
    }

    player.position = [position.x, position.y, position.z];
}
