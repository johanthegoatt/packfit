# Packfit

Will my bag fit? Type your suitcase's size and weight, pick the airline, and
Packfit tells you if it fits the cabin or hold limit, or exactly how much to
shave off or lift out. It runs in the browser; nothing you type is uploaded.

Live: https://packfit.johanthegoat.xyz

## Why

Oversize and overweight bags get caught at the gate or the desk, where the fee
is highest and there's nothing you can do about it. The rules are fiddly in a
way that's easy to get wrong:

- A **cabin** bag is measured **side by side**, with the wheels and handles on
  it, so turning the bag doesn't help: the longest side has to fit the longest
  side allowed, and so on down.
- A **hold** bag is usually measured on the **three sides added up** (the
  "linear" size, commonly 158 cm / 62 in), because it goes in a hold, not a
  frame.
- Weight is separate. The common hold limit is 23 kg (50 lb); over that you pay,
  and past 32 kg most airlines won't take a single bag at all, for the people
  who have to lift it.

Packfit does all three checks and, when a bag is over, says the smallest change
that would make it fit.

## What it does

- Checks a bag against the cabin and hold limits for a set of major airlines, or
  any airline whose numbers you type in.
- Works in cm or inches, kg or lb.
- When a bag is over, gives the plain fix: shave N cm off the longest side, or
  lift out N kg.
- Flags the 32 kg point where a single bag is usually refused, and says to split
  it rather than inventing a fee for it.
- Optional: type what your airline charges for an over bag and it adds it up. No
  fee is ever made up.
- A share link that carries the bag and airline in the address, so nothing is
  stored on a server.

## How it's built

Plain HTML, CSS and JavaScript, no framework and no build step. The rules live
in `src/engine.js` as pure functions with no DOM, so they can be tested in Node:

```
npm test
```

`src/data.js` holds the airline allowances. `src/app.js` wires the page and
`src/stow.js` is Stow, the suitcase in the corner who gives a tip when tapped.
The page works with the keyboard, reads correctly to a screen reader, respects
reduced-motion, and has a light and dark theme.

## The numbers, and where they come from

These are the published economy allowances at the time of writing. **Airlines
change them and vary them by fare, route and cabin, and a gate agent has the
final say, so always check your own booking.** Packfit says this on the page
too.

- Cabin bags are measured on each side; most hold bags on the three sides added
  up to **158 cm (62 in)** at **23 kg (50 lb)**, with a single bag over 32 kg
  usually refused. These are the long-standing industry norms, used by the US
  majors and most full-service carriers.
- American Airlines, Delta and United: carry-on **22 x 14 x 9 in**
  (56 x 36 x 23 cm), checked 62 in / 50 lb.
- The free **personal item** (the bag that goes under the seat in front, on
  top of the carry-on, and the only free bag on a US Basic Economy fare):
  American **18 x 14 x 8 in** (46 x 36 x 20 cm), United **17 x 10 x 9 in**
  (43 x 25 x 23 cm). Delta allows a free personal item too but does not publish
  a size, only that it must fit fully under the seat, so Packfit leaves Delta's
  as a note rather than a number.
- British Airways: cabin bag 56 x 45 x 25 cm plus a 40 x 30 x 15 cm handbag,
  23 kg; checked bag each side up to 90 x 75 x 43 cm, 23 kg.
- Ryanair: a free small bag 40 x 25 x 20 cm; a 55 x 40 x 20 cm 10 kg bag with
  Priority.
- easyJet: a free small bag 45 x 36 x 20 cm; a larger 56 x 45 x 25 cm cabin bag
  with a seat up front or an add-on.

Sources used when building the table:

- [American Airlines — Carry-on and checked bags](https://www.aa.com/i18n/travel-info/baggage/baggage.jsp)
- [Delta — Carry-on baggage](https://www.delta.com/us/en/baggage/carry-on-baggage)
- [United — Carry-on bags](https://www.united.com/en/us/fly/baggage/carry-on-bags.html)
- [British Airways — Baggage essentials](https://www.britishairways.com/en-gb/information/baggage-essentials)
- [Ryanair — Cabin and checked bags](https://www.ryanair.com/gb/en/useful-info/help-centre/bags)
- [easyJet — Hold and cabin bags](https://www.easyjet.com/en/help/baggage)
- Background on the 158 cm / 23 kg norms and overweight/oversize fees:
  [checked luggage sizes by airline for 2025 (WTOP)](https://wtop.com/news/2024/12/checked-luggage-sizes-by-airline-for-2025/),
  [Excess baggage explained (Going)](https://going.com/glossary/excess-baggage)

## Licence

MIT. Made by Johan.
