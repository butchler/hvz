import * as util from "common/util";
import handlers from "client/event-handlers";

handlers.init();

// Init events.
initEventHandlers();

// Start animation loop.
util.animationLoop(handlers.render);

function initEventHandlers() {
    // Use pointerlock to move camera.
    let requestPointerLock = document.body.requestPointerLock || document.body.mozRequestPointerLock;
    //document.addEventListener('click', event => requestPointerLock.call(document.body));
    document.getElementById('canvas-container').addEventListener('click', event => requestPointerLock.call(document.body));
    // TODO: Handle pointerlock events.
    /*document.addEventListener('pointerlockchange', (event) => {});
      document.addEventListener('pointerlockerror', (event) => {});*/

    document.addEventListener('mousemove', event => {
        let movementX = event.movementX || event.mozMovementX || 0;
        let movementY = event.movementY || event.mozMovementY || 0;

        handlers.mouseMoved(movementX, movementY);
    });
    document.addEventListener('keydown', event => {
        handlers.keyPressedOrReleased(event.keyCode, String.fromCharCode(event.keyCode).toLowerCase(), true);
    });
    document.addEventListener('keyup', event => {
        handlers.keyPressedOrReleased(event.keyCode, String.fromCharCode(event.keyCode).toLowerCase(), false);
    });

    // Detect when the user presses the enter key on the name input field.
    document.getElementById('name-input').addEventListener('keyup', event => {
        if (event.keyCode === 13)
            handlers.nameEntered(event.target.value);
    });
    // Handle create and join lobby buttons.
    document.getElementById('lobby-list').addEventListener('click', event => {
        if (event.target.classList.contains('join-lobby')) {
            let lobbyId = event.target.dataset.lobby;
            handlers.joinLobbyButton(lobbyId);
        } else if (event.target.classList.contains('create-lobby')) {
            handlers.createLobbyButton();
        }
    });
    document.getElementById('lobby').addEventListener('click', event => {
        if (event.target.classList.contains('leave-lobby')) {
            handlers.leaveLobbyButton();
        } else if (event.target.classList.contains('start-game')) {
            handlers.startGameButton();
        }
    });
}
