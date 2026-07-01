// ============================================================
// Supabase 연결 설정
// 개인용 앱이라 별도 로그인 없이 anon(공개) 키로 바로 접근합니다.
// 보안은 PIN 화면 + Supabase RLS 정책(rls_setup.sql 참고)으로 처리됩니다.
// ============================================================

const SUPABASE_URL = "https://sjrxgqpugoveuaeenukp.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_l5zLRdcbszUohxIC-l1NIg_NNSFahJV";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

// PIN 통과 후 app.js에서 호출됨.
// 이제 별도 로그인 절차가 없으므로 항상 true를 반환.
async function ensureSupabaseLogin() {
  return true;
}
