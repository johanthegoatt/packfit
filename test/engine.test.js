"use strict";
var test = require("node:test");
var assert = require("node:assert");
var E = require("../src/engine.js");

var CABIN = { name: "Test cabin", type: "cabin", sizeMode: "each", maxCm: [55, 40, 20], maxKg: 10 };
var CHECKED = { name: "Test hold", type: "checked", sizeMode: "linear", maxLinearCm: 158, maxKg: 23 };

test("inches convert to cm", function () {
  assert.strictEqual(E.round(E.toCm(9, "in"), 2), 22.86);
  assert.strictEqual(E.toCm(55, "cm"), 55);
});

test("pounds convert to kg", function () {
  assert.strictEqual(E.round(E.toKg(50, "lb"), 1), 22.7);
  assert.strictEqual(E.toKg(23, "kg"), 23);
});

test("a bag inside every side passes in each mode", function () {
  var r = E.checkSize([54, 38, 19], CABIN);
  assert.strictEqual(r.mode, "each");
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.trimCm, 0);
});

test("turning the bag can't beat each-side mode", function () {
  // 42 on the middle axis is over the 40 allowance however you rotate it.
  var r = E.checkSize([54, 42, 19], CABIN);
  assert.strictEqual(r.ok, false);
  // longest-to-longest: 54<=55 ok, 42>40 over by 2, 19<=20 ok
  assert.deepStrictEqual(r.overBy, [0, 2, 0]);
  assert.strictEqual(r.trimCm, 2);
});

test("each mode sorts both sides, so orientation doesn't matter", function () {
  var a = E.checkSize([20, 55, 40], CABIN); // same bag, sides shuffled
  var b = E.checkSize([55, 40, 20], CABIN);
  assert.strictEqual(a.ok, b.ok);
  assert.strictEqual(a.ok, true);
});

test("linear mode adds the three sides", function () {
  var r = E.checkSize([80, 50, 30], CHECKED); // sum 160 > 158
  assert.strictEqual(r.mode, "linear");
  assert.strictEqual(r.linearCm, 160);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.linearOverCm, 2);
  assert.strictEqual(r.trimCm, 2);
});

test("linear mode passes on the line", function () {
  var r = E.checkSize([78, 50, 30], CHECKED); // sum 158
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.linearOverCm, 0);
});

test("weight under the limit is fine", function () {
  var w = E.checkWeight(22, 23);
  assert.strictEqual(w.ok, true);
  assert.strictEqual(w.cls, "ok");
  assert.strictEqual(w.overKg, 0);
});

test("weight over the limit but under 32 is a fee, not a refusal", function () {
  var w = E.checkWeight(26, 23);
  assert.strictEqual(w.ok, false);
  assert.strictEqual(w.cls, "overweight");
  assert.strictEqual(w.overKg, 3);
});

test("a single bag over 32 kg is usually refused", function () {
  var w = E.checkWeight(34, 23);
  assert.strictEqual(w.cls, "refused");
});

test("no weight limit means the bag is never weighed", function () {
  var w = E.checkWeight(18, null);
  assert.strictEqual(w.checked, false);
  assert.strictEqual(w.ok, true);
  assert.strictEqual(w.cls, "notweighed");
});

test("checkBag joins size and weight and only fits when both pass", function () {
  var ok = E.checkBag({ l: 54, w: 38, h: 19, kg: 9, unit: "cm", weightUnit: "kg" }, CABIN);
  assert.strictEqual(ok.fits, true);
  var tooHeavy = E.checkBag({ l: 54, w: 38, h: 19, kg: 12, unit: "cm", weightUnit: "kg" }, CABIN);
  assert.strictEqual(tooHeavy.fits, false);
  assert.strictEqual(tooHeavy.weight.overKg, 2);
});

test("a given oversize fee is added, an unknown one is just flagged", function () {
  var withFee = E.checkBag(
    { l: 80, w: 50, h: 30, kg: 20, unit: "cm", weightUnit: "kg" },
    CHECKED,
    { oversize: 65 }
  );
  assert.strictEqual(withFee.feeTotal, 65);
  assert.strictEqual(withFee.feeLines[0].kind, "oversize");
  assert.strictEqual(withFee.feeLines[0].amount, 65);

  var noFee = E.checkBag(
    { l: 80, w: 50, h: 30, kg: 20, unit: "cm", weightUnit: "kg" },
    CHECKED
  );
  assert.strictEqual(noFee.feeTotal, 0);
  assert.strictEqual(noFee.feeLines[0].amount, null);
});

test("a refused bag is flagged and no overweight fee is invented for it", function () {
  var r = E.checkBag(
    { l: 70, w: 45, h: 25, kg: 35, unit: "cm", weightUnit: "kg" },
    CHECKED,
    { overweight: 40 }
  );
  assert.strictEqual(r.refused, true);
  assert.strictEqual(r.feeTotal, 0);
  assert.ok(r.feeLines.some(function (f) { return f.kind === "refused"; }));
});

test("compare puts fitting options first, then the smallest fix", function () {
  var bag = { l: 56, w: 45, h: 25, kg: 11, unit: "cm", weightUnit: "kg" };
  var rows = E.compare(bag, [CABIN, CHECKED]);
  // CABIN: 56>55 and 11>10, fails. CHECKED: linear 126<=158, 11<=23, fits.
  assert.strictEqual(rows[0].type, "checked");
  assert.strictEqual(rows[0].fits, true);
  assert.strictEqual(rows[1].fits, false);
});

var D = require("../src/data.js");

test("US carriers now carry a free personal item allowance", function () {
  ["american", "united"].forEach(function (id) {
    var air = D.byId(id);
    var pi = air.allowances.filter(function (a) { return a.type === "personal"; });
    assert.strictEqual(pi.length, 1, id + " has a personal item");
    assert.strictEqual(pi[0].sizeMode, "each");
  });
});

test("a small backpack fits American's personal item but a big one is over", function () {
  var american = D.byId("american");
  var pi = american.allowances.find(function (a) { return a.type === "personal"; });
  // American personal item is 46 x 36 x 20 cm.
  var ok = E.checkBag({ l: 40, w: 30, h: 15, unit: "cm" }, pi, {});
  assert.strictEqual(ok.fits, true);
  assert.strictEqual(ok.type, "personal");
  var over = E.checkBag({ l: 50, w: 36, h: 22, unit: "cm" }, pi, {});
  assert.strictEqual(over.fits, false);
});

test("compare ranks a backpack: fits the personal item, over the carry-on is irrelevant", function () {
  var united = D.byId("united");
  var rows = E.compare({ l: 42, w: 24, h: 20, unit: "cm" }, united.allowances, {});
  // The personal item (43 x 25 x 23) should be among the fitting rows.
  var pi = rows.find(function (r) { return r.type === "personal"; });
  assert.ok(pi && pi.fits, "backpack fits United's under-seat personal item");
});
