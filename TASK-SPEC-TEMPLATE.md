# CEREBRO — Task Spec Template for Claude Code
## Opus produces these → User passes to Code → Code implements

---

### CÓMO USAR:
1. Opus analiza y diseña la solución
2. Opus genera un task spec siguiendo este formato
3. Copias el task spec y se lo pasas a Claude Code
4. Code lee CLAUDE.md (automático) + el task spec → implementa
5. Code actualiza `docs/CEREBRO-State.md` al final

---

### TEMPLATE (Opus llena esto):

```markdown
# TASK: [nombre corto de la tarea]
## Session: [N] | Priority: [P0/P1/P2] | Estimated: [tiempo]

## CONTEXT
[1-3 oraciones de por qué se hace esto. Qué problema resuelve.]

## FILES TO MODIFY
- `path/to/file1.py` — [qué cambiar]
- `path/to/file2.py` — [qué cambiar]

## REQUIREMENTS
1. [Requisito específico y verificable]
2. [Requisito específico y verificable]
3. [Requisito específico y verificable]

## IMPLEMENTATION NOTES
[Detalles técnicos que Code necesita saber. Gotchas, edge cases, dependencias.]

## DO NOT
- [Cosa que NO debe hacer — anti-patrón específico]
- [Otra cosa que NO debe hacer]

## VERIFICATION
- [ ] [Cómo verificar que funciona — test específico]
- [ ] [Segundo check]
- [ ] Update docs/CEREBRO-State.md with changes

## AFTER DEPLOY
[Qué hacer después — test manual, URL a verificar, etc.]
```

---

### EJEMPLO REAL (Session 8):

```markdown
# TASK: Pipeline quality overhaul — remove humanize step
## Session: 8 | Priority: P0 | Estimated: 15 min

## CONTEXT
Content quality is bad. Root cause: DeepSeek-chat rewrites Sonnet's draft in humanize step,
degrading quality. Also 6000 char truncation cuts articles. Fix: eliminate humanize,
make draft the final output with Sonnet + 12K tokens.

## FILES TO MODIFY
- `packages/ai/__init__.py` — Empty _STEP_PROVIDER and _STEP_MODEL dicts (keep infrastructure)
- `packages/ai/prompts/content_prompts.py` — New DRAFT_SYSTEM with 6 writing principles + persona_block. New DRAFT_USER with keyword/search_intent.
- `packages/content/pipeline.py` — Remove _humanize() call from main flow. All post-processing operates on draft. max_tokens=12000. Inject persona_block. Pass keyword through brief.

## REQUIREMENTS
1. All LLM calls route to Anthropic (no DeepSeek, no OpenAI)
2. Draft uses Sonnet with max_tokens=12000
3. No humanize step in pipeline flow
4. Persona voice from client_profiles.persona_voice injected into draft system prompt
5. anti-words filter still runs on draft output
6. _humanize() function kept as dead code for future reference

## DO NOT
- Delete _humanize() function (keep as dead code)
- Delete OpenAI/DeepSeek provider code (infrastructure for future)
- Change scorer, linker, anti_words, or knowledge engine

## VERIFICATION
- [ ] `python3 -c "import ast; ast.parse(open('packages/ai/__init__.py').read())"` — no syntax errors
- [ ] `python3 -c "import ast; ast.parse(open('packages/content/pipeline.py').read())"` — no syntax errors
- [ ] `grep "await _humanize" packages/content/pipeline.py` — returns nothing
- [ ] `grep "humanized" packages/content/pipeline.py` — returns nothing
- [ ] `grep "max_tokens=12000" packages/content/pipeline.py` — returns match
- [ ] Deploy and generate 1 test article
- [ ] Update docs/CEREBRO-State.md

## AFTER DEPLOY
- Generate article with keyword "mejor colchón para dolor de espalda panamá"
- Review for: narrative arc, human voice, data integration
- Share output with founder for Phase A gate check
```
