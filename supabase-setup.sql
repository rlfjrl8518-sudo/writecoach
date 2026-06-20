-- 글습관 Supabase 설정 SQL
-- Supabase 대시보드 → SQL Editor에서 실행하세요

-- 1. 데이터 테이블 생성
CREATE TABLE IF NOT EXISTS user_data (
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  data       JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Row Level Security 활성화 (본인 데이터만 접근 가능)
ALTER TABLE user_data ENABLE ROW LEVEL SECURITY;

-- 3. 정책: 본인 데이터만 읽기/쓰기
CREATE POLICY "사용자 본인 데이터 접근" ON user_data
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
