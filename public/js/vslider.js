// Simple video carousel for the "See Oversight in action" section.
(function () {
  const slider = document.getElementById("vslider");
  if (!slider) return;
  const slides = Array.from(slider.querySelectorAll(".vslide"));
  const videos = slides.map((s) => s.querySelector("video"));
  const dotsWrap = document.getElementById("v-dots");
  const prev = document.getElementById("v-prev");
  const next = document.getElementById("v-next");
  let i = 0;

  slides.forEach((_, idx) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "vdot" + (idx === 0 ? " active" : "");
    b.setAttribute("aria-label", "Video " + (idx + 1));
    b.addEventListener("click", () => go(idx));
    dotsWrap.appendChild(b);
  });
  const dots = Array.from(dotsWrap.children);

  function go(n) {
    const current = videos[i];
    if (current) { try { current.pause(); } catch (e) {} }
    i = (n + slides.length) % slides.length;
    slides.forEach((s, idx) => s.classList.toggle("active", idx === i));
    dots.forEach((d, idx) => d.classList.toggle("active", idx === i));
  }

  prev.addEventListener("click", () => go(i - 1));
  next.addEventListener("click", () => go(i + 1));
})();
