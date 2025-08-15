-- Create ratings table
CREATE TABLE ratings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  url_hash TEXT NOT NULL,
  user_id_hash UUID NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  is_spam BOOLEAN DEFAULT FALSE,
  is_misleading BOOLEAN DEFAULT FALSE,
  is_scam BOOLEAN DEFAULT FALSE,
  processed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create url_stats table for aggregated data
CREATE TABLE url_stats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  url_hash TEXT UNIQUE NOT NULL,
  trust_score DECIMAL(5,2),
  rating_count INTEGER DEFAULT 0,
  spam_reports_count INTEGER DEFAULT 0,
  misleading_reports_count INTEGER DEFAULT 0,
  scam_reports_count INTEGER DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX idx_ratings_url_hash ON ratings(url_hash);
CREATE INDEX idx_ratings_user_id_hash ON ratings(user_id_hash);
CREATE INDEX idx_ratings_processed ON ratings(processed);
CREATE INDEX idx_url_stats_url_hash ON url_stats(url_hash);

-- Enable Row Level Security
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE url_stats ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can only insert/update their own ratings
CREATE POLICY "Users can manage own ratings" ON ratings
  FOR ALL USING (auth.uid() = user_id_hash);

-- Anyone can read url_stats (public data)
CREATE POLICY "Anyone can read url stats" ON url_stats
  FOR SELECT USING (true);

-- Only authenticated users can read ratings (for aggregation purposes)
CREATE POLICY "Authenticated users can read ratings" ON ratings
  FOR SELECT USING (auth.role() = 'authenticated');