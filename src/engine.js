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

  // Two bags, one over the limit. If the total across your bags fits within the
  // allowance (number of bags x the per-bag limit), you don't pay an excess fee,
  // you just move weight from the heavy bag to the light one. This works out
  // whether that's possible and, for the common two-bag case, how much to shift
  // so neither bag is over. weights is a list of bag weights in kg.
  function rebalance(weights, maxKg) {
    var limit = num(maxKg);
    var w = (Array.isArray(weights) ? weights : []).map(function (x) { return num(x); }).filter(function (x) { return x >= 0; });
    if (!(limit > 0) || w.length < 2) return null;
    var total = w.reduce(function (s, x) { return s + x; }, 0);
    var n = w.length;
    var capacity = limit * n;
    var feasible = total <= capacity + 1e-9;
    var anyOver = w.some(function (x) { return x > limit + 1e-9; });
    var move = null;
    if (n === 2) {
      var hi = Math.max(w[0], w[1]);
      move = (hi > limit + 1e-9 && feasible) ? round(hi - limit, 1) : 0;
    }
    return {
      total: round(total, 1),
      n: n,
      maxKg: limit,
      capacity: round(capacity, 1),
      feasible: feasible,
      anyOver: anyOver,
      evenKg: round(total / n, 1),
      headroomKg: round(capacity - total, 1),
      moveKg: move
    };
  }

  // Cabin liquids, the "3-1-1" rule. Two things have to be true: every
  // container is 100 ml (3.4 oz) or less, AND they all fit in one small clear
  // resealable bag (a quart bag in the US, about 0.95 L; a 1-litre bag in the
  // EU/UK). The size printed on the bottle is what counts, not how full it is,
  // so a half-used 200 ml bottle still fails. Medicines and baby food are
  // generally allowed over the limit but may be checked separately, so they're
  // left out of the count. The bag can't be packed to the brim, so the fit
  // check allows roughly 70% of the bag to be usable for bottles.
  var LIQUID_LIMIT_ML = 100;
  var ML_PER_OZ = 29.5735;
  var LIQUID_BAGS = {
    us: { ml: 946, label: "one quart bag (about 0.95 L)" },
    eu: { ml: 1000, label: "one 1-litre bag" }
  };

  function toMl(value, unit) {
    var n = num(value);
    return unit === "oz" ? n * ML_PER_OZ : n;
  }

  function checkLiquids(opts) {
    opts = opts || {};
    var region = opts.region === "eu" ? "eu" : "us";
    var bag = LIQUID_BAGS[region];
    var unit = opts.unit === "oz" ? "oz" : "ml";
    var list = Array.isArray(opts.containers) ? opts.containers : [];

    var items = [], compliantCount = 0, oversizeCount = 0, compliantMl = 0;
    list.forEach(function (c) {
      var raw = c && c.ml != null ? c.ml : c;
      var ml = toMl(raw, unit);
      if (!(ml > 0)) return;
      var name = c && c.name ? String(c.name) : null;
      // 1 ml of slack so a 3.4 oz bottle (100.5 ml), which the rules treat as
      // 100 ml, isn't failed on a rounding.
      var over = ml > LIQUID_LIMIT_ML + 1 + 1e-9;
      if (over) oversizeCount++; else { compliantCount++; compliantMl += ml; }
      items.push({ ml: round(ml, 0), name: name, over: over });
    });

    var usable = bag.ml * 0.7;
    var likelyFits = compliantMl <= usable + 1e-9;
    return {
      region: region,
      limitMl: LIQUID_LIMIT_ML,
      bagMl: bag.ml,
      bagLabel: bag.label,
      items: items,
      compliantCount: compliantCount,
      oversizeCount: oversizeCount,
      compliantMl: round(compliantMl, 0),
      usableMl: round(usable, 0),
      allUnderLimit: oversizeCount === 0,
      likelyFits: likelyFits,
      ok: oversizeCount === 0 && likelyFits && items.length > 0
    };
  }

  // Powders are a separate rule from liquids. On flights to the United States a
  // powder-like item of 12 oz / 350 ml or more in the cabin gets pulled for
  // extra screening, and if the officer can't clear it, it won't be allowed on
  // board and is thrown away, so a big tub of protein, loose make-up or similar
  // is better in the hold. There's no general cabin limit on powders outside the
  // US, but the US rule catches people on connecting and outbound flights.
  // Baby formula, medicines and ashes are exempt. Threshold in millilitres.
  var POWDER_LIMIT_ML = 350;

  function checkPowders(opts) {
    opts = opts || {};
    var unit = opts.unit === "oz" ? "oz" : "ml";
    var list = Array.isArray(opts.containers) ? opts.containers : [];
    var items = [], overCount = 0;
    list.forEach(function (c) {
      var raw = c && c.ml != null ? c.ml : c;
      var ml = toMl(raw, unit);
      if (!(ml > 0)) return;
      // A little slack so a 12 oz tub (354 ml), which the rule treats as the
      // threshold, isn't flagged as over when someone types 350.
      var over = ml >= POWDER_LIMIT_ML - 1e-9;
      if (over) overCount++;
      items.push({ ml: round(ml, 0), over: over });
    });
    return {
      limitMl: POWDER_LIMIT_ML,
      usRule: opts.usBound !== false,
      items: items,
      overCount: overCount,
      // ok means nothing needs the hold: either no big powders, or you're not
      // flying to/through the US so the rule doesn't bite.
      allUnderLimit: overCount === 0,
      ok: items.length > 0 && (overCount === 0 || opts.usBound === false)
    };
  }

  return {
    CM_PER_INCH: CM_PER_INCH,
    LB_PER_KG: LB_PER_KG,
    MAX_SINGLE_BAG_KG: MAX_SINGLE_BAG_KG,
    LIQUID_LIMIT_ML: LIQUID_LIMIT_ML,
    LIQUID_BAGS: LIQUID_BAGS,
    POWDER_LIMIT_ML: POWDER_LIMIT_ML,
    toMl: toMl,
    checkLiquids: checkLiquids,
    checkPowders: checkPowders,
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
