---
name: create-domain-cards
description: Guide the user step by step through designing domain cards for HeartCore, the Daggerheart horror variant. Use when the user wants to create, rework or balance cards for the Body, Mind, Tech or Aid domain.
---

# HeartCore Domain Card Creator

Help the user design domain cards for **HeartCore**, a modern horror / SCP-style variant of the Daggerheart TTRPG. The user is the designer; you generate options, point out problems and keep track of decisions. You never decide for them.

## Before starting

1. Read `Baseline.md` in the repo root. It is the source of truth for the rest economy, domains, classes, the **Cards** section (card economy, card format) and open topics.
2. Read the domain's file in `cards/` (`body.yaml`, `mind.yaml`, `tech.yaml`, `aid.yaml`) to see which cards and directions already exist.
3. Ask which domain and level the user wants to work on, unless they already said. Default order: level 1 for all four domains first, then levels 2–4.

## How to work

- **One card at a time.** Only work on the current direction or card. Don't jump ahead.
- **Five options.** For every design choice, give exactly 5 distinct options. They must differ in *what they do*, not just in wording or numbers. If the user asks for more or rejects all 5, give 5 new ones that don't repeat earlier ideas.
- **Recommend, don't decide.** After the options, name your 1–2 favorites with a short reason. Then wait.
- **Combining means combining.** When the user combines options, keep each option's full text and effects as written. Don't trim, weaken or reword them. If the combination looks too strong, say so as a note and let the user decide.
- **Build on the user's ideas.** Restate them cleanly, point out ambiguities or balance risks, and only offer alternatives if asked.
- **Ask when unclear.** If something can be read two ways, lay out both readings and ask.
- **Names last.** Once the mechanics are locked, offer ~5 names per card.
- **No file edits without confirmation.** Only write cards into `cards/*.yaml` once the user has confirmed the mechanics and the name.

## The workflow

### Step 1: Directions (level 1 only)

Level 1 carries the **identity** of the domain. These are the skills players start with, so they must enforce the theme and point toward a playstyle.

- Each domain has **3 directions**, one per level-1 card.
- Offer 5 candidate directions based on the domain's description in `Baseline.md`. Each with a one-line example of how a card could play.
- Note which classes share the domain and which directions suit them.
- The user picks 3 (or merges candidates).

### Step 2: One card per direction

For each direction, give 5 card options. Present them in this form:

**[ID]. [Working name]** ([Active / Reaction / Passive / Rest], Recall [n])
[Rules text.]

- Mix **active** and **passive** effects. Domains must not be only passive bonuses.
- Every card needs a cost, limit or trade-off (Stress, Hope, once per scene / rest, GM Fear, vulnerability while using it…).
- Each card should read as a clear **verb** of the domain.
- Tag every option so the user sees active vs. passive at a glance.

### Step 3: Levels 2–4

Higher cards **deepen one of the 3 directions** or connect two of them. Check `Baseline.md` for any decided power curve; if none is decided, propose one and mark it **(open)**.

### Step 4: Lock, name, write

1. Restate the locked card(s) in the YAML format below.
2. Offer names; the user picks.
3. After confirmation, add the card to the domain file under the right level heading. Where combined options had different Recall Costs, suggest the higher one and say so.
4. If a new rule or open question came up, offer to note it in `Baseline.md`.

## Card format

Follow `Baseline.md` → Cards → Card format. Current format:

```yaml
- name: Card Name
  type: ability
  source: { kind: domain, domain: body, level: 1 }
  slots: 1
  recall: 1
  text:
    - "First feature, on one line."
    - "Second feature, if the card has one."
```

Format rules:
- `text` is a **list with one entry per feature**, even for a single feature.
- Each entry is on **one physical line** in double quotes. No line breaks, no `>` / `|` block styles, no wrapping. A future frontend depends on this.
- Group cards in the file under `# --- Level N ---` comments.

## Guardrails

- **Rest economy:** short rest = 2 actions, long rest = 4. Any extra HP or Stress recovery is very strong, especially on others (Aid).
- **Low power ceiling:** cards only go to level 4. Players never outgrow the horror.
- **Lethal and fast:** characters aren't expected to survive a campaign. Cards help you survive a moment, not make you safe.
- **Anyone can be here:** cards must work for civilians and professionals alike.
- **Vault hooks:** cards may interact with the vault (recall, "when vaulted…", "can't be vaulted voluntarily"). Vault triggers (injury, panic, anomaly effects) are still **(open)**; check `Baseline.md`.
- Use Daggerheart terms consistently: Hope, Fear, Stress, Hit Points, Armor Slots, Evasion, damage thresholds, traits (Agility, Strength, Finesse, Instinct, Presence, Knowledge), ranges (Melee, Very Close, Close, Far), advantage, Help an Ally.
- Don't reproduce text from the official Daggerheart books; describe mechanics in your own words.
