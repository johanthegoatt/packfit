// Stow, the little suitcase who tells you if your bag's going to be a problem.
// Stow watches your pointer (or the box you're typing in on a phone), gives a
// tip when tapped, hops when a bag fits, looks worried when it's over, and
// throws off a few paper planes if you tap five times fast. Everything Stow
// says goes through the bubble's live region, so screen readers hear it too.
(function () {
  "use strict";
  var btn = document.getElementById("stow");
  var bubble = document.getElementById("stow-bubble");
  var dock = document.getElementById("stow-dock");
  var hide = document.getElementById("stow-hide");
  if (!btn) {
    window.Stow = { react: function () {}, context: function () {}, say: function () {} };
    return;
  }

  var still = matchMedia("(prefers-reduced-motion: reduce)");
  var baseMood = "sleepy", tipKey = "start";
  var flashing = false, flashTimer = null, bubbleTimer = null, tapTimes = [], tipIndex = {};
  var greeted = false;

  var TIPS = {
    start: [
      "Hi, I'm Stow! Pop in your bag's size and weight, then pick the airline.",
      "Measure the widest points, wheels and handles and all. That's what the gate sizer catches.",
      "No scales? Stand on them holding the bag, then on your own, and take the difference."
    ],
    details: [
      "A cabin bag is checked side by side, so turning it doesn't help.",
      "A hold bag is usually checked on the three sides added up. That's the 'total' number.",
      "If your airline isn't listed, pick 'My airline' and type the limits straight in."
    ],
    result: [
      "Green means it fits. Amber means it's over, and I've put the fix right under it.",
      "Over by a little? A softer bag or moving a heavy thing to your coat often does it.",
      "These are the published numbers. Your fare or route can differ, so check your booking too."
    ]
  };

  function setMood(m) { btn.setAttribute("data-mood", m); }

  function say(text, ms) {
    if (dock.classList.contains("tucked")) return;
    bubble.textContent = text;
    bubble.classList.remove("pop");
    void bubble.offsetWidth;
    bubble.classList.add("pop");
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(function () { bubble.textContent = ""; }, ms || 7000);
  }

  function flash(m, ms) {
    setMood(m);
    flashing = true;
    clearTimeout(flashTimer);
    flashTimer = setTimeout(function () { flashing = false; setMood(baseMood); }, ms || 1400);
  }

  function play(cls) {
    if (still.matches) return;
    btn.classList.remove("hop", "buzz");
    void btn.offsetWidth;
    btn.classList.add(cls);
  }
  btn.addEventListener("animationend", function () { btn.classList.remove("hop", "buzz"); });

  function context(c) {
    if (c.bad) { tipKey = "result"; baseMood = "worried"; }
    else if (!c.ready) { tipKey = "start"; baseMood = "sleepy"; }
    else if (!c.result) { tipKey = "details"; baseMood = "happy"; }
    else { tipKey = "result"; baseMood = "happy"; }
    if (!flashing) setMood(baseMood);
    if (!greeted) {
      greeted = true;
      setTimeout(function () { if (!bubble.textContent && baseMood === "sleepy") say(TIPS.start[0], 9000); }, 900);
    }
  }

  function nextTip() {
    var list = TIPS[tipKey] || TIPS.result;
    var i = tipIndex[tipKey] || 0;
    tipIndex[tipKey] = (i + 1) % list.length;
    return list[i];
  }

  btn.addEventListener("click", function () {
    if (dock.classList.contains("tucked")) {
      dock.classList.remove("tucked");
      remember(false);
      say("I'm back! Tap me any time for a tip.");
      play("hop");
      return;
    }
    var now = Date.now();
    tapTimes = tapTimes.filter(function (t) { return now - t < 1600; });
    tapTimes.push(now);
    if (tapTimes.length >= 5) {
      tapTimes = [];
      play("buzz");
      flash("wow", 1200);
      sparkle(8);
      say("Wheee! Mind the overhead locker.");
      return;
    }
    play("hop");
    if (baseMood === "sleepy") flash("happy", 1600);
    say(nextTip());
  });

  hide.addEventListener("click", function () {
    dock.classList.add("tucked");
    bubble.textContent = "";
    remember(true);
  });

  function remember(tucked) {
    try { localStorage.setItem("packfit.stowTucked", tucked ? "1" : ""); } catch (e) {}
  }
  try { if (localStorage.getItem("packfit.stowTucked")) dock.classList.add("tucked"); } catch (e) {}

  // Eyes follow the pointer, a few pixels at most.
  var pupils = btn.querySelectorAll(".s-pupil");
  var target = null, frame = 0;
  function look() {
    frame = 0;
    if (!target) return;
    var r = btn.getBoundingClientRect();
    var cx = r.left + r.width / 2, cy = r.top + r.height * 0.66;
    var dx = target.x - cx, dy = target.y - cy;
    var d = Math.hypot(dx, dy) || 1;
    var reach = Math.min(1, d / 220);
    var x = (dx / d) * 3 * reach, y = (dy / d) * 3 * reach;
    pupils.forEach(function (p) { p.style.transform = "translate(" + x.toFixed(2) + "px," + y.toFixed(2) + "px)"; });
  }
  window.addEventListener("pointermove", function (ev) {
    target = { x: ev.clientX, y: ev.clientY };
    if (!frame) frame = requestAnimationFrame(look);
  }, { passive: true });
  document.addEventListener("focusin", function (ev) {
    var r = ev.target.getBoundingClientRect && ev.target.getBoundingClientRect();
    if (!r || ev.target === btn) return;
    target = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    if (!frame) frame = requestAnimationFrame(look);
  });

  (function blink() {
    setTimeout(function () {
      if (baseMood !== "sleepy" && !document.hidden) {
        btn.classList.add("blink");
        setTimeout(function () { btn.classList.remove("blink"); }, 140);
      }
      blink();
    }, 2600 + Math.random() * 3800);
  })();

  // A few little paper planes fly off the case.
  function sparkle(n) {
    if (still.matches) return;
    var r = btn.getBoundingClientRect();
    for (var i = 0; i < n; i++) {
      var s = document.createElement("span");
      s.className = "spark";
      s.textContent = "✈";
      s.style.position = "fixed";
      s.style.pointerEvents = "none";
      s.style.zIndex = "7";
      s.style.left = r.left + r.width * (0.3 + Math.random() * 0.4) + "px";
      s.style.top = r.top + r.height * 0.3 + "px";
      s.style.fontSize = (12 + Math.random() * 12) + "px";
      document.body.appendChild(s);
      var dx = (Math.random() - 0.5) * 220, dy = -(60 + Math.random() * 160);
      var a = s.animate([
        { transform: "translate(0,0) scale(0.4) rotate(0deg)", opacity: 1 },
        { transform: "translate(" + dx * 0.6 + "px," + dy + "px) scale(1.1) rotate(60deg)", opacity: 1, offset: 0.6 },
        { transform: "translate(" + dx + "px," + (dy + 180) + "px) scale(0.6) rotate(120deg)", opacity: 0 }
      ], { duration: 1200 + Math.random() * 600, easing: "ease-out" });
      a.onfinish = (function (node) { return function () { node.remove(); }; })(s);
    }
  }

  var lastVerdict = "";
  function react(what) {
    switch (String(what)) {
      case "fits":
        if (lastVerdict !== "fits") { play("hop"); flash("party", 1400); say("It fits! You're good to go."); }
        lastVerdict = "fits"; break;
      case "over":
        if (lastVerdict !== "over") { flash("worried", 1300); say("It's over. The fix is right under each one."); }
        lastVerdict = "over"; break;
      case "refused":
        flash("wow", 1300); say("That one's too heavy for a single bag. Best to split it."); lastVerdict = "refused"; break;
      case "airline": play("hop"); break;
      case "copied": play("hop"); flash("party", 1200); say("Copied! Paste it wherever you like."); break;
      case "shared": play("hop"); say("Link copied. It carries your bag and airline, nothing else."); break;
    }
  }

  window.Stow = { react: react, context: context, say: say };
})();
