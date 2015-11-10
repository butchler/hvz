import * as three from "three";

export function create2DArray(rows, columns, fillValue) {
    let array = new Array(rows);
    for (let y = 0; y < rows; y++) {
        array[y] = new Array(columns);
    }

    if (fillValue !== undefined) {
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < columns; x++) {
                if (typeof fillValue === "function")
                    array[y][x] = fillValue(y, x);
                else
                    array[y][x] = fillValue;
            }
        }
    }

    return array;
}

// Call the given callback with the cooresponding cell if the given coordinates
// are within the bounds of the 2D array.
export function ifInBounds(array, row, column, callback) {
    if (isInBounds(array, row, column))
        callback(array[row][column]);
}

export function isInBounds(array, row, column) {
    return array &&
        row >= 0 && row < array.length &&
        column >= 0 && column < array[row].length;
}

// Initialize three.js renderer, camera, and scene.
export function initThree(container) {
    // Initialize renderer
    let renderer = new three.WebGLRenderer({ antialias: true });
    renderer.setClearColor('black', 1.0);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    let camera = new three.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);

    // Resize canvas when window is resized.
    window.addEventListener('resize', function () {
        renderer.setSize(window.innerWidth, window.innerHeight);
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
    });

    let scene = new three.Scene();

    return { renderer, camera, scene };
}

export function animationLoop(callback, requestFrameFunction) {
    requestFrameFunction = requestFrameFunction || requestAnimationFrame;

    var previousFrameTime = window.performance.now();

    // How many seconds the animation has progressed in total.
    var animationSeconds = 0;

    var render = function () {
        var now = window.performance.now();
        var animationDelta = (now - previousFrameTime) / 1000;
        previousFrameTime = now;

        // requestAnimationFrame will not call the callback if the browser
        // isn't visible, so if the browser has lost focus for a while the
        // time since the last frame might be very large. This could cause
        // strange behavior (such as objects teleporting through walls in
        // one frame when they would normally move slowly toward the wall
        // over several frames), so make sure that the delta is never too
        // large.
        animationDelta = Math.min(animationDelta, 1/30);

        // Keep track of how many seconds of animation has passed.
        animationSeconds += animationDelta;

        callback(animationDelta, animationSeconds);

        requestFrameFunction(render);
    };

    requestFrameFunction(render);
}

export function shuffleArray(array) {
    // Fisher-Yates shuffle. Traverse array, randomly swapping elements.
    for (let from = 0; from < array.length - 1; from++) {
        let to = from + Math.floor(Math.random() * (array.length - from));
        [array[from], array[to]] = [array[to], array[from]];
    }
}
