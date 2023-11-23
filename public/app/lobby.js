refresh();
setInterval(refresh, 5000);

SETUP_WEBSOCKET();
document.getElementById("startButton").addEventListener("click", () => {
    POST("/startGame").then(() => {}).catch((err) => ERROR(err));
});

function refresh() {
    GET("/getLobby").then((data) => {
        updateLobbyList(data.players);
            
        let isHost = GET_COOKIES().session.name == data.players[0].name;
        document.getElementById("startButton").style.display = isHost ? "block" : "none";

    }).catch((err) => {
        if(typeof(err) == "object" && err.redirect)
            window.location.href = err.redirect;
        else
            window.location.href = "/index.html"
    });

}

let lastHTML = "";
function updateLobbyList(list) {
    let html = "";

    for(let i = 0; i < list.length; i++) {
        html += `<div class="lobbyItem jitter">
        <img src="${GET_PFP(list[i].name)}" height="100%">
        <p>${list[i].name}</p>
        ${list[i].connected ? "" : `<img src="../assets/loading.gif" style="height: 100%; margin-right: 0px;">`}
        </div>`

        //<p style="color: red; float: right; text-align: right; margin-right: 7px;">Loading</p>
    }

    if(html == lastHTML) return;
    lastHTML = html;
    document.getElementById("lobbyList").innerHTML = html;

    updateJitterList();
}