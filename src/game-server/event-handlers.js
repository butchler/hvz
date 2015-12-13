import * as util from "common/util";
import {generateMaze} from "common/maze";
import random from "pcg-random";
import {Vector3} from "three";
import {initState, updateState, addPlayer} from "common/update-state";
import * as config from "common/config";

let playerConnections = {};
let state, maze;

let connectedToMatchmaking, connectedToSignalling, sendMatchmakingMessage, matchmakingData, numPlayersConnected;

export default {
    init() {
        state = initState();

        maze = generateMaze(config.mazeWidth, config.mazeHeight, state.randomSeed);

        connectedToMatchmaking = false;
        connectedToSignalling = false;
        numPlayersConnected = 0;
    },
    playerConnected(playerId, playerName, sendStateFunction) {
        playerConnections[playerId] = {
            sendState: sendStateFunction,
            lastInputTimestamp: 0,
            playerName
        };

        let isZombie = playerName === matchmakingData.creator;

        addPlayer({ state, maze }, playerId, isZombie);

        numPlayersConnected += 1;
    },
    playerDisconnected(playerId) {
        delete state.players[playerId];
        delete playerConnections[playerId];

        // If all players disconnect, tell the matchmaking server to kill the process.
        if (Object.keys(playerConnections).length === 0 && connectedToMatchmaking) {
            sendMatchmakingMessage({
                type: 'game-finished',
                gameServerId: matchmakingData.gameServerId
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
        // Don't start the game until all players have connected.
        if (numPlayersConnected < matchmakingData.numPlayers)
            return;

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
                gameServerId: matchmakingData.gameServerId
            });
        }
    },
    connected(matchData) {
        connectedToSignalling = true;
        matchmakingData = matchData;

        if (connectedToMatchmaking) {
            sendMatchmakingMessage({
                type: 'game-server-ready',
                gameServerId: matchmakingData.gameServerId
            });
        }
    }
};
