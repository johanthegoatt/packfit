// Packfit's wiring. Reads the bag and the airline, recomputes on every
// keystroke, draws a plain yes or no per bag, and keeps Stow in the loop.
// Nothing is sent anywhere: the share link carries the whole thing in the
// address itself.
(function () {
  "use strict";
  var E = window.PackfitEngine;
  var D = window.PackfitData;
  var Stow = window.Stow || { react: function () {}, context: function () {}, say: function () {} };

  var $ = function (id) { return document.getElementById(id); };

  var lenUnit = "cm";   // "cm" | "in"
  var wtUnit = "kg";    // "kg" | "lb"
  var currency = "$";

  // ---- units + formatting ----
  function fmtLen(cm) {
    if (lenUnit === "in") return E.round(cm / E.CM_PER_INCH, 1) + " in";
    return E.round(cm, 1) + " cm";
  }
  function fmtWt(kg) {
    if (wtUnit === "lb") return E.round(kg * E.LB_PER_KG, 1) + " lb";
    return E.round(kg, 1) + " kg";
  }
  function setLenUnit(u) {
    lenUnit = u === "in" ? "in" : "cm";
    Array.prototype.forEach.call(document.querySelectorAll(".u-len"), function (s) {
      s.textContent = "(" + (lenUnit === "in" ? "in" : "cm") + ")";
    });
    toggleButtons("len-unit", lenUnit);
  }
  function setWtUnit(u) {
    wtUnit = u === "lb" ? "lb" : "kg";
    Array.prototype.forEach.call(document.querySelectorAll(".u-wt"), function (s) {
      s.textContent = "(" + wtUnit + ")";
    });
    toggleButtons("wt-unit", wtUnit);
  }
  function toggleButtons(groupId, unit) {
    Array.prototype.forEach.call($(groupId).querySelectorAll("button"), function (b) {
      b.setAttribute("aria-pressed", b.getAttribute("data-unit") === unit ? "true" : "false");
    });
  }

  // ---- read inputs ----
  function numVal(id) {
    var v = $(id).value.trim();
    return v === "" ? null : (parseFloat(v) || 0);
  }

  function readBag() {
    return {
      l: numVal("bag-l"), w: numVal("bag-w"), h: numVal("bag-h"), kg: numVal("bag-kg"),
      unit: lenUnit, weightUnit: wtUnit
    };
  }
  function haveBag(bag) {
    return bag.l != null && bag.w != null && bag.h != null && bag.l > 0 && bag.w > 0 && bag.h > 0;
  }

  function readFees() {
    return { overweight: numVal("fee-weight") || 0, oversize: numVal("fee-size") || 0 };
  }

  // Build the list of allowances to check against. The custom option reads the
  // numbers in the user's chosen units and converts to cm/kg for the engine.
  function allowances() {
    var id = $("airline").value;
    if (id === "custom") {
      var out = [];
      var cl = numVal("c-l"), cw = numVal("c-w"), ch = numVal("c-h");
      if (cl && cw && ch) {
        out.push({
          name: "Cabin bag", type: "cabin", sizeMode: "each",
          maxCm: [E.toCm(cl, lenUnit), E.toCm(cw, lenUnit), E.toCm(ch, lenUnit)],
          maxKg: numVal("c-kg") ? E.toKg(numVal("c-kg"), wtUnit) : null
        });
      }
      var hl = numVal("h-linear");
      if (hl) {
        out.push({
          name: "Hold bag", type: "checked", sizeMode: "linear",
          maxLinearCm: E.toCm(hl, lenUnit),
          maxKg: numVal("h-kg") ? E.toKg(numVal("h-kg"), wtUnit) : null
        });
      }
      return out;
    }
    var a = D.byId(id);
    return a ? a.allowances : [];
  }

  // ---- render ----
  function recompute() {
    var bag = readBag();
    var ready = haveBag(bag);
    $("empty").hidden = ready;
    $("custom-wrap").hidden = $("airline").value !== "custom";

    if (!ready) {
      $("cards").innerHTML = "";
      $("sub").textContent = "";
      Stow.context({ ready: false, result: false, bad: false });
      saveToHash();
      return;
    }

    var allow = allowances();
    if (!allow.length) {
      $("cards").innerHTML = "";
      $("sub").textContent = $("airline").value === "custom"
        ? "Type at least one limit on the right to check against."
        : "";
      Stow.context({ ready: true, result: false, bad: false });
      saveToHash();
      return;
    }

    var rows = E.compare(bag, allow, readFees());
    var anyFits = rows.some(function (r) { return r.fits; });
    var anyRefused = rows.some(function (r) { return r.refused; });

    $("sub").textContent = anyFits
      ? "It fits at least one way below."
      : "It's over on every option here. The fix is on each one.";

    $("cards").innerHTML = "";
    rows.forEach(function (r) { $("cards").appendChild(renderCard(r)); });

    Stow.context({ ready: true, result: true, bad: !anyFits });
    if (anyRefused) Stow.react("refused");
    else if (anyFits) Stow.react("fits");
    else Stow.react("over");

    saveToHash();
  }

  function renderCard(r) {
    var el = document.createElement("div");
    var cls = r.refused ? "refused" : (r.fits ? "fits" : "over");
    el.className = "rescard " + cls;

    var verdictText = r.refused ? "Too heavy" : (r.fits ? "Fits" : "Over");
    var typeLabel = r.type === "cabin" ? "cabin" : r.type === "personal" ? "personal item" : "hold";

    var lines = [];
    // size line
    if (r.size.mode === "linear") {
      var sizeOk = r.size.ok;
      lines.push(line("Size (three sides)",
        fmtLen(r.size.linearCm) + " vs " + fmtLen(r.size.maxLinearCm) + " max",
        sizeOk ? "ok" : "over"));
    } else {
      lines.push(line("Size (each side)",
        r.size.ok ? "every side fits" : "a side is over",
        r.size.ok ? "ok" : "over"));
    }
    // weight line
    if (r.weight.checked) {
      lines.push(line("Weight",
        fmtWt(r.weight.kg) + " vs " + fmtWt(r.weight.maxKg) + " max",
        r.weight.ok ? "ok" : "over"));
    } else {
      lines.push(line("Weight", "not weighed on this bag", "ok"));
    }

    var fix = fixAdvice(r);

    el.innerHTML =
      '<div class="rescard-top">' +
        "<h3>" + esc(r.allowance) + ' <small style="font-weight:500;color:var(--ink-2)">(' + typeLabel + ")</small></h3>" +
        '<span class="verdict ' + cls + '">' + verdictText + "</span>" +
      "</div>" +
      '<ul class="lines">' + lines.join("") + "</ul>" +
      (fix ? '<p class="fix">' + fix + "</p>" : "") +
      (r.note ? '<p class="note">' + esc(r.note) + "</p>" : "");
    return el;
  }

  function line(k, v, cls) {
    return '<li><span class="k">' + esc(k) + ':</span> <span class="v ' + cls + '">' + esc(v) + "</span></li>";
  }

  // The plain-words fix for a bag that doesn't fit.
  function fixAdvice(r) {
    if (r.fits) return "";
    var parts = [];
    if (!r.size.ok) {
      if (r.size.mode === "linear") {
        parts.push("Lose <b>" + fmtLen(r.size.trimCm) + "</b> across the three sides to fit.");
      } else {
        parts.push("Shave <b>" + fmtLen(r.size.trimCm) + "</b> off the longest side that's over.");
      }
    }
    if (r.weight.checked && !r.weight.ok) {
      if (r.refused) {
        parts.push("At " + fmtWt(r.weight.kg) + " it's past the " + E.MAX_SINGLE_BAG_KG +
          " kg a single bag can be, so most airlines won't take it. Split it into two.");
      } else {
        parts.push("Lift out <b>" + fmtWt(r.weight.overKg) + "</b>, or expect an overweight fee.");
      }
    }
    if (r.feeTotal > 0) {
      parts.push("As you've typed the fees, that's about <b>" + money(r.feeTotal) + "</b>.");
    }
    return parts.join(" ");
  }

  function money(n) {
    return currency + n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  // ---- copy + share ----
  function plainText() {
    var bag = readBag();
    if (!haveBag(bag)) return "Type your bag's size first.";
    var rows = E.compare(bag, allowances(), readFees());
    var out = ["Will my bag fit? (Packfit)", ""];
    out.push("Bag: " + fmtLen(E.toCm(bag.l, lenUnit)) + " x " + fmtLen(E.toCm(bag.w, lenUnit)) +
      " x " + fmtLen(E.toCm(bag.h, lenUnit)) + (bag.kg != null ? ", " + fmtWt(E.toKg(bag.kg, wtUnit)) : ""));
    out.push("");
    rows.forEach(function (r) {
      var v = r.refused ? "too heavy" : (r.fits ? "FITS" : "over");
      out.push("- " + r.allowance + " (" + r.type + "): " + v);
      var fix = fixAdvice(r).replace(/<\/?b>/g, "");
      if (fix) out.push("    " + fix);
    });
    out.push("");
    out.push("Always check your own booking; airlines change these.");
    return out.join("\n");
  }

  function copyText(text, okMsg, reaction) {
    var done = function () { status(okMsg); Stow.react(reaction); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text, done); });
    } else { fallbackCopy(text, done); }
  }
  function fallbackCopy(text, done) {
    var ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); done(); } catch (e) { status("Couldn't copy, sorry."); }
    ta.remove();
  }
  function status(msg) {
    var el = $("status"); el.textContent = msg;
    clearTimeout(status._t); status._t = setTimeout(function () { el.textContent = ""; }, 4000);
  }

  // ---- state in the URL hash ----
  function saveToHash() {
    try {
      var state = {
        lu: lenUnit, wu: wtUnit, cur: currency,
        b: [$("bag-l").value, $("bag-w").value, $("bag-h").value, $("bag-kg").value],
        air: $("airline").value,
        c: [$("c-l").value, $("c-w").value, $("c-h").value, $("c-kg").value, $("h-linear").value, $("h-kg").value],
        f: [$("fee-weight").value, $("fee-size").value]
      };
      var enc = btoa(unescape(encodeURIComponent(JSON.stringify(state))));
      history.replaceState(null, "", "#" + enc);
    } catch (e) {}
  }
  function loadFromHash() {
    var h = location.hash.replace(/^#/, "");
    if (!h) return false;
    try {
      var s = JSON.parse(decodeURIComponent(escape(atob(h))));
      if (s.lu) setLenUnit(s.lu);
      if (s.wu) setWtUnit(s.wu);
      if (s.cur) { currency = s.cur; $("cur").value = s.cur; }
      if (s.b) { $("bag-l").value = s.b[0] || ""; $("bag-w").value = s.b[1] || ""; $("bag-h").value = s.b[2] || ""; $("bag-kg").value = s.b[3] || ""; }
      if (s.air) $("airline").value = s.air;
      if (s.c) { $("c-l").value = s.c[0] || ""; $("c-w").value = s.c[1] || ""; $("c-h").value = s.c[2] || ""; $("c-kg").value = s.c[3] || ""; $("h-linear").value = s.c[4] || ""; $("h-kg").value = s.c[5] || ""; }
      if (s.f) { $("fee-weight").value = s.f[0] || ""; $("fee-size").value = s.f[1] || ""; }
      return !!(s.b && s.b[0]);
    } catch (e) { return false; }
  }

  // ---- airline menu ----
  function fillAirlines() {
    var sel = $("airline");
    D.AIRLINES.forEach(function (a) {
      var o = document.createElement("option");
      o.value = a.id; o.textContent = a.label;
      sel.appendChild(o);
    });
    var c = document.createElement("option");
    c.value = D.CUSTOM.id; c.textContent = D.CUSTOM.label;
    sel.appendChild(c);
  }

  // ---- wire up ----
  fillAirlines();

  function recomputeLiquids() {
    var host = $("liq-out");
    if (!host) return;
    var raw = ($("liq-list").value || "").split(/[,;]+/).map(function (x) { return x.trim(); }).filter(Boolean);
    if (!raw.length) { host.innerHTML = ""; return; }
    var containers = raw.map(function (x) { return { ml: parseFloat(x) }; }).filter(function (c) { return isFinite(c.ml) && c.ml > 0; });
    var r = E.checkLiquids({ region: $("liq-region").value, unit: $("liq-unit").value, containers: containers });
    if (!r.items.length) { host.innerHTML = ""; return; }
    var cls = r.ok ? "ok" : "no";
    var head = r.ok ? "All good for cabin"
      : !r.allUnderLimit ? (r.oversizeCount + (r.oversizeCount === 1 ? " bottle is" : " bottles are") + " over 100 ml")
      : "Too much to fit one bag";
    var pills = r.items.map(function (it) {
      return '<span class="liq-pill ' + (it.over ? "over" : "under") + '">' + it.ml + ' ml' + (it.over ? " ✕" : "") + '</span>';
    }).join(" ");
    var msg;
    if (!r.allUnderLimit) msg = "Bottles over 100 ml have to go in a checked bag. Only the 100 ml and under ones can come in the cabin bag.";
    else if (!r.likelyFits) msg = "That's " + r.compliantMl + " ml of liquids. " + r.bagLabel + " realistically holds about " + r.usableMl + " ml of bottles, so some will have to go in the hold.";
    else msg = "All " + r.compliantCount + " fit the limit and should go in " + r.bagLabel + " (" + r.compliantMl + " ml of " + r.usableMl + " ml usable).";
    host.innerHTML = '<div class="liq-result ' + cls + '"><div class="liq-head">' + head + '</div>' +
      '<div class="liq-pills">' + pills + '</div><p class="liq-msg">' + msg + '</p></div>';
  }

  Array.prototype.forEach.call($("len-unit").querySelectorAll("button"), function (b) {
    b.addEventListener("click", function () { setLenUnit(b.getAttribute("data-unit")); recompute(); });
  });
  Array.prototype.forEach.call($("wt-unit").querySelectorAll("button"), function (b) {
    b.addEventListener("click", function () { setWtUnit(b.getAttribute("data-unit")); recompute(); });
  });

  ["bag-l", "bag-w", "bag-h", "bag-kg", "c-l", "c-w", "c-h", "c-kg", "h-linear", "h-kg", "fee-weight", "fee-size"].forEach(function (id) {
    $(id).addEventListener("input", recompute);
  });
  $("airline").addEventListener("change", function () { Stow.react("airline"); recompute(); });
  ["liq-list", "liq-unit", "liq-region"].forEach(function (id) { var e = $(id); if (e) e.addEventListener("input", recomputeLiquids); if (e) e.addEventListener("change", recomputeLiquids); });
  $("cur").addEventListener("change", function () { currency = $("cur").value || "$"; recompute(); });

  $("copy").addEventListener("click", function () {
    if (!haveBag(readBag())) { status("Type your bag's size first."); return; }
    copyText(plainText(), "Copied the answer.", "copied");
  });
  $("share").addEventListener("click", function () {
    copyText(location.href, "Share link copied.", "shared");
  });

  // Start: reopen a shared check, or seed a carry-on so the page isn't blank.
  var loaded = loadFromHash();
  if (!loaded) {
    setLenUnit("cm"); setWtUnit("kg");
    $("bag-l").value = "55"; $("bag-w").value = "40"; $("bag-h").value = "23"; $("bag-kg").value = "9";
    $("airline").value = "american";
  }
  recompute();
  recomputeLiquids();
})();
