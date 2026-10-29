# Electricity for the Gaggia, just enough

Live: https://rnaidenov.github.io/deep-dive-briefings/electricity-gaggia/

The short version

## Three things to keep

1.  FactCurrent only flows around a **closed loop**. A switch, a
    thermostat or a jumper just opens or closes that loop. [S3](#S3)
2.  FactEU colours: **brown = Line**, **blue = Neutral**, **green/yellow
    = Earth**. [S1](#S1) [S2](#S2)
3.  FactGaggiMate's first safety step is: **unplug the machine** so
    nothing is live while you work. [S4](#S4)

First principles

## Loops, switches, and the fault path

Fact A circuit is a closed loop that gives current a return path;
without the loop it is an **open circuit** and nothing flows. [S3](#S3)

In the Gaggia, current leaves on Line (brown), goes through a part
(heater, pump, valve), and comes back on Neutral (blue). Every switch
and thermostat in between is just a gate in that loop.

Fact Earth is **not** the working path. It ties exposed metal to a
low-impedance route so that if a live wire touches the chassis, a big
fault current flows and trips the breaker/RCD or blows a fuse. [S5](#S5)

What "hot" meansPlain "Hot" or "live" is everyday wording for the Line
conductor: the one at mains voltage relative to earth. In UK/EU terms
both Line and Neutral count as live (current-carrying) conductors; earth
does not. [S2](#S2) Treat **both** brown and blue as dangerous while
plugged in.

Colours

## Brown, blue, green/yellow

1.  Fact**Brown** — single AC phase (Line). IEC 60446/60445 colour
    scheme, which EU wiring is harmonised with. [S1](#S1) [S2](#S2)
2.  Fact**Blue** — Neutral. [S1](#S1)
3.  Fact**Green/yellow** — always and only the protective (earth)
    conductor. [S1](#S1)

Colour is not identity inside the machineOpinion The internal Gaggia
wires (grey, white, black, the kit's red/green/yellow) are not
mains-standard colours. GaggiMate has you **label by position** (BT.A,
S.5, C.4, PMP.B…) for that reason; trust the label, not the colour.
[S4](#S4)

Fact The cup-warmer has two **grounding wires** you disconnect to lift
it off; GaggiMate says reconnect them on reassembly. [S4](#S4) That is
the earth bond for the metal chassis: don't skip it.

Spades & jumpers

## Why the red BT.A–BT.B jumper exists

Each spade connector is one point in a loop. Pull it off and the loop is
open.

Fact The stock brew thermostat sits in series in the heater loop.
GaggiMate has you remove it and **bridge BT.A and BT.B with the small
red jumper**, securely and insulated. [S4](#S4)

Reasoning Removing the thermostat would leave the loop open, so the
heater could never run. The jumper restores **continuity**, and
temperature control moves to the thermocouple + board + SSR instead. See
the [Gaggia briefing →
jumper](https://rnaidenov.github.io/deep-dive-briefings/gaggia-gaggimate/#jumper).

High level

## Three paths — don't mix them up

### 1 · Heater → SSR

Fact ST.A/ST.B are extended with yellow wires to the **OUTPUT** side of
the SSR; the yellow/black signal cable goes to its input. The SSR
switches the **heater only**. [S4](#S4) [S6](#S6)

### 2 · Pump → board P

Fact The kit's green wire goes from the pump's PMP.B position to the
board's **P/Pump** connector. [S4](#S4) The pump is **not** on the SSR.

### 3 · Valve → board V

Fact The original PMP.B lead (grey; the one **not** going into the
pump's thermal fuse) is extended with the red wire to the board's
**V/Valve** connector. [S4](#S4)

Plus the board's own feed: C.4 (brown) → **L/Line** via the grey kit
wire; S.5 (white) → **N/Neutral** via the blue kit wire. [S4](#S4)
Where-is-what: [BT / ST / PMP
finder](https://rnaidenov.github.io/deep-dive-briefings/gaggia-gaggimate/#find-bt-st-pmp)
· [3D
explore](https://rnaidenov.github.io/deep-dive-briefings/gaggia-gaggimate/#explore-3d)
· [companion](https://gaggimate-companion.vercel.app).

Habits

## Safe habits, every time

1.  Fact**Unplug** at the wall before opening; work dry. [S4](#S4)
2.  Opinion**Don't probe live** mid-install. Test only after it's closed
    up, per the guide's final checks.
3.  Fact**Never join earth to Line or Neutral**; green/yellow is
    exclusively protective. [S1](#S1)
4.  Opinion**Leave mains brown/blue alone** unless the guide names that
    exact wire (e.g. C.4, S.5).
5.  Fact**Label by position**, not colour, and keep a record of your
    wiring. [S4](#S4)
6.  Fact**Insulate every join** and every removed end with tape or
    heatshrink. If unsure, ask a professional. [S4](#S4)

Receipts

## Sources

All opened 29 Oct 2026. Official HD 308 / IEC 60445 texts are paywalled;
S1 summarises the IEC colour scheme.

1.  S1
    [IEC 60446 (now IEC 60445) — conductor
    colours](https://en.wikipedia.org/wiki/IEC_60446)WebWikipedia
    Brown = single phase, blue = neutral, green/yellow exclusively
    protective.
2.  S2
    [Electrical wiring in the United
    Kingdom](https://en.wikipedia.org/wiki/Electrical_wiring_in_the_United_Kingdom)WebWikipedia
    L brown / N blue / E green-yellow; line and neutral are live
    conductors, earth is not; harmonised with Europe/IEC 60446.
3.  S3
    [Electrical network /
    circuit](https://en.wikipedia.org/wiki/Electric_circuit)WebWikipedia
    Circuit = closed loop with return path; no loop = open circuit.
4.  S4
    [GaggiMate — Gaggia Classic Pro/Evo
    installation](https://docs.gaggimate.eu/docs/installation-gcp/)WebGaggiMate
    docs
    Unplug, high-voltage safety, ground wires, red BT jumper, SSR
    wiring, L/N/P/V connections, insulation.
5.  S5
    [Ground
    (electricity)](https://en.wikipedia.org/wiki/Ground_(electricity))WebWikipedia
    Protective earth gives exposed metal a low-impedance fault path that
    trips breakers/RCDs.
6.  S6
    [Solid-state
    relay](https://en.wikipedia.org/wiki/Solid-state_relay)WebWikipedia
    How an SSR switches an AC load electronically.
