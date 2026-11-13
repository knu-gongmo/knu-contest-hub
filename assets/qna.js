"use strict";
// =====================================================================
// KNU 스퀘어 Q&A · 팀원모집 게시판 (Supabase + 경북대 메일 인증)
// - 읽기/쓰기 모두 @knu.ac.kr 메일 인증 사용자만 가능 (DB의 RLS에서 강제)
// - 화면에 넣는 모든 값은 esc()로 이스케이프
// =====================================================================

const QNA_DOMAIN = "knu.ac.kr";
const QNA_CFG = window.KNU_SQUARE_CONFIG || {};

// 실수로 관리자(service_role) 키를 넣었으면 사용을 거부 (공개 페이지에 노출되면 DB 전체가 위험)
function qnaKeyRole(key) {
  try {
    const part = String(key).split(".")[1];
    if (part) return JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/"))).role || "";
  } catch (e) {}
  return "";
}
const QNA_KEY_UNSAFE = qnaKeyRole(QNA_CFG.supabaseAnonKey) === "service_role" || /^sb_secret_/.test(String(QNA_CFG.supabaseAnonKey || ""));
if (QNA_KEY_UNSAFE) console.error("[KNU 스퀘어] config.js에 service_role(비밀) 키가 들어 있습니다. anon(public) 키로 바꾸고 Supabase에서 비밀 키를 재발급하세요.");

const QNA_CONFIGURED = !QNA_KEY_UNSAFE && !!(
  QNA_CFG.supabaseUrl &&
  QNA_CFG.supabaseAnonKey &&
  /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(QNA_CFG.supabaseUrl)
);

// Supabase 는 Q&A 탭을 처음 열 때만 불러온다.
// (첫 화면에서 바로 불러오면 카카오톡 링크스티커의 '링크 미리보기'가 멈추는 문제가 있었음)
const QNA_SDK_SRC = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js";
const QNA_SDK_SRI = "sha384-0w2KAL2YHP6wKOkUDzkCDGgVvfmHnj02DHeQ6XcHOgTfFsGyonKOpShMH1x6nk9o";
let qnaClient = null;
let qnaInitPromise = null;

function qnaEnsureClient() {
  if (!QNA_CONFIGURED) return Promise.resolve(null);
  if (qnaInitPromise) return qnaInitPromise;
  qnaInitPromise = new Promise((resolve) => {
    const start = () => {
      qnaClient = window.supabase.createClient(QNA_CFG.supabaseUrl, QNA_CFG.supabaseAnonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
      });
      qnaClient.auth.onAuthStateChange((event, session) => {
        const wasIn = !!qna.session;
        qna.session = session || null;
        qna.ready = true;
        // 콜백 안에서 Supabase를 바로 호출하면 교착될 수 있어 다음 틱에 실행
        if (session) {
          qna.step = "email"; qna.authErr = ""; qna.authMsg = "";
          qnaSavePending("");
          if (!wasIn || event === "SIGNED_IN") setTimeout(() => qnaLoadPosts().then(qnaRefreshIcons), 0);
        } else {
          qna.posts = [];
          state.qnaPosts = [];
          setTimeout(qnaLoadStats, 0);
        }
        setTimeout(qnaRerender, 0);
      });
      resolve(qnaClient);
    };
    if (window.supabase && typeof window.supabase.createClient === "function") return start();
    const s = document.createElement("script");
    s.src = QNA_SDK_SRC;
    s.integrity = QNA_SDK_SRI;
    s.crossOrigin = "anonymous";
    s.onload = () => {
      if (window.supabase && typeof window.supabase.createClient === "function") start();
      else s.onerror();
    };
    s.onerror = () => {
      qnaInitPromise = null;
      qna.ready = true;
      qna.loadFailed = true;
      qnaRerender();
      resolve(null);
    };
    document.head.appendChild(s);
  });
  return qnaInitPromise;
}

