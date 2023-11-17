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
app.use("/app/", (req, res, next) => {
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
    console.log("Client connected");

    ws.on('message', (message, isBinary) => {
        const msg = isBinary ? message : message.toString();
        ROOT.GAME.ON_SOCKET_MESSAGE(ws, JSON.parse(msg));
    });

    ws.on('close', () => {
        ROOT.GAME.ON_SOCKET_DISCONNECT(ws);
        console.log("Client disconnected");
    }); 
});


// -------------------
//     GAME ROUTES
// -------------------

app.post("/joinGame", (req, res) => {
    ROOT.GAME.JOIN_GAME(req.body.name).then((data) => {
        let ses = addSession(req.body.name);
        res.cookie("session", ses, {"maxAge": ses.expires});
        res.json(data);
    }).catch((err) => {
        res.json({"error": err});
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
            res.json({"error": err});
        });

    }).catch((err) => {
        res.json({"error": err});
    });
});

app.get("/getLobby", (req, res) => {
    ROOT.GAME.GET_LOBBY().then((data) => {
        res.json(data);
    }).catch((err) => {
        res.json({"error": err});
    });
});

app.post("/startGame", (req, res) => {
    ROOT.GAME.START_GAME().then((data) => {
        res.json(data);
    }).catch((err) => {
        res.json({"error": err});
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