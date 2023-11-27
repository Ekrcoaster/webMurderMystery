"use strict";

const fs = require("fs");
const tasks = require("./tasks.json");



/**@type {WebSocket} */
var wsCupcake;

/**@typedef {("lobby"|"round"|"voting"|"gameOver")} GameState */

class Lobby {
    /**@type {Person[]} */
    players;

    killerCount = 1;

    constructor() {
        this.players = [];
        this.killerCount = 1;
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
    ownerName;

    lastKilled;
    springlocked;

    constructor() {
        this.survivors = [];
        this.killers = [];
        this.setState("lobby");
        this.ownerName = null;
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
        if(this.state == "voting") return "/app/voting.html";
        if(this.state == "gameOver") return "/app/gameOver.html"

        return "/app/notimplemented.html";
    }

    getKillersLeft() {
        let c = 0;
        for(let i = 0; i < this.killers.length; i++) {
            c += this.killers[i].isAlive ? 1 : 0;
        }
        return c;
    }

    getSurvivorsLeft() {
        let c = 0;
        for(let i = 0; i < this.survivors.length; i++) {
            c += this.survivors[i].isAlive ? 1 : 0;
        }
        return c;
    }

    beginRound() {
        if(this.getKillersLeft() == 0 || this.getSurvivorsLeft() == 0) {
            this.gameOver();
            return;
        }

        this.voteWinner = null;

        this.setState("round");
        this.roundCount++;

        sendCupcake("Night " + this.roundCount + " has begun...");

        // gameStart survivors
        for(let i = 0; i < this.survivors.length; i++) {
            this.survivors[i].onBeginRound();
            this.survivors[i].chooseTasks(tasks.survivor);
        }

        // gameStart killers, they should share tasks
        for(let i = 0; i < this.killers.length; i++) {
            this.killers[i].onBeginRound();
            if(i == 0) {
                this.killers[i].chooseTasks(Object.keys(tasks.killers));
            } else {
                this.killers[i].tasks = this.killers[0].tasks;
            }
        }
    }

    endRound() {
        this.setState("voting");

        sendCupcake("6am", "bell");

        let voteWinner = this.getVoteWinner();
        if(voteWinner != null) {
            this.voteOut(voteWinner);
            this.lastKilled = voteWinner;
            console.log(`Voted out ${voteWinner}`);
        }

        if(this.survivors.length == 0) {
            this.gameOver();
            return;
        }
        
        // if killers didn't do their tasks, get springlocked
        if(this.killers[0].getCompletedTasks() < 1) {
            this.springlocked = true;
            this.gameOver();
            return;
        }

        for(let i = 0; i < this.survivors.length; i++) {
            this.survivors[i].onRoundEnd();
        }
        for(let i = 0; i < this.killers.length; i++) {
            this.killers[i].onRoundEnd();
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

            if(this.killers[0].getCompletedTasks() >= this.killers[0].tasksNeeded) {
                let possible = [
                    `A misty air fills the room...`, 
                    `Watch your back bitches...`, 
                    `The world shakes with some terrifying news...`, 
                    `A sudden death fills the pizzaria`, 
                    `Yall bitches are in for a suprise`,
                    `Umm yea um`,
                ];
                sendCupcake(possible[Math.floor(Math.random() * possible.length)]);
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

    voteOut(name) {
        let player = this.getPlayer(name);
        if(player == null) return null;

        player.kill();

        let role = player.getType();

        for(let i = 0; i < this.survivors.length; i++) {
            this.survivors[i].sendMessage({"type": "voteOver", "username": name, "role": role});
        }
        for(let i = 0; i < this.killers.length; i++) {
            this.killers[i].sendMessage({"type": "voteOver", "username": name, "role": role});
        }

        sendCupcake(`${name} was voted out!..........They were a ${role}!`);

        return role;
    }

    voteSkip() {
        for(let i = 0; i < this.survivors.length; i++) {
            this.survivors[i].sendMessage({"type": "voteSkip"});
        }
        for(let i = 0; i < this.killers.length; i++) {
            this.killers[i].sendMessage({"type": "voteSkip"});
        }

        sendCupcake(`No one was suspiscious enough to vote out... yet...`);
    }

    getAlivePlayerNames() {
        let playerNames = [];
        for(let i = 0; i < this.survivors.length; i++) {
            if(this.survivors[i].isAlive)
                playerNames.push(this.survivors[i].name);
        }
        for(let i = 0; i < this.killers.length; i++) {
            if(this.killers[i].isAlive)
                playerNames.push(this.killers[i].name);
        }
        return playerNames;
    }

    gameOver() {
        this.setState("gameOver");

        for(let i = 0; i < this.survivors.length; i++) {
            this.survivors[i].onGameOver();
        }
        for(let i = 0; i < this.killers.length; i++) {
            this.killers[i].onGameOver();
        }

        sendCupcake(`GAME OVER! ${this.whoWon() == "survivor" ? "Missing Children have" : "William Afton has"} won!`);
    }

    whoWon() {
        return this.getKillersLeft() == 0 ? "survivor" : "killer";
    }

    getVotes() {
        let votes = [];

        for(let i = 0; i < this.survivors.length; i++) {
            if(this.survivors[i].isAlive) {
                let votingForMe = [];
                for(let j = 0; j < this.killers.length; j++) {
                    if(this.killers[j].votingForThisRound == this.survivors[i].name)
                        votingForMe.push(this.killers[j].name);
                }
                votes.push({
                    name: this.survivors[i].name,
                    votedForBy: votingForMe
                });
            }
        }

        return votes;
    }

    getVoteWinner() {
        let votes = this.getVotes();

        for(let i = 0; i < votes.length; i++) {
            if(votes[i].votedForBy.length >= this.getKillersLeft()) {
                return votes[i].name;
            }
        }
        return null;
    }

    onKillerChoosePoll() {
        for(let i = 0; i < this.killers.length; i++) {
            this.killers[i].sendMessage({"type": "update"});
        }
    
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
        this.sendMessage({"type": "update"});
    }

    onRoundEnd() {
        this.sendMessage({"type": "update"});
    }

    kill() {
        this.isAlive = false;
    }

    onGameOver() {
        this.sendMessage({"type": "update"});
    }
}

class Survivor extends Person {

    constructor(data, game) {
        super(data, game);
        this.tasksNeeded = 1;
        this.tasksGiven = 1;
    }

    getType() { return "Dead Child" }
}

class Killer extends Person {

    votingForThisRound = null;

    constructor(data, game) {
        super(data, game);
        this.tasksNeeded = 3;
        this.tasksGiven = 5;
        this.votingForThisRound = null;
    }

    getType() { return "Killer" }

    onBeginRound() {
        super.onBeginRound();
        this.votingForThisRound = null;
    }

    voteFor(name) {
        this.votingForThisRound = name;
        this.game.onKillerChoosePoll();
    }
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

exports.CREATE_GAME = (killerCount) => {
    return new Promise((resolve, reject) => {
        if(GAME != null) {reject("Game already exists"); return;}
        LOBBY = new Lobby();
        if(killerCount < 1) return reject("Killer count must be atleast 1");
        LOBBY.killerCount = killerCount;

        resolve({ok: true});
    });
}

exports.JOIN_GAME = (name) => {
    return new Promise((resolve, reject) => {
        if(GAME != null) {
            resolve("REDIRECT");
            return;
        }
        if(LOBBY == null) {reject("Lobby doesn't exist"); return;}
    
        LOBBY.addPlayer(new Person({
            "name": name
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

        if(LOBBY.killerCount > LOBBY.players.length) return reject("Killer count must be less than the player count");

        GAME = new Game();

        // choose killers        
        let killers = new Set();
        for(let i = 0; i < LOBBY.killerCount; i++) {
            let index = Math.floor(Math.random() * LOBBY.players.length);
            while(killers.has(LOBBY.players[index].name)) {
                index = Math.floor(Math.random() * LOBBY.players.length);
            }
            killers.add(LOBBY.players[index].name);
        }

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

        GAME.ownerName = LOBBY.players[0].name;
        GAME.gameStart();

        // tell players to redirect
        LOBBY.sendMessageToPlayers({
            type: "redirect",
            url: GAME == null ? "/app/gameOver.html" : GAME.getIntendedPage()
        });

        LOBBY = null;
    
        resolve({ok: true});
    });
}

exports.GET_GAME = (name) => {
    if(GAME == null) return "Game doesn't exist!";

    let myPlayer = GAME.getPlayer(name);
    if(myPlayer == null) return "Player doesn't exist!";

    return {
        "role": myPlayer.getType(),
        "roundCount": GAME.roundCount,
        "state": GAME.state,
        "intendedPage": GAME.getIntendedPage(),
        "killersLeft": GAME.getKillersLeft(),
        "survivorsLeft": GAME.getSurvivorsLeft(),
        "tasks": myPlayer.exportTasks(),
        "tasksNeeded": myPlayer.tasksNeeded,
        "tasksCompleted": myPlayer.getCompletedTasks(),
        "killerHint": GAME.getKillerHint(),
        "randomSurvivorTask": GAME.getRandomSurvivorTask(),
        "isAdmin": GAME.ownerName == name,
        "alivePlayers": GAME.getAlivePlayerNames(),
        "isAlive": myPlayer.isAlive,
        "votes": GAME.getVotes(),
        "votesWinner": GAME.lastKilled == null ? GAME.getVoteWinner() : GAME.lastKilled
    };
}

exports.COMPLETE_TASK = (name, taskIndex) => {
    return new Promise((resolve, reject) => {
        if(GAME == null) {reject("Game doesn't exist!");}

        let myPlayer = GAME.getPlayer(name);
        if(myPlayer == null) {reject("Player doesn't exist: " + name)};

        myPlayer.completeTask(taskIndex);
        
        resolve({
            "game": exports.GET_GAME(name)
        });
    });
}

exports.START_ROUND = () => {
    return new Promise((resolve, reject) => {
        if(GAME == null) {reject("Game doesn't exist!");}
        
        GAME.beginRound();
        
        resolve({
            "ok": true
        });
    });
}

exports.END_ROUND = () => {
    return new Promise((resolve, reject) => {
        if(GAME == null) {reject("Game doesn't exist!");}
        
        GAME.endRound();
        
        resolve({
            "ok": true
        });
    });
}

exports.VOTE_OUT = (votedOutname) => {
    return new Promise((resolve, reject) => {
        if(GAME == null) {reject("Game doesn't exist!");}
        
        let role = GAME.voteOut(votedOutname);
        if(role == null) {
            reject("Player " + votedOutname + " doesn't exist!");
            return;
        }
        
        resolve({
            "role": role
        });
    });
}

exports.VOTE_SKIP = () => {
    return new Promise((resolve, reject) => {
        if(GAME == null) {reject("Game doesn't exist!");}
        
        GAME.voteSkip();
        
        resolve({
            "ok": true
        });
    });
}

exports.WHO_WON = () => {
    return {
        "result": GAME?.whoWon(),
        "springlocked": GAME.springlocked
    }
}

exports.RESTART_GAME = () => {
    return new Promise((resolve, reject) => {
        if(GAME == null) {reject("Game doesn't exist!");}
        
        GAME = null;
        
        resolve({
            "ok": true
        });
    });
}

exports.KILLER_VOTE_FOR = (name, votedFor) => {
    return new Promise((resolve, reject) => {
        if(GAME == null) {reject("Game doesn't exist!");}
        
        let myPlayer = GAME.getPlayer(name);
        if(myPlayer == null) {reject("Player doesn't exist: " + name)};

        if(!(myPlayer instanceof Killer)) return reject("Only killers can vote!");
        myPlayer.voteFor(votedFor);

        resolve({
            "game": exports.GET_GAME(name)
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

    if(obj.type == "cupcake") {
        wsCupcake = ws;
    }
}

exports.ON_SOCKET_DISCONNECT = (ws) => {
    if(LOBBY != null) LOBBY.socketDisconnect(ws);
    if(GAME != null) GAME.socketDisconnect(ws);
}

function sendCupcake(msg, type = "speak") {
    if(wsCupcake == null) return;
    wsCupcake.send(JSON.stringify({
        "type": type,
        "msg": msg
    }));
}