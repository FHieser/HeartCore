# HeartCore

*A Daggerheart horror variant.*

A modern horror hack for the Daggerheart TTRPG, set somewhere in the SCP-like / modern sci-fi space. Characters can be trained professionals (containment staff, security, researchers) **or** ordinary people thrown into anomalous situations. Both use the same classes; only background and starting gear differ.

> Status: early design draft. Items marked **(open)** are undecided.
>
> Detailed rules (ailments, …) live in [Mechanics.md](Mechanics.md).

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

- Lower max Hope (e.g. 4 instead of 6).
- Scars from *Avoid Death* as a central horror element.

---

## Rest Rules

| Rest | Actions |
|---|---|
| Short rest | 2 actions |
| Long rest | 4 actions |

**No duplicates:** each action type can only be chosen once per rest.

Base rest actions:

- Clear 1 HP
- Clear 1 Stress
- Gain 1 Hope
- Clear 1 Armor Slot

Notes:
- With only 4 base actions, a long rest is currently "one of each". More complex rest options are planned for later (e.g. treating wounds, dealing with trauma from Stress and HP damage).

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

### Card economy

- Characters go from **level 1 to 4**.
- Start with **2 domain cards**; gain **1 domain card automatically** on each level-up (max 5 from levelling). The card's level must be equal to or lower than the character's level.
- **2 advancements** per level-up. Daggerheart's "take an additional domain card" advancement is removed.
- **Loadout** of 5 slots; the rest go to the **vault**. A vaulted card can be recalled mid-scene by marking Stress equal to its Recall Cost, or for free during a rest.
- **Found cards:** extra cards gained during play (items, artifacts, abilities, curses, …). They are **independent of character level**, go into the loadout like any other card, and may take **more than one slot**. The GM balances powerful finds through slot size. How long a found card lasts depends on the card. If the loadout is full, something has to be packed into the vault: you can only handle so much.

Open:
- What else pushes cards into the vault. Candidates, possibly all: **injury** (last HP / scars), **panic** (maxed Stress), **anomaly effects** (GM moves, adversary features). **(open)**
- List of card types. **(open)**
- Taking a dead teammate's card as a found card. **(open)**

### Card format

Cards live in YAML files under `data/`: one file per domain in `data/domains/`, found cards in `data/found/`:
`data/domains/body.yaml`, `data/domains/mind.yaml`, `data/domains/tech.yaml`, `data/domains/aid.yaml`, `data/found/found.yaml`.

```yaml
- name: Card Name          # required
  type: ability            # required: ability | item | artifact | curse | … (open)
  source:                  # required
    kind: domain           # domain | found
    domain: aid            # only for kind: domain → body | mind | tech | aid
    level: 1               # only for kind: domain → 1–4
  slots: 1                 # loadout slots, default 1
  recall: 1                # Stress to recall from the vault mid-scene
  text:                    # one entry per feature
    - "First feature. Activation, costs, duration and vault effects all go here."
    - "Second feature, if the card has one."
  flavor: "Optional flavor line."   # optional
```

Found cards use `source: { kind: found }` and have no domain or level.

`text` is a **list with one entry per feature**, even when the card has only one. Each entry is written on **one physical line** in double quotes, with no line breaks inside (a future frontend depends on this). Don't use `>` / `|` block styles or wrap long lines.

Ideas for card text (not fields, but useful patterns):
- Standard activations: Passive / costs Hope / costs Stress / X uses per rest / One-shot.
- Drawbacks, especially on found cards.
- Vault interactions: "When vaulted…", "Vaulted by…", "Can't be vaulted voluntarily."

---

## Class Structure

Each class has:

- **Two domains**
- **Main mechanic:** the big feature that defines the class
- **Flair:** a smaller feature that adds flavor (not necessarily a roll bonus)
- **Hope feature:** assumed to cost 3 Hope unless stated otherwise **(open)**

Subclasses / specializations are skipped for now.

### Class files

Classes live in `data/classes/`, one YAML file per class (`data/classes/soldier.yaml`, …). The webapp picks up every `.yaml` file in that folder. The file format is defined in the create-class command ([.claude/create-class.md](.claude/create-class.md)).

---

## Creating a Class (Workflow)

This is the process the four starting classes were built with. Follow it step by step for any new class. Each step ends with a **decision** before moving on.

### How to work through each step

For every step that needs a design choice:

1. **Generate options.** Write 5 distinct ideas. They should differ in *what they do*, not just in wording or numbers.
2. **Pick or combine.** Choose one, or merge parts of several.
3. **Refine.** Adjust costs, triggers and limits. Name open questions explicitly.
4. **Lock it.** Only move to the next step once the current one is decided. Record anything still undecided as **(open)**.

If none of the 5 options fit, generate 5 more rather than forcing one.

### Step 1: Archetype

Define who this class is, in one sentence, from the table's perspective.

- **Fantasy line:** what the class does when things go wrong ("Stands between the others and the thing in the dark").
- **Professional examples:** 3–5 jobs that fit.
- **Civilian examples:** 3–5 ordinary people who fit.

Check:
- [ ] Works equally for a trained professional and a civilian.
- [ ] Describes a *way of acting under pressure*, not a job title.
- [ ] Clearly different from every existing class.

