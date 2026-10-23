// Packfit bag-check engine. Pure functions, no DOM, so the tests run in Node.
//
// The job is small and the rules are fiddly, so they live in one place:
//
//   1. Size. A cabin bag is usually checked on each side (with the wheels and
//      handles on it), so the longest side of your bag has to fit the longest
//      side the airline allows, and so on down. A hold bag is usually checked
//      on the three sides added up (the "linear" size), because it goes in a
//      hold, not a sized frame. So the engine has two size modes: "each" and
//      "linear".
//   2. Weight. Some airlines weigh the cabin bag, some don't. A hold bag has a
//      limit (23 kg is the common one); over that you pay, and past 32 kg most
//      airlines won't take one bag at all, for the people who lift it.
//
// No fees are made up here. If you type in what your airline charges for an
// over bag, the engine adds it up; if you don't, it just tells you a fee will
// apply. Airlines change these numbers, so the page always says to check.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PackfitEngine = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var CM_PER_INCH = 2.54;
  var LB_PER_KG = 2.2046226218;
  // Past this, most airlines won't accept a single bag (handler safety).
  var MAX_SINGLE_BAG_KG = 32;

  function num(v, fallback) {
    var n = typeof v === "number" ? v : parseFloat(v);
    if (!isFinite(n)) return fallback === undefined ? 0 : fallback;
    return n;
  }

  function round(n, dp) {
    var f = Math.pow(10, dp === undefined ? 2 : dp);
    return Math.round(num(n) * f) / f;
  }

  // Turn a length into cm. unit is "cm" or "in".
  function toCm(value, unit) {
    var n = num(value);
    return unit === "in" ? n * CM_PER_INCH : n;
  }

  // Turn a weight into kg. unit is "kg" or "lb".
  function toKg(value, unit) {
    var n = num(value);
    return unit === "lb" ? n / LB_PER_KG : n;
  }

  function sortedDesc(arr) {
    return arr.map(function (x) { return num(x); }).sort(function (a, b) { return b - a; });
  }

  function linear(dims) {
    return dims.reduce(function (s, x) { return s + num(x); }, 0);
  }

  // Compare a bag's three sides to an allowance.
  //  - "each" mode: match longest-to-longest, so turning the bag can't cheat it.
  //  - "linear" mode: the three sides added up against one number.
  // Returns what's over and the smallest trim that would make it fit.
  function checkSize(bagDims, allowance) {
    var mode = allowance.sizeMode === "linear" ? "linear" : "each";
    var bag = sortedDesc(bagDims);

    if (mode === "linear") {
      var bagLinear = round(linear(bag), 1);
      var maxLinear = num(allowance.maxLinearCm);
      var over = round(bagLinear - maxLinear, 1);
      return {
        mode: "linear",
        ok: over <= 0,
        linearCm: bagLinear,
        maxLinearCm: maxLinear,
        linearOverCm: over > 0 ? over : 0,
        // To fit, shave this much off any mix of sides. Shown on the longest.
        trimCm: over > 0 ? over : 0,
        overBy: null
      };
    }

    var max = sortedDesc([allowance.maxCm[0], allowance.maxCm[1], allowance.maxCm[2]]);
    var overBy = [0, 0, 0];
    var worst = 0;
    var ok = true;
    for (var i = 0; i < 3; i++) {
      var d = round(bag[i] - max[i], 1);
      if (d > 0) {
        overBy[i] = d;
        ok = false;
        if (d > worst) worst = d;
      }
    }
    return {
      mode: "each",
      ok: ok,
      bagSorted: bag,
      maxSorted: max,
      overBy: overBy,
      // Trimming the worst side by this much is the smallest change that fits,
      // because the sides are judged one by one.
      trimCm: round(worst, 1)
    };
  }

  // Weight check. maxKg null/0 means the airline doesn't weigh this bag.
  function checkWeight(kg, maxKg) {
    var w = num(kg);
    if (!maxKg) {
      return { checked: false, ok: true, kg: round(w, 1), overKg: 0, cls: "notweighed" };
    }
    var limit = num(maxKg);
    var over = round(w - limit, 1);
    var cls;
    if (over <= 0) cls = "ok";
    else if (w <= MAX_SINGLE_BAG_KG) cls = "overweight"; // fee territory
    else cls = "refused"; // one bag over 32 kg usually isn't taken
    return {
      checked: true,
      ok: over <= 0,
      kg: round(w, 1),
      maxKg: limit,
      overKg: over > 0 ? over : 0,
      cls: cls
    };
  }

  // Full check of one bag against one allowance, with any fees the user gave.
  // fees: { overweight: number, oversize: number } in the airline's currency.
  function checkBag(bag, allowance, fees) {
    fees = fees || {};
    var dims = [toCm(bag.l, bag.unit), toCm(bag.w, bag.unit), toCm(bag.h, bag.unit)];
    var size = checkSize(dims, allowance);
    var weight = checkWeight(toKg(bag.kg, bag.weightUnit), allowance.maxKg);

    var feeLines = [];
    var feeTotal = 0;
    if (!size.ok) {
      var f = num(fees.oversize);
      if (f > 0) { feeTotal += f; feeLines.push({ kind: "oversize", amount: round(f, 2) }); }
      else feeLines.push({ kind: "oversize", amount: null });
    }
    if (weight.checked && !weight.ok) {
      if (weight.cls === "refused") {
        feeLines.push({ kind: "refused", amount: null });
      } else {
        var g = num(fees.overweight);
        if (g > 0) { feeTotal += g; feeLines.push({ kind: "overweight", amount: round(g, 2) }); }
        else feeLines.push({ kind: "overweight", amount: null });
      }
    }

    return {
      allowance: allowance.name,
      type: allowance.type,
      fits: size.ok && weight.ok,
      size: size,
      weight: weight,
      feeLines: feeLines,
      feeTotal: round(feeTotal, 2),
      refused: weight.cls === "refused"
    };
  }

  // Check one bag against several allowances (e.g. cabin and checked on the
  // same airline, or a few airlines) and sort so the ones that fit come first,
  // then by the smallest fix needed.
  function compare(bag, allowances, fees) {
    var rows = allowances.map(function (a) { return checkBag(bag, a, fees); });
    rows.sort(function (a, b) {
      if (a.fits !== b.fits) return a.fits ? -1 : 1;
      if (a.refused !== b.refused) return a.refused ? 1 : -1;
      var am = (a.size.trimCm || 0) + (a.weight.overKg || 0);
      var bm = (b.size.trimCm || 0) + (b.weight.overKg || 0);
      return am - bm;
    });
    return rows;
  }

  return {
    CM_PER_INCH: CM_PER_INCH,
    LB_PER_KG: LB_PER_KG,
    MAX_SINGLE_BAG_KG: MAX_SINGLE_BAG_KG,
    toCm: toCm,
    toKg: toKg,
    round: round,
    linear: linear,
    sortedDesc: sortedDesc,
    checkSize: checkSize,
    checkWeight: checkWeight,
    checkBag: checkBag,
    compare: compare
  };
});
