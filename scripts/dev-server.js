var webpack = require("webpack");
var WebpackDevServer = require("webpack-dev-server");
var peer = require("peer"); // Note: "peer" is PeerJS's PeerServer
                            // library, and "peerjs" is the client side library.

var src = __dirname + '/../src';
var dist = __dirname + '/../dist';

var compiler = webpack({
    entry: {
        'client': src + '/client',
        'game-server': src + '/game-server'
    },
    output: {
        path: dist,
        filename: '[name]/index.js'
    },
    module: {
        loaders: [
            { test: /\.js$/, exclude: /node_modules/, loader: "babel-loader" }
        ]
    },
    resolve: {
        root: src
    },
    devtool: 'inline-source-map'
});

var server = new WebpackDevServer(compiler, {
    contentBase: dist,
    publicPath: '/'
});

server.listen(8000);

// Add PeerServer
server.app.use('/peerjs', peer.ExpressPeerServer(server.listeningApp, {debug: true}));
