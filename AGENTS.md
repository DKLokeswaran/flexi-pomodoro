# AGENTS.md

## Frontend work

Before any frontend change, bug fix, or new feature in `apps/web`, read `apps/web/DESIGN.md` and apply it using the rules below.

### How to read DESIGN.md

`DESIGN.md` is a flavors.design flavor and has three layers with different authority:

1. **YAML front matter tokens** (`colors`, `typography`, `rounded`, `spacing`): the normative values, per the Google DESIGN.md spec.
2. **Hand-written prose** (Overview through Motion, including Components and Do's and Don'ts): how to apply the tokens. It uses the flavor's own vocabulary, where `accent` means the brand gold.
3. **shadcn/ui Usage section**: a kit generated from the tokens. Its variable names follow shadcn semantics; any value in it that does not come from a token is a generator default, not a design decision.

Resolve conflicts this way:

- Where the tokens or prose give a value, they win over the generated shadcn kit.
- Where the design is silent (hover surfaces, error color, chart colors), the generated shadcn value fills the gap.
- Variable names follow shadcn semantics: the flavor's `accent` (gold) is `--primary`; shadcn's `--accent` is the hover surface.
