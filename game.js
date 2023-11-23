"use strict";

const fs = require("fs");
const tasks = require("./tasks.json");

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

        for(let i = 0; i < this.players.length; i++)
            this.players[i].sendMessage({"type": "update"});

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
        this.players.find((p) => p.socket == ws)?.setSocket(null);
    }
}

class Game {
    /**@type {Survivor[]} */
    survivors;
    /**@type {Killer[]} */
    killers;
    /**@type {GameState} */
    state;
    roundCount = 0;

    constructor() {
        this.survivors = [];
        this.killers = [];
        this.setState("lobby");

        this.gameStart();
    }

    gameStart() {
        // gameStart survivors
        for(let i = 0; i < this.survivors.length; i++) {
            this.survivors[i].gameStart();
        }
        // gameStart killers
        for(let i = 0; i < this.killers.length; i++) {
            this.killers[i].gameStart();
        }

        // setting to -1 cause beginRound has ++
        this.roundCount = -1;
        this.beginRound();
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

        this.gameStart();
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

    getPlayer(name) {
        return this.killers.find((p) => p.name == name) || this.survivors.find((s) => s.name == name);
    }

    reconnectPlayer(name) {

    }
    
    socketDisconnect(ws) {
        this.survivors.find((p) => p.socket == ws)?.setSocket(null);
        this.killers.find((p) => p.socket == ws)?.setSocket(null);
    }

    getIntendedPage() {
        if(this.state == "lobby") return "/app/lobby.html";
        if(this.state == "round") return "/app/night.html";

        return "/app/notimplemented.html";
    }

    getKillersLeft() {
        let c = 0;
        for(let i = 0; i < this.killers.length; i++) {
            c += this.killers[i].isAlive ? 1 : 0;
        }
        return c;
    }

    beginRound() {
        this.setState("round");
        this.roundCount++;

        // gameStart survivors
        for(let i = 0; i < this.survivors.length; i++) {
            this.survivors[i].onBeginRound();
            this.survivors[i].chooseTasks(tasks.survivor);
        }

        // gameStart killers, they should share tasks
        let chosenKillerTasks = [];
        for(let i = 0; i < this.killers.length; i++) {
            this.killers[i].onBeginRound();
            if(i == 0) {
                chosenKillerTasks = this.killers[i].chooseTasks(Object.keys(tasks.killers));
            } else {
                this.killers[i].tasks = this.killers[0].tasks;
            }
        }
    }

    /**@param {Person} player  */
    onTaskCompleted(player, taskIndex) {
        console.log(`${player.name} has completed task ${taskIndex}`);

        // set true for all killers
        if(player instanceof Killer) {
            for(let i = 0; i < this.killers.length; i++) {
                this.killers[i].tasks[taskIndex].completed = true;
                this.killers[i].tasks[taskIndex].by = player.name;
                this.killers[i].sendMessage({"type": "update"});
            }
        }
    }

    getKillerHint() {
        if(this.killers.length == 0) return "being dead...";

        let killerTasks = this.killers[0].tasks;
        let task = killerTasks[this.roundCount % killerTasks.length].task;

        return tasks.killers[task];
    }

    getRandomSurvivorTask() {
        return tasks.survivor[(this.roundCount * 100 + 524) % tasks.survivor.length];
    }
}

class Person {
    /**@type {string} */
    name;

    /**@type {boolean} */
    isAlive;
    /**@type {Game} */
    game;
    /**@type {WebSocket} */
    socket;

    _socketDisconnectedQueue = [];

    /**@type {{task: String, completed: boolean}[]} */
    tasks = [];
    /**
     * These are tasks that have been completed, DO NOT REPEAT
     * @type {String[]}
     */
    completedTasks = [];
    /**
     * These are tasks that have been used, try to avoid but its fine if not
     * @type {String[]}
     */
    avoidTasks = [];

    tasksNeeded = 1;
    tasksGiven = 1;

    /** 
     * @param {Game} game
     * @param {Person} data */
    constructor(data, game) {
        this.name = data.name || "Unnamed Player";
        this.isAlive = data.isAlive || true;
        this.game = game;
        this.socket = data.socket || null;

        this._socketDisconnectedQueue = [];
        this.tasksNeeded = 1;
        this.tasksGiven = 1;
    }

    /**@returns {Person} */
    getSave() {
        return {
            name: this.name,
            isAlive: this.isAlive
        }
    }

    setSocket(socket) {
        this.socket = socket;
        if(socket == null)
            console.log(this.name + " disconnected!");
        else {
            console.log("Player Connected! " + this.name + ", unread messages: " + this._socketDisconnectedQueue.length);
            for(let i = 0; i < this._socketDisconnectedQueue.length; i++)
                this.sendMessage(this._socketDisconnectedQueue[i]);
        }
    }

