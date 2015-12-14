import * as util from "common/util";
import {generateMaze} from "common/maze";
import random from "pcg-random";
import {Vector3} from "three";
import {initState, updateState, addPlayer} from "common/update-state";
import * as config from "common/config";

let playerConnections = {};
let state, maze;

let connectedToMatchmaking, connectedToSignalling, sendMatchmakingMessage, gameServerId, gameStarted;
let creator, numPlayers, numPlayersConnected;

export default {
    init() {
        state = initState();

        maze = generateMaze(config.mazeWidth, config.mazeHeight, state.randomSeed);

        connectedToMatchmaking = false;
        connectedToSignalling = false;
        gameStarted = false;
        numPlayersConnected = 0;
    },
    playerConnected(playerId, playerName, sendStateFunction) {
        playerConnections[playerId] = {
            sendState: sendStateFunction,
            lastInputTimestamp: 0,
            playerName
        };

        let isZombie = playerName === creator;

        addPlayer({ state, maze }, playerId, isZombie);

        numPlayersConnected += 1;
    },
    playerDisconnected(playerId) {
        delete state.players[playerId];
        delete playerConnections[playerId];

        // Reset the server if all players are disconnected.
        if (Object.keys(playerConnections).length === 0)
            window.location.reload();
    },
    receivedInput(playerId, inputStateUpdate) {
        if (!(playerId in playerConnections && playerId in state.players))
            return;

        // Ignore old/out of order messages.
        if (inputStateUpdate.timestamp < playerConnections[playerId].lastInputTimestamp)
            return;
        else
            playerConnections[playerId].lastInputTimestamp = inputStateUpdate.timestamp;

        util.mergeDeep(state.players[playerId].inputState, inputStateUpdate);
    },
    update(delta, now) {
        // Don't start the game until all players have connected.
        if (!gameStarted || numPlayersConnected < numPlayers)
            return;

        updateState({ state, maze }, delta);

        for (let playerId in playerConnections) {
            playerConnections[playerId].sendState(state);
        }

        state.timestamp = window.performance.now();
    },
    connectedToMatchmakingServer(sendMessageFunction) {
        connectedToMatchmaking = true;
        sendMatchmakingMessage = sendMessageFunction;

        if (connectedToSignalling) {
            sendMatchmakingMessage({
                type: 'game-server-started',
                gameServerId
            });
        }
    },
    connected(serverId) {
        connectedToSignalling = true;
        gameServerId = serverId;

        if (connectedToMatchmaking) {
            sendMatchmakingMessage({
                type: 'game-server-started',
                gameServerId
            });
        }
    },
    startGame(_creator, _numPlayers) {
        gameStarted = true;

        creator = _creator;
        numPlayers = _numPlayers;

        sendMatchmakingMessage({
            type: 'game-server-ready'
        });
    }
};
