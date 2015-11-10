#!/bin/sh

# Automatically bundle code when files change.
# -d = generate source maps, -v = verbose.
watchify src/index.js -o bundle.js -d -v 2>&1 | sed -e 's/^/WATCHIFY /' &

# Start livereload server, accessed by script in index.html.
# -d = verbose
# -x node_modules = don't watch files in the node_modules folder.
livereload ./bundle.js -p 8001 -d -x node_modules 2>&1 | sed -e 's/^/LIVERELOAD /' &

# Start local HTTP server.
python -m http.server 2>&1 | sed -e 's/^/SERVER /'
