-- PostgreSQL Schema for Video Forge
-- Converted from MariaDB schema

-- Users table with username support
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255),
    role VARCHAR(50) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Jobs table
CREATE TABLE IF NOT EXISTS jobs (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    input_source VARCHAR(1024),
    output_format VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    progress INTEGER DEFAULT 0,
    error_text TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Media assets table
CREATE TABLE IF NOT EXISTS media_assets (
    id BIGSERIAL PRIMARY KEY,
    job_id BIGINT NOT NULL,
    asset_type VARCHAR(50) NOT NULL,
    path VARCHAR(1024) NOT NULL,
    size_bytes BIGINT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_job_id ON media_assets(job_id);
CREATE INDEX IF NOT EXISTS idx_asset_type ON media_assets(asset_type);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Create a trigger function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for jobs table
CREATE TRIGGER update_jobs_updated_at 
    BEFORE UPDATE ON jobs 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

SELECT 'PostgreSQL schema setup complete.' as status;