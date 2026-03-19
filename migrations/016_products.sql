-- Migration 016: Products catalog table
-- Stores products/SKUs for each site (colchones, accesorios, etc.)

CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES domain_sites(id),
    name TEXT NOT NULL,
    model TEXT,
    category TEXT,
    price DECIMAL,
    currency TEXT DEFAULT 'USD',
    firmness TEXT,
    type TEXT,
    materials JSONB DEFAULT '[]',
    features JSONB DEFAULT '[]',
    target_segment TEXT,
    best_for JSONB DEFAULT '[]',
    pros JSONB DEFAULT '[]',
    cons JSONB DEFAULT '[]',
    comparison_vs JSONB DEFAULT '{}',
    image_url TEXT,
    product_url TEXT,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_site ON products(site_id);
