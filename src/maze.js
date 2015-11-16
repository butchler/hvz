import * as util from "./util";

// Randomly generate a maze.
export function generateMaze(width, height, rng) {
    rng = rng || Math.random;

    // Each cell is represented by a 3x3 subgrid, where the truthiness of the
    // cells on the left, top, right, and bottom of the subgrid represent
    // existence of four walls around that cell.
    //
    // For example, if the grid looks like this:
    //
    // #########
    // ## ### ##
    // ##  ## ##
    // ##  #  ##
    // ##    ###
    // ###  ####
    // #########
    //
    // Then the cells marked with x's represent walls around the cells, represented by .'s
    //
    // #X#X#X#X#
    // X.x.X.x.X
    // #X x#X X#
    // X.x.X.x.X
    // #X x x#X#
    // X.X.x.X.X
    // #X#X#X#X#
    //
    // Producing a maze with walls and cells like this:
    //
    // _________
    // |. .|. .|
    // |. .|. .|
    // |.|. .|.|
    // ---------
    //
    // Again without the cell centers to make it more clear:
    //
    // _________
    // |   |   |
    // |   |   |
    // | |   | |
    // ---------
    //
    // Representing the walls as boolean cells like this allows the maze
    // generation algorithm to use cellular automata techniques to generate
    // interesting cave-liked structures in the maze.

    // Initialize the grid to all true, meaning all walls are up by default.
    let grid = util.create2DArray(height * 2 + 1, width * 2 + 1, true);

    drillMaze(grid, rng);

    createCaves(grid);

    // Convert grid to a more easy to work with representation of a maze.
    let maze = {
        grid,
        wallGrid: util.create2DArray(height, width,
                          () => { return {north: false, south: false, east: false, west: false}; }),
        wallList: []
    };

    for (let y = 0; y < grid.length; y++) {
        for (let x = 0; x < grid[y].length; x++) {
            // NOTE: Positive y goes in the up/north direction and positive x
            // goes in the right/east direction.

            // Only some cells represent walls.
            //if ((y % 2 === 0 && x % 2 !== 0) || (y % 2 !== 0 && x % 2 === 0))
            // Another way of writing the above is:
            if (y % 2 !== x % 2) {
                // Which means that every other diagonal line going through the
                // grid of cells will be considered a wall. For example, if x's
                // are walls:
                //
                // #x#x#x#x#
                // x#x#x#x#x
                // #x#x#x#x#
                // x#x#x#x#x
                // #x#x#x#x#
                // x#x#x#x#x
                // #x#x#x#x#
                //

                // The boolean value at each cell represents whether or not a wall is there.
                const hasWall = grid[y][x];

                if (hasWall) {
                    const mazeX = Math.floor(x / 2);
                    const mazeY = Math.floor(y / 2);

                    // Construct a list of all walls for easy iteration.
                    maze.wallList.push({
                        x: mazeX,
                        y: mazeY,
                        direction: y % 2 === 0 ? 'horizontal' : 'vertical'
                    });

                    // Construct a grid of cells and their surrounding walls
                    // for easy random lookup.
                    //
                    // Each wall is bounded by two cells, either horizontally or
                    // vertically (depending on whether it is a vertical or
                    // horizontal wall). Find those two cells:
                    if (y % 2 === 0) {
                        // Horizontal wall, update the cells to the north and south.
                        util.ifInBounds(maze.wallGrid, mazeY, mazeX, cell => cell.south = true);
                        util.ifInBounds(maze.wallGrid, mazeY - 1, mazeX, cell => cell.north = true);
                    } else {
                        // Vertical wall, update the cells to the east and west.
                        util.ifInBounds(maze.wallGrid, mazeY, mazeX, cell => cell.west = true);
                        util.ifInBounds(maze.wallGrid, mazeY, mazeX - 1, cell => cell.east = true);
                    }
                }
            }
        }
    }

    return maze;
}

function drillMaze(grid, rng) {
    if (grid.length < 3 || grid[0].length < 3)
        throw new Error('Grid too small');

    let visited = [];

    let knockDown = function([x, y], [dx, dy]) {
        let [newX, newY] = [x + dx * 2, y + dy * 2];
        let [wallX, wallY] = [x + dx, y + dy];

        if (grid[newY] && grid[newY][newX]) {
            // Knock down wall.
            grid[wallY][wallX] = false;
            // Mark cell as visited.
            grid[newY][newX] = false;

            visited.push([newX, newY]);

            return true;
        } else {
            return false;
        }
    }

    let offsets = [
        [1, 0], [-1, 0], [0, 1], [0, -1]
    ];

    // Start at bottom left of maze.
    grid[1][1] = false;
    visited.push([1, 1]);

    while (visited.length > 0) {
        // Choose a random cell that we've already visited and try to move to
        // one of its unvisited neighboring cells, if it has any, knocking down
        // the wall in between the two cells.
        let index = Math.floor(rng() * visited.length);
        let position = visited[index];

        // Randomize the directions so that we choose the neighboring cell in a
        // random order.
        util.shuffleArray(offsets, rng);

        // Find one neighboring cell that hasn't been visited, and knock down
        // the wall between this cell and that cell, adding the new cell to the
        // list of visited cells.
        let hasUnvisitedNeighbors = knockDown(position, offsets[0]) ||
            knockDown(position, offsets[1]) ||
            knockDown(position, offsets[2]) ||
            knockDown(position, offsets[3]);

        // If this cell has no unvisited neighboring cells, then we can't do
        // anything else with it, so remove it from the list.
        if (!hasUnvisitedNeighbors)
            visited.splice(index, 1);
    }
}

// Uses a cellular automata to create open areas in the cave.
// Based on the caves example from http://sanojian.github.io/cellauto/
function createCaves(grid) {
    // Returns the number of false cells around the given cell.
    let countFalseNeighbors = (g, x, y) => {
        let sum = 0;
        for (let xo = -1; xo <= 1; xo++) {
            for (let yo = -1; yo <= 1; yo++) {
                if (xo === 0 && yo === 0)
                    continue;

                util.ifInBounds(g,
                        y + yo,
                        x + xo,
                        (cell) => {
                            if (!cell)
                                sum += 1
                        });
            }
        }
        return sum;
    }

    // Create a copy of the grid to store the state of the previous iteration.
    let height = grid.length;
    let width = grid[0].length;
    let grid2 = util.create2DArray(height, width, (y, x) => grid[y][x]);

    // Iterate, knocking down walls to create open areas.
    let currentGrid = grid;
    let previousGrid = grid2;
    for (let i = 0; i < 10; i++) {
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                // Cells with a lot of empty/false cells around them will also
                // become empty/false.
                let numFalse = countFalseNeighbors(previousGrid, x, y);
                if ((previousGrid[y][x] && numFalse >= 6) || numFalse >= 7)
                    currentGrid[y][x] = false;
            }
        }

        if (currentGrid === grid) {
            currentGrid = grid2;
            previousGrid = grid;
        } else {
            currentGrid = grid2;
            previousGrid = grid;
        }
    }
}

export function printGrid(grid) {
    for (let y = 0; y < grid.length; y++) {
        let row = '';
        for (let x = 0; x < grid[0].length; x++) {
            row += grid[y][x] ? '#' : ' ';
        }
        console.log(row);
    }
}
