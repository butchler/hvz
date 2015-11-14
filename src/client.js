import * as three from "three";
import generateMaze from "./maze";
import * as util from "./util";

let {renderer, camera, scene} = util.initThree({ cameraFov: 65 });

let textureLoader = new three.TextureLoader();

const width = 10, height = 10;
const centerX = width / 2 - 0.5, centerY = height / 2 - 0.5;
const wallWidth = 0.05;
let maze = generateMaze(width, height);

// Build maze geometry.
let mazeGeometry = new three.Geometry();
let wallGeometry = new three.BoxGeometry(1 + wallWidth, 1, wallWidth);
let matrix = new three.Matrix4();
for (let i = 0; i < maze.wallList.length; i++) {
    let wall = maze.wallList[i];

    if (wall.direction === 'vertical') {
        // Place vertical walls at left side of cell.
        matrix.makeRotationY(Math.PI / 2);
        matrix.setPosition(new three.Vector3(wall.x - 0.5, 0, wall.y));
    } else {
        // Place horizontal walls at bottom of cell.
        matrix.makeRotationY(0);
        matrix.setPosition(new three.Vector3(wall.x, 0, wall.y - 0.5));
    }

    mazeGeometry.merge(wallGeometry, matrix);
}

// Add maze object.
let mazeMaterial = new three.MeshPhongMaterial({ map: textureLoader.load('images/concrete-red.jpg') });
let mazeObject = new three.Mesh(mazeGeometry, mazeMaterial);
scene.add(mazeObject);

// Add lighting.
//scene.add(new three.AmbientLight(0x444444));
scene.add(new three.AmbientLight(0x333333));

// Center light above maze.
let light = new three.PointLight(0xffffff);
light.position.set(centerX, 20, centerY);
scene.add(light);

// Add fog.
scene.fog = new three.Fog(0x000000, 2, 5);

// Add ground plane.
let groundTexture = textureLoader.load('images/concrete-gray.jpg');
groundTexture.wrapS = groundTexture.wrapT = three.RepeatWrapping;
groundTexture.repeat.set(4, 4);
let ground = new three.Mesh(
        new three.PlaneGeometry(width, height),
        new three.MeshPhongMaterial({
            map: groundTexture,
            color: 0x444444
        }));
ground.rotateX(-Math.PI / 2);
ground.position.set(centerX, -0.5, centerY);
scene.add(ground);

// Position camera.
let cameraContainer = new three.Object3D();
cameraContainer.add(camera);
cameraContainer.position.set(0, 0, 0);
cameraContainer.rotateY(-Math.PI / 2);
scene.add(cameraContainer);

/*camera.position.set(width / 2, 15, height / 2);
camera.lookAt(scene.position);*/

// Use pointerlock to move camera.
document.addEventListener('click', (event) => document.body.requestPointerLock());

//let mouse = {x: 0, y: 0};
document.addEventListener('mousemove', (event) => {
    // Rotate camera horizontally.
    cameraContainer.rotateY(-event.movementX * 0.002);

    // Rotate camera vertically.
    camera.rotateX(-event.movementY * 0.002);

    // Make it so that vertical rotation cannot loop.
    camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, camera.rotation.x));

    // Putting both the horizontal and vertical rotation on the camera directly
    // allows "flying" camera controls, because camera.translateZ() will move
    // in exactly the direction the camera is facing, rather than just in the
    // direction of its horizontal rotation.
    /*mouse.x += event.movementX;
    mouse.y += event.movementY;

    camera.rotation.set(0, 0, 0);

    // Rotate camera horizontally.
    camera.rotateY(-mouse.x * 0.002);

    // Rotate camera vertically.
    // Make it so that vertical rotation cannot loop.
    var verticalAngle = Math.max(-Math.PI / 2, Math.min(Math.PI /2, -mouse.y * 0.002));
    camera.rotateX(verticalAngle);*/
});

let keys = util.createKeyState();

util.animationLoop((delta, now) => {
    const speed = 2;

    let row = Math.round(cameraContainer.position.z);
    let column = Math.round(cameraContainer.position.x);
    let walls = maze.wallGrid[row] && maze.wallGrid[row][column];

    // Move forward and backward.
    if (keys['w'])
        cameraContainer.translateZ(-delta * speed);
    else if (keys['s'])
        cameraContainer.translateZ(delta * speed);
    // Move left and right.
    if (keys['a'])
        cameraContainer.translateX(-delta * speed);
    else if (keys['d'])
        cameraContainer.translateX(delta * speed);

    if (walls !== undefined) {
        if (walls.north)
            cameraContainer.position.z = Math.min(cameraContainer.position.z, row + 0.3 - wallWidth);
        if (walls.south)
            cameraContainer.position.z = Math.max(cameraContainer.position.z, row - 0.3 + wallWidth);
        if (walls.east)
            cameraContainer.position.x = Math.min(cameraContainer.position.x, column + 0.3 - wallWidth);
        if (walls.west)
            cameraContainer.position.x = Math.max(cameraContainer.position.x, column - 0.3 + wallWidth);
    }

    renderer.render(scene, camera);
});
