function animateBackground() {
    let img = document.getElementById("backgroundImage");
    let static = document.getElementById("staticImage");
    var jitter = document.getElementsByClassName("jitter");
    let cur = 0.5;

    const possibleImages = [
        "/backgrounds/background1.jpg",
        "/backgrounds/background2.jpg",
        "/backgrounds/background3.jpg",
        "/backgrounds/background4.jpg",
        "/backgrounds/background5.jpg"
    ]

    setPos(cur);
    setInterval(() => {
        if(Math.random() > 0.6)
            cur += Math.random() * 0.05 - 0.025;
        if(cur < 0) cur = 0;
        if(cur > 1) cur = 1;
        setPos(cur);

        if(Math.random() > 0.95)
            img.src = possibleImages[Math.floor(Math.random() * possibleImages.length)];

        img.style.filter = `brightness(${Math.random() - 0.15})`;

        if(Math.random() > 0.95)
            img.style.transform = "skew(20deg, 10deg)";
        else if(Math.random() > 0.9)
            img.style.transform = "skew(-20deg, 10deg)";
        else
            img.style.transform = "skew(0deg, 0deg)"

        static.style.opacity = Math.random() * 0.25;

    }, 200);

    setInterval(() => {
        for(let i = 0; i < jitter.length; i++) {
            let amt = 3;
            let degAmt = 1;
            if(Math.random() > 0.8)
                jitter.item(i).style.transform = `translate(${Math.random() * amt - amt/2}px, ${Math.random() * amt - amt/2}px) rotate(${Math.random() * degAmt - degAmt/2}deg)`
        }
    }, 50);

    function setPos(pos) {
        let width = document.body.clientWidth;
        let x = 0;
        x += (-2000 + width) * pos;
        img.style.left = x + "px";
    }
}