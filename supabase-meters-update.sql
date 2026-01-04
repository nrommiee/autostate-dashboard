-- =====================================================
-- AutoState Dashboard - Meter Models Enhancement
-- Execute this SQL in Supabase SQL Editor
-- =====================================================

-- 1. Create meter_model_tests table for test history
CREATE TABLE IF NOT EXISTS meter_model_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID REFERENCES meter_models(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  tested_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Results
  success BOOLEAN NOT NULL,
  validation_type TEXT CHECK (validation_type IN ('auto', 'manual')) NOT NULL,
  confidence DOUBLE PRECISION,
  
  -- Extracted data
  extracted_serial TEXT,
  extracted_reading TEXT,
  expected_serial TEXT,
  expected_reading TEXT,
  
  -- Debug
  ai_response JSONB,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create index for performance
CREATE INDEX IF NOT EXISTS idx_meter_model_tests_model_id 
ON meter_model_tests(model_id);

CREATE INDEX IF NOT EXISTS idx_meter_model_tests_created_at 
ON meter_model_tests(created_at DESC);

-- 3. Enable RLS
ALTER TABLE meter_model_tests ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policy (allow all for service role)
DROP POLICY IF EXISTS "Allow all for service role" ON meter_model_tests;
CREATE POLICY "Allow all for service role" 
ON meter_model_tests FOR ALL USING (true);

-- 5. Add keywords column to meter_models
ALTER TABLE meter_models 
ADD COLUMN IF NOT EXISTS keywords JSONB DEFAULT '[]';

-- 6. Add test_success_rate column to meter_models
ALTER TABLE meter_models 
ADD COLUMN IF NOT EXISTS test_success_rate DOUBLE PRECISION DEFAULT 0;

-- 7. Add display_type if not exists
ALTER TABLE meter_models 
ADD COLUMN IF NOT EXISTS display_type TEXT;

-- 8. Add primary_color if not exists
ALTER TABLE meter_models 
ADD COLUMN IF NOT EXISTS primary_color TEXT;

-- 9. Update meter_models RLS if needed
ALTER TABLE meter_models ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for service role" ON meter_models;
CREATE POLICY "Allow all for service role" 
ON meter_models FOR ALL USING (true);

-- 10. Function to calculate test success rate
CREATE OR REPLACE FUNCTION update_meter_model_test_rate()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE meter_models
  SET test_success_rate = (
    SELECT COALESCE(
      CAST(COUNT(*) FILTER (WHERE success = true) AS FLOAT) / 
      NULLIF(COUNT(*), 0),
      0
    )
    FROM meter_model_tests
    WHERE model_id = NEW.model_id
  )
  WHERE id = NEW.model_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 11. Trigger to auto-update success rate
DROP TRIGGER IF EXISTS trigger_update_test_rate ON meter_model_tests;
CREATE TRIGGER trigger_update_test_rate
AFTER INSERT ON meter_model_tests
FOR EACH ROW
EXECUTE FUNCTION update_meter_model_test_rate();

-- =====================================================
-- Verification queries (run after to check)
-- =====================================================

-- Check meter_model_tests table exists
-- SELECT * FROM meter_model_tests LIMIT 1;

-- Check new columns on meter_models
-- SELECT id, name, keywords, test_success_rate, display_type, primary_color 
-- FROM meter_models LIMIT 1;
