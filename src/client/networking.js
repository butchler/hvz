import Peer from "peerjs";
import handlers from "client/event-handlers";
import * as config from "common/config";

export function connectToMatchmakingServer() {
    let socket = new WebSocket(config.matchmakingServerUrl);

    socket.onopen = event => {
        let sendMessageFunction = message => {
            socket.send(JSON.stringify(message));
        };

        socket.onmessage = event => {
            let message = JSON.parse(event.data);

            handlers.matchmakingMessageReceived(message);
        };

        handlers.connectedToMatchmakingServer(sendMessageFunction);
    };
}

export function connectToGameServer(gameServerId, playerName) {
    let clientPeer = new Peer(config.signallingServerConfig);

    let disconnected = false;
    function onDisconnect(connection) {
        // Make sure onDisconnect only happens once.
        if (disconnected)
            return;
        else
            disconnected = true;

        handlers.disconnected();

        // Destroy peer.
        if (clientPeer) clientPeer.destroy();

        alert('Disconnected from server, refresh to reconnect.');
    };

    clientPeer.on('open', (clientId) => {
        // The peer has connected to the PeerJS signalling server.
        console.log(`Connected to signalling server with ID: ${clientId}.`);

        // Try to connect to server peer.
        let connection = clientPeer.connect(gameServerId, {reliable: false, metadata: { playerName }});
        let initialState = true;

        connection.on('open', () => {
            // Successfully connected to server peer.
            console.log('Connected to peer server.');

            connection.on('data', (data) => {
                // TODO: Validate data received from server.

                if (initialState) {
                    // Call the connected() event handler when the initial state is received.
                    let sendInputStateFunction = inputState => connection.send(inputState);
                    handlers.connected(clientId, sendInputStateFunction, data);
                    initialState = false;
                } else {
                    handlers.receivedState(data);
                }
            });
        });

        // Handle connection errors.
        connection.on('error', (error) => {
            console.error('Error connecting to server peer:', error);

            onDisconnect(connection);
        });

        connection.on('close', () => {
            console.error('Disconnected from server peer.');

            onDisconnect(connection);
        });
    });

    // Handle peer errors.
    clientPeer.on('error', (error) => {
        console.error('Error connecting to signalling server:', error);

        onDisconnect();
    });

    clientPeer.on('disconnected', () => {
        console.error('Disconnected from signalling server.');

        onDisconnect();
    });

    clientPeer.on('close', () => {
        console.error('Peer was closed.');

        onDisconnect();
    });
}
