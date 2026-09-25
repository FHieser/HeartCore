# HeartCore

*A Daggerheart horror variant.*

A modern horror hack for the Daggerheart TTRPG, set somewhere in the SCP-like / modern sci-fi space. Characters can be trained professionals (containment staff, security, researchers) **or** ordinary people thrown into anomalous situations. Both use the same classes; only background and starting gear differ.

> Status: early design draft. Items marked **(open)** are undecided.

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

Domains are arranged in a ring; each domain belongs to exactly two classes:

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

Cards live in YAML files under `cards/`, one file per domain plus one for found cards:
`cards/body.yaml`, `cards/mind.yaml`, `cards/tech.yaml`, `cards/aid.yaml`, `cards/found.yaml`.

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

- Every class takes **two neighboring domains** on the ring.
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

Document the class with the template below and add it to the class list and overview table.

### Class template

```markdown
### [Class Name] ([Domain] + [Domain])

*[Fantasy line.]*
Examples: [professional examples], [civilian examples].

- **Main, [Name]:** [Rules text.]
- **Flair, [Name]:** [Rules text.]
- **Hope feature, [Name] ([cost] Hope):** [Rules text.]

Notes:
- [Loop / tension between features.]
- [Open questions, marked (open).]
```

### Guardrails (apply to every class)

- No instant heals or combat drugs in class features; those go in the Aid domain.
- Respect the rest economy: extra HP or Stress recovery is a major benefit.
- Features must work for civilians as well as professionals.
- Prefer decisions and trade-offs over flat bonuses.
- Keep rules text short enough to fit on a card.

---

## Classes

### Soldier (Body + Aid)

*The protector. Stands between the others and the thing in the dark.*
Examples: marine, security guard, cop, firefighter, bouncer.

- **Main, Ward:** At the start of a scene, name one ally as your ward. While they're within Close range, you can mark your own Armor Slots to reduce damage they take.
- **Flair, Adrenaline:** When your Stress is maxed out, gain advantage on all Strength, Instinct and Agility rolls until the end of the scene or until your Stress is reduced. This overrides the usual max Stress penalties. If the scene ends while your Stress is still maxed, Adrenaline stops and the normal penalties apply (the crash).
- **Hope feature, Calm Under Pressure:** Clear 2 Stress.

Note: Calm Under Pressure ends Adrenaline, so the player has to choose between keeping the bonus and clearing Stress.

---

### Mechanic (Body + Tech)

*The fixer. Gets the generator running and builds what the moment needs from junk.*
Examples: field engineer, electrician, janitor, car mechanic, handyman.

- **Main, MacGyver:** Collect **Scrap** on rolls with Hope. Scrap refills on a short rest. Spend Scrap to build things.
- **Flair:** Advantage on rolls to understand, follow or navigate tech and infrastructure (vents, fuse boxes, maintenance tunnels, wiring).
- **Hope feature, Not Pretty, But It'll Do:** Create a Scrap build on the spot without spending Scrap. It breaks immediately after one use.

Open:
- Max Scrap; does a short rest refill to a set amount or to max?
- What can be built, and at what Scrap cost?
- Can other characters (e.g. the Scientist with Tech cards) use Scrap?
- Name for the Flair.

---

### Scientist (Mind + Tech)

*The analyst. Understands what's happening, and pays for it.*
Examples: researcher, lab tech, grad student, journalist, hacker.

- **Main, Hypothesis:** Spend 1 Hope to declare a reasonable hypothesis about an anomaly (e.g. "It's drawn to heat"). If the group's test confirms it, choose one bonus for the party. A wrong hypothesis only costs the Hope.
  - Bonuses last until the anomaly is dealt with.
  - Bonuses stack across different confirmed hypotheses (hypotheses must be reasonable, at GM discretion).
  - **Bonus options:**
    - **Steeled:** When the anomaly causes Stress, each party member marks 1 less.
    - **Weak Spot:** Attacks against the anomaly deal +1 HP damage.
    - **Predictable:** The party gains +1 Evasion against the anomaly's attacks.
    - **Countermeasure:** Once per scene, one party member can ignore one of the anomaly's features.
    - **Early Warning:** The anomaly can't surprise the party. The GM must show a sign before it acts.
    - **Leverage:** Advantage on rolls to trap, evade or contain the anomaly.
- **Flair, Cold Logic:** Each time you receive Stress from an anomaly, ask the GM one question from the list. They answer truthfully.
  - What is it reacting to right now?
  - What is it about to do?
  - Where is it, or where is it coming from?
  - What here is dangerous that I haven't noticed?
  - Is it hurt, and how badly?
  - What would make this worse?
- **Hope feature, It Starts With a Plan (3 Hope):** Distribute 3 Hope among the other players.

---

### Doctor (Mind + Aid)

*The one making the hard calls. Keeps people alive, but can't save everyone.*
Examples: paramedic, nurse, surgeon, psychologist, first aider.

- **Main, Code Red:** At the start of a dangerous scene, name one ally as your priority. When you Help an Ally for them, add a d8 instead of a d6. You can switch your priority mid-scene. When you do, gain a Hope, and the previous priority marks a Stress (they know you've given up on them).
- **Flair, House Call:** During a rest, choose one ally as your patient. They clear 1 additional HP or 1 additional Stress, and can choose from improved rest options.
- **Hope feature, Unparalleled Concentration:** Gain advantage on Finesse, Instinct and Knowledge rolls until the end of the scene.

Notes:
- Loop: switching priority generates Hope, which fuels Unparalleled Concentration.
- Unparalleled Concentration shares Instinct with the Soldier's Adrenaline. Possible swap to Presence if they should be fully distinct. **(open)**
- "Improved rest options" still need to be defined. **(open)**

---

## Class Overview

| Class | Domains | Main | Flair | Hope feature |
|---|---|---|---|---|
| Soldier | Body + Aid | Ward | Adrenaline | Calm Under Pressure |
| Mechanic | Body + Tech | MacGyver | Tech/infrastructure advantage | Not Pretty, But It'll Do |
| Scientist | Mind + Tech | Hypothesis | Cold Logic | It Starts With a Plan |
| Doctor | Mind + Aid | Code Red | House Call | Unparalleled Concentration |

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