const QNA_CATEGORY_LABEL = { team: "팀원 모집", question: "공모전 Q&A", tip: "참가 후기·팁" };
const QNA_NICK_KEY = "knu_square_nickname_v1";
const QNA_CONTACT = /^[^\s@<>"']+@[^\s@<>"']+\.[a-z]{2,}$/i.test(String(QNA_CFG.contactEmail || "")) ? String(QNA_CFG.contactEmail) : "";

// 인증코드를 보낸 메일 주소를 1시간 동안 기억 (탭을 닫았다 열어도 코드 입력 화면으로 복귀)
const QNA_PENDING_KEY = "knu_square_pending_v1";
function qnaSavePending(email) {
  try {
    if (email) localStorage.setItem(QNA_PENDING_KEY, JSON.stringify({ email, at: Date.now() }));
    else localStorage.removeItem(QNA_PENDING_KEY);
  } catch (e) {}
}
function qnaLoadPending() {
  try {
    const p = JSON.parse(localStorage.getItem(QNA_PENDING_KEY) || "null");
    if (p && typeof p.email === "string" && /@knu\.ac\.kr$/.test(p.email) && Date.now() - p.at < 3600000) return p.email;
  } catch (e) {}
  qnaSavePending("");
  return "";
}

// 신고 메일 링크 (연락처가 설정된 경우에만)
function qnaReportHref(kind, id, title) {
  if (!QNA_CONTACT) return "";
  const subject = `[KNU 스퀘어 신고] ${kind} ${id}`;
  const body = `신고 대상: ${kind} (${title || ""})\nID: ${id}\n신고 사유:\n`;
  return `mailto:${QNA_CONTACT}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

const qna = {
  session: null,
  ready: false,           // 세션 확인 완료 여부
  loading: false,
  loadError: "",
  posts: [],
  stats: null,
  step: "email",          // "email" | "code" (아래에서 기억된 주소가 있으면 "code")
  pendingEmail: qnaLoadPending(),
  authMsg: "",
  authErr: "",
  busy: false,
  resendAt: 0,
  openOnly: false,
  consent: false          // 개인정보 수집·이용 동의 체크 여부
};
if (qna.pendingEmail) qna.step = "code";

function qnaUserEmail() {
  return (qna.session && qna.session.user && qna.session.user.email) || "";
}
function qnaIsKnu() {
  return qnaUserEmail().toLowerCase().endsWith("@" + QNA_DOMAIN);
}
function qnaUserId() {
  return (qna.session && qna.session.user && qna.session.user.id) || "";
}
function qnaKstDate(iso) {
  try {
    return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
  } catch (e) {
    return String(iso || "").slice(0, 10);
  }
}
function qnaGetNick() {
  try { return localStorage.getItem(QNA_NICK_KEY) || ""; } catch (e) { return ""; }
}
function qnaSetNick(v) {
  try { localStorage.setItem(QNA_NICK_KEY, v); } catch (e) {}
}

function qnaErrorText(error) {
  const msg = String((error && (error.message || error.error_description)) || error || "");
  if (/RATE_LIMIT/.test(msg)) return msg.replace("RATE_LIMIT: ", "");
  if (/row-level security|permission denied/i.test(msg)) return "경북대 메일(@knu.ac.kr)로 인증한 계정만 이용할 수 있습니다.";
  if (/rate limit|too many|security purposes/i.test(msg)) return "요청이 너무 잦습니다. 잠시 후 다시 시도해주세요.";
  if (/expired|invalid/i.test(msg)) return "인증코드가 틀렸거나 만료되었습니다. 다시 확인해주세요.";
  if (/violates check constraint/i.test(msg)) return "입력 길이를 확인해주세요.";
  if (/Failed to fetch|NetworkError/i.test(msg)) return "서버에 연결하지 못했습니다. 네트워크를 확인해주세요.";
  if (/sending (confirmation|magic link)|send.*email|smtp/i.test(msg)) return "인증 메일을 보내지 못했습니다. 사이트 메일 발송 설정 문제일 수 있으니 잠시 후 다시 시도하거나 운영자에게 알려주세요.";
  return "처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
}

// ---------------------------------------------------------------------
// 데이터 로드
// ---------------------------------------------------------------------
async function qnaLoadStats() {
  if (!qnaClient) return;
  const { data, error } = await qnaClient.rpc("qna_public_stats");
  if (!error && data && typeof data === "object") {
    qna.stats = { posts: Number(data.posts) || 0, openTeams: Number(data.openTeams) || 0 };
    state.qnaCount = qna.stats.posts;
    renderMetrics();
    if (!qna.session) renderQnaBoard();
  }
}

async function qnaLoadPosts() {
  if (!qnaClient || !qna.session || !qnaIsKnu()) return;
  qna.loading = true;
  qna.loadError = "";
  renderQnaBoard();
  const { data, error } = await qnaClient
    .from("qna_posts")
    .select("id,user_id,category,author_name,contest_title,title,content,status,created_at,qna_replies(id,user_id,author_name,content,created_at),qna_likes(user_id)")
    .order("created_at", { ascending: false })
    .order("created_at", { referencedTable: "qna_replies", ascending: true })
    .limit(200);
  qna.loading = false;
  if (error) {
    qna.loadError = qnaErrorText(error);
  } else {
    const me = qnaUserId();
    qna.posts = (data || []).map(p => {
      const likes = Array.isArray(p.qna_likes) ? p.qna_likes : [];
      return {
        id: String(p.id),
        userId: String(p.user_id),
        category: QNA_CATEGORY_LABEL[p.category] ? p.category : "question",
        author: String(p.author_name || ""),
        contestTitle: String(p.contest_title || ""),
        title: String(p.title || ""),
        content: String(p.content || ""),
        status: p.status === "closed" ? "closed" : "open",
        createdAt: String(p.created_at || ""),
        replies: (Array.isArray(p.qna_replies) ? p.qna_replies : []).map(r => ({
          id: String(r.id),
          userId: String(r.user_id),
          author: String(r.author_name || ""),
          content: String(r.content || ""),
          createdAt: String(r.created_at || "")
        })),
        likes: likes.length,
        liked: likes.some(l => l.user_id === me)
      };
    });
    state.qnaPosts = qna.posts;
    state.qnaCount = qna.posts.length;
  }
  renderMetrics();
  renderQnaBoard();
}

// ---------------------------------------------------------------------
// 렌더링
// ---------------------------------------------------------------------
function qnaRenderAuthPanel() {
  const panel = document.getElementById("qna-auth-panel");
  if (!panel) return;

  if (!QNA_CONFIGURED) {
    panel.innerHTML = `
      <div class="flex items-start gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900">
        <i data-lucide="wrench" class="w-5 h-5 shrink-0 mt-0.5"></i>
        <div class="text-xs sm:text-sm">
          <strong class="font-extrabold">게시판 준비 중입니다.</strong>
          <p class="mt-0.5 text-amber-800">경북대 메일 인증 게시판을 연결하고 있어요. 곧 열립니다.</p>
        </div>
      </div>`;
    return;
  }

  if (qna.loadFailed && !qnaClient) {
    panel.innerHTML = `
      <div class="flex flex-wrap items-center justify-between gap-2 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm">
        <span>게시판을 불러오지 못했습니다. 네트워크를 확인해주세요.</span>
        <button type="button" data-qna-act="retry-load" class="px-3 py-1.5 rounded-xl bg-white border border-rose-200 font-bold">다시 시도</button>
      </div>`;
    return;
  }

  if (!qna.ready) {
    panel.innerHTML = `<div class="text-xs text-slate-400 py-3">게시판 불러오는 중…</div>`;
    return;
  }

  if (qna.session) {
    const email = qnaUserEmail();
    const knu = qnaIsKnu();
    panel.innerHTML = `
      <div class="flex flex-wrap items-center justify-between gap-2 p-3 rounded-2xl ${knu ? "bg-emerald-50 border border-emerald-200" : "bg-rose-50 border border-rose-200"}">
        <div class="flex items-center gap-2 text-xs sm:text-sm min-w-0">
          <i data-lucide="${knu ? "badge-check" : "alert-triangle"}" class="w-4 h-4 shrink-0 ${knu ? "text-emerald-700" : "text-rose-700"}"></i>
          <span class="truncate">${knu
            ? `<strong class="font-extrabold text-emerald-800">경북대 인증 완료</strong> <span class="text-emerald-700">${esc(email)}</span>`
            : `<strong class="font-extrabold text-rose-800">경북대 메일 계정이 아닙니다</strong> <span class="text-rose-700">${esc(email)}</span>`}</span>
        </div>
        <div class="flex items-center gap-2">
          <button type="button" data-qna-act="withdraw" class="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-500 hover:text-rose-700">탈퇴</button>
          <button type="button" data-qna-act="logout" class="px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-xs font-bold text-slate-700">로그아웃</button>
        </div>
      </div>`;
    return;
  }

  const cooldown = Math.max(0, Math.ceil((qna.resendAt - Date.now()) / 1000));
  const msg = qna.authErr
    ? `<p class="text-xs font-semibold text-rose-700" role="alert">${esc(qna.authErr)}</p>`
    : qna.authMsg ? `<p class="text-xs font-semibold text-emerald-700" role="status">${esc(qna.authMsg)}</p>` : "";

  if (qna.step === "code") {
    panel.innerHTML = `
      <form id="qna-code-form" class="p-4 sm:p-5 rounded-2xl bg-[#f6f5f2] border border-slate-200 space-y-3">
        <div class="flex items-center gap-2">
          <i data-lucide="mail-check" class="w-5 h-5 text-rose-700"></i>
          <h4 class="text-sm font-extrabold text-slate-900">메일로 받은 인증코드 입력</h4>
        </div>
        <p class="text-xs text-slate-600"><strong>${esc(qna.pendingEmail)}</strong> 으로 인증코드를 보냈습니다. 메일이 안 보이면 스팸함도 확인해주세요.</p>
        <div class="flex flex-col sm:flex-row gap-2">
          <input id="qna-code-input" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6,10}" maxlength="10" required placeholder="숫자 인증코드" class="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm tracking-widest font-bold focus:outline-none focus:ring-2 focus:ring-slate-900" />
          <button type="submit" ${qna.busy ? "disabled" : ""} class="px-4 py-2.5 rounded-xl bg-slate-950 hover:bg-rose-700 disabled:opacity-50 text-white text-xs sm:text-sm font-bold">인증하고 입장</button>
        </div>
        ${msg}
        <div class="flex flex-wrap gap-3 text-xs">
          <button type="button" data-qna-act="resend" ${cooldown > 0 || qna.busy ? "disabled" : ""} class="font-bold text-slate-600 hover:text-rose-700 disabled:opacity-50">${cooldown > 0 ? `코드 다시 받기 (${cooldown}초)` : "코드 다시 받기"}</button>
          <button type="button" data-qna-act="change-email" class="font-bold text-slate-600 hover:text-rose-700">메일 주소 바꾸기</button>
        </div>
      </form>`;
    return;
  }

  panel.innerHTML = `
    <form id="qna-email-form" class="p-4 sm:p-5 rounded-2xl bg-[#f6f5f2] border border-slate-200 space-y-3">
      <div class="flex items-center gap-2">
        <i data-lucide="lock-keyhole" class="w-5 h-5 text-rose-700"></i>
        <h4 class="text-sm font-extrabold text-slate-900">경북대생 전용 게시판입니다</h4>
      </div>
      <p class="text-xs text-slate-600">경북대 메일(@knu.ac.kr)로 인증코드를 받아 로그인하면 팀원 모집글과 Q&amp;A를 보고 쓸 수 있습니다. 비밀번호는 필요 없습니다.</p>
      <div class="flex flex-col sm:flex-row gap-2">
        <label class="flex-1 flex items-center rounded-xl border border-slate-200 bg-white focus-within:ring-2 focus-within:ring-slate-900 overflow-hidden">
          <span class="sr-only">경북대 메일 아이디</span>
          <input id="qna-email-input" type="text" inputmode="email" autocomplete="username" autocapitalize="off" spellcheck="false" required maxlength="64" placeholder="메일 아이디" value="${esc(qna.emailDraft || "")}" class="flex-1 min-w-0 px-3.5 py-2.5 text-sm bg-transparent focus:outline-none" />
          <span class="px-3 py-2.5 text-sm font-bold text-slate-500 bg-slate-50 border-l border-slate-200 shrink-0">@${QNA_DOMAIN}</span>
        </label>
        <button type="submit" ${qna.busy || cooldown > 0 ? "disabled" : ""} class="px-4 py-2.5 rounded-xl bg-rose-700 hover:bg-rose-800 disabled:opacity-50 text-white text-xs sm:text-sm font-bold">${cooldown > 0 ? `${cooldown}초 후 재전송` : "인증코드 받기"}</button>
      </div>
      <div class="rounded-xl bg-white border border-slate-200 p-3 text-xs text-slate-600 space-y-2">
        <p><strong class="text-slate-800">개인정보 수집·이용 안내</strong> · 수집 항목: 경북대 메일 주소 · 목적: 경북대생 인증과 게시글 작성자 구분 · 보관: 탈퇴 시 즉시 삭제 · 동의하지 않을 수 있으며, 이 경우 게시판을 이용할 수 없습니다.</p>
        <label class="flex items-start gap-2 cursor-pointer">
          <input id="qna-consent" type="checkbox" required ${qna.consent ? "checked" : ""} class="mt-0.5 w-4 h-4 accent-rose-700 shrink-0" />
          <span><strong class="text-slate-800">(필수)</strong> 개인정보 수집·이용과 <a href="privacy.html" target="_blank" rel="noopener" class="underline font-bold text-rose-700">게시판 이용규칙</a>에 동의합니다.</span>
        </label>
      </div>
      ${msg}
    </form>`;
}

function qnaPostHtml(post) {
  const me = qnaUserId();
  const mine = post.userId === me;
  const isExpanded = state.expandedQnaIds.has(post.id);
  const replyCount = post.replies.length;
  const catBadgeCls = post.category === "team"
    ? "bg-indigo-50 text-indigo-700 border-indigo-200"
    : post.category === "tip"
    ? "bg-amber-50 text-amber-800 border-amber-200"
    : "bg-rose-50 text-rose-700 border-rose-200";
  const statusBadge = post.category === "team"
    ? (post.status === "open"
      ? `<span class="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-emerald-600 text-white">모집중</span>`
      : `<span class="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-slate-200 text-slate-600">모집완료</span>`)
    : (replyCount > 0
      ? `<span class="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">답변 ${replyCount}</span>`
      : `<span class="px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-500">답변 대기</span>`);

  const replies = replyCount === 0
    ? `<div class="text-xs text-slate-400 bg-white rounded-2xl p-3.5 border border-slate-200/60">아직 댓글이 없습니다. 첫 댓글을 남겨주세요!</div>`
    : post.replies.map(rep => `
        <div class="bg-white rounded-2xl p-3.5 border border-slate-200/90 space-y-1">
          <div class="flex items-center justify-between gap-2 text-xs">
            <strong class="font-extrabold text-slate-900">${esc(rep.author)}${rep.userId === post.userId ? ' <span class="ml-1 px-1.5 py-0.5 rounded bg-slate-900 text-white text-[10px]">작성자</span>' : ""}</strong>
            <span class="flex items-center gap-2 text-slate-400">
              <span>${esc(qnaKstDate(rep.createdAt))}</span>
              ${rep.userId === me
                ? `<button type="button" data-qna-act="delete-reply" data-id="${esc(rep.id)}" class="font-bold text-slate-400 hover:text-rose-700">삭제</button>`
                : (QNA_CONTACT ? `<a href="${esc(qnaReportHref("댓글", rep.id, post.title))}" class="font-bold text-slate-400 hover:text-rose-700">신고</a>` : "")}
            </span>
          </div>
          <p class="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-line break-words">${esc(rep.content)}</p>
        </div>`).join("");

  return `
    <article class="bento-surface overflow-hidden ${post.status === "closed" && post.category === "team" ? "opacity-75" : ""}">
      <div data-qna-act="toggle" data-id="${esc(post.id)}" role="button" tabindex="0" aria-expanded="${isExpanded}" class="p-5 cursor-pointer hover:bg-slate-50/70 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div class="space-y-1.5 min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <span class="px-2.5 py-0.5 rounded-lg text-xs font-bold border ${catBadgeCls}">${esc(QNA_CATEGORY_LABEL[post.category])}</span>
            ${statusBadge}
            ${post.contestTitle ? `<span class="text-xs text-slate-400 truncate max-w-xs sm:max-w-md">· ${esc(post.contestTitle)}</span>` : ""}
          </div>
          <h4 class="font-extrabold text-[15px] sm:text-[17px] text-slate-900 leading-snug break-words">${esc(post.title)}</h4>
          <div class="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span>작성자 <strong class="text-slate-700 font-semibold">${esc(post.author)}</strong>${mine ? ' <span class="text-rose-700 font-bold">(나)</span>' : ""}</span>
            <span>·</span>
            <span>${esc(qnaKstDate(post.createdAt))}</span>
            <span>·</span>
            <span>댓글 ${replyCount}</span>
          </div>
        </div>
        <div class="flex items-center gap-2 shrink-0 self-end sm:self-center">
          <button type="button" data-qna-act="like" data-id="${esc(post.id)}" aria-pressed="${post.liked}" class="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border text-xs font-bold transition ${post.liked ? "bg-rose-50 border-rose-200 text-rose-600" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"}">
            <i data-lucide="thumbs-up" class="w-3.5 h-3.5"></i>
            <span>공감 ${post.likes}</span>
          </button>
          <span class="p-1.5 text-slate-400"><i data-lucide="${isExpanded ? "chevron-up" : "chevron-down"}" class="w-4 h-4"></i></span>
        </div>
      </div>

      <div class="${isExpanded ? "block" : "hidden"} px-5 pb-5 pt-2 border-t border-slate-100 bg-[#f6f5f2]/60 space-y-4">
        <p class="text-xs sm:text-sm text-slate-700 leading-relaxed bg-white p-4 rounded-2xl border border-slate-200/80 whitespace-pre-line break-words">${esc(post.content)}</p>

        ${mine ? `
        <div class="flex flex-wrap gap-2">
          ${post.category === "team" ? `<button type="button" data-qna-act="status" data-id="${esc(post.id)}" class="px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-xs font-bold text-slate-700">${post.status === "open" ? "모집완료로 변경" : "다시 모집중으로"}</button>` : ""}
          <button type="button" data-qna-act="delete-post" data-id="${esc(post.id)}" class="px-3 py-1.5 rounded-xl bg-white border border-rose-200 hover:bg-rose-50 text-xs font-bold text-rose-700">글 삭제</button>
        </div>` : (QNA_CONTACT ? `
        <div class="flex justify-end">
          <a href="${esc(qnaReportHref("게시글", post.id, post.title))}" class="inline-flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-rose-700"><i data-lucide="flag" class="w-3.5 h-3.5"></i>이 글 신고</a>
        </div>` : "")}

        <div class="space-y-2.5">
          <div class="text-xs font-extrabold text-slate-600 flex items-center gap-1.5">
            <i data-lucide="corner-down-right" class="w-3.5 h-3.5 text-rose-700"></i>
            <span>댓글 ${replyCount}건</span>
          </div>
          ${replies}
        </div>

        <form data-qna-reply-form="${esc(post.id)}" class="flex flex-col sm:flex-row gap-2 pt-1">
          <input type="text" name="replyAuthor" value="${esc(qnaGetNick())}" placeholder="학과/닉네임" required maxlength="30" autocomplete="off" class="sm:w-40 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-slate-900" />
          <input type="text" name="replyText" placeholder="${post.category === "team" ? "참여 희망 댓글이나 질문을 남겨주세요" : "답변이나 댓글을 입력하세요"}" required maxlength="500" autocomplete="off" class="flex-1 px-4 py-2 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
          <button type="submit" class="px-4 py-2 rounded-xl bg-slate-950 hover:bg-rose-700 text-white text-xs font-bold transition shrink-0">댓글 등록</button>
        </form>
      </div>
    </article>`;
}

function renderQnaBoard() {
  const listEl = document.getElementById("qna-list-container");
  const toolbar = document.getElementById("qna-member-tools");
  if (!listEl) return;

  // Q&A 탭이 처음 보일 때 Supabase 를 불러옴
  if (state.activeTab === "qna" && QNA_CONFIGURED && !qnaClient && !qnaInitPromise) qnaEnsureClient();

  qnaRenderAuthPanel();

  const member = QNA_CONFIGURED && qna.session && qnaIsKnu();
  if (toolbar) toolbar.classList.toggle("hidden", !member);
  if (!member) {
    const form = document.getElementById("qna-write-form");
    if (form) form.classList.add("hidden");
  }

  document.querySelectorAll(".qna-cat-btn").forEach(btn => {
    const cat = btn.getAttribute("data-qcat");
    btn.className = cat === state.qnaCategory
      ? "qna-cat-btn px-3.5 py-1.5 rounded-xl text-xs font-bold bg-slate-950 text-white shadow-sm"
      : "qna-cat-btn px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[#f6f5f2] text-slate-700 hover:bg-slate-200";
    btn.setAttribute("aria-pressed", String(cat === state.qnaCategory));
  });

  if (!member) {
    const s = qna.stats;
    listEl.innerHTML = QNA_CONFIGURED && s ? `
      <div class="bento-surface p-8 text-center space-y-2">
        <div class="w-12 h-12 rounded-2xl bg-rose-50 text-rose-700 flex items-center justify-center mx-auto"><i data-lucide="users" class="w-6 h-6"></i></div>
        <p class="text-sm font-extrabold text-slate-900">지금 ${s.openTeams}개 팀이 팀원을 찾고 있어요</p>
        <p class="text-xs text-slate-500">전체 게시글 ${s.posts}개 · 경북대 메일로 로그인하면 볼 수 있습니다.</p>
      </div>` : "";
    return;
  }

  if (qna.loading && qna.posts.length === 0) {
    listEl.innerHTML = `<div class="bento-surface p-10 text-center text-slate-400 text-sm">게시글을 불러오는 중…</div>`;
    return;
  }
  if (qna.loadError) {
    listEl.innerHTML = `
      <div class="bento-surface p-8 text-center space-y-3">
        <p class="text-sm font-bold text-rose-700">${esc(qna.loadError)}</p>
        <button type="button" data-qna-act="reload" class="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold">다시 불러오기</button>
      </div>`;
    return;
  }

  const q = state.qnaSearch.trim().toLowerCase();
  const filtered = qna.posts.filter(post => {
    if (state.qnaCategory !== "all" && post.category !== state.qnaCategory) return false;
    if (state.qnaAnsweredOnly && post.replies.length === 0) return false;
    if (qna.openOnly && !(post.category === "team" && post.status === "open")) return false;
    if (q) {
      const hay = `${post.title} ${post.content} ${post.author} ${post.contestTitle}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    listEl.innerHTML = `
      <div class="bento-surface p-10 text-center text-slate-500 text-sm space-y-3">
        <p>${qna.posts.length === 0 ? "아직 게시글이 없습니다. 첫 팀원 모집글을 올려보세요!" : "조건에 맞는 게시글이 없습니다."}</p>
        <button type="button" data-qna-act="open-write" class="px-4 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold">글쓰기</button>
      </div>`;
    return;
  }
  listEl.innerHTML = filtered.map(qnaPostHtml).join("");
}

