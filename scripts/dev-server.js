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

server.listen(8080);

// Add PeerServer
//server.app.use('/peerjs', peer.ExpressPeerServer(server.listeningApp, {debug: true}));

// Automatically recomple and restart web/matchmaking server.
/*var chokidar = require("chokidar");

var files = {
    'src/web-server.js': 'dist/web-server.js',
    'src/matchmaking-server.js': 'dist/matchmaking-server.js'
};

chokidar.watch(filenames, {
    persistent: true,
    ignoreInitial: true
}).on("all", function (type, files.keys()) {
    if (type === "add" || type === "change") {
        util.log(type + " " + filename);

        try {
            babel.transformFile(filename, function (error, result) {
                if (error) {
                    console.error('Compile error:', error);
                } else {
                    fs.writeFileSync(files[filename], result.code);
                }
            });
        } catch (err) {
            console.error(err.stack);
        }
    }
});*/
