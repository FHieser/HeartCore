# HeartCore

*A Daggerheart horror variant.*

A modern horror hack for the Daggerheart TTRPG, set somewhere in the SCP-like / modern sci-fi space. Characters can be trained professionals (containment staff, security, researchers) **or** ordinary people thrown into anomalous situations. Both use the same classes; only background and starting gear differ.

> Status: early design draft. Items marked **(open)** are undecided.
>
> Where things live:
> - Classes: `data/classes/` (format and creation workflow: `.claude/create-class.md`)
> - Domain and found cards: `data/domains/`, `data/found/` (format and workflow: `.claude/create-domain-cards.md`)
> - Detailed mechanics (rest, ailments, equipment, …): `data/mechanics/`, indexed in [Mechanics.md](Mechanics.md)

---

## Design Pillars

- **Scarcity.** Recovery is slow; wounds and fear carry over.
- **Anyone can be here.** Domains describe what kind of person you are, not your job. Classes are archetypes, not professions.
- **Low power ceiling.** Domain cards only go to level 4. Players never outgrow the horror.

---

## Core Mechanics Kept from Daggerheart

- **Hit Points**
- **Stress**
- **Hope**
- **Armor** (Armor Slots)

### Ideas under consideration (not decided)

- Scars from *Avoid Death* as a central horror element (dropped from the ailment tables for now).

---

## Domains

Domain cards go from **level 1 to level 4 only**.

| Domain | Covers |
|---|---|
| **Body** | Toughness, endurance, physical feats, pushing through wounds. Leans toward HP and Armor. |
| **Mind** | Knowledge, perception, composure, resisting the anomalous. Leans toward Stress. |
| **Tech** | Tools, devices, repairs, hacking, comms, improvised gear. |
| **Aid** | Healing, protecting, covering, calming others. Clears HP and Stress for allies. |

The four starting classes arrange the domains in a ring; each domain belongs to exactly two classes. Later classes don't have to be neighbours on the ring.

```
   Body ── Mechanic ── Tech
    |                   |
 Soldier            Scientist
    |                   |
   Aid ──── Doctor ─── Mind
```

Design notes:
- Instant heals and combat drugs belong in the **Aid** domain cards, not in class features.
- Planned card count: 3 cards at level 1, 2 each at levels 2–4 (9 per domain, 36 total). **(open)**

---

## Cards

- Characters go from **level 1 to 4**.
- Start with **2 domain cards**; gain **1 domain card automatically** on each level-up (max 5 from levelling). The card's level must be equal to or lower than the character's level.
- **2 advancements** per level-up. Daggerheart's "take an additional domain card" advancement is removed.
- **Loadout** of 5 slots; the rest go to the **vault**. A vaulted card can be recalled mid-scene by marking Stress equal to its Recall Cost, or for free during a rest.
- **Ordinary vs. extraordinary:** mundane gear (armor, weapons, consumables, tools) is equipment (`data/mechanics/equipment.yaml`) and never takes loadout slots. Anything special or anomalous is a found card.
- **Found cards:** extraordinary things gained during play (special items like alien armor or a heavy laser, artifacts, abilities, curses, …). They can take **0 slots** for small finds. They are **independent of character level**, go into the loadout like any other card, and may take **more than one slot**. The GM balances powerful finds through slot size. How long a found card lasts depends on the card. If the loadout is full, something has to be packed into the vault: you can only handle so much.

Open:
- What else pushes cards into the vault. Candidates: **anomaly effects** (GM moves, adversary features). Injury and panic are now partly covered by ailments (Disarmed, Concussion, Locked Up). **(open)**
- List of card types. **(open)**
- Taking a dead teammate's card as a found card. **(open)**

---

## Open Topics

1. **Scrap access:** who can gather and spend Scrap. Options discussed:
   - Shared party pool (Mechanic gathers, anyone with Tech cards spends)
   - Anyone gathers, Mechanic gathers better
   - Tech cards cost "Scrap *or* Hope"
   - Scrap is Mechanic-only; Tech cards don't use it
   - Scrap as narrative items instead of a number
2. **Domain cards:** level 1 is done for all four domains; levels 2–4 and their power curve are still open.