### Step 2: Domains

Pick the two domains.

- Every class takes **two domains**. They don't have to be neighbours on the ring.
- Every domain must end up in **exactly two classes**.
- When adding classes beyond the starting four, the ring (or the number of domains) has to be revisited. **(open)**

Check:
- [ ] Both domains support the archetype from Step 1.
- [ ] The combination is not already used by another class.

### Step 3: Role and boundaries

Write down what the class brings to the group, and just as important, what it is **not**.

- **Role:** 1–2 sentences on its job in the party.
- **Not this:** things the class should avoid becoming (e.g. the Doctor is *not* a healbot).
- **Domain vs. class:** decide which effects belong in the class features and which belong in domain cards. Generic effects anyone could take (instant heals, combat drugs, damage boosts) belong in domains. Class features should be things only this class does.

### Step 4: Main mechanic

The main mechanic defines how the class plays, scene to scene.

Guidelines:
- It should create **decisions**, not just numbers. (Ward: who do I protect? Code Red: who do I prioritize, and when do I give up on them?)
- It should be usable **during scenes**, not only in downtime.
- It may introduce a resource (like Scrap), but only if the class needs one. Not every class needs its own currency.
- It must respect the **rest economy**. Anything that clears HP or Stress is extremely strong when rests only give 2 or 4 actions.

Check:
- [ ] Is it fun to use repeatedly, or does it make the player a support machine?
- [ ] Does it have a cost, limit or trade-off?
- [ ] Can it be explained in two sentences?

### Step 5: Flair

A smaller feature that adds character.

Guidelines:
- It does **not** have to be a roll bonus. It can bend a core rule (Adrenaline overrides max Stress penalties), give information (Cold Logic) or improve downtime (House Call).
- Ideally it **interacts with the Hope feature or the main mechanic**.
- It should reinforce the archetype, not add a new direction.

### Step 6: Hope feature

The class's big moment.

Guidelines:
- Default cost: 3 Hope.
- It should feel like a signature move, the thing players remember.
- It should be simple to resolve at the table.

### Step 7: The loop

Check how the three features work together. The best classes have a small loop or a built-in tension:

| Class | Loop / tension |
|---|---|
| Soldier | Adrenaline rewards maxed Stress, but Calm Under Pressure clears Stress and ends it. The player must choose. |
| Mechanic | Rolls with Hope give Scrap, Scrap builds things; the Hope feature builds for free, but only once. |
| Scientist | Hope pays for Hypotheses; Cold Logic turns incoming Stress into information for better hypotheses. |
| Doctor | Switching priority in Code Red costs an ally Stress but gives Hope, which fuels Unparalleled Concentration. |

Check:
- [ ] At least two of the three features feed into or pull against each other.
- [ ] The loop is visible to the player without explanation.

### Step 8: Cross-class check

Compare the new class against all existing ones.

- [ ] **Trait overlap:** does it boost the same traits as another class? Is that intentional? (Soldier and Doctor share Instinct.)
- [ ] **Mechanic overlap:** does it copy another class's structure (e.g. a second Scrap-like resource)?
- [ ] **Party value:** would a group want this class, without *needing* it to survive?
- [ ] **Horror check:** does the class still feel vulnerable? Nothing should make the anomaly trivial.

### Step 9: Naming

Name each feature last, once the mechanics are locked.

- Short, evocative, and understandable at the table.
- Generate several name options per feature and pick one.
- Optional: a short flavor line in quotes or italics.

### Step 10: Write it up

Write the class as a new file `data/classes/<id>.yaml` using the format from the create-class command. Put the loop from Step 7 in `loop` and anything undecided in `open`. The webapp picks the file up automatically.

### Guardrails (apply to every class)

- No instant heals or combat drugs in class features; those go in the Aid domain.
- Respect the rest economy: extra HP or Stress recovery is a major benefit.
- Features must work for civilians as well as professionals.
- Prefer decisions and trade-offs over flat bonuses.
- Keep rules text short enough to fit on a card.

---

## Classes

The classes live in [`data/classes/`](data/classes/), one YAML file each (format: see Class Structure → Class files). The starting four:

| Class | Domains | File |
|---|---|---|
| Soldier | Body + Aid | [soldier.yaml](data/classes/soldier.yaml) |
| Mechanic | Body + Tech | [mechanic.yaml](data/classes/mechanic.yaml) |
| Scientist | Mind + Tech | [scientist.yaml](data/classes/scientist.yaml) |
| Doctor | Mind + Aid | [doctor.yaml](data/classes/doctor.yaml) |

---

## Open Topics

1. **Scrap access:** who can gather and spend Scrap. Options discussed:
   - Shared party pool (Mechanic gathers, anyone with Tech cards spends)
   - Anyone gathers, Mechanic gathers better
   - Tech cards cost "Scrap *or* Hope"
   - Scrap is Mechanic-only; Tech cards don't use it
   - Scrap as narrative items instead of a number
2. **Improved rest options:** treating wounds, trauma from Stress/HP damage, and what House Call unlocks.
3. **Domain cards:** design levels 1–4 for all four domains, fitting the rest economy. Economy and format are decided (see Cards); vault triggers and card types are still open.
4. **Starting stats:** HP, Evasion and Stress per class.