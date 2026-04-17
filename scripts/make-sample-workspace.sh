#!/usr/bin/env bash
# Build a sample Yarrow workspace — a two-week European trip in the planning
# phase. 12 notes, typed connections between them, two open questions, and a
# second path showing a stripped-down "budget backpacker" version of the plan.
#
# Usage:  ./scripts/make-sample-workspace.sh [destination]
#         ./scripts/make-sample-workspace.sh ~/yarrow-demo

set -euo pipefail

DEST="${1:-./yarrow-demo}"
DEST="$(python3 -c 'import os,sys; print(os.path.abspath(sys.argv[1]))' "$DEST")"

if [[ -e "$DEST" ]]; then
  read -r -p "$DEST already exists. Remove it and start fresh? [y/N] " REPLY
  [[ "$REPLY" =~ ^[Yy]$ ]] || { echo "aborted."; exit 1; }
  rm -rf "$DEST"
fi

mkdir -p "$DEST/notes" "$DEST/.yarrow"
cd "$DEST"

GIT=(git -c user.name=Yarrow -c user.email=noreply@yarrow.app -c init.defaultBranch=main -c commit.gpgsign=false)
"${GIT[@]}" init -q

NOW="$(date -u -Iseconds)"

# ───────── workspace config ─────────
cat > .gitignore <<'EOF'
# Yarrow derived/cache files and per-machine secrets — do not track
.yarrow/index.json
.yarrow/scratchpad.md
.yarrow/credentials.toml
EOF

cat > .yarrow/config.toml <<EOF
[workspace]
name = "Two weeks in Europe"
created = "$NOW"

[sync]
remote_type = "custom"

[preferences]
decay_days = 60
autocheckpoint_debounce_ms = 3000
focus_mode_default = false
ask_thinking_on_close = true
EOF

