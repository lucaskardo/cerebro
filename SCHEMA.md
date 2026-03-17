# CEREBRO — Schema Reference

> All tables include `site_id UUID FK → domain_sites(id)`. This is the sacred rule.
> Migrations live in `migrations/001–008_*.sql`. Each file is idempotent (`IF NOT EXISTS`).

---

## Migration Order

| File | Tables |
|------|--------|
| `001_core.sql` | missions, domain_sites, cost_events, operator_alerts, seo_rule_versions, demand_signals |
| `002_content.sql` | clusters, opportunities, content_assets, pages, social_content_queue, email_sequences, content_versions, cta_variants |
| `003_leads.sql` | leads, lead_events, lead_outcomes, partner_deliveries, partner_webhooks |
| `004_strategy.sql` | goals, strategies, strategy_variations, knowledge_entries, compliance_rules, prompt_versions |
| `005_attribution.sql` | visitors, sessions, touchpoints, attribution_events, channel_performance, metrics_daily, experiments, fact_daily_asset_performance, fact_daily_channel_performance |
| `006_multibrand.sql` | ALTER domain_sites (brand columns) |
| `007_personas.sql` | personas, persona_identities |
| `008_operations.sql` | jobs, audit_log, approvals, feature_flags |

---

## Core Tables

### missions
Primary business objective. Parent of all content and leads.
- `id`, `name`, `country`, `objective`, `partner_name`
- `target_audience JSONB`, `core_topics JSONB`, `cta_config JSONB`
- `budget_daily_usd`, `status`

### domain_sites
One row per brand/domain. The `site_id` foreign key on all other tables references this.
- `id`, `mission_id → missions`, `domain` (UNIQUE), `site_type`
- `brand_name`, `brand_persona`, `brand_tone`, `brand_audience JSONB`, `brand_topics JSONB`, `brand_cta JSONB`
- `author_name`, `author_bio`, `author_avatar_url`
- `status`

---

## Content Tables

### content_assets
Articles, guides, tools. The main content entity.
- `id`, `site_id → domain_sites`, `mission_id → missions`
- `title`, `slug`, `keyword`, `asset_type`
- `brief JSONB`, `outline JSONB`, `body_md`, `body_html`, `meta_description`
- `quality_score`, `humanization_score`, `validation_results JSONB`
- `research_json JSONB`, `conversion_plan_json JSONB`
- `faq_section JSONB`, `partner_mentions JSONB`
- `status`: `generating → draft → review → approved → published → archived`

### social_content_queue
Platform-specific content generated per persona per article.
- `id`, `site_id → domain_sites`, `content_asset_id → content_assets`, `persona_id → personas`
- `platform`: instagram, tiktok, x, linkedin, reddit, facebook, whatsapp
- `content_type`: post, reel, carousel, thread, story, comment, video_script, whatsapp_message
- `content_text`, `image_prompt`, `audio_url` (Chatterbox), `video_url` (HeyGen)
- `status`: `draft → approved → scheduled → published / rejected / failed`
- All items start as `draft`. Human approval required before scheduling.

### cta_variants
A/B testable CTAs per asset and position.
- `id`, `site_id`, `asset_id → content_assets`
- `position`: hero, mid, end, sidebar
- `text`, `url`, `variant_name`
- `impressions`, `clicks`, `conversions`

### content_versions
Audit trail of content edits.
- `id`, `site_id`, `asset_id → content_assets`
- `version_number`, `body_md`, `changed_by`

---

## Lead Tables

### leads
All captured leads. Single source of truth for contacts.
- `id`, `site_id → domain_sites`, `mission_id → missions`
- `email`, `nombre`, `telefono`
- `utm_source/medium/campaign/content`, `visitor_id`, `session_id`, `asset_id`, `cta_variant`
- `intent_score` (0–100), `quiz_responses JSONB`
- `current_status`: `new → confirmed → nurturing → qualified → delivered → accepted/rejected → closed`
- Dedupe: same email + site_id within 24h = merge, not duplicate

### lead_events
State machine audit log. One row per transition.
- `id`, `site_id`, `lead_id → leads`
- `from_status`, `to_status`, `reason`, `triggered_by`

### lead_outcomes
Revenue source of truth. One row per lead (UNIQUE on lead_id).
- `id`, `site_id`, `lead_id → leads` (UNIQUE)
- `status`: pending, accepted, rejected
- `revenue_value DECIMAL`, `partner`, `source`: manual / webhook / system
- Partner webhook wins over manual estimate if conflict.

---

## Strategy Tables

### goals
What the operator wants to achieve. Parent of strategies.
- `id`, `site_id`, `mission_id`, `description`, `target_metric`, `target_value`, `current_value`
- `status`: active, achieved, paused

### strategies
AI-proposed approaches to achieve a goal.
- `id`, `site_id`, `goal_id → goals`
- `name`, `channel`, `skills_needed JSONB`, `confidence_score`
- `status`: proposed → approved → running → completed / failed

