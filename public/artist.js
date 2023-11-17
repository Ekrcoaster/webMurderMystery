function GET(url) {
    return new Promise((resolve, reject) => {
        fetch(url).then(res => res.json()).then((data) => {
            if(data.error)
                reject(data.error);
            else 
                resolve(data);
        }).catch((err) => {
            reject(err);
        });
    });
}

function POST(url, data) {
    return new Promise((resolve, reject) => {
        fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            }, 
            body: JSON.stringify(data)
        }).then(res => res.json()).then((data) => {
            if(data.error)
                reject(data.error);
            else 
                resolve(data);
        }).catch((err) => {
            reject(err);
        });
    });

}

function ERROR(text) {
    alert(text);
}

function GET_COOKIES() {
    let raw = Object.fromEntries(new URLSearchParams(document.cookie.replace(/; /g, "&")));

    let cookies = {}
    for(let id in raw) {
        if(raw[id].startsWith("j:"))
            cookies[id] = JSON.parse(raw[id].substring(2));
        else
            cookies[id] = raw[id];
    }
    return cookies;
}

function SETUP_WEBSOCKET() {
    let ws = new WebSocket('wss://4fba-2601-500-8681-7150-d14d-9ea1-4311-57d3.ngrok-free.app');
    ws.onmessage = (event) => {
        ON_WEBSOCKET(JSON.parse(event.data));
    }
    ws.onopen = (event) => {
        console.log("Connected to Websocket!");
        ws.send(JSON.stringify({
            type: "join",
            session: GET_COOKIES().session
        }));
    }
    ws.onclose = (event) => {
        console.log("Disconnected from Websocket");
    }
    ws.onerror = (event) => {
        console.log("Error connecting to Websocket", event);
    }
    return ws;
}

function ON_WEBSOCKET(data) {   
    console.log(data);

    if(data.type == "redirect")
        window.location.href = data.url;
}