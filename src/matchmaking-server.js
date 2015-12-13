import * as ws from "ws";
import {spawn} from "child_process";
import * as config from "config";

export default function startMatchmakingServer(options) {
    let server = new ws.Server(options);

    let players = {};
    let lobbies = {};
    let gameServers = {};

    server.on('connection', socket => {
        let playerName = null;

        socket.on('message', messageString => {
            let message = null;
            try {
                message = JSON.parse(messageString);
            } catch (error) {
                console.error(`Could not parse message "${messageString}": ${error}`);
                return;
            }

            if (message === null) {
                console.error('Message must be a JSON object:', messageString);
                return;
            }

            if (message.type === 'request-name') {
                // Step 1. User chooses a name to identify themselves.
                if (playerName !== null) return sendError('Cannot change name.');

                // Check if the name is valid.
                if (typeof message.name !== 'string' || message.name.length < 1) {
                    socket.send(JSON.stringify({
                        type: 'name-invalid',
                        name: message.name
                    }));
                // Check if the name is already taken.
                } else if (message.name in players) {
                    socket.send(JSON.stringify({
                        type: 'name-taken',
                        name: message.name
                    }));
                // Add player with requested name.
                } else {
                    playerName = message.name;
                    players[message.name] = {
                        socket,
                        lobby: null
                    };

                    socket.send(JSON.stringify({
                        type: 'name-accepted',
                        name: message.name
                    }));

                    // Send the player the lobby list after they log in.
                    socket.send(JSON.stringify({
                        type: 'lobbies-updated',
                        lobbies
                    }));

                    console.log(`New player connected with name ${playerName}`);
                }
            } else if (message.type === 'create-lobby') {
                // Step 2. User creates a game lobby that other players can join.
                if (playerName === null) return sendError('Must choose a name before creating a lobby.');

                lobbies[playerName] = {
                    players: [playerName]
                };

                players[playerName].lobby = playerName;

                console.log(`${playerName} created a lobby.`);

                broadcastLobbies();
            } else if (message.type === 'join-lobby') {
                // Step 3. Let other players join the lobby.
                if (playerName === null) return sendError('Must choose a name before joining a lobby.');
                if (players[playerName].lobby !== null) return sendError('Cannot join a lobby when already in one.');
                if (!(message.lobby in lobbies)) return sendError('Lobby does not exist.');

                let player = players[playerName];
                let lobby = lobbies[message.lobby];

                lobby.players.push(playerName);
                player.lobby = message.lobby;

                console.log(`${playerName} joined ${player.lobby}'s lobby`);

                broadcastLobbies();
            } else if (message.type === 'leave-lobby') {
                // Step 3.5. Optionally allow player to leave lobby. If the creator leaves, then the lobby is destroyed.
                if (playerName === null) return sendError('Must choose a name before leaving a lobby.');
                if (players[playerName].lobby === null) return sendError('Must be in a lobby to leave one.');

                leaveLobby();
            } else if (message.type === 'start-game') {
                // Step 4. Let the creator of a lobby start the game.
                if (playerName === null) return sendError('Must choose a name before starting a game.');
                if (!(playerName in lobbies)) return sendError('Must be the creator of a lobby to start a game.');

                let [gameServerId, gameServerProcess] = startNewGameServer(playerName, lobbies[playerName]);

                gameServers[gameServerId] = {
                    lobby: playerName,
                    process: gameServerProcess
                };

                console.log(`Starting ${playerName}'s game...`);
            } else if (message.type === 'game-server-ready') {
                // Step 5. The game server also connects to the websocket
                // server and to tell the players that it's ready.
                if (gameServers[message.gameServerId] === undefined) {
                    console.error(`Game server doesn't exist: ${message.gameServerId}.`);
                    return;
                }

                let lobbyName = gameServers[message.gameServerId].lobby;
                let lobby = lobbies[lobbyName];

                // Do nothing if this game was already started and the lobby removed.
                if (lobby === undefined)
                    return;

                lobby.players.forEach(playerName => {
                    players[playerName].socket.send(JSON.stringify({
                        type: 'game-started',
                        gameServerId: message.gameServerId
                    }));

                    // Also remove players from the lobby when the game starts.
                    players[playerName].lobby = null;
                });

                // Destroy the lobby when the game has started.
                delete lobbies[lobbyName];

                console.log(`Game started and ${lobbyName}'s lobby destroyed.`);

                broadcastLobbies();
            } else if (message.type === 'game-finished') {
                // Step 6. Kill the game server's process when the game server
                // tells us the game is over.
                if (gameServers[message.gameServerId] === undefined) {
                    console.error(`Game server doesn't exist: ${message.gameServerId}.`);
                    return;
                }

                //gameServers[message.gameServerId].process.kill();
                delete gameServers[message.gameServerId];

                console.log(`Game server ${message.gameServerId} ended.`);

                // TODO: Also kill processes after 30 minutes or so as a backup.
            } else {
                console.error('Unknown message', JSON.stringify(message));
            }
        });

        socket.on('close', () => {
            if (playerName !== null) {
                // If the player was in a lobby when they disconnected, remove them from it.
                if (players[playerName].lobby !== null)
                    leaveLobby();

                console.log(`Player '${playerName}' disconnected.`);

                delete players[playerName];
            }
        });

        function leaveLobby() {
            let player = players[playerName];
            let lobby = lobbies[player.lobby];

            if (player.lobby === playerName) {
                // If the player is the creator of this lobby, destroy the lobby and kick all of thep players.
                // The lobby IDs are just the player names, so they can be used to determine ownership.
                delete lobbies[player.lobby];
                lobby.players.forEach(playerName => players[playerName].lobby = null);

                console.log(`${playerName}'s lobby was destroyed.`);
            } else {
                // If they are not the creator, kick them from the lobby.
                let playerIndex = lobby.players.indexOf(playerName);
                if (playerIndex > -1)
                    lobby.players.splice(playerIndex, 1);

                console.log(`{playerName} left ${player.lobby}'s lobby`);

                player.lobby = null;
            }

            broadcastLobbies();
        }

        function broadcastLobbies() {
            // Broadcast the updated list of lobbies to all clients.
            for (let playerName in players) {
                let player = players[playerName];

                // Need to make sure socket is open because broadcastLobbies()
                // is also called from socket.on('close').
                if (player.socket.readyState === ws.OPEN) {
                    player.socket.send(JSON.stringify({
                        type: 'lobbies-updated',
                        lobbies
                    }));
                }
            }

            /*console.log('lobbies', JSON.stringify(lobbies));
            console.log('players', JSON.stringify(Object.keys(players).map(p => p + ' -> ' + players[p].lobby)));*/
        }

        function sendError(errorMessage) {
            socket.send(JSON.stringify({
                type: 'error',
                errorMessage
            }));

            console.error('Error: ' + errorMessage);
        }
    });

    console.log('Matchmaking server started.')
}

// Spawn a headless chromium process to run the game server.
function startNewGameServer(lobbyName, lobby) {
    // Create random ID.
    let gameServerId = 'server' + ('' + Math.random()).substr(2);

    let matchmakingData = {
        gameServerId,
        numPlayers: lobby.players.length,
        creator: lobbyName
    };

    // Use Xvfb to create a virtual screen that chromium can use, so you can run chrome without popping up a new window each time.
    let gameServerProcess = spawn('xvfb-run', [
            '-a',
            '--server-args="-screen 0, 1024x768x16"',
            'chromium',
                // Need to create a new user data directory for each process so that it
                // doesn't open up the page in a new tab in an existing window.
                '--user-data-dir=/tmp/headless-chromium-' + gameServerId,
                '--no-first-run',
                // Pass server id so game server can connect to and identify itself to the
                // matchmaking server, and pass lobby id/creator name so the game server
                // knows who the initial zombie should be.
                config.webServerUrl + '/game-server/index.html#' + JSON.stringify(matchmakingData)
    ]);

    return [gameServerId, gameServerProcess];
}