### knowledge_entries
Structured learnings from experiments. NOT narrative summaries.
- `id`, `site_id`, `category`
- `condition_json JSONB` — when this applies (e.g. `{channel: instagram, asset_type: carousel}`)
- `metric_name`, `metric_value DECIMAL`, `sample_size`, `confidence`: low/medium/high
- Only promoted if `sample_size >= 100` and `confidence >= medium`

---

## Attribution Tables

### visitors
One row per unique visitor (fingerprinted).
- `id`, `site_id`, `fingerprint_hash`, `first_seen`, `last_seen`

### sessions
One row per visit. Captures UTM context at landing.
- `id`, `site_id`, `visitor_id → visitors`
- `source`, `medium`, `campaign`, `content`, `referrer`, `landed_on`

### touchpoints
Every trackable event within a session.
- `id`, `site_id`, `session_id → sessions`
- `event_type`: page_view, cta_click, calculator_complete, quiz_complete, form_start, form_submit, email_capture
- `asset_id`, `cta_id`, `page_url`, `metadata_json`

### fact_daily_asset_performance
Pre-aggregated daily metrics per asset. Source for reports.
- `id`, `site_id`, `asset_id → content_assets`, `date` (UNIQUE per site+asset+date)
- `visits`, `unique_visitors`, `leads`, `qualified_leads`, `revenue`, `cta_clicks`

### fact_daily_channel_performance
Pre-aggregated daily metrics per channel.
- `id`, `site_id`, `channel`, `date` (UNIQUE per site+channel+date)
- `visits`, `leads`, `qualified_leads`, `revenue`

### experiments
A/B tests with full state machine.
- `id`, `site_id`, `hypothesis`, `target_metric`
- `variant_a_json`, `variant_b_json`, `run_window_days`
- `status`: planned → running → evaluated → winner_declared → archived
- `outcome_json`, `winner`, `learnings`

---

## Persona Tables

### personas
Digital identities for social distribution.
- `id`, `site_id → domain_sites`
- `name`, `age`, `city`, `backstory`
- `personality_traits JSONB`: tone, role, style
- `platforms JSONB`: per-platform config
- `anti_detection_rules JSONB`
- `status`: active, inactive, suspended

### persona_identities
Credentials per persona per platform. Passwords AES-encrypted at rest.
- `id`, `persona_id → personas`
- `platform`: instagram, tiktok, x, reddit, linkedin, whatsapp, email, facebook, youtube, telegram
- `handle_or_email`, `password_encrypted` (Fernet)
- `recovery_email`, `recovery_phone`, `api_keys JSONB`, `two_factor_secret`
- `status`: active, suspended, pending_setup
- Reveal requires `X-Master-Key` header. Audit-logged.

---

## Operations Tables

### jobs
Persistent task queue. Survives restarts. Idempotent via `idempotency_key`.
- `id`, `site_id`, `type`, `payload_json JSONB`
- `status`: queued → running → completed → failed → cancelled → dead_lettered
- `attempts`, `max_attempts` (default 3), `error`, `idempotency_key` (UNIQUE)
- `priority`, `started_at`, `completed_at`

### audit_log
Every mutable API action is logged here.
- `id`, `site_id`, `actor`, `action`, `entity_type`, `entity_id`, `ip`, `payload_summary JSONB`

### approvals
Human-in-the-loop gate for sensitive actions.
- `id`, `site_id`, `entity_type`, `entity_id`, `action`
- `status`: pending → approved/rejected → executed/expired
- Required for: publish articles, CTA changes, email sends, social posts, gasto >$5

### feature_flags
Runtime on/off per site.
- `id`, `site_id → domain_sites`, `flag_name` (UNIQUE per site)
- `enabled BOOLEAN`
- Default flags: auto_publish_articles, social_scheduler_enabled, whatsapp_enabled, sandbox_mode, loop_scheduler_enabled

---

## Key Relationships

```
missions
  └── domain_sites (site_id)
        ├── content_assets
        │     ├── cta_variants
        │     ├── content_versions
        │     └── social_content_queue
        ├── leads
        │     ├── lead_events
        │     └── lead_outcomes
        ├── goals → strategies → strategy_variations
        ├── knowledge_entries
        ├── personas → persona_identities
        ├── visitors → sessions → touchpoints
        ├── experiments
        ├── jobs
        ├── approvals
        └── feature_flags
```

---

## State Machines

| Entity | States |
|--------|--------|
| Lead | new → confirmed → nurturing → qualified → delivered → accepted/rejected → closed |
| Content | generating → draft → review → approved → published → archived |
| Experiment | planned → running → evaluated → winner_declared → archived |
| Job | queued → running → completed → failed → cancelled → dead_lettered |
| Approval | pending → approved/rejected → executed/expired |
| Social post | draft → approved → scheduled → published / rejected / failed |
| Persona | inactive → active → suspended |
| Identity | pending_setup → active → suspended |

---

## Autonomy Policy

**Auto-run (no approval):** briefs, drafts, reporting, opportunity scoring, lead scoring, knowledge updates.

**Approval required:** publish articles, CTA changes in prod, outbound email, WhatsApp to real contacts, social posting (all platforms), spend >$5/action, any change to public experience.

**Never:** auto-posting without approval, credentials in logs, actions not in audit_log.
