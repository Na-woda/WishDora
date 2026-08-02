const robot = document.getElementById("robot");

document.addEventListener("mousemove",(e)=>{

  const x =
    (window.innerWidth / 2 - e.clientX) / 40;

  const y =
    (window.innerHeight / 2 - e.clientY) / 40;

  robot.style.transform =
    `translate(${-x}px, ${-y}px)`;
});


// Create sparkles dynamically

const hero = document.querySelector(".hero");

for(let i=0;i<20;i++){

  const sparkle = document.createElement("span");

  sparkle.classList.add("sparkle");

  sparkle.style.left =
    Math.random()*100 + "%";

  sparkle.style.top =
    Math.random()*100 + "%";

  sparkle.style.animationDelay =
    Math.random()*5 + "s";

  hero.appendChild(sparkle);
}