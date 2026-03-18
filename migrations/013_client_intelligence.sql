-- 013_client_intelligence.sql
-- Client/market intelligence profiles — one per site
CREATE TABLE IF NOT EXISTS client_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES domain_sites(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  company_url TEXT,
  country TEXT NOT NULL,
  industry TEXT,
  value_proposition TEXT,
  core_competencies JSONB DEFAULT '[]',
  pain_points JSONB DEFAULT '[]',
  desires JSONB DEFAULT '[]',
  target_segments JSONB DEFAULT '[]',
  advantages JSONB DEFAULT '[]',
  weaknesses JSONB DEFAULT '[]',
  competitors JSONB DEFAULT '[]',
  content_angles JSONB DEFAULT '[]',
  customer_objections JSONB DEFAULT '[]',
  buying_triggers JSONB DEFAULT '[]',
  market_trends JSONB DEFAULT '[]',
  key_differentiators JSONB DEFAULT '[]',
  brand_voice_notes TEXT,
  research_depth TEXT DEFAULT 'none' CHECK (research_depth IN ('none','initial','standard','deep')),
  research_version INTEGER DEFAULT 0,
  last_researched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(site_id)
);

-- Individual market research entries — append-only log
CREATE TABLE IF NOT EXISTS market_research (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES domain_sites(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES client_profiles(id) ON DELETE CASCADE,
  research_type TEXT NOT NULL CHECK (research_type IN (
    'company_analysis', 'competitor_analysis', 'audience_research',
    'pain_point_discovery', 'market_trends', 'content_gap_analysis',
    'keyword_opportunity', 'positioning_analysis'
  )),
  query TEXT NOT NULL,
  findings TEXT,
  structured_data JSONB DEFAULT '{}',
  confidence TEXT DEFAULT 'medium' CHECK (confidence IN ('low','medium','high')),
  source TEXT DEFAULT 'ai_research',
  applied_to_profile BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_profiles_site ON client_profiles(site_id);
CREATE INDEX IF NOT EXISTS idx_market_research_site ON market_research(site_id);
CREATE INDEX IF NOT EXISTS idx_market_research_type ON market_research(site_id, research_type);
