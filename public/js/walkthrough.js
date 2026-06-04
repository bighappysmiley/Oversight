// Drives the animated Android setup walkthrough on the landing page.
(function () {
  const STEPS = [
    {
      role: "On your phone · dashboard",
      title: "Add a device",
      text: "Open your dashboard in any browser and tap “Add a device”. You’ll get an 8-character setup code.",
    },
    {
      role: "On the child’s phone",
      title: "Enter the setup code",
      text: "On your child’s Android phone, open the setup link and type in the code.",
    },
    {
      role: "On the child’s phone",
      title: "Download the app",
      text: "Tap “Download Oversight app”, then open the downloaded file to install it.",
    },
    {
      role: "On the child’s phone",
      title: "Approve device admin",
      text: "Activate device administrator so the app can’t be removed without your password.",
    },
    {
      role: "On the child’s phone",
      title: "Allow permissions",
      text: "Turn on “Usage access” and “Display over other apps” so app limits and downtime work.",
    },
    {
      role: "All done",
      title: "Protection is active",
      text: "That’s it! Manage web filtering, app limits and downtime from your dashboard anytime.",
    },
  ];

  const frames = Array.from(document.querySelectorAll("#wt-screen .wt-frame"));
  if (!frames.length) return;
  const dotsWrap = document.getElementById("wt-dots");
  const roleEl = document.getElementById("wt-role");
  const titleEl = document.getElementById("wt-title");
  const textEl = document.getElementById("wt-text");
  const prev = document.getElementById("wt-prev");
  const next = document.getElementById("wt-next");
  const playpause = document.getElementById("wt-playpause");

  let i = 0;
  let playing = true;
  let timer = null;
  const DURATION = 4200;

  STEPS.forEach((_, idx) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "wt-dot" + (idx === 0 ? " active" : "");
    b.setAttribute("aria-label", "Step " + (idx + 1));
    b.addEventListener("click", () => { go(idx); restart(); });
    dotsWrap.appendChild(b);
  });
  const dots = Array.from(dotsWrap.children);

  function render() {
    frames.forEach((f, idx) => f.classList.toggle("active", idx === i));
    dots.forEach((d, idx) => d.classList.toggle("active", idx === i));
    const s = STEPS[i] || {};
    roleEl.textContent = s.role || "";
    titleEl.textContent = "Step " + (i + 1) + " — " + (s.title || "");
    textEl.textContent = s.text || "";
  }

  function go(n) { i = (n + frames.length) % frames.length; render(); }
  function start() { stop(); if (playing) timer = setInterval(() => go(i + 1), DURATION); }
  function stop() { if (timer) { clearInterval(timer); timer = null; } }
  function restart() { if (playing) start(); }

  prev.addEventListener("click", () => { go(i - 1); restart(); });
  next.addEventListener("click", () => { go(i + 1); restart(); });
  playpause.addEventListener("click", () => {
    playing = !playing;
    playpause.textContent = playing ? "❙❙ Pause" : "▶ Play";
    if (playing) start(); else stop();
  });

  render();
  start();
})();
