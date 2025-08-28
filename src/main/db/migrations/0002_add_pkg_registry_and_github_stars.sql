-- Add package_registry and github_stars to mcp_servers
ALTER TABLE mcp_servers ADD COLUMN package_registry TEXT;
ALTER TABLE mcp_servers ADD COLUMN github_stars INTEGER;

-- Indexes for new columns
CREATE INDEX IF NOT EXISTS idx_mcp_servers_package_registry ON mcp_servers (package_registry);
CREATE INDEX IF NOT EXISTS idx_mcp_servers_github_stars ON mcp_servers (github_stars);

