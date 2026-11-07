// =====================================================================
// Q&A 게시판 연결 설정 (Supabase)
// Supabase 대시보드 → Project Settings → API 에서 두 값을 복사해 붙여넣으세요.
//
// ※ 여기 넣는 anon(public) 키는 원래 공개용 키라 GitHub에 올라가도 괜찮습니다.
//    실제 접근 제한은 supabase/schema.sql 의 RLS(경북대 메일만 허용)가 담당합니다.
// ※ 절대로 service_role 키를 넣지 마세요. (모든 보안을 우회하는 관리자 키)
//
// contactEmail: 개인정보 문의·게시글 신고를 받을 운영자 메일 (사이트에 공개됩니다)
//   → 개인 메일 대신 운영용 메일을 따로 만들어 쓰는 것을 추천합니다.
// =====================================================================
window.KNU_SQUARE_CONFIG = {
  supabaseUrl: "https://swzmdqaoqdrtbiupedbp.supabase.co",
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3em1kcWFvcWRydGJpdXBlZGJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQwMzk1MDgsImV4cCI6MjEwOTYxNTUwOH0.LJeUcbwDRxAwA_5OGvvUJ0TP4vJHgRCxr1mGVC48wRs",
  contactEmail: "hagseong12@gmail.com"
};