# ───────── notes helper ─────────
write_note() {
  local slug="$1"; shift
  local title="$1"; shift
  local body="$1"; shift
  local links_yaml=""
  while [[ $# -gt 0 ]]; do
    links_yaml+=$'\n'"  - target: $1"$'\n'"    type: $2"
    shift 2
  done
  [[ -z "$links_yaml" ]] && links_yaml=" []"

  {
    echo "---"
    echo "title: $title"
    echo "created: $NOW"
    echo "modified: $NOW"
    echo -n "links:"
    printf '%s\n' "$links_yaml"
    echo "tags: []"
    echo "---"
    echo
    printf '%s\n' "$body"
  } > "notes/$slug.md"
}

# ── 1. the hero ────────────────────────────────────────────────────────
write_note "two-weeks-in-europe" "Two weeks in Europe" "\
Two weeks, three cities, one loose plan.

We're going in late September — shoulder season, before the weather turns
but after the worst of the summer crowds. The plan isn't nailed down yet,
and that's on purpose. Here's the shape:

## The route

- 4 days in [[paris-four-days]]
- Overnight train south
- 4 days in [[rome-four-days]]
- Flight to [[barcelona-three-days]]
- Home

## What we're *not* optimizing for

- Cramming in every monument
- Waking up at 6am to queue
- A fancy dinner every single night

## What actually matters

- One unhurried café morning per city
- Walking more than riding
- Eating where locals eat, not where the reviews cluster
- Leaving at least one afternoon in each city deliberately unplanned" \
  "paris-four-days" "supports" \
  "rome-four-days" "supports" \
  "barcelona-three-days" "supports" \
  "amsterdam-add-on" "challenges" \
  "overnight-train-to-rome" "supports" \
  "if-it-rains" "supports"

# ── 2. paris ───────────────────────────────────────────────────────────
write_note "paris-four-days" "Paris — four days" "\
Four days feels right. Not enough to see everything, which means we're
not trying to.

## Day shape

- **Arrival day** is a lost day. Coffee, wander the neighborhood, find a
  bakery, sleep early.
- **Day 2**: Île de la Cité plus a long lunch. Maybe Sainte-Chapelle if
  the line isn't brutal.
- **Day 3**: Picasso Museum in the morning, Marais in the afternoon,
  dinner somewhere we didn't plan.
- **Day 4**: Out on the night train.

## Things we're deliberately skipping

- The Eiffel Tower climb (looking at it is enough)
- Versailles — a day trip eats the whole day
- A three-star dinner (not this trip)

## Note to self

Canal Saint-Martin in the evening — apparently less touristy and a good
walk. Cross-check with [[food-we-cant-miss]] for nearby spots." \
  "two-weeks-in-europe" "supports" \
  "food-we-cant-miss" "supports"

# ── 3. rome ────────────────────────────────────────────────────────────
write_note "rome-four-days" "Rome — four days" "\
Rome is messy and beautiful and no amount of planning fixes that. Four
days, same rhythm as Paris.

## The short list

- Forum + Palatine Hill — one combined ticket, one long morning
- Villa Borghese gardens for an afternoon escape
- Trastevere walking and dinner
- One day trip to Ostia Antica if the weather holds

## What we're deliberately not doing

- The Vatican on a Sunday
- Any line longer than an hour for a single thing

?? Should we prebook the Colosseum, or just show up with timed tickets the
night before? The forums on this are wildly inconsistent.

## The gelato rule

Two per day, max. One of them has to be in the afternoon." \
  "two-weeks-in-europe" "supports" \
  "food-we-cant-miss" "supports"

# ── 4. barcelona ───────────────────────────────────────────────────────
write_note "barcelona-three-days" "Barcelona — three days" "\
Three days is short but Barcelona rewards a compact itinerary. Gothic
Quarter in the morning, Gaudí in the afternoon, sea in the evening.

- **Sagrada Família**: book the first slot we can get, bring earplugs
- **Park Güell**: either dawn or last entry — midday is a zoo
- **El Raval** for dinner at least one night
- A beach walk on the last morning before the flight home

Food-wise, see [[food-we-cant-miss]]. The answer is: nowhere touristy on
La Rambla, always the side streets." \
  "two-weeks-in-europe" "supports" \
  "food-we-cant-miss" "supports"

# ── 5. overnight train ─────────────────────────────────────────────────
write_note "overnight-train-to-rome" "The overnight train to Rome" "\
The night train saves us a hotel night, cuts a day of travel in half, and
is genuinely fun if we set expectations right.

## Booking notes

- Couchette, not seat — sleep matters
- Book 3 months out for the best price; 4 weeks out for availability
- Snacks from a market before boarding — the dining car is unreliable
- Ear plugs, eye mask, water bottle, phone charger

## What to expect

- The bed is short. You'll sleep fine anyway.
- The first hour of a border crossing can be noisy.
- Coffee at the Rome station in the morning, drop bags at the apartment,
  then slowly find our feet.

Supports [[budget]] — one night's lodging saved, and no daytime hours
burned sitting on a train." \
  "two-weeks-in-europe" "supports" \
  "budget" "supports"

# ── 6. where to stay ───────────────────────────────────────────────────
write_note "where-to-stay" "Where to stay" "\
Neighborhoods matter more than star ratings. In every city:

- **Not** the area directly around the main train station
- Walking distance to a real neighborhood — bakery, non-tourist café,
  a grocer
- A metro or tram line that goes somewhere useful
- Quiet at night (read reviews specifically for this)

## By city

- **Paris**: 11th arrondissement, near Oberkampf — residential feel,
  good food scene, reasonable prices
- **Rome**: Monti or Trastevere. Trastevere is louder but charming.
- **Barcelona**: Gràcia or Eixample. Avoid the Gothic Quarter if we
  want sleep.

## How we book

Airbnb if we want a kitchen, family-run guesthouse otherwise. Never
a chain — we can stay in a chain anywhere." \
  "budget" "supports"

# ── 7. what to pack ────────────────────────────────────────────────────
write_note "what-to-pack" "What to pack" "\
One carry-on each. No checked bag. That's the whole rule.

## Clothes (for shoulder season)

- 4 shirts, mix of layers
- 1 pair jeans, 1 lighter pants
- 1 nice outfit each for evenings out
- A real rain shell — it will rain at least twice, see [[if-it-rains]]
- One sweater
- Scarves: best packable warmth-per-gram ratio

## Things people always forget

- Plug adapter (two, so we don't fight over it)
- Collapsible water bottle
- Small med kit — band-aids, ibuprofen, something for stomach trouble
- A notebook + pen for the things that don't belong on a phone

## Things we're buying there, not packing

Toiletries. Bring 50ml of the essentials, buy the rest on day one." \
  "if-it-rains" "came-from"

# ── 8. food we can't miss ──────────────────────────────────────────────
write_note "food-we-cant-miss" "Food we can't miss" "\
Not a restaurant list. Dishes and formats we want to experience.

## Paris

- **Pain au chocolat from a real boulangerie** — at least one morning
- **Steak frites at a bistro where they bring the wine in a carafe**
- **A proper cheese course** — the weird one, not the safe one

## Rome

- **Cacio e pepe done right** (we'll know)
- **Supplì** from a hole in the wall
- **An aperitivo that turns into dinner**

## Barcelona

- **Bombas, patatas bravas, and a beer** as a pre-dinner ritual
- **Proper seafood by the water, once** — worth the premium
- **Churros con chocolate**, morning, one time only

## The rule

No restaurant with its menu translated into five languages. No restaurant
with someone outside trying to wave us in." \
  "paris-four-days" "supports" \
  "rome-four-days" "supports" \
  "barcelona-three-days" "supports"

# ── 9. museum passes ───────────────────────────────────────────────────
write_note "museum-day-passes" "The museum day-passes question" "\
The Paris Museum Pass, the Roma Pass, the Barcelona Card — they all pitch
the same thing, and the math is fuzzy.

## Paris (2-day pass)

Worth it if we hit 4+ museums. We're planning 2 — Picasso, maybe one
more. Probably skip.

## Rome (Roma Pass)

Includes the Colosseum *and* skip-the-line for it. That's basically the
selling point. Probably worth it for the transit + one major site combo.

## Barcelona

The card is mostly public transit with small discounts. Not compelling
at our pace. Skip.

?? Is the skip-the-line benefit of the Roma Pass actually faster than the
official timed-entry Colosseum ticket? Worth one more check before deciding." \
  "budget" "open-question"

# ── 10. budget ─────────────────────────────────────────────────────────
write_note "budget" "Budget" "\
Rough target: **€5,000 all-in** for two people, two weeks.

## Breakdown

| category             | est. | notes                                   |
|----------------------|------|-----------------------------------------|
| flights (round trip) | 1400 | shoulder season, booked early           |
| intra-Europe transit | 300  | includes the [[overnight-train-to-rome]] |
| lodging (12 nights)  | 1500 | see [[where-to-stay]]                   |
| food                 | 1100 | one nice dinner per city, otherwise modest |
| sites / museums      | 300  | see [[museum-day-passes]]               |
| cushion              | 400  | things will cost more than we expect    |

## Where we'll over-run

Food. Always food. We've learned this.

## Where we can recover

Walking instead of metro. Picnic lunches. Skipping one \"nice dinner\" in
favor of a perfect sandwich from the right place." \
  "overnight-train-to-rome" "supports" \
  "where-to-stay" "supports" \
  "museum-day-passes" "open-question"

# ── 11. if it rains ────────────────────────────────────────────────────
write_note "if-it-rains" "If it rains" "\
Europe in late September means at least two rainy afternoons. That's
fine — we planned for it.

## Per city, rainy-day moves

- **Paris**: the covered passages (Galeries Vivienne and friends), a long
  museum, or Maison Européenne de la Photographie
- **Rome**: the Pantheon (indoor + stunning in the rain), any church,
  a trattoria with a long lunch
- **Barcelona**: Palau de la Música, Picasso museum, MACBA

## The rule

A rainy afternoon is a gift if we let it be. Don't try to \"salvage\" it —
the afternoon is the experience.

## What we have for it

- A proper rain shell each (see [[what-to-pack]])
- A paperback each in the carry-on" \
  "two-weeks-in-europe" "supports" \
  "what-to-pack" "came-from"

# ── 12. amsterdam add-on ───────────────────────────────────────────────
write_note "amsterdam-add-on" "Amsterdam — the add-on we keep debating" "\
We keep coming back to this. Four extra days tacked on the front: fly
into Schiphol, spend a weekend in Amsterdam, then train down to Paris.

## Why we keep hesitating

- Adds a real chunk of cost — another flight, more lodging
- Compresses [[paris-four-days]] by at least a day
- Another whole city to not-see-everything of

## Why we keep talking about it

- The light in the canals
- We've both never been
- The train from AMS to Paris is gorgeous and a perfect ease-in

This challenges the core shape of [[two-weeks-in-europe]]. Came from
reading too many Amsterdam blog posts in bed." \
  "two-weeks-in-europe" "challenges"

# ───────── initial commit on main ─────────
"${GIT[@]}" add -A
"${GIT[@]}" commit -q -m "checkpoint: workspace seeded"

# A couple of later revisions so the history slider has content to scrub.
cat >> notes/overnight-train-to-rome.md <<'EOF'

## One more thing we learned

Book the couchette on the upper bunk if you can — quieter, fewer people
bumping past you in the night. Not obvious from the seat map.
EOF
"${GIT[@]}" add -A
"${GIT[@]}" commit -q -m "checkpoint: couchette tip" > /dev/null

cat >> notes/budget.md <<'EOF'

## Update after actually pricing lodging

Midrange guesthouses in Paris are running €160–200/night in the 11th.
If we're disciplined with the other cities we can still land near €5,000.
EOF
"${GIT[@]}" add -A
"${GIT[@]}" commit -q -m "checkpoint: budget — after pricing lodging"

# ───────── branch: budget-backpacker ─────────
# A stripped-down version of the hero plan — same skeleton, different soul.
"${GIT[@]}" checkout -q -b budget-backpacker

cat > notes/two-weeks-in-europe.md <<EOF
---
title: Two weeks in Europe
created: $NOW
modified: $NOW
links:
  - target: paris-four-days
    type: supports
  - target: rome-four-days
    type: supports
  - target: barcelona-three-days
    type: supports
  - target: amsterdam-add-on
    type: challenges
  - target: overnight-train-to-rome
    type: supports
  - target: if-it-rains
    type: supports
tags: []
---

Two weeks, three cities, half the budget.

Same route, same dates — but we're doing it as cheaply as two people
reasonably can without hating the trip.

## The route

- 4 days in [[paris-four-days]]
- Overnight train south — seat, not couchette
- 4 days in [[rome-four-days]]
- Budget flight to [[barcelona-three-days]]
- Home

## Rules for this version

- **Hostels or guesthouses only.** No Airbnb, no hotels. We can share a
  dorm room for a few nights — we've done it before.
- **Groceries over restaurants** for at least one meal per day. Breakfast
  from a bakery, dinner from a market.
- **Free walking tours** in every city. The tips-only ones are often
  excellent.
- **No museum passes.** Free entry on the first Sunday, for anything we
  really want to see. Otherwise skip.
- **Transit: legs first, metro second.**

## What we keep

The one unhurried café morning per city. The slow afternoon. The good
dinner, once per city, not every night. The trip is the trip — just
lighter.
EOF

"${GIT[@]}" add -A
"${GIT[@]}" commit -q -m "checkpoint: the backpacker take"

# Back to main so the workspace opens on the primary path
"${GIT[@]}" checkout -q main

# Stub index so the graph has a file to overwrite on first open.
cat > .yarrow/index.json <<EOF
{
  "notes": [],
  "links": [],
  "last_built": "$NOW"
}
EOF

cat <<MSG

✔ Sample workspace ready at: $DEST

Open it from Yarrow's onboarding screen via "Open a different folder" and
point it at this path. It'll appear in your Recents after the first open.

The workspace has:
  · 12 notes planning a two-week European trip (Paris / Rome / Barcelona)
  · typed connections: supports · challenges · came-from · open-question
  · 2 paths — main, and budget-backpacker (a fork on the hero note)
  · 3 checkpoints on main so the history slider has something to scrub
  · 2 open questions (??) for the right-sidebar panel
  · multiple [[wikilinks]] inside the prose
MSG
