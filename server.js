const ROOT = require("./index");

const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const http = require('http');
const webSocket = require('ws');
const port = 3000;

const app = express();

app.use(bodyParser.json());
app.use(cookieParser());
app.use("/app/*.html", (req, res, next) => {
    if(getActiveSession(req.cookies.session?.name) == null) {
        res.redirect("/index.html");
    } else {
        next();
    } 
});
app.use(express.static(__dirname + '/public'));
app.use(express.static(__dirname + '/assets/backgrounds/'));

const server = app.listen(port, () => console.log("Server started"));

// -------------------
//    WEB SOCKETS
// -------------------

const wsServer = new webSocket.Server({ noServer: true});

server.on("upgrade", (request, socket, head) => {
    wsServer.handleUpgrade(request, socket, head, (socket) => {
        wsServer.emit('connection', socket, request);
    });
});

wsServer.on('connection', (ws) => {
    console.log("Someone joined... " + wsServer.clients.size);

    ws.on('message', (message, isBinary) => {
        const msg = isBinary ? message : message.toString();
        ROOT.GAME.ON_SOCKET_MESSAGE(ws, JSON.parse(msg));
    });

    ws.on('close', () => {
        console.log("Someone left... " + wsServer.clients.size);
        ROOT.GAME.ON_SOCKET_DISCONNECT(ws);
    }); 
});


// -------------------
//     GAME ROUTES
// -------------------

app.post("/joinGame", (req, res) => {
    ROOT.GAME.JOIN_GAME(req.body.name).then((data) => {
        let ses = addSession(req.body.name);
        res.cookie("session", ses, {"maxAge": ses.expires});
        if(data == "REDIRECT") {
            //res.json({redirect: "/app/reconnect.html"});
            //return;
        }
        res.json(data);
    }).catch((err) => {
        res.json({"error": err.toString()});
    });
});

app.post("/createGame", (req, res) => {
    ROOT.GAME.CREATE_GAME().then((data) => {

        // then add myself to the game
        ROOT.GAME.JOIN_GAME(req.body.name).then((data) => {
            let ses = addSession(req.body.name);
            res.cookie("session", ses, {"maxAge": ses.expires});
            res.json(data);
        }).catch((err) => {
            res.json({"error": err.toString()});
        });

    }).catch((err) => {
        res.json({"error": err.toString()});
    });
});

app.get("/getLobby", (req, res) => {
    ROOT.GAME.GET_LOBBY().then((data) => {
        res.json(data);
    }).catch((err) => {
        res.json({"error": err.toString()});
    });
});

app.post("/startGame", (req, res) => {
    ROOT.GAME.START_GAME().then((data) => {
        res.json(data);
    }).catch((err) => {
        res.json({"error": err.toString()});
    });
});

app.get("/getGame/:name", (req, res) => {
    let game = ROOT.GAME.GET_GAME(req.params.name);
    if(typeof(game) == "string")
        res.json({"error": game});
    else
        res.json(game);
});

app.post("/completeTask", (req, res) => {
    ROOT.GAME.COMPLETE_TASK(req.body.name, req.body.index).then((data) => {
        res.json(data);
    }).catch((err) => {
        res.json({"error": err.toString()});
    });
});

app.post("/startRound", (req, res) => {
    ROOT.GAME.START_ROUND().then((data) => {
        res.json(data);
    }).catch((err) => {
        res.json({"error": err.toString()});
    });
});

app.post("/endRound", (req, res) => {
    ROOT.GAME.END_ROUND().then((data) => {
        res.json(data);
    }).catch((err) => {
        res.json({"error": err.toString()});
    });
});

app.post("/voteOut", (req, res) => {
    ROOT.GAME.VOTE_OUT(req.body.name).then((data) => {
        res.json(data);
    }).catch((err) => {
        res.json({"error": err.toString()});
    });
});

app.post("/voteSkip", (req, res) => {
    ROOT.GAME.VOTE_SKIP().then((data) => {
        res.json(data);
    }).catch((err) => {
        res.json({"error": err.toString()});
    });
});

app.get("/whoWon", (req, res) => {
    res.json(ROOT.GAME.WHO_WON());
});

app.post("/restartGame", (req, res) => {
    ROOT.GAME.RESTART_GAME().then((data) => {
        res.json(data);
    }).catch((err) => {
        res.json({"error": err.toString()});
    });
});

app.post("/killerVoteFor", (req, res) => {
    ROOT.GAME.KILLER_VOTE_FOR(req.body.name, req.body.votedFor).then((data) => {
        res.json(data);
    }).catch((err) => {
        res.json({"error": err.toString()});
    });
});

// -----------------
//    SESSIONS
// -----------------

/**@typedef {{name: String, id: String, expires: Number}} Session */
var sessions = {}

/**@returns {Session} */
function addSession(name) {
    let data = {
        name: name,
        id: (Math.random() * 100000000000000000).toString(16),
        expires: Date.now() + 1000*60*60*24
    }
    sessions[name] = data;
    return data;
}

/**@returns {Session} */
function getActiveSession(name) {
    if(sessions[name] == null) return null;
    if(sessions[name].expires < Date.now()) return null;
    return sessions[name];
}