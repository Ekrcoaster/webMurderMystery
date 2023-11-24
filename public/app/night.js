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

    if(game.state == "voting") {
        location.href = "/app/voting.html";
        return;
    }

    console.log(game);
    let nights = document.getElementsByClassName("nightLabel");
    for(let i = 0; i < nights.length; i++) {
        nights.item(i).innerHTML = `Night ${game.roundCount+1}`;
    }

    document.getElementById("nightSubtitleLabel").innerHTML = `${game.killersLeft} killer${game.killersLeft == 1 ? "" : "s"} remains...`;

    document.getElementById("tasksCompletedLabel").innerHTML = `${game.tasksCompleted}/${game.tasksNeeded} Tasks Completed`;

    if(game.role == "Survivor") {
        document.getElementById("instructions").innerHTML = `You are a MISSING CHILD! You have been given your task for the night. Once you complete it, press done!`
        document.getElementById("killerHint").innerText = `The killers have been tasked with ${game.killerHint}...`;
        document.getElementById("rumorText").innerText = "Rumor has it...";
    } else if(game.role == "Killer") {
        document.getElementById("instructions").innerHTML = `You are WILLIAM AFTON (the killer)! You've been given a bunch of tasks, you must complete 1 of them before the night is up, otherwise you'll be springlocked!`
        document.getElementById("rumorText").innerText = "Need help blending in?";
        document.getElementById("killerHint").innerText = `Random Survivor Task: ${game.randomSurvivorTask}...`;
    }

    updateTaskList(game.tasks);
    document.getElementById("settingsButton").style.display = game.isAdmin ? "block" : "none";

    if(game.isAlive == false) {
        document.getElementById("instructions").innerHTML = `You have been killed! You can no longer complete tasks or participate in voting!`
        document.getElementById("rumorText").innerText = "Want to keep playing? Here is a random survivor task you can try!";
        document.getElementById("killerHint").innerText = `Random Survivor Task: ${game.randomSurvivorTask}...`;
        updateTaskList([]);
    }
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

let lastHTML = "";
function updateTaskList(tasks) {
    let html = "";

    for(let i = 0; i < tasks.length; i++) {
        html += `
        <div class="container jitter taskBox ${tasks[i].completed ? "taskCompleted" : ""}">
            <p id="taskTitle" class="jitter">Your Task:</p>
            <p id="task" class="jitter">${tasks[i].task}</p>
            <button id="completedTaskButton" onclick=" ${tasks[i].completed ? "" : `completeTask('${i}')`}" class="jitter">${tasks[i].completed ? `Task Completed${tasks[i].by ? ` by ${tasks[i].by}` : "" }!` : "I completed this task!"}</button>
        </div>
        `;
    }

    if(lastHTML == html) return;
    document.getElementById("taskContainer").innerHTML = html;
    lastHTML = html;
    updateJitterList();

    let tipY = document.getElementById("tipContainer").getBoundingClientRect().top;
    let containerY = document.getElementById("taskContainer").getBoundingClientRect().top;
    document.getElementById("taskContainer").style.height = (tipY - containerY-50) + "px";
}

function completeTask(index) {
    console.log("marking task complete " + index);
    POST("/completeTask", {
        "index": index,
        "name": cookies.session.name
    }).then((res) => {
        onGameUpdate(res.game);
    }).catch((err) => {
        ERROR(err);
    })
}

addWSListener((data) => {
    if(data.type == "update")
        updateGame();
});

function endRound() {
    POST("/endRound", {}).then((data) => {

    }).catch((err) => {

    });
}