function qnaRefreshIcons() {
  if (window.lucide) window.lucide.createIcons();
}
function qnaRerender() {
  renderQnaBoard();
  qnaRefreshIcons();
}

// ---------------------------------------------------------------------
// 동작
// ---------------------------------------------------------------------
async function qnaSendCode(email) {
  qna.busy = true; qna.authErr = ""; qna.authMsg = ""; qnaRerender();
  const { error } = await qnaClient.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  qna.busy = false;
  if (error) {
    qna.authErr = qnaErrorText(error);
  } else {
    qna.pendingEmail = email;
    qna.step = "code";
    qnaSavePending(email);
    qna.resendAt = Date.now() + 60000;
    qna.authMsg = "인증코드를 보냈습니다.";
    qnaTickCooldown();
  }
  qnaRerender();
  const codeInput = document.getElementById("qna-code-input");
  if (codeInput) codeInput.focus();
}

function qnaTickCooldown() {
  if (window._qnaCooldownTimer) clearInterval(window._qnaCooldownTimer);
  window._qnaCooldownTimer = setInterval(() => {
    if (Date.now() >= qna.resendAt) clearInterval(window._qnaCooldownTimer);
    if (!qna.session) {
      const active = document.activeElement && document.activeElement.id;
      const codeVal = (document.getElementById("qna-code-input") || {}).value;
      const emailVal = (document.getElementById("qna-email-input") || {}).value;
      qnaRenderAuthPanel();
      qnaRefreshIcons();
      const ci = document.getElementById("qna-code-input");
      if (ci && codeVal) ci.value = codeVal;
      const ei = document.getElementById("qna-email-input");
      if (ei && emailVal) ei.value = emailVal;
      if (active && document.getElementById(active)) document.getElementById(active).focus();
    }
  }, 1000);
}

