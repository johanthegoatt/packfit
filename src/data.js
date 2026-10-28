// Airline allowances Packfit ships with. These are the published everyday
// numbers for a standard economy ticket; airlines change them and vary them by
// fare and route, so the page always tells you to check your own booking. Every
// airline here is listed with its source in the README.
//
// sizeMode "each" = each side is measured on its own (how cabin bags are sized,
// with wheels and handles counted). sizeMode "linear" = the three sides added
// up (how most hold bags are sized). maxKg null = that bag isn't weighed.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PackfitData = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var AIRLINES = [
    {
      id: "typical",
      label: "Most airlines (typical hold bag)",
      allowances: [
        { name: "Hold bag", type: "checked", sizeMode: "linear", maxLinearCm: 158, maxKg: 23,
          note: "The common standard: three sides adding up to 158 cm (62 in), 23 kg (50 lb)." }
      ]
    },
    {
      id: "american",
      label: "American Airlines",
      allowances: [
        { name: "Carry-on", type: "cabin", sizeMode: "each", maxCm: [56, 36, 23], maxKg: null,
          note: "22 x 14 x 9 in including wheels and handle. No cabin weight limit on most routes." },
        { name: "Personal item", type: "personal", sizeMode: "each", maxCm: [46, 36, 20], maxKg: null,
          note: "18 x 14 x 8 in. The free under-seat bag you get as well as the carry-on, even on Basic Economy." },
        { name: "Checked bag", type: "checked", sizeMode: "linear", maxLinearCm: 158, maxKg: 23,
          note: "62 in total, 50 lb. 51-70 lb pays an overweight fee." }
      ]
    },
    {
      id: "delta",
      label: "Delta",
      allowances: [
        { name: "Carry-on", type: "cabin", sizeMode: "each", maxCm: [56, 35, 23], maxKg: null,
          note: "22 x 14 x 9 in. No cabin weight limit on most routes." },
        { name: "Checked bag", type: "checked", sizeMode: "linear", maxLinearCm: 158, maxKg: 23,
          note: "62 in total, 50 lb." }
      ]
    },
    {
      id: "united",
      label: "United",
      allowances: [
        { name: "Carry-on", type: "cabin", sizeMode: "each", maxCm: [56, 35, 22], maxKg: null,
          note: "22 x 14 x 9 in including handles and wheels." },
        { name: "Personal item", type: "personal", sizeMode: "each", maxCm: [43, 25, 23], maxKg: null,
          note: "17 x 10 x 9 in. The free under-seat bag you get as well as the carry-on." },
        { name: "Checked bag", type: "checked", sizeMode: "linear", maxLinearCm: 158, maxKg: 23,
          note: "62 in total, 50 lb." }
      ]
    },
    {
      id: "ba",
      label: "British Airways",
      allowances: [
        { name: "Cabin bag", type: "cabin", sizeMode: "each", maxCm: [56, 45, 25], maxKg: 23,
          note: "Plus a separate handbag up to 40 x 30 x 15 cm. 23 kg, must lift it in yourself." },
        { name: "Checked bag", type: "checked", sizeMode: "each", maxCm: [90, 75, 43], maxKg: 23,
          note: "Each side measured. 23 kg in most cabins." }
      ]
    },
    {
      id: "ryanair-small",
      label: "Ryanair (free small bag)",
      allowances: [
        { name: "Small under-seat bag", type: "cabin", sizeMode: "each", maxCm: [40, 25, 20], maxKg: null,
          note: "The only free bag. Must fit under the seat in front." }
      ]
    },
    {
      id: "ryanair-priority",
      label: "Ryanair (Priority cabin bag)",
      allowances: [
        { name: "Priority 10 kg bag", type: "cabin", sizeMode: "each", maxCm: [55, 40, 20], maxKg: 10,
          note: "Needs Priority or a bag add-on, on top of the free small bag." }
      ]
    },
    {
      id: "easyjet-small",
      label: "easyJet (free small bag)",
      allowances: [
        { name: "Small cabin bag", type: "cabin", sizeMode: "each", maxCm: [45, 36, 20], maxKg: null,
          note: "The free bag. Goes under the seat. Lift it in yourself." }
      ]
    },
    {
      id: "easyjet-large",
      label: "easyJet (large cabin, paid)",
      allowances: [
        { name: "Large cabin bag", type: "cabin", sizeMode: "each", maxCm: [56, 45, 25], maxKg: null,
          note: "Needs a seat up front or a Plus/add-on. Overhead locker." }
      ]
    }
  ];

  var CUSTOM = {
    id: "custom",
    label: "My airline (type the numbers)",
    allowances: []
  };

  function byId(id) {
    for (var i = 0; i < AIRLINES.length; i++) if (AIRLINES[i].id === id) return AIRLINES[i];
    return null;
  }

  return { AIRLINES: AIRLINES, CUSTOM: CUSTOM, byId: byId };
});
