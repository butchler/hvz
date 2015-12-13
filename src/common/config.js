export const mazeWidth = 20,
       mazeHeight = 20,
       webServerPort = 8000,
       webServerUrl = 'http://localhost:' + webServerPort,
       matchmakingServerPath = '/ws', matchmakingServerUrl = 'ws://localhost:8000' + matchmakingServerPath,
       signallingServerConfig = {
           host: 'localhost',
           port: 8000,
           path: '/peerjs'
       },
       gameServerFrameRate = 60,
       antialias = true,
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
