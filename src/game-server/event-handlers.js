import * as util from "common/util";
import {generateMaze} from "common/maze";
import random from "pcg-random";
import {Vector3} from "three";
import {initState, updateState, addPlayer} from "common/update-state";

const mazeWidth = 5, mazeHeight = 5;

let playerConnections = {};
let state, maze;

export default {
    init() {
        state = initState();

        let rng = new random(state.randomSeed);
        let rngFunction = () => rng.number();

        maze = generateMaze(mazeWidth, mazeHeight, rngFunction);
    },
    playerConnected(playerId, sendStateFunction) {
        playerConnections[playerId] = {
            sendState: sendStateFunction,
            lastInputTimestamp: 0
        };

        addPlayer({ state, mazeWidth, mazeHeight }, playerId);
    },
    playerDisconnected(playerId) {
        delete state.players[playerId];
        delete playerConnections[playerId];
    },
    receivedInput(playerId, inputStateUpdate) {
        // Ignore old/out of order messages.
        if (inputStateUpdate.timestamp < playerConnections[playerId].lastInputTimestamp)
            return;
        else
            playerConnections[playerId].lastInputTimestamp = inputStateUpdate.timestamp;

        util.mergeDeep(state.players[playerId].inputState, inputStateUpdate);
    },
    update(delta, now) {
        updateState({ state, maze }, delta);

        for (let playerId in playerConnections) {
            playerConnections[playerId].sendState(state);
        }

        state.timestamp = window.performance.now();
    }
};
