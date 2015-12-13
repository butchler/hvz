var webpack = require("webpack");
var babel = require('babel-core');
var fs = require('fs');

var src = __dirname + '/../src';
var dist = __dirname + '/../dist';

// Compile client and game server for browser target.
var compiler = webpack({
    entry: {
        'client/index': src + '/client',
        'game-server/index': src + '/game-server'
    },
    output: {
        path: dist,
        filename: '[name].js'
    },
    module: {
        loaders: [
            { test: /\.js$/, exclude: /node_modules/, loader: "babel-loader" }
        ]
    },
    resolve: {
        root: src
    },
    devtool: '#inline-source-map'
});

compiler.run(function(error, stats) {
    if (error) console.error(error);
    if (stats) console.log(stats.toString());
});

// Compile web server for node target.
function runBabel(filename, outputFilename) {
    var outputFilename = outputFilename || filename;

    babel.transformFile(src + '/' + filename, function (error, result) {
        if (error) {
            console.error('Error compiling ' + filename + ': ' + error);
        } else {
            fs.writeFileSync(dist + '/' + outputFilename, result.code);

            console.log('Compiled ' + filename);
        }
    });
}

runBabel('web-server.js');
runBabel('matchmaking-server.js');
runBabel('common/config.js', 'config.js');