async function qnaVerifyCode(token) {
  qna.busy = true; qna.authErr = ""; qnaRerender();
  const { error } = await qnaClient.auth.verifyOtp({ email: qna.pendingEmail, token, type: "email" });
  qna.busy = false;
  if (error) {
    qna.authErr = qnaErrorText(error);
    qnaRerender();
  }
  // 성공 시 onAuthStateChange에서 처리
}

async function qnaAction(act, id) {
  if (act === "retry-load") {
    qna.loadFailed = false; qna.ready = false;
    qnaRerender();
    qnaEnsureClient();
    return;
  }
  if (!qnaClient) return;
  if (act === "logout") {
    await qnaClient.auth.signOut();
    return;
  }
  if (act === "withdraw") {
    if (!window.confirm("탈퇴하면 인증된 메일 주소와 내가 쓴 글·댓글·공감이 모두 즉시 삭제되고 되돌릴 수 없습니다. 탈퇴할까요?")) return;
    const { error } = await qnaClient.rpc("qna_delete_my_account");
    if (error) { showToast(qnaErrorText(error)); return; }
    await qnaClient.auth.signOut({ scope: "local" });
    showToast("탈퇴가 완료되었습니다. 개인정보가 모두 삭제되었습니다.");
    return;
  }
  if (act === "reload") return qnaLoadPosts();
  if (act === "change-email") {
    qna.step = "email"; qna.authErr = ""; qna.authMsg = "";
    qnaSavePending("");
    return qnaRerender();
  }
  if (act === "resend") {
    if (Date.now() < qna.resendAt) return;
    return qnaSendCode(qna.pendingEmail);
  }
  if (act === "open-write") return qnaOpenWriteForm();
  if (act === "toggle") {
    if (state.expandedQnaIds.has(id)) state.expandedQnaIds.delete(id);
    else state.expandedQnaIds.add(id);
    return qnaRerender();
  }

  const post = qna.posts.find(p => p.id === id);
  let result = null;
  if (act === "like" && post) {
    result = post.liked
      ? await qnaClient.from("qna_likes").delete().eq("post_id", id).eq("user_id", qnaUserId())
      : await qnaClient.from("qna_likes").insert({ post_id: id });
  } else if (act === "status" && post) {
    result = await qnaClient.from("qna_posts").update({ status: post.status === "open" ? "closed" : "open" }).eq("id", id);
  } else if (act === "delete-post" && post) {
    if (!window.confirm("이 글과 댓글을 모두 삭제할까요? 되돌릴 수 없습니다.")) return;
    result = await qnaClient.from("qna_posts").delete().eq("id", id);
  } else if (act === "delete-reply") {
    if (!window.confirm("이 댓글을 삭제할까요?")) return;
    result = await qnaClient.from("qna_replies").delete().eq("id", id);
  }
  if (result && result.error) showToast(qnaErrorText(result.error));
  await qnaLoadPosts();
  qnaRefreshIcons();
}

