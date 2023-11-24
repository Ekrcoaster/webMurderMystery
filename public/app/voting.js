SETUP_WEBSOCKET();
let cookies = GET_COOKIES();

setTimeout(() => {
    document.getElementById("nightTransition").style.display = "block";
    document.getElementById("nightOverlay").style.display = "none";
}, 6000);

function onGameUpdate(game) {
    if(game.error) {
        ERROR(game.error);
        return;
    }

    if(game.state == "round") {
        location.href = "/app/night.html";
        return;
    }
    if(game.state == "gameOver") {
        location.href = "/app/gameOver.html";
        return;
    }

    document.getElementById("adminController").style.display = game.isAdmin ? "block" : "none";
    fillVotingOptions(game.alivePlayers);
    console.log(game);
}

updateGame();
function updateGame() {
    GET("/getGame/" + cookies.session.name).then((game) => {
        onGameUpdate(game);
    }).catch((err) => {
        console.log(err);
        ERROR(err);
    });
}

addWSListener((data) => {
    if(data.type == "update")
        updateGame();

    if(data.type == "voteOver")
        voteOverScreen(`${data.username} has been voted out...`, `${data.username} was a ${data.role}`);

    if(data.type == "voteSkip")
        voteOverScreen(`No one was voted out tonight`, `For now...`);
});

function skipVoting() {
    POST("/voteSkip", {});

    
    setInterval(() => {
        POST("/startRound", {})
    }, 6000);
}

function fillVotingOptions(players) {
    let html = "";

    html += `<option value="---">Select a name...</option>`;
    for(let i = 0; i < players.length; i++) {
        html += `<option value="${players[i]}">${players[i]}</option>`;
    }

    document.getElementById("playerVoteSelect").innerHTML = html;
}

document.getElementById("playerVoteSelect").addEventListener("change", (e) => {
    let val = e.target.value;
    if(val == "---") return;

    POST("/voteOut", {
        "name": val
    }).then((data) => {
        console.log(data);
    }).catch((err) => {
        ERROR(err);
    });

    setInterval(() => {
        POST("/startRound", {})
    }, 6000);
});

function voteOverScreen(message, subtitle) {
    document.getElementById("nightTransition").style.display = "none";
    document.getElementById("nightOverlay").style.display = "block";

    document.getElementById("nightIntroduceLabel").style.display = "none";

    document.getElementById("nightOverlayMessage").innerHTML = message;

    let i = 0;
    let msg = setInterval(() => {
        if(i > 1) {clearInterval(msg); return;};
        i += 0.05;
        document.getElementById("nightOverlayMessage").style.opacity = i;
    }, 100);

    document.getElementById("nightOverlaySubtitle").innerHTML = subtitle;

    setTimeout(() => {
        let i = 0;
        let message = setInterval(() => {
            if(i > 1) {clearInterval(message); return;};
            i += 0.05;
            document.getElementById("nightOverlaySubtitle").style.opacity = i;
        }, 100);
    }, 3000);
}