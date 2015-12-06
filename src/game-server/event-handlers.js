import * as util from "common/util";
import {generateMaze} from "common/maze";
import random from "pcg-random";
import {Vector3} from "three";
import updateState from "common/update-state";

const mazeWidth = 10, mazeHeight = 10;

let state = {
    players: {}
};
let players = {};
let maze, rng;

export default {
    init() {
        state.randomSeed = Math.floor(Math.random() * 1000000);

        rng = new random(state.randomSeed);
        let rngFunction = () => rng.number();

        maze = generateMaze(mazeWidth, mazeHeight, rngFunction);
    },
    playerConnected(playerId, sendStateFunction) {
        players[playerId] = {
            sendState: sendStateFunction
        };

        let colors = ['red', 'blue', 'green', 'yellow', 'purple', 'pink', 'black', 'white', 'brown', 'orange'];

        state.players[playerId] = {
            position: [rng.integer(mazeWidth), 0, rng.integer(mazeHeight)],
            color: colors[rng.integer(colors.length)],
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
    },
    playerDisconnected(playerId) {
        delete state.players[playerId];
        delete players[playerId];
    },
    receivedInput(playerId, inputStateUpdate) {
        util.merge(state.players[playerId].inputState, inputStateUpdate);
    },
    update(delta, now) {
        updateState({ state, maze }, delta, now);

        for (let playerId in players) {
            players[playerId].sendState(state);
        }
    }
};