function qnaOpenWriteForm() {
  switchTab("qna");
  const member = QNA_CONFIGURED && qna.session && qnaIsKnu();
  if (!member) {
    const ei = document.getElementById("qna-email-input");
    if (ei) ei.focus();
    showToast(QNA_CONFIGURED ? "경북대 메일로 로그인한 뒤 글을 쓸 수 있습니다." : "게시판 준비 중입니다.");
    return;
  }
  const form = document.getElementById("qna-write-form");
  if (form) {
    form.classList.remove("hidden");
    const authorEl = document.getElementById("qna-input-author");
    if (authorEl && !authorEl.value) authorEl.value = qnaGetNick();
    const titleInput = document.getElementById("qna-input-title");
    if (titleInput) titleInput.focus();
  }
}

async function qnaSubmitPost(e) {
  e.preventDefault();
  const form = e.currentTarget;
  const btn = form.querySelector('button[type="submit"]');
  const val = id => (document.getElementById(id).value || "").trim();
  const category = val("qna-input-category");
  const payload = {
    category: QNA_CATEGORY_LABEL[category] ? category : "team",
    author_name: val("qna-input-author").slice(0, 30),
    contest_title: val("qna-input-contest").slice(0, 200),
    title: val("qna-input-title").slice(0, 120),
    content: val("qna-input-content").slice(0, 2000)
  };
  if (!payload.author_name || !payload.title || !payload.content) return;
  qnaSetNick(payload.author_name);
  if (btn) btn.disabled = true;
  const { data, error } = await qnaClient.from("qna_posts").insert(payload).select("id").single();
  if (btn) btn.disabled = false;
  if (error) {
    showToast(qnaErrorText(error));
    return;
  }
  document.getElementById("qna-input-title").value = "";
  document.getElementById("qna-input-content").value = "";
  form.classList.add("hidden");
  if (data && data.id) state.expandedQnaIds.add(String(data.id));
  showToast("게시글이 등록되었습니다.");
  await qnaLoadPosts();
  qnaRefreshIcons();
}

