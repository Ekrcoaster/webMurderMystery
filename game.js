"use strict";

const fs = require("fs");

/**@typedef {("lobby"|"round"|"voting"|"gameOver")} GameState */

class Lobby {
    /**@type {Person[]} */
    players;

    constructor() {
        this.players = [];
    }

    /**@param {Person} player */
    addPlayer(player) {
        if(this.getPlayer(player.name) != null)
            throw "Player already exists";

        this.players.push(player);
    }

    getPlayer(name) {
        return this.players.find((p) => p.name == name);
    }

    sendMessageToPlayers(obj) {
        for(let i = 0; i < this.players.length; i++) {
            this.players[i].sendMessage(obj);
        }
    }
    socketDisconnect(ws) {
        this.players.find((p) => p.socket == ws).setSocket(null);
    }
}

class Game {
    /**@type {Survivor[]} */
    survivors;
    /**@type {Killer[]} */
    killers;
    /**@type {GameState} */
    state;

    constructor() {
        this.survivors = [];
        this.killers = [];
        this.setState("lobby");

        this.setup();
    }

    setup() {
        // setup survivors
        for(let i = 0; i < this.survivors.length; i++) {
            this.survivors[i].setup();
        }
        // setup killers
        for(let i = 0; i < this.killers.length; i++) {
            this.killers[i].setup();
        }
    }

    /**@param {GameState} state */
    setState(state) {
        this.state = state;
    }

    /** Load data from a saved game
     * @param {Game} data  */
    load(data) {
        this.survivors = data.survivors.map((s) => new Survivor(s, this));
        this.killers = data.killers.map((k) => new Killer(k, this));
        this.setState(data.state);

        this.setup();
        return this;
    }
    
    /**@param {Survivor} player */
    addSurvivor(player) {
        this.survivors.push(player);
        player.game = this;
    }

    /**@param {Killer} player */
    addKiller(player) {
        this.killers.push(player);
        player.game = this;
    }

    /** Save data to file **/
    save() {
        let data = {
            survivors: this.survivors.map((s) => s.getSave()),
            killers: this.killers.map((k) => k.getSave()),
            state: this.state
        }

        save(data);
    }
    
    socketDisconnect(ws) {
        this.survivors.find((p) => p.socket == ws)?.setSocket(null);
        this.killers.find((p) => p.socket == ws)?.setSocket(null);
    }
}

class Person {
    /**@type {string} */
    name;
    /**@type {boolean} */
    isInGame;
    /**@type {Game} */
    game;
    /**@type {WebSocket} */
    socket;

    _socketDisconnectedQueue = [];

    /** 
     * @param {Game} game
     * @param {Person} data */
    constructor(data, game) {
        this.name = data.name || "Unnamed Player";
        this.isInGame = data.isInGame || true;
        this.game = game;
        this.socket = data.socket || null;

        this._socketDisconnectedQueue = [];
    }

    /**@returns {Person} */
    getSave() {
        return {
            name: this.name,
            isInGame: this.isInGame
        }
    }

    setSocket(socket) {
        this.socket = socket;
        if(socket == null)
            console.log(this.name + " disconnected!");
        else {
            for(let i = 0; i < this._socketDisconnectedQueue.length; i++)
                this.sendMessage(this._socketDisconnectedQueue[i]);
        }
    }

    setup() {

    }

    sendMessage(obj) {
        if(this.socket == null) {
            this._socketDisconnectedQueue.push(obj);
            return;
        }
        if(obj.type == null)
            obj.type = "message";
        this.socket.send(JSON.stringify(obj));
    }
}

class Survivor extends Person {

}

class Killer extends Person {

}


function save(data) {
    fs.writeFileSync("./data/murderMystery.json", JSON.stringify(data));
}

function load() {
    let data = fs.readFileSync("./data/murderMystery.json");
    return JSON.parse(data);
}

/**@type {Game} */
var GAME;
/**@type {Lobby} */
var LOBBY;

exports.START = () => {
    let loa = load();
    if (loa && JSON.stringify(loa) != "{}")
        GAME = new Game().load(loa);

    if (GAME != null) {
        GAME.setup(guild);
    }

    LOBBY = new Lobby();
}

exports.CREATE_GAME = () => {
    return new Promise((resolve, reject) => {
        if(GAME != null) {reject("Game already exists"); return;}
        LOBBY = new Lobby();

        resolve({ok: true});
    });
}

exports.JOIN_GAME = (username) => {
    return new Promise((resolve, reject) => {
        if(GAME != null) {reject("Game already exists"); return;}
        if(LOBBY == null) {reject("Lobby doesn't exist"); return;}
    
        LOBBY.addPlayer(new Person({
            "name": username
        }, null));
    
        resolve({ok: true});
    });
}

exports.GET_LOBBY = () => {
    return new Promise((resolve, reject) => {
        if(LOBBY == null) {reject("Lobby doesn't exist"); return;}
    
        resolve({
            "players": LOBBY.players.map((p) => {
                return {
                    "name": p.name
                }
            })
        });
    });
}

exports.START_GAME = () => {
    return new Promise((resolve, reject) => {
        if(GAME != null) {reject("Game already exists"); return;}
        if(LOBBY == null) {reject("Lobby doesn't exist"); return;}

        GAME = new Game();

        let killers = new Set(["Mac"]);

        // distrubute players
        for(let i = 0; i < LOBBY.players.length; i++) {
            if(killers.has(LOBBY.players[i].name)) {
                let killer = new Killer(LOBBY.players[i], GAME);
                GAME.addKiller(killer);
            } else {
                let survivor = new Survivor(LOBBY.players[i], GAME);
                GAME.addSurvivor(survivor);
            }
        }

        GAME.setup();

        // tell players to redirect
        LOBBY.sendMessageToPlayers({
            type: "redirect",
            url: "/app/game.html"
        });

        LOBBY = null;
    
        resolve({ok: true});
    });
}

/**
 * 
 * @param {WebSocket} ws 
 * @param {Data} obj 
 */
exports.ON_SOCKET_MESSAGE = (ws, obj) => {
    if(obj.type == "join") {
        if(LOBBY != null) {
            LOBBY.getPlayer(obj.session.name).setSocket(ws);
        } else {
            GAME.getPlayer(obj.session.name).setSocket(ws);
        }
        console.log("Player joined: " + obj.session.name);
        return;
    }
}

exports.ON_SOCKET_DISCONNECT = (ws) => {
    if(LOBBY != null) LOBBY.socketDisconnect(ws);
    if(GAME != null) GAME.socketDisconnect(ws);
}