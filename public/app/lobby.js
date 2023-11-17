refresh();
setInterval(refresh, 5000);

SETUP_WEBSOCKET();
document.getElementById("startButton").addEventListener("click", () => {
    POST("/startGame");
});

function refresh() {
    GET("/getLobby").then((data) => {
        updateLobbyList(data.players);
        
    let isHost = GET_COOKIES().session.name == data.players[0].name;
    console.log(GET_COOKIES().session.name, data.players[0].name);
    document.getElementById("startButton").style.display = isHost ? "block" : "none";

    }).catch((err) => {
        ERROR(err);
    });

}

function updateLobbyList(list) {
    let html = "";

    for(let i = 0; i < list.length; i++) {
        html += `<div class="lobbyItem">- ${list[i].name}</div>`
    }

    document.getElementById("lobbyList").innerHTML = html;
}