async function qnaSubmitReply(form) {
  const postId = form.getAttribute("data-qna-reply-form");
  const author = (form.elements.replyAuthor.value || "").trim().slice(0, 30);
  const content = (form.elements.replyText.value || "").trim().slice(0, 500);
  if (!postId || !author || !content) return;
  qnaSetNick(author);
  const btn = form.querySelector('button[type="submit"]');
  if (btn) btn.disabled = true;
  const { error } = await qnaClient.from("qna_replies").insert({ post_id: postId, author_name: author, content });
  if (btn) btn.disabled = false;
  if (error) {
    showToast(qnaErrorText(error));
    return;
  }
  state.expandedQnaIds.add(postId);
  showToast("댓글이 등록되었습니다.");
  await qnaLoadPosts();
  qnaRefreshIcons();
}

// ---------------------------------------------------------------------
// 초기화
// ---------------------------------------------------------------------
window.addEventListener("DOMContentLoaded", () => {
  const section = document.getElementById("view-qna");
  if (!section) return;

  // 클릭 동작 (이벤트 위임)
  section.addEventListener("click", (e) => {
    const el = e.target.closest("[data-qna-act]");
    if (!el || !section.contains(el)) return;
    const act = el.getAttribute("data-qna-act");
    if (act !== "toggle") e.stopPropagation();
    if (act === "toggle" && e.target.closest("button:not([data-qna-act='toggle'])")) return;
    qnaAction(act, el.getAttribute("data-id") || "");
  });
  section.addEventListener("keydown", (e) => {
    const el = e.target.closest("[data-qna-act='toggle']");
    if (el && e.target === el && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      qnaAction("toggle", el.getAttribute("data-id") || "");
    }
  });

  // 동의 체크 상태 유지 (재전송 카운트다운 중 패널이 다시 그려져도 풀리지 않게)
  section.addEventListener("change", (e) => {
    if (e.target && e.target.id === "qna-consent") {
      qna.consent = e.target.checked;
      if (qna.consent && qna.authErr.startsWith("개인정보")) { qna.authErr = ""; }
    }
  });

  // 폼 제출 (이벤트 위임)
  section.addEventListener("submit", (e) => {
    const form = e.target;
    if (form.id === "qna-email-form") {
      e.preventDefault();
      const consentBox = document.getElementById("qna-consent");
      qna.consent = !!(consentBox && consentBox.checked);
      qna.emailDraft = (document.getElementById("qna-email-input").value || "").trim().slice(0, 64);
      if (!qna.consent) {
        qna.authErr = "개인정보 수집·이용에 동의해야 인증코드를 받을 수 있습니다.";
        qnaRerender();
        return;
      }
      const local = (document.getElementById("qna-email-input").value || "").trim().toLowerCase().replace(/@.*$/, "");
      if (!/^[a-z0-9._%+-]{1,64}$/.test(local)) {
        qna.authErr = "메일 아이디 형식을 확인해주세요. (@knu.ac.kr 앞부분만 입력)";
        qnaRerender();
        return;
      }
      qnaSendCode(`${local}@${QNA_DOMAIN}`);
    } else if (form.id === "qna-code-form") {
      e.preventDefault();
      const token = (document.getElementById("qna-code-input").value || "").replace(/\D/g, "");
      if (token.length < 6) {
        qna.authErr = "메일로 받은 숫자 코드를 모두 입력해주세요.";
        qnaRerender();
        return;
      }
      qnaVerifyCode(token);
    } else if (form.hasAttribute("data-qna-reply-form")) {
      e.preventDefault();
      qnaSubmitReply(form);
    }
  });

  const writeForm = document.getElementById("qna-write-form");
  if (writeForm) writeForm.addEventListener("submit", qnaSubmitPost);
  document.getElementById("toggle-qna-form-btn").addEventListener("click", () => {
    if (writeForm && !writeForm.classList.contains("hidden")) writeForm.classList.add("hidden");
    else qnaOpenWriteForm();
  });
  document.getElementById("cancel-qna-form-btn").addEventListener("click", () => writeForm.classList.add("hidden"));
  document.getElementById("header-qna-write-btn").addEventListener("click", qnaOpenWriteForm);

  document.querySelectorAll(".qna-cat-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      state.qnaCategory = btn.getAttribute("data-qcat") || "all";
      qnaRerender();
    });
  });
  document.getElementById("qna-search-input").addEventListener("input", (e) => {
    state.qnaSearch = e.target.value;
    qnaRerender();
  });
  document.getElementById("qna-answered-only").addEventListener("change", (e) => {
    state.qnaAnsweredOnly = e.target.checked;
    qnaRerender();
  });
  const openOnly = document.getElementById("qna-open-only");
  if (openOnly) openOnly.addEventListener("change", (e) => {
    qna.openOnly = e.target.checked;
    qnaRerender();
  });
  const refreshBtn = document.getElementById("qna-refresh-btn");
  if (refreshBtn) refreshBtn.addEventListener("click", () => qnaLoadPosts().then(qnaRefreshIcons));

  if (!QNA_CONFIGURED) {
    qna.ready = true;
    qnaRerender();
  }
  // 설정돼 있으면 Q&A 탭을 열 때 renderQnaBoard() 가 qnaEnsureClient() 로 불러옴
});
