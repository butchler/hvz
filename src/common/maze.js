import * as util from "./util";
import random from "pcg-random";

// Returns the number of alive cells around the given cell.
function countNeighbors(grid, x, y) {
    let sum = 0;
    for (let xo = -1; xo <= 1; xo++) {
        for (let yo = -1; yo <= 1; yo++) {
            // Don't count the cell itself, just its neighbors.
            if (xo === 0 && yo === 0)
                continue;

            util.ifInBounds(grid,
                    y + yo,
                    x + xo,
                    cell => {
                        if (cell)
                            sum += 1
                    });
        }
    }

    return sum;
}

function cellAuto(maze, { born, survive, iterations }) {
    // Create a copy of the grid to store the state of the previous iteration.
    let gridCopy = util.create2DArray(maze.height, maze.width, (y, x) => maze.grid[y][x]);

    let currentGrid = maze.grid;
    let nextGrid = gridCopy;
    for (let i = 0; i < iterations; i++) {
        for (let y = 0; y < maze.height; y++) {
            for (let x = 0; x < maze.width; x++) {
                let isAlive = currentGrid[y][x];
                let numAliveNeighbors = countNeighbors(currentGrid, x, y);

                if (!isAlive)
                    nextGrid[y][x] = born(numAliveNeighbors);
                else
                    nextGrid[y][x] = survive(numAliveNeighbors);
            }
        }

        // Swap buffers after each iteration.
        [currentGrid, nextGrid] = [nextGrid, currentGrid];
    }

    maze.grid = currentGrid;
}

export function generateMaze(width, height, randomSeed) {
    let rng = new random(randomSeed);

    // Create a maze of straight corridors using a cellular automata.
    let grid = util.create2DArray(height, width, (y, x) => rng.number() > 0.5);
    let maze = { width, height, grid };

    // Use the mazectric cellular automata (http://www.conwaylife.com/wiki/Maze)
    cellAuto(maze, {
        born: n => n === 3,
        survive: n => n >= 1 && n <= 4,
        iterations: 20
    });

    // Create a maze of caves to carve out of the previously generated maze.
    let maskGrid = util.create2DArray(height, width, (y, x) => rng.number() > 0.4);
    let maskMaze = { width, height, grid: maskGrid };

    // Based on the caves example from https://sanojian.github.io/cellauto/
    cellAuto(maskMaze, {
        born: n => n >= 6,
        survive: n => n >= 4,
        iterations: 20
    });

    // Carve out the caves.
    for (let y = 0; y < maze.height; y++) {
        for (let x = 0; x < maze.width; x++) {
            if (maskMaze.grid[y][x])
                maze.grid[y][x] = false;
        }
    }

    // Ensure that the maze has an outer ring of walls.
    for (let y = 0; y < maze.height; y++) {
        maze.grid[y][0] = true;
        maze.grid[y][maze.width - 1] = true;
    }
    for (let x = 0; x < maze.width; x++) {
        maze.grid[0][x] = true;
        maze.grid[maze.height - 1][x] = true;
    }

    return maze;
}

export function printMaze(maze) {
    let row = '';
    for (let x = 0; x < maze.width + 2; x++)
        row += '-';
    console.log(row);

    for (let y = 0; y < maze.height; y++) {
        row = '';
        for (let x = 0; x < maze.width; x++) {
            row += maze.grid[y][x] ? '#' : ' ';
        }
        console.log('|' + row + '|');
    }

    row = '';
    for (let x = 0; x < maze.width + 2; x++)
        row += '-';
    console.log(row);
}
