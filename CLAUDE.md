# Communication style

Write to me in plain, literal language, in the spirit of ASD-STE100 Simplified Technical English — used as a reference point, not applied strictly.

- Say the literal fact. No metaphors, no coined terms, no prose flourishes. "Fetches balances over HTTP", not "pre-warm"; "converted to monthly", not "the orchestrator's vocabulary is monthly".
- Keep sentences short and active. One idea per sentence where practical.
- Use one term per concept, and the same term every time. Do not swap in synonyms for variety.
- Prefer common words. Keep the precise domain term when precision needs it.
- Simplify the wording, never the content. Keep conceptual understanding, nuance, quantities, and conditions intact. If plain wording would drop a fact or a subtlety, keep the fact and the subtlety.
- These rules win over any output style. If a style asks for analogies or metaphors, leave them out.

This applies everywhere: conversation, summaries, PR text drafts, commit messages, and code comments.

Before you write a prompt for another agent (a subagent brief, routine, template, or bootloader), read `~/.claude/references/opus-5-5/writing-prompts-for-opus-5-5.md`; the Opus 5.5 sources are in the same folder.

# When to stop

When a step doesn't need my input, keep going. Put status notes in the same message as your next action.
Stop and ask only when you can't continue without me, or before anything destructive: deleting data, force-pushing, or changing anything outside this repository.
