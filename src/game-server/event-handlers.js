import * as util from "common/util";
import {generateMaze} from "common/maze";
import random from "pcg-random";
import {Vector3} from "three";
import {initState, updateState, addPlayer} from "common/update-state";

const mazeWidth = 5, mazeHeight = 5;

let playerConnections = {};
let state, maze;

let connectedToMatchmaking, connectedToSignalling, sendMatchmakingMessage, gameServerId;
let creatorName;

export default {
    init() {
        state = initState();

        let rng = new random(state.randomSeed);
        let rngFunction = () => rng.number();

        maze = generateMaze(mazeWidth, mazeHeight, rngFunction);

        connectedToMatchmaking = false;
        connectedToSignalling = false;
    },
    playerConnected(playerId, playerName, sendStateFunction) {
        playerConnections[playerId] = {
            sendState: sendStateFunction,
            lastInputTimestamp: 0,
            playerName
        };

        let isZombie = playerName === creatorName;

        addPlayer({ state, mazeWidth, mazeHeight }, playerId, isZombie);
    },
    playerDisconnected(playerId) {
        delete state.players[playerId];
        delete playerConnections[playerId];

        // If all players disconnect, tell the matchmaking server to kill the process.
        if (Object.keys(playerConnections).length === 0 && connectedToMatchmaking) {
            sendMatchmakingMessage({
                type: 'game-finished',
                gameServerId
            });
        }
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

        // TODO: Check if game has finished.
    },
    connectedToMatchmakingServer(sendMessageFunction) {
        connectedToMatchmaking = true;
        sendMatchmakingMessage = sendMessageFunction;

        if (connectedToSignalling) {
            sendMatchmakingMessage({
                type: 'game-server-ready',
                gameServerId
            });
        }
    },
    connected(serverId, creator) {
        connectedToSignalling = true;
        gameServerId = serverId;

        creatorName = creator;

        if (connectedToMatchmaking) {
            sendMatchmakingMessage({
                type: 'game-server-ready',
                gameServerId
            });
        }
    }
};
