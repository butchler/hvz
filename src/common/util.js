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
export function initThree(options) {
    options = options || {};
    options.clearColor = options.clearColor || 0x000000;
    options.cameraFov = options.cameraFov || 50;
    options.antialias = options.antialias || true;
    options.shadowMapEnabled = options.shadowMapEnabled || true;

    // Initialize renderer
    let renderer = new three.WebGLRenderer({ antialias: options.antialias });
    renderer.setClearColor(options.clearColor, 1.0);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = options.shadowMapEnabled;
    document.body.appendChild(renderer.domElement);

    let camera = new three.PerspectiveCamera(options.cameraFov, window.innerWidth / window.innerHeight, 0.1, 1000);

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
        animationDelta = Math.min(animationDelta, 1/12);

        // Keep track of how many seconds of animation has passed.
        animationSeconds += animationDelta;

        callback(animationDelta, animationSeconds);

        requestFrameFunction(render);
    };

    requestFrameFunction(render);
}

// Returns an object that contains the current state of keys being pressed.
export function createKeyState() {
    // Keep track of current keys being pressed.
    let keyState = {};

    document.addEventListener('keydown', event => {
        keyState[event.keyCode] = true;
        keyState[String.fromCharCode(event.keyCode).toLowerCase()] = true;
    });
    document.addEventListener('keyup', event => {
        keyState[event.keyCode] = false;
        keyState[String.fromCharCode(event.keyCode).toLowerCase()] = false;
    });
    document.addEventListener('blur', event => {
        // Make it so that all keys are unpressed when the browser loses focus.
        for (var key in keyState) {
            if (keyState.hasOwnProperty(key))
                keyState[key] = false;
        }
    });

    return keyState;
};

export function shuffleArray(array, rng) {
    rng = rng || Math.random;

    // Fisher-Yates shuffle. Traverse array, randomly swapping elements.
    for (let from = 0; from < array.length - 1; from++) {
        let to = from + Math.floor(rng() * (array.length - from));
        [array[from], array[to]] = [array[to], array[from]];
    }
}

// Merges all values in the from object to the into object.
// i.e. into[key] = from[key] for each key in from.
export function merge(into, from) {
    if (!isObject(into))
        throw new Error('merge() cannot merge into non-object.');

    for (let key in from) {
        if (from.hasOwnProperty(key)) {
            into[key] = from[key];
        }
    }

    return into;
}

// Merge values recursively.
export function mergeDeep(into, from) {
    if (!isObject(into))
        throw new Error('mergeDeep() cannot merge into non-object.');

    for (let key in from) {
        if (!from.hasOwnProperty(key))
            continue;

        if (isObject(from[key])) {
            // Create sub-objects if they don't exist.
            if (!isObject(into[key]))
                into[key] = Array.isArray(from[key]) ? new Array(from[key].length) : {};

            mergeDeep(into[key], from[key]);
        } else {
            into[key] = from[key];
        }
    }

    return into;
}

export function cloneObject(object) {
    if (!isObject(object))
        throw new Error('cloneObject() cannot clone non-object.');

    return mergeDeep({}, object);
}

// Calls the given callbacks when a value is added, removed, or changed between
// the old and new versions of an object.
//
// Callback signatures:
//   add(key, value)
//   remove(key, value)
//   change(key, oldValue, newValue)
//   exists(key, newValue)
//
export function onDiff(oldObject, newObject, {add, remove, change, exists}, equals = objectsEqual) {
    if (!isObject(oldObject) || !isObject(newObject))
        throw new Error('onDiff() cannot diff non-objects.');
    if ((add && typeof add !== "function") ||
            (remove && typeof remove !== "function") ||
            (change && typeof change !== "function") ||
            (exists && typeof exists !== "function"))
        throw new Error("onDiff()'s add/remove/change/exists handlers must be functions.");

    if (add) {
        for (let key in newObject) {
            if (newObject.hasOwnProperty(key) && !oldObject.hasOwnProperty(key)) {
                // Call add() when a value is in newObject but not in oldObject.
                add(key, newObject[key]);
            }
        }
    }

    if (remove) {
        for (let key in oldObject) {
            if (oldObject.hasOwnProperty(key) && !newObject.hasOwnProperty(key)) {
                // Call remove() when a value is in oldObject but not in newObject.
                remove(key, oldObject[key]);
            }
        }
    }

    if (change) {
        for (let key in oldObject) {
            if (oldObject.hasOwnProperty(key) && newObject.hasOwnProperty(key)
                    && equals(oldObject[key], newObject[key])) {
                // Call change() when the values in newObject and oldObject differ.
                change(key, oldObject[key], newObject[key]);
            }
        }
    }

    if (exists) {
        for (let key in newObject) {
            if (newObject.hasOwnProperty(key)) {
                // Call exists if a value exists in newObject (i.e. same thing as forEach).
                exists(key, newObject[key]);
            }
        }
    }
}

// Recursively checks if all of the values in the two objects are equal.
export function objectsEqual(a, b) {
    if (!isObject(a) || !isObject(b))
        throw new Error('objectsEqual cannont compare non-objects.');

    for (let key in a) {
        if (a.hasOwnProperty(key)) {
            if (!b.hasOwnProperty(key))
                return false;

            if (isObject(a[key]) && isObject(b[key]) && !objectsEqual(a[key], b[key]))
                return false;
            else if (Array.isArray(a[key]) && Array.isArray(b[key]) && !arraysEqual(a[key], b[key]))
                return false;
            else if (a[key] !== b[key])
                return false;
        }
    }

    return true;
}

export function arraysEqual(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b))
        throw new Error('arraysEqual() cannot compare non-arrays.');

    if (a.length !== b.length)
        return false;

    for (let i = 0; i < a.length; i++) {
        if (isObject(a[i]) && isObject(b[i]) && !objectsEqual(a[i], b[i]))
            return false;
        else if (Array.isArray(a[i]) && Array.isArray(b[i]) && !arraysEqual(a[i], b[i]))
            return false;
        else if (a[i] !== b[i])
            return false;
    }

    return true;
}

// Recursively merge values from "target" into "object", interpolating numeric
// values by the interpolation factor "t", which should be a number between 0
// and 1. Also removes values not in "target" from "object".
export function interpolateObjects(object, target, t) {
    if (!isObject(object) || !isObject(target))
        throw new Error('interpolateObjects() cannot interpolate non-object.');

    // Copy new values from target into object.
    for (let key in target) {
        if (!target.hasOwnProperty(key))
            continue;

        if (isObject(target[key])) {
            // Create sub-objects if they don't exist.
            if (!isObject(object[key]))
                object[key] = Array.isArray(target[key]) ? new Array(target[key].length) : {};

            // Interpolate sub-objects.
            interpolateObjects(object[key], target[key], t);
        } else if (isNumeric(target[key]) && isNumeric(object[key]) && t !== 1) {
            // If both of the values are numbers, interpolate the values.
            object[key] = object[key] * (1 - t) + target[key] * t;
            // If t === 1, just copy the new value over in the following else clause.
        } else {
            // Strings and other values just get copied over as is.
            object[key] = target[key];
        }
    }

    // Remove old values from object.
    for (let key in object) {
        if (!target.hasOwnProperty(key))
            delete object[key];
    }

    return object;
}

export function isNumeric(n) {
    return !isNaN(parseFloat(n)) && isFinite(n);
}

export function isObject(obj) {
    return obj !== null && typeof obj === 'object';
}
