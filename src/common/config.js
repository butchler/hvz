export const mazeWidth = 30, mazeHeight = 30,
       hostname = 'localhost',
       webServerPort = 8000,
       webServerUrl = `http://${hostname}:${webServerPort}`,
       matchmakingServerPath = '/ws',
       matchmakingServerUrl = `ws://${hostname}:${webServerPort}${matchmakingServerPath}`,
       signallingServerConfig = {
           host: hostname,
           port: webServerPort,
           path: '/peerjs'
       },
       gameServerFrameRate = 60,
       antialias = false,
       skyColor = 0x33aaee,
       fogColor = 0x005599, fogMin = 2, fogMax = 10,
       ambientColor = 0xaaaaaa,
       wallColor = 0xffffff,
       groundColor = 0x666666,
       lightColor = 0x888888,
       mouseSensitivity = 0.002, // radians/pixel
       humanFov = 65, zombieFov = 45,
       humanRadius = 0.1, zombieRadius = 0.2,
       humanColor = 'white', zombieColor = 'black',
       humanSpeed = 2, zombieSpeed = 5, // maze cells/seconds
       gameLength = 60; // seconds
