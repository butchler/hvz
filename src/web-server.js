// Runs a PeerJS PeerServer that the clients can use to connect to the game
// server (which runs in a PhantomJS headless browser instance), and also runs
// a simple static file server using express to server the index.html and
// other resources.

import express from "express";
import startMatchmakingServer from "matchmaking-server";
import {ExpressPeerServer} from "peer"; // Note: "peer" is PeerJS's PeerServer
                                        // library, and "peerjs" is the client side library.
import * as config from "config";

// Start simple file server on port 8000 serving files from dist/.
let app = express();
app.use(express.static(__dirname + '/'));
let server = app.listen(config.webServerPort);

// Start PeerJS PeerServer.
app.use('/peerjs', ExpressPeerServer(server));

startMatchmakingServer({ server, path: config.matchmakingServerPath });
