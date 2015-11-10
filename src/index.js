import * as three from "three";
import generateMaze from "./maze";
import * as util from "./util";

let {renderer, camera, scene} = util.initThree();

let width = 10, height = 10;
let maze = window.maze = generateMaze(width, height);

// Build maze geometry.
let mazeGeometry = new three.Geometry();
let wallGeometry = new three.BoxGeometry(1, 1, 0.05);
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
let mazeMaterial = new three.MeshPhongMaterial({ color: 'blue' });
let mazeObject = new three.Mesh(mazeGeometry, mazeMaterial);
mazeObject.position.set(-width / 2, 0, -height / 2);
scene.add(mazeObject);

// Add lighting.
scene.add(new three.AmbientLight(0x444444));

let light = new three.PointLight(0xffffff);
light.position.set(0, -20, 0);
scene.add(light);

// Position camera.
camera.position.set(0, -15, 0);
camera.up.set(0, 0, 1);
camera.lookAt(scene.position);

// Render
renderer.render(scene, camera);