    sendMessage(obj) {
        if(this.socket == null) {
            this._socketDisconnectedQueue.push(obj);
            console.log(this.name + ' is not connected, leaving message!');
            return;
        }
        if(obj.type == null)
            obj.type = "message";
        this.socket.send(JSON.stringify(obj));
    }

    gameStart() {
    }
    
    getType() { return "LobbyPlayer" }

    exportTasks() { return this.tasks}

    /**@param {Number} index  */
    completeTask(index) {
        this.tasks[index].completed = true;
        this.completedTasks.push(this.tasks[index].task);
        this.game.onTaskCompleted(this, index);
    }

    getCompletedTasks() {
        let c = 0;
        for(let i = 0; i < this.tasks.length; i++)
            if(this.tasks[i].completed) c++;
        return c;
    }

    chooseTasks(allPossibleTasks) {
        let remaining = [];

        // choose the tasks
        for(let i = 0; i < allPossibleTasks.length; i++) {
            if(this.completedTasks.indexOf(allPossibleTasks[i]) > -1)
                continue;

            if(this.avoidTasks.indexOf(allPossibleTasks[i]) > -1) {
                remaining.push({task: allPossibleTasks[i], score: -Math.random()});
                continue;
            }

            remaining.push({task: allPossibleTasks[i], score: Math.random()});
        }

        // sort them
        remaining.sort((a, b) => b.score - a.score);

        let chosen = [];

        // choose the tasks
        for(let i = 0; i < this.tasksGiven; i++) {
            if(i >= remaining.length) {
                console.log(`Ran out of tasks for ${this.name}`, this.completedTasks, this.avoidTasks, remaining, this.tasksGiven);
                chosen.push(this.completedTasks[Math.floor(Math.random() * this.completedTasks.length)]);
            } else
                chosen.push(remaining[i].task);
        }
        
        this.tasks = chosen.map((task) => {return {task: task, completed: false}});
        return chosen;
    }

    onBeginRound() {
        this.avoidTasks.push(...this.tasks);
        this.tasks = [];
    }
}

class Survivor extends Person {

    constructor(data, game) {
        super(data, game);
        this.tasksNeeded = 1;
        this.tasksGiven = 1;
    }

    getType() { return "Survivor" }
}

class Killer extends Person {

    constructor(data, game) {
        super(data, game);
        this.tasksNeeded = 3;
        this.tasksGiven = 5;
    }

    getType() { return "Killer" }
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
        GAME.gameStart(guild);
    }
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
        if(GAME != null) {
            resolve("REDIRECT");
            return;
        }
        if(LOBBY == null) {reject("Lobby doesn't exist"); return;}
    
        LOBBY.addPlayer(new Person({
            "name": username
        }, null));
    
        resolve({ok: true});
    });
}

exports.GET_LOBBY = () => {
    return new Promise((resolve, reject) => {
        if(GAME != null) {reject({"redirect": GAME.getIntendedPage()});}
        if(LOBBY == null) {reject("Lobby doesn't exist"); return;}
    
        resolve({
            "players": LOBBY.players.map((p) => {
                return {
                    "name": p.name,
                    "connected": p.socket != null
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

        let killers = new Set(["test", "Phone"]);

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

        GAME.gameStart();

        // tell players to redirect
        LOBBY.sendMessageToPlayers({
            type: "redirect",
            url: GAME.getIntendedPage()
        });

        LOBBY = null;
    
        resolve({ok: true});
    });
}

exports.GET_GAME = (username) => {
    if(GAME == null) return "Game doesn't exist!";

    let myPlayer = GAME.getPlayer(username);
    if(myPlayer == null) return "Player doesn't exist!";

    return {
        "role": myPlayer.getType(),
        "roundCount": GAME.roundCount,
        "state": GAME.state,
        "intendedPage": GAME.getIntendedPage(),
        "killersLeft": GAME.getKillersLeft(),
        "tasks": myPlayer.exportTasks(),
        "tasksNeeded": myPlayer.tasksNeeded,
        "tasksCompleted": myPlayer.getCompletedTasks(),
        "killerHint": GAME.getKillerHint(),
        "randomSurvivorTask": GAME.getRandomSurvivorTask()
    };
}

exports.COMPLETE_TASK = (username, taskIndex) => {
    return new Promise((resolve, reject) => {
        if(GAME == null) {reject("Game doesn't exist!");}

        let myPlayer = GAME.getPlayer(username);
        if(myPlayer == null) {reject("Player doesn't exist: " + username)};

        console.log("COMPLETD TASK");

        myPlayer.completeTask(taskIndex);
        
        resolve({
            "game": exports.GET_GAME(username)
        });
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
            LOBBY.getPlayer(obj.session?.name)?.setSocket(ws);
        } else if(GAME != null) {
            GAME.getPlayer(obj.session?.name)?.setSocket(ws);
        }
        return;
    }
}

exports.ON_SOCKET_DISCONNECT = (ws) => {
    if(LOBBY != null) LOBBY.socketDisconnect(ws);
    if(GAME != null) GAME.socketDisconnect(ws);
}