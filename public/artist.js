function GET(url) {
    return new Promise((resolve, reject) => {
        fetch(url).then(res => res.json()).then((data) => {
            if(data.error)
                reject(data.error, url);
            else 
                resolve(data);
        }).catch((err) => {
            reject(err, url);
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
                reject(data.error, url);
            else 
                resolve(data);
        }).catch((err) => {
            reject(err, url);
        });
    });

}

function ERROR(text) {
    console.trace(text);
    if(typeof(text) == "object") text = JSON.stringify(text);
    alert(text);
}

/**@returns {{session: {expires: Number, id: String, name: String}}} */
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

/**@type {WebSocket} */
let ws = null;

let wsListeners = new Set();

function SETUP_WEBSOCKET(onOpen = () => {}) {
    // if this happens to get run while the websocket is still fine, ignore
    if(ws != null && ws.readyState != ws.CLOSED && ws.readyState != ws.CLOSING) {
        return;
        //ws.close();
    };

    ws = new WebSocket('wss://580f-2601-500-8681-7150-1c6d-f10c-e789-e596.ngrok-free.app');
    ws.onmessage = (event) => {
        ON_WEBSOCKET(JSON.parse(event.data));
    }
    ws.onopen = (event) => {
        console.log("Connected to Websocket!");
        onOpen();
        ws.send(JSON.stringify({
            type: "join",
            session: GET_COOKIES().session
        }));
    }
    ws.onclose = (event) => {
        console.log("Disconnected from Websocket");

        reconnectInterval = setTimeout(() => {
            console.log("attempting to reconnect");
            ws = null;
            SETUP_WEBSOCKET();
        }, 1000);
    }
    ws.onerror = (event) => {
        console.log("Error connecting to Websocket", event);
        
        reconnectInterval = setTimeout(() => {
            console.log("attempting to reconnect");
            ws = null;
            SETUP_WEBSOCKET();
        }, 1000);
    }
    return ws;
}

// every 5 seconds check for websocket connection
setInterval(() => {
    if(ws == null || ws.readyState == ws.CLOSED || ws.readyState == ws.CLOSING) {
        SETUP_WEBSOCKET();
    }
}, 1000*5);

const pfps = [
    "BalloonBoy.webp",
    "Bonnie.webp",
    "Chica.webp",
    "Foxy.webp",
    "FreddyFazbear.webp",
    "FuntimeFreddy.webp",
    "Mangle.webp",
    "NightmareBB.webp",
    "Plushtrap.webp",
    "ThePuppet.webp",
    "ToyBonnie.webp",
    "ToyChica.webp",
    "ToyFreddy.webp",
    "WitheredBonnie.webp",
    "WitheredChica.webp",
    "WitheredFoxy.webp",
    "WitheredFreddy.webp",
    "Ballora.webp",
    "CircusBaby.webp",
    "FuntimeFoxy.webp",
    "BidyBab.webp",
    "BonBon.webp",
    "NightmareFreddy.webp",
    "NightmareBonnie.webp",
    "NightmareChica.webp",
    "NightmareFoxy.webp",
    "NightmareFredbear.webp",
    "Nightmare.webp",
    "Nightmarionne.webp",
]

function GET_PFP(name) {
    let hash = Math.abs(hashCode(name));

    return "../assets/profilePictures/" + pfps[hash % pfps.length];

    /**
     * Returns a hash code from a string
     * @param  {String} str The string to hash.
     * @return {Number}    A 32bit integer
     */
    function hashCode(str) {
        let hash = 0;
        for (let i = 0, len = str.length; i < len; i++) {
            let chr = str.charCodeAt(i);
            hash = (hash << 5) - hash + chr;
            hash |= 0; // Convert to 32bit integer
        }
        return hash;
    }
}

function ON_WEBSOCKET(data) {   
    console.log(data);

    if(data.type == "redirect")
        window.location.href = data.url;

    wsListeners.forEach((listener) => {
        listener(data);
    });
}

function addWSListener(callback = (data) => {}) {
    wsListeners.add(callback);
}