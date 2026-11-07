"use strict";
const TODAY_STR = (() => {
  try {
    const parts = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(new Date());
    if (/^\d{4}-\d{2}-\d{2}$/.test(parts)) return parts;
  } catch (e) {}
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
})();

// ---------------------------------------------------------------
// 보안 헬퍼: 크롤링 데이터·사용자 입력은 항상 이스케이프 후 innerHTML에 삽입
// ---------------------------------------------------------------
const HTML_ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;", "`": "&#96;" };
function esc(value) {
  return String(value == null ? "" : value).replace(/[&<>"'`]/g, ch => HTML_ESCAPES[ch]);
}

// http(s) 링크만 허용 (javascript:, data: 등 차단)
function safeUrl(value, fallback = "https://www.knu.ac.kr") {
  try {
    const u = new URL(String(value || ""), window.location.href);
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : fallback;
  } catch (e) {
    return fallback;
  }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TEXT_LIMIT = { title: 200, summary: 1200, default: 400 };

// 외부(JSON) 데이터를 검증·정규화. 형식이 깨진 항목은 버린다.
function normalizeItem(raw) {
  if (!raw || typeof raw !== "object") return null;
  const str = (k) => {
    const v = raw[k];
    if (v == null) return "";
    return String(v).slice(0, TEXT_LIMIT[k] || TEXT_LIMIT.default);
  };
  const deadline = str("deadline").slice(0, 10);
  const postedDate = str("postedDate").slice(0, 10);
  if (!str("id") || !str("title") || !DATE_RE.test(deadline)) return null;
  return {
    ...raw,
    id: str("id"),
    itemType: ["contest", "event", "campaign"].includes(raw.itemType) ? raw.itemType : "contest",
    title: str("title"),
    orgId: str("orgId"),
    orgName: str("orgName"),
    subOrg: str("subOrg"),
    category: str("category"),
    categoryName: str("categoryName"),
    postedDate: DATE_RE.test(postedDate) ? postedDate : deadline,
    postedTime: str("postedTime"),
    boardPeriod: str("boardPeriod"),
    deadline,
    deadlineTime: str("deadlineTime"),
    scheduleDetail: str("scheduleDetail"),
    eligibility: str("eligibility"),
    benefit: str("benefit"),
    summary: str("summary"),
    url: safeUrl(raw.url),
    tags: Array.isArray(raw.tags) ? raw.tags.slice(0, 8).map(t => String(t).slice(0, 40)) : []
  };
}

const ORGANIZATIONS = [
  { id: "all", name: "전체 기관", icon: "layout-grid" },
  { id: "bootcamp", name: "로봇·AI·드론·반도체사업단", icon: "bot" },
  { id: "knu_main", name: "대학본부·학생처", icon: "landmark" },
  { id: "it_college", name: "IT대학", icon: "cpu" },
  { id: "ceedin", name: "공학혁신센터", icon: "settings" },
  { id: "swedu", name: "SW교육원", icon: "code-2" },
  { id: "startup", name: "창업지원단", icon: "rocket" },
  { id: "datainst", name: "데이터융복합·DNA", icon: "database" },
  { id: "knucube", name: "진로·도서관·CUBE", icon: "compass" }
];

const CATEGORIES = [
  { id: "all", name: "전체 분야" },
  { id: "hackathon", name: "해커톤·AI·SW" },
  { id: "capstone", name: "캡스톤·공학설계" },
  { id: "startup", name: "창업·아이디어" },
  { id: "event", name: "교내행사·특강·페스티벌" },
  { id: "campaign", name: "캠페인·서포터즈·봉사" },
  { id: "global", name: "글로벌·대외활동" },
  { id: "research", name: "연구·장학·학술" }
];

// Type-specific visual theme (Original Editorial Ticket System)
const TYPE_THEME = {
  contest: {
    badge: "🏆 공모전·대회",
    bar: "bg-indigo-600",
    pill: "bg-indigo-50 text-indigo-700 border-indigo-200/80",
    accentText: "text-indigo-700"
  },
  event: {
    badge: "🎉 교내행사·특강",
    bar: "bg-amber-500",
    pill: "bg-amber-50 text-amber-800 border-amber-200/80",
    accentText: "text-amber-700"
  },
  campaign: {
    badge: "🌱 캠페인·서포터즈",
    bar: "bg-emerald-600",
    pill: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
    accentText: "text-emerald-700"
  }
};

const INITIAL_COMPETITIONS = [
{
    "id": "library_book_camp_2026",
    "itemType": "campaign",
    "title": "[대외협력홍보과] 2027학년도 제29기 경북대학교 학생홍보대사(KNU 앰배서더) 모집",
    "orgId": "knu_main",
    "orgName": "대학본부·학생처",
    "subOrg": "대외협력홍보과 (대강당 3층 홍보대사실)",
    "category": "campaign",
    "categoryName": "캠페인·서포터즈·봉사",
    "postedDate": "2026-10-23",
    "postedTime": "2026-10-23 10:52",
    "boardPeriod": "2026-10-23 ~ 2026-11-22",
    "deadline": "2026-11-06",
    "deadlineTime": "17:00",
    "scheduleDetail": "본문 서류접수 기간: 2026.11.02(월) ~ 2026.11.06(금) 10:00~17:00 (대강당 3층 홍보대사실 방문)",
    "eligibility": "경북대학교 학부 재학생 (캠퍼스 투어·의전·대학 홍보 캠페인 참여 가능자)",
    "benefit": "공식 학생홍보대사 임명장, 활동 장학금 및 공식 의전 단복 지원",
    "url": "https://www.knu.ac.kr/wbbs/wbbs/bbs/btin/viewBtin.action?bbs_cde=1&btin.bbs_cde=1&btin.doc_no=1338637&btin.appl_no=000000&menu_idx=67",
    "tags": [
        "29기학생홍보대사",
        "11월6일17시마감",
        "대강당3층접수",
        "캠퍼스홍보"
    ],
    "summary": "[본문 분석 완료] 2026-10-23 10:52 게시(doc_no=1338637). 상단 게시기간은 11.22까지이나 본문 내 실제 서류접수 기간은 11.02(월)~11.06(금) 17:00까지(대강당 3층 홍보대사실)입니다.",
    "isNew": false
},
{
    "id": "mind_care_camp_2026",
    "itemType": "campaign",
    "title": "[대외협력홍보과] 2027학년도 경북대학교 공식 학생리포터(캠퍼스 취재·서포터즈) 모집",
    "orgId": "knu_main",
    "orgName": "대학본부·학생처",
    "subOrg": "대외협력홍보과",
    "category": "campaign",
    "categoryName": "캠페인·서포터즈·봉사",
    "postedDate": "2026-10-23",
    "postedTime": "2026-10-23 09:28",
    "boardPeriod": "2026-10-23 ~ 2026-11-06",
    "deadline": "2026-11-06",
    "deadlineTime": "18:00",
    "scheduleDetail": "공고 및 지원서 접수 기간: 2026.10.23(금) ~ 2026.11.06(금)",
    "eligibility": "글쓰기·취재·SNS 캠퍼스 콘텐츠 제작에 관심 있는 경북대 재학생",
    "benefit": "매월 소정의 원고료·활동비 지급 및 대외협력홍보과 공식 수료증 발급",
    "url": "https://knu.ac.kr/wbbs/wbbs/bbs/btin/viewBtin.action?bbs_cde=1&btin.bbs_cde=1&btin.doc_no=1338633&btin.appl_no=000000&menu_idx=67",
    "tags": [
        "KNU학생리포터",
        "11월6일마감",
        "대외협력홍보과",
        "캠퍼스서포터즈"
    ],
    "summary": "[본문 분석 완료] 2026-10-23 09:28 게시(doc_no=1338633). 대학 공식 웹진·소식지 취재 및 캠퍼스 홍보 캠페인을 이끌어갈 2027학년도 학생리포터를 11.06(금)까지 모집합니다.",
    "isNew": false
},
{
    "id": "it_see_105796",
    "itemType": "contest",
    "title": "[AI부트캠프사업단] 2026 네이버 클라우드 · AWS 동계 몰입형 AI 프로젝트 교육생 모집",
    "orgId": "it_college",
    "orgName": "IT대학 (전자공학부·컴퓨터학부)",
    "subOrg": "경북대 AI부트캠프사업단",
    "category": "hackathon",
    "categoryName": "해커톤·AI·SW",
    "postedDate": "2026-11-03",
    "postedTime": "2026-11-03 15:20",
    "boardPeriod": "2026-11-03 ~ 2026-11-09",
    "deadline": "2026-11-06",
    "deadlineTime": "14:00",
    "scheduleDetail": "구글폼 접수 ~11.06(금) 14:00 → 선발발표 11.09(월) → OT 12.22(화) → 수업 12.28~01.12",
    "eligibility": "경북대 학부 재학생 중 겨울계절수업 대면 일정 전과정 참석 가능자 (과목당 30명)",
    "benefit": "이수증 발급 및 AI부트캠프 장학금 지급 대상 포함 (계절학기 3학점 인정)",
    "url": "https://see.knu.ac.kr/mobile/content/notice.html?fidx=105796",
    "tags": [
        "네이버소버린AI",
        "AWS멀티에이전트",
        "11월6일14시마감",
        "장학금지급"
    ],
    "summary": "[본문 분석 완료] 2026-11-03 게시(fidx=105796). [중급] 네이버 소버린 Agentic AI 개발실무(30명), [고급] AWS 멀티에이전트 시스템(30명) 과정으로 11.06(금) 14:00 구글폼 마감입니다.",
    "isNew": true
},
{
    "id": "it_see_105801",
    "itemType": "contest",
    "title": "[인공지능혁신융합대학] 2026 동계 차세대통신 컨소시엄(미래ICT융합기술) 참가 모집",
    "orgId": "swedu",
    "orgName": "SW교육원·IT교육센터",
    "subOrg": "인공지능혁신융합대학사업단(AICOSS)",
    "category": "hackathon",
    "categoryName": "해커톤·AI·SW",
    "postedDate": "2026-11-03",
    "postedTime": "2026-11-03 14:05",
    "boardPeriod": "2026-11-03 ~ 2026-11-06",
    "deadline": "2026-11-06",
    "deadlineTime": "15:00",
    "scheduleDetail": "구글폼+지원서 회신 ~11.06(금) 15:00 → 수업기간 2026.12.28(월) ~ 2027.01.22(금)",
    "eligibility": "본교 재학생 및 휴학생 (졸업유예자·졸업예정자 제외)",
    "benefit": "차세대통신 컨소시엄 학점 인정 (미래ICT융합기술의이해 CLT0987)",
    "url": "https://see.knu.ac.kr/mobile/content/notice.html?fidx=105801",
    "tags": [
        "AICOSS",
        "차세대통신",
        "11월6일15시마감",
        "미래ICT융합"
    ],
    "summary": "[본문 분석 완료] 2026-11-03 게시(fidx=105801). 11.06(금) 15:00까지 구글양식 작성과 수학지원서 이메일(kkm8223@knu.ac.kr) 제출을 모두 완료해야 인정됩니다.",
    "isNew": true
},
{
    "id": "it_see_105808",
    "itemType": "contest",
    "title": "[반도체특성화대학사업단] 2027-1학기 PBL기반반도체실무프로젝트 추가 모집",
    "orgId": "it_college",
    "orgName": "IT대학 (전자공학부·컴퓨터학부)",
    "subOrg": "반도체특성화대학사업단 (작성자: 이수빈)",
    "category": "capstone",
    "categoryName": "캡스톤·공학설계",
    "postedDate": "2026-11-04",
    "postedTime": "2026-11-04 11:10",
    "boardPeriod": "2026-11-04 ~ 2026-11-10",
    "deadline": "2026-11-06",
    "deadlineTime": "16:00",
    "scheduleDetail": "추가신청 11.05(목) 09:00 ~ 11.06(금) 16:00 → 팀 선정 발표 11.10(화) 14:00",
    "eligibility": "반도체특성화대학사업단 트랙 선발 재학생 (트랙 선발자 필독)",
    "benefit": "PBL 실무프로젝트 학점 이수 및 실습재료비·트랙 장학 혜택 연계",
    "url": "https://see.knu.ac.kr/mobile/content/notice.html?fidx=105808",
    "tags": [
        "오늘게시",
        "반도체PBL",
        "11월6일16시마감",
        "추가모집"
    ],
    "summary": "[본문 분석 완료] 2026-11-04 게시(fidx=105808). 본문 내 추가 신청 기간은 11.05(목) 09:00 ~ 11.06(금) 16:00까지이며, 팀 선정 결과는 11.10(화) 14:00 이후 발표됩니다.",
    "isNew": true
},
{
    "id": "knu_green_camp_2026",
    "itemType": "campaign",
    "title": "[학생과] 2026년 KNU 학생 옴부즈맨(학교생활 모니터링·캠퍼스 개선) 참여 학생 모집",
    "orgId": "knu_main",
    "orgName": "대학본부·학생처",
    "subOrg": "학생처 학생과 (053-950-2093)",
    "category": "campaign",
    "categoryName": "캠페인·서포터즈·봉사",
    "postedDate": "2026-11-04",
    "postedTime": "2026-11-04 10:28",
    "boardPeriod": "2026-11-04 ~ 2026-11-12",
    "deadline": "2026-11-06",
    "deadlineTime": "18:00",
    "scheduleDetail": "학생→학과 신청서 제출: ~2026.11.06(금) 18:00 (전자공학부는 11.06 12:00 마감 / 단과대→본부 11.11)",
    "eligibility": "학부 재학생 95명, 대학원생 5명 (2026-2학기 휴학예정자 및 초과학기자 제외)",
    "benefit": "학생 옴부즈맨 1인당 근로장학금(활동수당) 60만원 지급",
    "url": "https://www.knu.ac.kr/wbbs/wbbs/bbs/btin/viewBtin.action?bbs_cde=1&btin.bbs_cde=1&btin.doc_no=1338711&btin.appl_no=000000&menu_idx=67",
    "tags": [
        "오늘게시",
        "학생옴부즈맨",
        "근로장학금60만원",
        "11월6일18시마감"
    ],
    "summary": "[본문 분석 완료] 2026-11-04 10:28 게시(doc_no=1338711). 학교생활 전반 설문조사(20명) 및 개선 보고서를 작성하는 캠퍼스 모니터링 활동입니다. 붙임 문서상의 11.11은 단과대 제출일이며 학생은 11.06(금) 18:00까지 학과로 제출해야 합니다.",
    "isNew": true
},
{
    "id": "knucube_mentor_2026",
    "itemType": "event",
    "title": "[진로취업과] 2026 동문선배 멘토링 「커넥트」 Part 2 공기업 현직자 멘토링 데이",
    "orgId": "knucube",
    "orgName": "진로취업·도서관·CUBE",
    "subOrg": "학생처 진로취업과 · KNUCUBE",
    "category": "event",
    "categoryName": "교내행사·특강·페스티벌",
    "postedDate": "2026-10-12",
    "postedTime": "2026-10-12 11:04",
    "boardPeriod": "2026-10-12 ~ 2026-11-30",
    "deadline": "2026-11-10",
    "deadlineTime": "18:00",
    "scheduleDetail": "매주 화요일 진행: 6회차(11/3 완료) → 7회차(11/10) → 8회차(11/17) → 9회차(11/24) → 10회차(12/1)",
    "eligibility": "공기업·금융권 취업 희망 경북대 재학생 및 휴학생",
    "benefit": "국민연금공단·한수원·서울교통공사·가스공사·신보·캠코·IBK·한국은행 동문 선배 직무 멘토링",
    "url": "https://knu.ac.kr/wbbs/wbbs/bbs/btin/viewBtin.action?bbs_cde=1&btin.bbs_cde=1&btin.doc_no=1338528&btin.appl_no=000000&menu_idx=67",
    "tags": [
        "공기업멘토링",
        "한수원·한국은행",
        "매주화요일",
        "11월10일7회차"
    ],
    "summary": "[본문 분석 완료] 2026-10-12 11:04 게시(doc_no=1338528). 매주 화요일 진행되는 릴레이 동문 멘토링으로 어제 6회차(11/3)가 진행되었으며, 다가오는 7회차(11/10)~10회차(12/1)를 KNUCUBE에서 접수 중입니다.",
    "isNew": false
},
{
    "id": "it_see_105750",
    "itemType": "contest",
    "title": "[반도체특성화대학사업단] 2026 국외 글로벌 반도체 연구소(ICFO·IMEC) 현장학습 연수생 선발",
    "orgId": "it_college",
    "orgName": "IT대학 (전자공학부·컴퓨터학부)",
    "subOrg": "반도체특성화대학사업단 (작성자: 이수빈)",
    "category": "global",
    "categoryName": "글로벌·대외활동",
    "postedDate": "2026-10-28",
    "postedTime": "2026-10-28 09:00",
    "boardPeriod": "2026-10-28 ~ 2026-11-11",
    "deadline": "2026-11-11",
    "deadlineTime": "18:00",
    "scheduleDetail": "접수기간 2026.10.28(수) 09:00 ~ 2026.11.11(수) 18:00 (기한 엄수)",
    "eligibility": "경북대 반도체특성화대학사업단 트랙 Ⅰ, Ⅱ, Ⅲ 장학생",
    "benefit": "스페인 ICFO 연구소 및 벨기에 IMEC 연구소 해외 현장학습 파견 지원",
    "url": "https://see.knu.ac.kr/mobile/content/notice.html?fidx=105750",
    "tags": [
        "벨기에IMEC",
        "스페인ICFO",
        "해외현장학습",
        "11월11일18시마감"
    ],
    "summary": "[본문 분석 완료] 2026-10-28 게시(fidx=105750). 스페인 ICFO 및 벨기에 IMEC 반도체 연구소 신기술 현장학습 연수생을 10.28(수) 09:00부터 11.11(수) 18:00까지 모집합니다.",
    "isNew": false
},
{
    "id": "it_see_105800",
    "itemType": "contest",
    "title": "대구앵커사업(1-1) 개교 80주년 기념 「2026년 KNU 캡스톤디자인 경진대회」 참가팀 모집",
    "orgId": "it_college",
    "orgName": "IT대학 (전자공학부·컴퓨터학부)",
    "subOrg": "지역전략산업혁신연구소 · 대구앵커사업단",
    "category": "capstone",
    "categoryName": "캡스톤·공학설계",
    "postedDate": "2026-11-03",
    "postedTime": "2026-11-03 10:15",
    "boardPeriod": "2026-11-03 ~ 2026-12-03",
    "deadline": "2026-11-11",
    "deadlineTime": "18:00",
    "scheduleDetail": "신청접수 ~11.11(수) → 예선심사 11.13 → 발표·전시물 제출 11.16~11.23 → 본선·시상 11.26 → 전시 ~12.03",
    "eligibility": "학내 교과·비교과 캡스톤디자인 참여 팀 전체",
    "benefit": "크리에이티브파크 본선 진출·시상식 및 성과 공유 전시 Zone(11.26~12.03) 전시",
    "url": "https://see.knu.ac.kr/mobile/content/notice.html?fidx=105800",
    "tags": [
        "캡스톤디자인",
        "개교80주년",
        "11월11일마감",
        "크리에이티브파크"
    ],
    "summary": "[본문 분석 완료] 2026-11-03 게시(fidx=105800). 신청서 이메일(rlinc11@knu.ac.kr) 접수는 11.11(수) 마감이며, 11.13 예선, 11.26 본선 발표 및 시상식이 크리에이티브파크에서 열립니다.",
    "isNew": true
},
{
    "id": "datainst_685",
    "itemType": "contest",
    "title": "[대구앵커사업단] 「2026 대구 대학(원)생 AI 드래프톤」 참가팀 모집 (총 50팀)",
    "orgId": "datainst",
    "orgName": "데이터융복합·사업단",
    "subOrg": "대구테크노파크 대구앵커센터 · 대구앵커사업단",
    "category": "hackathon",
    "categoryName": "해커톤·AI·SW",
    "postedDate": "2026-10-29",
    "postedTime": "2026-10-29 10:31",
    "boardPeriod": "2026-10-29 ~ 2026-11-18",
    "deadline": "2026-11-15",
    "deadlineTime": "23:59",
    "scheduleDetail": "접수 ~11.15(일) → 참가팀 발표 11.17(화) → 본선 대회 11.25(수)~11.26(목) 대구 엑스코",
    "eligibility": "전국 대학생 및 대학원생 (휴학생 포함, 3~4인 1팀, 총 50팀 모집)",
    "benefit": "대상 500만원, 최우수상 200만원, 우수상 100만원, 장려상 각 50만원 (대구시 정책 반영)",
    "url": "https://knu.ac.kr/wbbs/wbbs/bbs/btin/viewBtin.action?bbs_cde=1&btin.bbs_cde=1&btin.doc_no=1338677&btin.appl_no=000000&menu_idx=67",
    "tags": [
        "AI드래프톤",
        "대상500만원",
        "11월15일마감",
        "엑스코본선"
    ],
    "summary": "[본문 분석 완료] 2026-10-29 10:31 게시(doc_no=1338677). AI 기반 대구시 정책 아이디어 발굴 해커톤으로 11.15(일)까지 접수하며, 11.17(화) 합격 발표 후 11.25~26 엑스코에서 개최됩니다.",
    "isNew": false
},
{
    "id": "swedu_talk_2026",
    "itemType": "event",
    "title": "[진로취업과·대학원혁신] 이차전지 · 조선 · 방산 분야 실시간 직무교육 특강 (학부생 가능)",
    "orgId": "knucube",
    "orgName": "진로취업·도서관·CUBE",
    "subOrg": "진로취업과 (053-950-2872)",
    "category": "event",
    "categoryName": "교내행사·특강·페스티벌",
    "postedDate": "2026-11-02",
    "postedTime": "2026-11-02 11:22",
    "boardPeriod": "2026-11-02 ~ 2026-11-27",
    "deadline": "2026-11-16",
    "deadlineTime": "19:00",
    "scheduleDetail": "이차전지 트랙: 11.16(월)~11.20(금) 19:00~22:00 / 조선·방산 트랙: 11.23(월)~11.27(금) 19:00~22:00",
    "eligibility": "경북대 대학원생 및 학부생 누구나 수강 가능 (온라인 실시간 Zoom)",
    "benefit": "이차전지·조선·방산 산업현황, 기술동향, 기업이슈 및 실전 직무이해 집중 특강",
    "url": "https://www.knu.ac.kr/wbbs/wbbs/bbs/btin/viewBtin.action?bbs_cde=1&btin.bbs_cde=1&btin.doc_no=1338695&btin.appl_no=000000&menu_idx=67",
    "tags": [
        "이차전지직무특강",
        "조선방산특강",
        "학부생수강가능",
        "11월16일개강"
    ],
    "summary": "[본문 분석 완료] 2026-11-02 11:22 게시(doc_no=1338695). 본문 첫 줄에 '학부생도 수강가능합니다'가 명시되어 있으며, 11.16~20(이차전지), 11.23~27(조선방산) 야간 실시간 Zoom으로 진행됩니다.",
    "isNew": true
},
{
    "id": "datainst_rise_09",
    "itemType": "contest",
    "title": "[데이터융복합연구원] 지역·산업 맞춤형 AI·빅데이터 실무 프로젝트 과정 모집",
    "orgId": "datainst",
    "orgName": "데이터융복합·사업단",
    "subOrg": "경북대학교 데이터융복합연구원",
    "category": "hackathon",
    "categoryName": "해커톤·AI·SW",
    "postedDate": "2026-10-22",
    "postedTime": "2026-10-22 14:00",
    "boardPeriod": "2026-10-22 ~ 2026-11-19",
    "deadline": "2026-11-18",
    "deadlineTime": "18:00",
    "scheduleDetail": "1차 마감 11.12(목) → 2차 마감 11.18(수) → 3차 마감 11.19(목)",
    "eligibility": "AI·빅데이터 프로젝트 수행 희망 경북대 재학생 및 청년 구직자",
    "benefit": "교육비 전액 국비 지원, 직무역량 수료증 발급 및 우수 프로젝트 시상",
    "url": "https://datainstitute.knu.ac.kr/contents/edu/selectEduList.do?menuId=343",
    "tags": [
        "데이터융복합연구원",
        "빅데이터실무",
        "11월18일마감",
        "국비지원"
    ],
    "summary": "[본문 분석 완료] 데이터융복합연구원 교육신청 게시판에 2026-10-22 등록된 과정으로, 세부 트랙별로 11.12 / 11.18 / 11.19까지 온라인 신청을 받습니다.",
    "isNew": false
},
{
    "id": "startup_noti_912",
    "itemType": "contest",
    "title": "[학생과] 2027학년도 관정재단 신규 장학생(학부생) 경북대 추천 선발",
    "orgId": "knu_main",
    "orgName": "대학본부·학생처",
    "subOrg": "학생처 학생과 · 관정이종환교육재단",
    "category": "research",
    "categoryName": "연구·장학·학술",
    "postedDate": "2026-11-03",
    "postedTime": "2026-11-03 16:45",
    "boardPeriod": "2026-11-03 ~ 2026-11-21",
    "deadline": "2026-11-20",
    "deadlineTime": "18:00",
    "scheduleDetail": "이메일 서류접수 ~2026.11.20(금) 18:00 도착분 한함 (본교 추천 5명 선발)",
    "eligibility": "2027-1학기 5학기(3학년 1학기) 진학 예정 학부생, 1~3학기 총 평점 4.0/4.5 이상, 만 24세 이하",
    "benefit": "관정재단 국내대학 최고 수준 장학금 지원 (자연·이공 80%, 인문·사회·예능 20% 추천)",
    "url": "https://www.knu.ac.kr/wbbs/wbbs/bbs/btin/viewBtin.action?bbs_cde=1&btin.bbs_cde=1&btin.doc_no=1338708&btin.appl_no=000000&menu_idx=67",
    "tags": [
        "관정재단장학생",
        "평점4.0이상",
        "11월20일18시마감",
        "본교5명추천"
    ],
    "summary": "[본문 분석 완료] 2026-11-03 16:45 게시(doc_no=1338708). 모든 제출 서류를 단일 PDF로 스캔하여 11.20(금) 18:00까지 이메일(ricjtls@knu.ac.kr)로 제출해야 합니다.",
    "isNew": true
},
{
    "id": "knu_festa_2026",
    "itemType": "event",
    "title": "개교 80주년 기념 「2026 KNU 연구 페스티벌」 (포럼·AI토크콘서트·성과전시)",
    "orgId": "knu_main",
    "orgName": "대학본부·학생처",
    "subOrg": "경북대학교 대학본부 · 연구산학처",
    "category": "event",
    "categoryName": "교내행사·특강·페스티벌",
    "postedDate": "2026-11-04",
    "postedTime": "2026-11-04 09:30",
    "boardPeriod": "2026-11-04 ~ 2026-12-02",
    "deadline": "2026-11-23",
    "deadlineTime": "18:00",
    "scheduleDetail": "11.12 AX포럼 → 11.13 논문대회 → 11.18 융합연구원 발표 → 11.23 김상균 교수 AI 토크콘서트 → 11.24 안전페스티벌 → 11.26 캡스톤전시 → 12.02 BK21포럼",
    "eligibility": "경북대학교 학부생, 대학원생, 연구원 및 교직원 전체",
    "benefit": "해외 석학 초청 강연, 경희대 김상균 교수 AI 토크콘서트(11.23) 무료 참관",
    "url": "https://knu.ac.kr/wbbs/wbbs/bbs/btin/viewBtin.action?bbs_cde=28&btin.bbs_cde=28&btin.doc_no=1338715&btin.appl_no=000000&menu_idx=166",
    "tags": [
        "오늘게시",
        "KNU연구페스티벌",
        "11월23일AI토크콘서트",
        "개교80주년"
    ],
    "summary": "[본문 분석 완료] 2026-11-04 게시(doc_no=1338715). 11월 한 달간 AX 시대 교수회 포럼(11.12), 신기술 신산업 AI 토크 콘서트(11.23), 연구실안전 페스티벌(11.24), 캡스톤 전시(11.26)가 이어집니다.",
    "isNew": true
},
{
    "id": "startup_noti2_455",
    "itemType": "contest",
    "title": "개교 80주년 기념 「대구·경북 대학(원)생 창업경진대회」 & 「첨성인 논문 경진대회」",
    "orgId": "startup",
    "orgName": "창업지원단",
    "subOrg": "연구산학처 · 창업지원단",
    "category": "startup",
    "categoryName": "창업·아이디어",
    "postedDate": "2026-11-04",
    "postedTime": "2026-11-04 09:30",
    "boardPeriod": "2026-11-04 ~ 2026-12-02",
    "deadline": "2026-12-02",
    "deadlineTime": "18:00",
    "scheduleDetail": "첨성인 대학원생 논문 경진대회 11.13(금) → 창업경진대회 최종 평가 및 시상식 12.02(수)",
    "eligibility": "대구·경북 대학(원)생 창업팀 및 경북대 대학원생 연구자",
    "benefit": "총장상 및 개교 80주년 창업경진대회 상금, 연구 페스티벌 본선 시상",
    "url": "https://knu.ac.kr/wbbs/wbbs/bbs/btin/viewBtin.action?bbs_cde=28&btin.bbs_cde=28&btin.doc_no=1338715&btin.appl_no=000000&menu_idx=166",
    "tags": [
        "오늘게시",
        "개교80주년창업대회",
        "첨성인논문대회",
        "12월2일결선"
    ],
    "summary": "[본문 분석 완료] 2026-11-04 게시(doc_no=1338715). 11월 13일 첨성인 대학원생 논문 경진대회가 개최되며, 10월 12일부터 진행된 개교 80주년 창업경진대회는 12월 2일 최종 평가·시상으로 마무리됩니다.",
    "isNew": true
},
{
    "id": "swedu_oz_310",
    "itemType": "contest",
    "title": "[세포기질연구소] '현장 맞춤 인재 양성 휴먼스테이션' 연구·실무 프로그램 참가자 모집",
    "orgId": "knu_main",
    "orgName": "대학본부·학생처",
    "subOrg": "경북대 세포기질연구소",
    "category": "research",
    "categoryName": "연구·장학·학술",
    "postedDate": "2026-11-04",
    "postedTime": "2026-11-04 17:58",
    "boardPeriod": "2026-11-04 ~ 2026-12-04",
    "deadline": "2026-12-04",
    "deadlineTime": "18:00",
    "scheduleDetail": "공고 등록: 2026.11.04(수) 17:58 → 게시 및 모집기간: ~2026.12.04(금)",
    "eligibility": "바이오·의생명·이공계열 현장 맞춤 연구역량 강화 희망 학부 및 대학원생",
    "benefit": "세포기질연구소 현장 실습 교육 및 수료 특전 제공",
    "url": "https://www.knu.ac.kr/wbbs/wbbs/bbs/btin/viewBtin.action?bbs_cde=1&btin.bbs_cde=1&btin.doc_no=1338718&btin.appl_no=000000&menu_idx=67",
    "tags": [
        "오늘17시58분게시",
        "휴먼스테이션",
        "세포기질연구소",
        "현장맞춤인재"
    ],
    "summary": "[본문 분석 완료] 오늘(2026-11-04) 17:58에 본부 공지사항 270번(doc_no=1338718)으로 방금 등록된 최신 공고입니다. 12월 4일까지 게시 및 모집이 진행됩니다.",
    "isNew": true
},
{
    "id": "knu_main_1338312",
    "itemType": "contest",
    "title": "[사범대학 미래교육센터] 2026 KNU TC AI 윤리 해커톤",
    "orgId": "knu_main",
    "orgName": "대학본부·학생처",
    "subOrg": "사범대학 미래교육센터 (053-950-6665)",
    "category": "hackathon",
    "categoryName": "해커톤·AI·SW",
    "postedDate": "2026-09-04",
    "postedTime": "2026-09-04 14:11",
    "boardPeriod": "2026-09-04 ~ 2026-10-04",
    "deadline": "2026-09-07",
    "deadlineTime": "18:00",
    "scheduleDetail": "본문 신청기한 ~09.07(월) 18:00 → 해커톤 본선 09.12(토)~09.13(일) 사범대학 303호",
    "eligibility": "사범대학 재학생, 비사범대 교직이수자, 교육대학원 재학생",
    "benefit": "우수팀 시상 및 상금 지급 (9.12~9.13 본선 개최 완료)",
    "url": "https://www.knu.ac.kr/wbbs/wbbs/bbs/btin/viewBtin.action?bbs_cde=1&btin.bbs_cde=1&btin.doc_no=1338312&btin.appl_no=000000&menu_idx=67",
    "tags": [
        "9월7일마감완료",
        "AI윤리해커톤",
        "사범대학",
        "미래교육센터"
    ],
    "summary": "[본문 분석 완료] 2026-09-04 14:11 게시(doc_no=1338312). 본문 신청기한(9.7 18:00) 및 본선 행사(9.12~13)가 모두 종료된 아카이브 공고입니다.",
    "isNew": false
},
{
    "id": "it_see_105712",
    "itemType": "contest",
    "title": "[진로취업과] 2026 'KNU-대구앵커' 청년 연구자 창업 아이디어 경진대회(LAB to MARKET)",
    "orgId": "knu_main",
    "orgName": "대학본부·학생처",
    "subOrg": "진로취업과 · ㈜뉴키즈인베스트먼트",
    "category": "startup",
    "categoryName": "창업·아이디어",
    "postedDate": "2026-10-06",
    "postedTime": "2026-10-06 13:36",
    "boardPeriod": "2026-10-06 ~ 2027-02-28",
    "deadline": "2026-10-21",
    "deadlineTime": "18:00",
    "scheduleDetail": "본문 모집기간 2026.10.06(화) ~ 10.21(수) 18:00 (게시기간 ~2027.02.28)",
    "eligibility": "예비 창업자 및 초기 창업기업 15개 사",
    "benefit": "사업화 지원금 최대 1,000만원 / 700만원 지급",
    "url": "https://www.knu.ac.kr/wbbs/wbbs/bbs/btin/viewBtin.action?bbs_cde=1&btin.bbs_cde=1&btin.doc_no=1338493&btin.appl_no=000000&menu_idx=67",
    "tags": [
        "10월21일본문마감",
        "청년연구자창업",
        "LABtoMARKET",
        "최대1000만원"
    ],
    "summary": "[본문 분석 완료] 2026-10-06 13:36 게시(doc_no=1338493). 게시판 노출은 '27년 2월까지이나 본문 '나. 모집기간'은 10.21(수) 18시에 마감되었습니다.",
    "isNew": false
},
{
    "id": "knucube_1336437",
    "itemType": "contest",
    "title": "[진로취업과] 2026학년도 하반기 면접 합격 전략 「면접 엣지」 (특강·1:1 모의면접)",
    "orgId": "knucube",
    "orgName": "진로취업·도서관·CUBE",
    "subOrg": "학생처 진로취업과 · KNUCUBE",
    "category": "global",
    "categoryName": "글로벌·대외활동",
    "postedDate": "2026-10-12",
    "postedTime": "2026-10-12 11:09",
    "boardPeriod": "2026-10-12 ~ 2026-10-26",
    "deadline": "2026-10-26",
    "deadlineTime": "18:00",
    "scheduleDetail": "공고일 2026.10.12(월) 11:09 → KNUCUBE 접수 마감 2026.10.26(월)",
    "eligibility": "하반기 공채 면접 준비 중인 경북대 재학생 및 졸업생",
    "benefit": "삼성전자·CJ제일제당·LX인터내셔널 전직 인사팀 강사 특강 및 1:1 온라인 모의면접",
    "url": "https://knu.ac.kr/wbbs/wbbs/bbs/btin/viewBtin.action?bbs_cde=1&btin.bbs_cde=1&btin.doc_no=1338529&btin.appl_no=000000&menu_idx=67",
    "tags": [
        "10월26일마감완료",
        "면접엣지",
        "1대1모의면접",
        "KNUCUBE"
    ],
    "summary": "[본문 분석 완료] 2026-10-12 11:09 게시(doc_no=1338529). KNUCUBE(lecture00113807/113808)를 통한 신청이 10.26에 마감되었습니다.",
    "isNew": false
},
{
    "id": "ceedin_2026_01",
    "itemType": "contest",
    "title": "[학생과] 2027학년도 해동과학문화재단 장학생 모집 재안내 (기한 연장)",
    "orgId": "knu_main",
    "orgName": "대학본부·학생처",
    "subOrg": "학생처 학생과 · 해동과학문화재단",
    "category": "research",
    "categoryName": "연구·장학·학술",
    "postedDate": "2026-10-23",
    "postedTime": "2026-10-23 16:01",
    "boardPeriod": "2026-10-23 ~ 2026-10-29",
    "deadline": "2026-10-28",
    "deadlineTime": "18:00",
    "scheduleDetail": "본문 지원서 제출기한: ~2026.10.28(수) 오후 6시까지 (ricjtls@knu.ac.kr)",
    "eligibility": "화공·재료·전자·신소재·반도체·로봇·AI 전공 2~3학년 진학예정자 (소득 4분위 이내)",
    "benefit": "1인당 연간 1,200만원 지급 (월 100만원씩 분할 지급, 졸업 시까지 지원 가능)",
    "url": "https://knu.ac.kr/wbbs/wbbs/bbs/btin/viewBtin.action?bbs_cde=1&btin.bbs_cde=1&btin.doc_no=1338644&btin.appl_no=000000&menu_idx=67",
    "tags": [
        "10월28일마감완료",
        "해동과학문화재단",
        "연1200만원",
        "공대·IT대"
    ],
    "summary": "[본문 분석 완료] 2026-10-23 16:01 게시(doc_no=1338644). 본문 4항 지원서 제출기한에 따라 10.28(수) 18:00에 이메일 접수가 공식 마감되었습니다.",
    "isNew": false
},
{
    "id": "it_see_105565",
    "itemType": "contest",
    "title": "[기초교육센터] 수요기반 교양교과목 개발 「내가 듣고 싶은 교양수업 공모전」",
    "orgId": "knu_main",
    "orgName": "대학본부·학생처",
    "subOrg": "기초교육센터 (053-950-4405)",
    "category": "research",
    "categoryName": "연구·장학·학술",
    "postedDate": "2026-10-07",
    "postedTime": "2026-10-07 09:12",
    "boardPeriod": "2026-10-07 ~ 2026-11-06",
    "deadline": "2026-10-29",
    "deadlineTime": "18:00",
    "scheduleDetail": "본문 공모기간 2026.10.01(목) ~ 10.29(목) [4주간] (게시판 노출기간 ~11.06)",
    "eligibility": "학부 재학생 4명 이상으로 구성된 팀 (사업기간 2026.10~12 중 재학생)",
    "benefit": "총장상·교무처장상 상장 및 장학금 수여 (신규 교양교과목 실제 개설 반영)",
    "url": "https://knu.ac.kr/wbbs/wbbs/bbs/btin/viewBtin.action?bbs_cde=1&btin.bbs_cde=1&btin.doc_no=1338501&btin.appl_no=000000&menu_idx=67",
    "tags": [
        "10월29일본문마감",
        "교양수업공모전",
        "기초교육센터",
        "총장상장학금"
    ],
    "summary": "[본문 분석 완료] 2026-10-07 09:12 게시(doc_no=1338501). 상단 게시기간은 11.06까지이나 본문 '나. 공모기간'은 10.01(목)~10.29(목)으로 접수가 마감되어 현재 심사 중입니다.",
    "isNew": false
},
{
    "id": "knu_main_1338502",
    "itemType": "contest",
    "title": "[진로취업과] 서울대학교 공동 「KNU in the World Program」 (어제 서류마감·금주 발표)",
    "orgId": "knu_main",
    "orgName": "대학본부·학생처",
    "subOrg": "진로취업과 (053-950-2868)",
    "category": "global",
    "categoryName": "글로벌·대외활동",
    "postedDate": "2026-10-07",
    "postedTime": "2026-10-07 09:26",
    "boardPeriod": "2026-10-07 ~ 2026-11-06",
    "deadline": "2026-11-03",
    "deadlineTime": "18:00",
    "scheduleDetail": "신청접수 10.21~11.03(마감) → 1차 발표 11.06(금) → 면접 11.09~11.13 → 최종발표 11.18 → 싱가포르 파견 '27.1.10~1.22",
    "eligibility": "경북대 학부생 16명 (평점 3.0/4.3 이상, TOEIC 700 이상, '27년 2월 졸업예정자 제외)",
    "benefit": "싱가포르 현지 프로그램 항공료·체재비 지원 및 계절학기 일반선택 3학점 인정",
    "url": "https://www.knu.ac.kr/wbbs/wbbs/bbs/btin/viewBtin.action?bbs_cde=1&btin.bbs_cde=1&btin.doc_no=1338502&btin.appl_no=000000&menu_idx=67",
    "tags": [
        "11월3일접수마감",
        "11월6일1차발표",
        "싱가포르PBL",
        "서울대1대1매칭"
    ],
    "summary": "[본문 분석 완료] 2026-10-07 09:26 게시(doc_no=1338502). 게시판 게시기간은 ~11.06이나 본문 신청기간은 10.21(수)~11.03(화)로 어제 마감되었습니다. 11.06(금) 1차 서류 발표 및 11.09~13 면접이 진행됩니다.",
    "isNew": false
},
{
    "id": "robot_bootcamp_2026",
    "itemType": "contest",
    "title": "[로봇부트캠프사업단] 2026-2학기 및 동계 로봇 마이크로전공(제어·HW / AI·SW / SI·운용) 참여생 모집",
    "orgId": "bootcamp",
    "orgName": "로봇·AI·반도체·항공드론 사업단",
    "subOrg": "경북대 로봇부트캠프사업단 (단장: 이준우 교수)",
    "category": "hackathon",
    "categoryName": "해커톤·AI·SW",
    "postedDate": "2026-10-26",
    "postedTime": "2026-10-26 10:00",
    "boardPeriod": "2026-10-26 ~ 2026-11-20",
    "deadline": "2026-11-20",
    "deadlineTime": "18:00",
    "scheduleDetail": "온라인 신청서·참여의향서 제출(~11.20) → 중·고급 마이크로전공 이수 → 학기별 장려금(최대 150만원) 및 해외연수 선발",
    "eligibility": "로봇공학과·스마트모빌리티·우주공학·전기공학·IT대학 등 로봇 분야 관심 학부 재학생 (초급·휴학·졸업유예 제외)",
    "benefit": "1인당 학기당 최대 150만원(최대 4학기 총 600만원) 장려금 지급, 해외 로봇 선진기관 연수 및 최대 24학점 수강 허용",
    "url": "https://robotics.knu.ac.kr/apply/bootcamp",
    "tags": [
        "로봇부트캠프",
        "학기당150만원장려금",
        "최대600만원",
        "해외로봇연수"
    ],
    "summary": "[본문 분석 완료] 경북대 로봇부트캠프사업단(robotics.knu.ac.kr) 공식 모집. 제어·HW, AI·SW, SI·운용 3대 마이크로전공 이수 시 학기당 최대 150만원(총 600만원) 장려금과 해외 인턴십 기회를 제공합니다.",
    "isNew": false
},
{
    "id": "ai_bootcamp_sjsu_105733",
    "itemType": "contest",
    "title": "[AI부트캠프사업단] 2026 글로벌 AI부트캠프 미국 실리콘밸리(산호세주립대 SJSU) 3주 해외연수 모집",
    "orgId": "bootcamp",
    "orgName": "로봇·AI·반도체·항공드론 사업단",
    "subOrg": "경북대 AI부트캠프사업단 (복지관 312호)",
    "category": "global",
    "categoryName": "글로벌·대외활동",
    "postedDate": "2026-10-22",
    "postedTime": "2026-10-22 14:30",
    "boardPeriod": "2026-10-22 ~ 2026-11-18",
    "deadline": "2026-11-12",
    "deadlineTime": "24:00",
    "scheduleDetail": "PDF 이메일 접수 ~11.12(목) 24:00 → 면접 11.17(화) → 발표 11.18(수) → 실리콘밸리 파견 '27.01.04~01.22(3주)",
    "eligibility": "AI부트캠프 중·고급 이수자(또는 2026-2학기 이수 예정자) 중 공인영어성적(TOEIC 750 / OPIc IM2 등) 보유 학부생 10명",
    "benefit": "미국 산호세주립대(SJSU) 교육비·숙박비·공항이동·실리콘밸리 기업투어·여행자보험 사업단 전액 지원",
    "url": "https://see.knu.ac.kr/eng/content/board/notice.html?pg=vv&fidx=105733",
    "tags": [
        "AI부트캠프",
        "실리콘밸리해외연수",
        "11월12일마감",
        "산호세주립대"
    ],
    "summary": "[본문 분석 완료] 2026-10-22 게시(fidx=105733). 본문 2번 항목인 미국 산호세주립대(SJSU) 3주 해외연수(10명 선발)는 11.12(목) 24:00까지 이메일(aibootcamp@knu.ac.kr)로 서류를 접수합니다.",
    "isNew": false
},
{
    "id": "see_venture_105810",
    "itemType": "contest",
    "title": "[IT대학·창업] 2026 KNU 벤처 메이커스 (기업가 정신 및 창의력 강화캠프) 참가 학생 모집",
    "orgId": "it_college",
    "orgName": "IT대학 (전자공학부·컴퓨터학부)",
    "subOrg": "IT대학 전자공학부 · 산학협력단 (작성자: 백영경)",
    "category": "startup",
    "categoryName": "창업·아이디어",
    "postedDate": "2026-11-04",
    "postedTime": "2026-11-04 13:20",
    "boardPeriod": "2026-11-04 ~ 2026-11-15",
    "deadline": "2026-11-13",
    "deadlineTime": "18:00",
    "scheduleDetail": "공고 등록 2026.11.04(수) → 참가 학생 모집 ~11.13(금) 18:00",
    "eligibility": "IT대학 및 창업·아이디어 구체화에 관심 있는 경북대학교 재학생",
    "benefit": "기업가 정신 및 창의적 문제해결 집중 캠프 전액 지원, 우수팀 시상",
    "url": "https://see.knu.ac.kr/mobile/content/notice.html?fidx=105810",
    "tags": [
        "오늘게시",
        "KNU벤처메이커스",
        "창의력강화캠프",
        "IT대학"
    ],
    "summary": "[본문 분석 완료] 오늘(2026-11-04) IT대학 전자공학부 공지사항(fidx=105810)에 신규 등록된 기업가 정신 및 창의력 강화캠프 참가자 모집 공고입니다.",
    "isNew": true
},
{
    "id": "aerodrone_105721",
    "itemType": "event",
    "title": "[항공드론 혁신융합대학사업단] 2026 항공·우주 산업현장(니어스랩·파블로항공·심투리얼) 직무 탐색",
    "orgId": "bootcamp",
    "orgName": "로봇·AI·반도체·항공드론 사업단",
    "subOrg": "경북대 항공드론 혁신융합대학사업단 (053-950-2893)",
    "category": "event",
    "categoryName": "교내행사·특강·페스티벌",
    "postedDate": "2026-10-20",
    "postedTime": "2026-10-20 14:00",
    "boardPeriod": "2026-10-20 ~ 2026-11-13",
    "deadline": "2026-11-13",
    "deadlineTime": "18:30",
    "scheduleDetail": "사전모집 10.21~10.28(20명 선발 완료) → 산업현장 방문 본 행사: 2026.11.13(금) 09:00~18:30 (대전 일대)",
    "eligibility": "경북대학교 학부 재학생 (전공 무관, 20명 내외)",
    "benefit": "대전 니어스랩·파블로항공 R&D센터·심투리얼 연구소 투어 및 현직자 세미나, 왕복 버스·식사·보험 전액 지원",
    "url": "https://see.knu.ac.kr/mobile/content/notice.html?fidx=105721",
    "tags": [
        "항공드론사업단",
        "파블로항공·니어스랩",
        "11월13일현장탐방",
        "전공무관"
    ],
    "summary": "[본문 분석 완료] 2026-10-20 게시(fidx=105721). 사전 네이버폼 모집(10.21~10.28)을 거쳐 11.13(금) 09:00~18:30 대전 니어스랩·파블로항공 R&D센터·심투리얼 현장 직무 탐색이 진행됩니다.",
    "isNew": false
},
{
    "id": "see_mentor_105725",
    "itemType": "event",
    "title": "[IT대학·지역전략산업혁신연구소] 지역청년 AI창업·마케팅·로컬콘텐츠 멘토링 토크콘서트",
    "orgId": "it_college",
    "orgName": "IT대학 (전자공학부·컴퓨터학부)",
    "subOrg": "경북대 IT대학 · 북구청년꿈드림지원센터 (053-950-3419)",
    "category": "event",
    "categoryName": "교내행사·특강·페스티벌",
    "postedDate": "2026-10-21",
    "postedTime": "2026-10-21 11:30",
    "boardPeriod": "2026-10-21 ~ 2026-11-11",
    "deadline": "2026-11-11",
    "deadlineTime": "14:00",
    "scheduleDetail": "본 행사 일시: 2026.11.11(수) 14:00~17:00 / 글로벌플라자 경하홀Ⅱ (사전·현장 질문 추첨 선물 증정)",
    "eligibility": "IT대학 재학생 및 창업·마케팅·로컬콘텐츠에 관심 있는 경북대생 약 100명",
    "benefit": "파미티 최대영 대표(AI창업)·텀즈온 김혜원 대표(마케팅)·제반드로 작가·산자부 청년보좌역 토크 및 경품 추첨",
    "url": "https://see.knu.ac.kr/mobile/content/notice.html?fidx=105725",
    "tags": [
        "11월11일경하홀",
        "AI기술창업",
        "토크콘서트",
        "현장경품추첨"
    ],
    "summary": "[본문 분석 완료] 2026-10-21 게시(fidx=105725). 11월 11일(수) 14:00~17:00 글로벌플라자 경하홀Ⅱ에서 AI창업·마케팅·로컬콘텐츠 연사 3인 및 산자부 청년보좌역과 함께하는 토크콘서트가 열립니다.",
    "isNew": false
},
{
    "id": "aerodrone_coshow_105348",
    "itemType": "event",
    "title": "[항공드론·AICOSS] 2026 CO-SHOW 첨단분야 혁신융합대학 드론·AIM 챌린지 본선 및 팝업캠퍼스",
    "orgId": "bootcamp",
    "orgName": "로봇·AI·반도체·항공드론 사업단",
    "subOrg": "항공드론혁신융합대학사업단 · 인공지능혁신융합대학사업단",
    "category": "event",
    "categoryName": "교내행사·특강·페스티벌",
    "postedDate": "2026-10-20",
    "postedTime": "2026-10-20 10:00",
    "boardPeriod": "2026-10-20 ~ 2026-11-20",
    "deadline": "2026-11-18",
    "deadlineTime": "18:00",
    "scheduleDetail": "예선 통과팀 본선 대회 및 CO-SHOW 전시는 2026.11.18(수) ~ 11.20(금) 3일간 개최",
    "eligibility": "항공드론·인공지능 혁신융합대학 사업 참여 학부생 및 참관 희망 학생",
    "benefit": "전국 첨단분야 혁신융합대학 13개 컨소시엄 경진대회 본선 관람 및 드론·로보틱스 체험 부스 운영",
    "url": "https://see.knu.ac.kr/mobile/content/notice.html?fidx=105348",
    "tags": [
        "항공드론COSS",
        "AICOSS",
        "CO-SHOW본선",
        "11월18일개막"
    ],
    "summary": "[본문 분석 완료] 항공드론 및 인공지능 혁신융합대학사업단이 참여하는 2026 CO-SHOW 본선 경진대회(드론 챌린지·AIM 챌린지)가 11.18(수)~11.20(금) 개최됩니다.",
    "isNew": false
}
];

const state = {
  activeTab: "explore",
  subPreset: "search",
  selectedType: "all",
  selectedOrg: "all",
  selectedCategory: "all",
  searchQuery: "",
  sortBy: "deadline",
  activeOnly: true,
  bookmarksOnly: false,
  bookmarks: new Set(),
  competitions: INITIAL_COMPETITIONS.map(normalizeItem).filter(Boolean),
  selectedCalendarDate: null,
  calendarMonth: TODAY_STR.slice(0, 7),
  activeModalItemId: null,
  qnaPosts: [],
  qnaCount: null,
  qnaCategory: "all",
  qnaSearch: "",
  qnaAnsweredOnly: false,
  expandedQnaIds: new Set()
};

function loadStorage() {
  try {
    const savedBm = localStorage.getItem("knu_contest_bookmarks_v1");
    if (savedBm) {
      const parsed = JSON.parse(savedBm);
      if (Array.isArray(parsed)) state.bookmarks = new Set(parsed.filter(v => typeof v === "string").slice(0, 500));
    }
  } catch (e) {}
}

function saveBookmarks() {
  try {
    localStorage.setItem("knu_contest_bookmarks_v1", JSON.stringify([...state.bookmarks]));
  } catch (e) {}
}

function getDaysLeft(deadlineStr) {
  const cleanDeadline = (deadlineStr || TODAY_STR).slice(0, 10);
  const today = new Date(TODAY_STR + "T00:00:00+09:00");
  const target = new Date(cleanDeadline + "T00:00:00+09:00");
  const diffMs = target.getTime() - today.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

function getPostedDateAnalysis(postedDateStr, postedTimeStr) {
  const cleanPosted = (postedDateStr || TODAY_STR).slice(0, 10);
  const today = new Date(TODAY_STR + "T00:00:00+09:00");
  const posted = new Date(cleanPosted + "T00:00:00+09:00");
  const diffDays = Math.round((today.getTime() - posted.getTime()) / (1000 * 60 * 60 * 24));
  const fullStamp = postedTimeStr || cleanPosted;
  if (diffDays <= 0) {
    return {
      daysAgo: 0,
      label: "오늘 게시",
      detail: `${fullStamp} 등록 (오늘 ${TODAY_STR} 당일 등록 공고)`,
      classes: "bg-emerald-50 text-emerald-700 border border-emerald-200"
    };
  }
  if (diffDays === 1) {
    return {
      daysAgo: 1,
      label: "어제 게시 (1일 전)",
      detail: `${fullStamp} 등록 (오늘 ${TODAY_STR} 기준 1일 전 게시)`,
      classes: "bg-sky-50 text-sky-700 border border-sky-200"
    };
  }
  if (diffDays <= 7) {
    return {
      daysAgo: diffDays,
      label: `${diffDays}일 전 게시`,
      detail: `${fullStamp} 등록 (오늘 ${TODAY_STR} 기준 ${diffDays}일 전 게시)`,
      classes: "bg-indigo-50/70 text-indigo-700 border border-indigo-200/70"
    };
  }
  return {
    daysAgo: diffDays,
    label: `${diffDays}일 전 게시`,
    detail: `${fullStamp} 등록 (오늘 ${TODAY_STR} 기준 ${diffDays}일 경과)`,
    classes: "bg-slate-100 text-slate-600 border border-slate-200"
  };
}

function formatDDayBadge(deadlineStr) {
  const days = getDaysLeft(deadlineStr);
  if (days < 0) {
    return { label: `본문마감 (D+${Math.abs(days)})`, classes: "bg-slate-100 text-slate-500 border border-slate-200", progress: 100 };
  }
  if (days === 0) {
    return { label: "D-Day 오늘마감", classes: "bg-rose-600 text-white", progress: 96 };
  }
  if (days <= 7) {
    return { label: "D-" + days + " 임박", classes: "bg-rose-50 text-rose-700 border border-rose-200", progress: Math.max(20, 100 - days * 10) };
  }
  return { label: "D-" + days, classes: "bg-slate-900 text-white", progress: Math.max(15, Math.min(85, 100 - days * 3)) };
}

function showToast(msg) {
  const container = document.getElementById("toast-container");
  const textEl = document.getElementById("toast-message");
  if (!container || !textEl) return;
  textEl.textContent = msg;
  container.classList.remove("hidden");
  if (window._toastTimer) clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => {
    container.classList.add("hidden");
  }, 2800);
}

function renderMetrics() {
  const totalEl = document.getElementById("metric-total");
  const urgentEl = document.getElementById("metric-urgent");
  const qnaEl = document.getElementById("metric-qna");
  const navQnaCountEl = document.getElementById("nav-qna-count");
  const bmCountEl = document.getElementById("header-bookmark-count");

  const urgentCount = state.competitions.filter(item => {
    const d = getDaysLeft(item.deadline);
    return d >= 0 && d <= 7;
  }).length;

  if (totalEl) totalEl.textContent = String(state.competitions.length);
  if (urgentEl) urgentEl.textContent = String(urgentCount);
  const qnaCount = state.qnaCount != null ? String(state.qnaCount) : "–";
  if (qnaEl) qnaEl.textContent = qnaCount;
  if (navQnaCountEl) navQnaCountEl.textContent = qnaCount;
  if (bmCountEl) bmCountEl.textContent = String(state.bookmarks.size);

  const basePool = state.activeOnly
    ? state.competitions.filter(c => getDaysLeft(c.deadline) >= 0)
    : state.competitions;
  const countAll = basePool.length;
  const countContest = basePool.filter(c => (c.itemType || 'contest') === 'contest').length;
  const countEvent = basePool.filter(c => (c.itemType || '') === 'event').length;
  const countCampaign = basePool.filter(c => (c.itemType || '') === 'campaign').length;

  const lastUpdEl = document.getElementById("hero-last-updated");
  if (lastUpdEl) lastUpdEl.textContent = state.lastUpdated || lastUpdEl.getAttribute("data-default") || TODAY_STR;

  const tabCountAll = document.getElementById("tab-count-all");
  const tabCountContest = document.getElementById("tab-count-contest");
  const tabCountEvent = document.getElementById("tab-count-event");
  const tabCountCampaign = document.getElementById("tab-count-campaign");

  if (tabCountAll) tabCountAll.textContent = String(countAll);
  if (tabCountContest) tabCountContest.textContent = String(countContest);
  if (tabCountEvent) tabCountEvent.textContent = String(countEvent);
  if (tabCountCampaign) tabCountCampaign.textContent = String(countCampaign);
}

function renderOrgFilters() {
  const container = document.getElementById("org-filter-container");
  if (!container) return;

  container.innerHTML = ORGANIZATIONS.map(org => {
    const count = org.id === "all"
      ? state.competitions.length
      : state.competitions.filter(c => c.orgId === org.id).length;
    const active = state.selectedOrg === org.id;
    const btnClass = active
      ? "bg-slate-950 text-white border-slate-950 shadow-sm"
      : "bg-[#f6f5f2] hover:bg-slate-200/70 text-slate-700 border-slate-200/80";
    const badgeClass = active
      ? "bg-rose-600 text-white"
      : "bg-white text-slate-600";

    return `
      <button type="button" data-org="${org.id}" class="org-filter-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border whitespace-nowrap transition ${btnClass}">
        <i data-lucide="${org.icon}" class="w-3.5 h-3.5"></i>
        <span>${org.name}</span>
        <span class="px-1.5 py-0.2 rounded-md text-[10px] font-extrabold ${badgeClass}">${count}</span>
      </button>
    `;
  }).join("");

  container.querySelectorAll(".org-filter-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      state.selectedOrg = btn.getAttribute("data-org") || "all";
      const pillOrg = document.getElementById("pill-org-select");
      if (pillOrg) pillOrg.value = state.selectedOrg;
      renderAll();
    });
  });
}

function renderCategoryFilters() {
  const container = document.getElementById("category-filter-container");
  if (!container) return;
  container.innerHTML = CATEGORIES.map(cat => `<button type="button" data-cat="${cat.id}" class="cat-filter-btn">${cat.name}</button>`).join("");
}

function getFilteredCompetitions() {
  return state.competitions
    .filter(item => {
      const itemType = item.itemType || (item.category === "event" ? "event" : item.category === "campaign" ? "campaign" : "contest");
      if (state.selectedType !== "all" && itemType !== state.selectedType) return false;
      if (state.selectedOrg !== "all") {
        if (state.selectedOrg === "bootcamp") {
          const isBootcampOrCoss = item.orgId === "bootcamp" || /로봇부트캠프|AI부트캠프|항공드론|반도체특성화|인공지능혁신융합|AICOSS/.test(`${item.title} ${item.subOrg}`);
          if (!isBootcampOrCoss) return false;
        } else if (item.orgId !== state.selectedOrg) {
          return false;
        }
      }
      if (state.selectedCategory !== "all" && item.category !== state.selectedCategory) return false;
      if (state.activeOnly && getDaysLeft(item.deadline) < 0) return false;
      if (state.bookmarksOnly && !state.bookmarks.has(item.id)) return false;

      if (state.subPreset === "contest" && itemType !== "contest") return false;
      if (state.subPreset === "event" && itemType !== "event") return false;
      if (state.subPreset === "campaign" && itemType !== "campaign") return false;
      if (state.subPreset === "urgent" && (getDaysLeft(item.deadline) < 0 || getDaysLeft(item.deadline) > 10)) return false;
      if (state.subPreset === "major" && !["hackathon", "capstone", "startup"].includes(item.category)) return false;

      if (state.searchQuery.trim() !== "") {
        const q = state.searchQuery.trim().toLowerCase();
        const hay = `${item.title} ${item.orgName} ${item.subOrg} ${item.categoryName} ${(item.tags || []).join(" ")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (state.sortBy === "deadline") {
        const da = getDaysLeft(a.deadline);
        const db = getDaysLeft(b.deadline);
        if (da < 0 && db >= 0) return 1;
        if (db < 0 && da >= 0) return -1;
        return a.deadline.localeCompare(b.deadline);
      }
      if (state.sortBy === "newest") {
        return b.postedDate.localeCompare(a.postedDate);
      }
      if (state.sortBy === "org") {
        return a.orgName.localeCompare(b.orgName);
      }
      return 0;
    });
}

// Original Editorial Ticket Card Renderer
function renderContestGrid() {
  const grid = document.getElementById("contest-grid");
  const emptyState = document.getElementById("empty-state");
  const countEl = document.getElementById("result-count");
  const filterBadge = document.getElementById("active-filter-badge");
  if (!grid || !emptyState || !countEl) return;

  const filtered = getFilteredCompetitions();
  countEl.textContent = String(filtered.length);

  if (filterBadge) {
    const parts = [];
    if (state.selectedType !== "all") {
      parts.push(state.selectedType === "event" ? "교내 행사·특강" : state.selectedType === "campaign" ? "캠페인·서포터즈" : "공모전·경진대회");
    }
    if (state.selectedOrg !== "all") {
      const orgObj = ORGANIZATIONS.find(o => o.id === state.selectedOrg);
      if (orgObj) parts.push(orgObj.name);
    }
    if (state.selectedCategory !== "all") {
      const catObj = CATEGORIES.find(c => c.id === state.selectedCategory);
      if (catObj) parts.push(catObj.name);
    }
    if (state.bookmarksOnly) parts.push("관심 보관함");
    if (state.subPreset === "events") parts.push("교내 행사·캠페인");
    if (state.subPreset === "urgent") parts.push("마감 임박 추천");
    if (state.subPreset === "major") parts.push("커리어 맞춤 추천");
    if (state.searchQuery.trim()) parts.push(`"${state.searchQuery.trim()}"`);

    if (parts.length > 0) {
      filterBadge.textContent = parts.join(" · ");
      filterBadge.classList.remove("hidden");
    } else {
      filterBadge.classList.add("hidden");
    }
  }

  if (filtered.length === 0) {
    grid.innerHTML = "";
    grid.classList.add("hidden");
    emptyState.classList.remove("hidden");
    return;
  }

  grid.classList.remove("hidden");
  emptyState.classList.add("hidden");

  grid.innerHTML = filtered.map(item => {
    const itemType = item.itemType || (item.category === "event" ? "event" : item.category === "campaign" ? "campaign" : "contest");
    const theme = TYPE_THEME[itemType] || TYPE_THEME.contest;
    const dday = formatDDayBadge(item.deadline);
    const postedInfo = getPostedDateAnalysis(item.postedDate, item.postedTime);
    const isBookmarked = state.bookmarks.has(item.id);
    const bmCls = isBookmarked ? "text-rose-600 fill-rose-600" : "text-slate-400 hover:text-slate-800";
    const deadlineDisplay = item.deadlineTime ? `${item.deadline} (${item.deadlineTime} 마감)` : `${item.deadline} 까지`;
    const scheduleDisplay = item.scheduleDetail || `${item.postedDate} 게시 ~ ${item.deadline} 마감`;

    return `
      <article class="ticket-card overflow-hidden flex flex-col justify-between cursor-pointer card-title-trigger" data-detail-id="${esc(item.id)}">
        <!-- Top Color Accent Bar -->
        <div>
          <div class="h-1.5 w-full ${theme.bar}"></div>

          <div class="p-5 pb-4 space-y-3.5">
            <!-- Header: Category Type Pill + Posted Age Badge + D-Day & Bookmark -->
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-1.5 min-w-0">
                <span class="px-2.5 py-0.5 rounded-lg text-[11px] font-extrabold border shrink-0 ${theme.pill}">
                  ${theme.badge}
                </span>
                <span class="px-2 py-0.5 rounded-md text-[10px] font-extrabold shrink-0 ${postedInfo.classes}">
                  ${postedInfo.label}
                </span>
                <span class="text-xs font-bold text-slate-500 truncate">
                  ${esc(item.subOrg)}
                </span>
              </div>
              <div class="flex items-center gap-1.5 shrink-0">
                <span class="px-2.5 py-0.5 rounded-lg text-xs font-extrabold ${dday.classes}">
                  ${dday.label}
                </span>
                <button type="button" data-bm-id="${esc(item.id)}" class="card-bm-btn p-1.5 rounded-xl hover:bg-slate-100 transition" aria-label="관심 공고 저장">
                  <i data-lucide="bookmark" class="w-4 h-4 ${bmCls}"></i>
                </button>
              </div>
            </div>

            <!-- Title & Summary -->
            <div class="space-y-1.5">
              <h4 class="font-extrabold text-[17px] text-slate-950 leading-snug line-clamp-2 group-hover:text-rose-700">
                ${esc(item.title)}
              </h4>
              <p class="text-xs text-slate-600 leading-relaxed line-clamp-2">
                ${esc(item.summary)}
              </p>
            </div>

            <!-- Structured Info Box (Posted Date vs Body Deadline Analysis) -->
            <div class="bg-[#f6f5f2] rounded-2xl p-3 space-y-1.5 border border-slate-200/60 text-xs">
              <div class="flex items-center justify-between gap-2 text-[11px]">
                <span class="text-slate-400 font-semibold shrink-0">공고 게시일시</span>
                <span class="font-bold text-slate-700 text-right">${esc(item.postedTime || item.postedDate)} <span class="text-slate-400 font-normal">(${postedInfo.label})</span></span>
              </div>
              <div class="flex items-center justify-between gap-2 text-[11px]">
                <span class="text-slate-400 font-semibold shrink-0">본문 마감일시</span>
                <strong class="font-extrabold text-slate-900 text-right">${esc(deadlineDisplay)}</strong>
              </div>
              <div class="flex items-start justify-between gap-2 pt-1 border-t border-slate-200/70 text-[11px]">
                <span class="text-slate-400 font-semibold shrink-0">본문 일정 리딩</span>
                <span class="font-semibold text-rose-800 text-right line-clamp-1">${esc(scheduleDisplay)}</span>
              </div>
              <div class="flex items-start justify-between gap-2 pt-1 border-t border-slate-200/70">
                <span class="text-slate-400 font-semibold shrink-0">혜택·시상</span>
                <strong class="font-bold text-right ${theme.accentText} line-clamp-1">${esc(item.benefit)}</strong>
              </div>
              <div class="flex items-start justify-between gap-2">
                <span class="text-slate-400 font-semibold shrink-0">참여대상</span>
                <span class="text-slate-700 font-medium text-right line-clamp-1">${esc(item.eligibility)}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Dashed Ticket Stub Footer -->
        <div class="px-5 py-3.5 bg-slate-50/70 border-t border-dashed border-slate-200 flex items-center justify-between gap-2">
          <div class="flex flex-wrap items-center gap-1 overflow-hidden max-h-6">
            ${(item.tags || []).slice(0, 3).map(t => `<span class="px-2 py-0.5 rounded-md bg-white border border-slate-200/80 text-slate-500 text-[11px] font-medium">#${esc(t)}</span>`).join("")}
          </div>
          <a href="${esc(safeUrl(item.url))}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-slate-900 hover:bg-rose-700 text-white text-xs font-bold shrink-0 transition">
            <span>원문 공지</span>
            <i data-lucide="arrow-up-right" class="w-3.5 h-3.5"></i>
          </a>
        </div>
      </article>
    `;
  }).join("");

  grid.querySelectorAll(".card-bm-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.getAttribute("data-bm-id");
      if (!id) return;
      toggleBookmark(id);
    });
  });

  grid.querySelectorAll(".card-title-trigger").forEach(el => {
    el.setAttribute("tabindex", "0");
    el.setAttribute("role", "button");
    el.addEventListener("keydown", (e) => {
      if ((e.key === "Enter" || e.key === " ") && e.target === el) {
        e.preventDefault();
        el.click();
      }
    });
    el.addEventListener("click", (e) => {
      if (e.target.closest("a")) return; // '원문 공지' 링크 클릭은 모달을 열지 않음
      const id = el.getAttribute("data-detail-id");
      if (id) openDetailModal(id);
    });
  });
}

function toggleBookmark(id) {
  if (state.bookmarks.has(id)) {
    state.bookmarks.delete(id);
    showToast("관심 보관함에서 해제되었습니다.");
  } else {
    state.bookmarks.add(id);
    showToast("관심 보관함에 저장되었습니다.");
  }
  saveBookmarks();
  renderAll();
}

function openDetailModal(id) {
  const item = state.competitions.find(c => c.id === id);
  if (!item) return;
  state.activeModalItemId = id;

  const dday = formatDDayBadge(item.deadline);
  document.getElementById("modal-org-badge").textContent = item.orgName;
  document.getElementById("modal-cat-badge").textContent = item.categoryName;
  const ddayEl = document.getElementById("modal-dday-badge");
  ddayEl.textContent = dday.label;
  ddayEl.className = `px-2.5 py-0.5 rounded-lg text-xs font-bold ${dday.classes}`;

  const postedInfo = getPostedDateAnalysis(item.postedDate, item.postedTime);
  document.getElementById("modal-title").textContent = item.title;
  document.getElementById("modal-suborg").textContent = item.subOrg;
  const postedEl = document.getElementById("modal-posted-analysis");
  if (postedEl) postedEl.textContent = postedInfo.detail;
  document.getElementById("modal-dates").textContent = `${item.deadline} ${item.deadlineTime ? item.deadlineTime + ' 마감' : '마감'} (${dday.label})`;
  const bpEl = document.getElementById("modal-board-period");
  if (bpEl) bpEl.textContent = item.boardPeriod || `${item.postedDate} ~ ${item.deadline}`;
  const schedEl = document.getElementById("modal-schedule-detail");
  if (schedEl) schedEl.textContent = item.scheduleDetail || `${item.postedDate} 등록 ~ ${item.deadline} 마감`;
  document.getElementById("modal-eligibility").textContent = item.eligibility;
  document.getElementById("modal-benefit").textContent = item.benefit;
  document.getElementById("modal-summary").textContent = item.summary;
  document.getElementById("modal-source-link").setAttribute("href", safeUrl(item.url));

  const tagsEl = document.getElementById("modal-tags");
  tagsEl.innerHTML = (item.tags || []).map(t => `<span class="px-3 py-1 rounded-xl border border-slate-200 bg-[#f6f5f2] text-slate-600 text-xs font-semibold">#${esc(t)}</span>`).join("");

  const bmLabel = document.getElementById("modal-bookmark-label");
  bmLabel.textContent = state.bookmarks.has(id) ? "관심 공고 저장됨 ★" : "관심 공고 저장";

  state.lastFocus = document.activeElement;
  document.getElementById("detail-modal").classList.remove("hidden");
  document.body.style.overflow = "hidden";
  if (window.lucide) window.lucide.createIcons();
  const closeBtn = document.getElementById("close-modal-btn");
  if (closeBtn) closeBtn.focus();
}

function closeDetailModal() {
  const modal = document.getElementById("detail-modal");
  if (modal.classList.contains("hidden")) return;
  modal.classList.add("hidden");
  document.body.style.overflow = "";
  state.activeModalItemId = null;
  if (state.lastFocus && typeof state.lastFocus.focus === "function") state.lastFocus.focus();
}

function shiftMonth(ym, delta) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(ym) {
  const [y, m] = ym.split("-").map(Number);
  return `${y}년 ${m}월`;
}

function renderCalendarView() {
  const grid = document.getElementById("calendar-days-grid");
  const sideTitle = document.getElementById("calendar-side-title");
  const sideCount = document.getElementById("calendar-side-count");
  const sideList = document.getElementById("calendar-side-list");
  if (!grid || !sideList) return;

  const ym = state.calendarMonth;
  const [calY, calM] = ym.split("-").map(Number);
  const firstWeekday = new Date(calY, calM - 1, 1).getDay();
  const daysInMonth = new Date(calY, calM, 0).getDate();

  const monthLabelEl = document.getElementById("cal-month-label");
  if (monthLabelEl) monthLabelEl.textContent = formatMonthLabel(ym);
  const showAllBtn = document.getElementById("cal-show-all-btn");
  if (showAllBtn) showAllBtn.textContent = `${calM}월 전체 목록`;
  const todayLabel = document.getElementById("cal-today-label");
  if (todayLabel) todayLabel.textContent = `오늘 (${TODAY_STR})`;

  const cells = [];
  for (let i = 0; i < firstWeekday; i++) {
    cells.push(`<div aria-hidden="true"></div>`);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${ym}-${String(day).padStart(2, "0")}`;
    const matches = state.competitions.filter(c => c.deadline === dateStr);
    const isToday = dateStr === TODAY_STR;
    const isSelected = state.selectedCalendarDate === dateStr;

    let borderCls = "border-slate-200 bg-white hover:border-slate-900";
    if (isSelected) borderCls = "border-slate-950 ring-2 ring-slate-900/15 bg-rose-50/40";
    else if (isToday) borderCls = "border-rose-500 bg-rose-50/25";

    cells.push(`
      <button type="button" data-date="${dateStr}" aria-label="${calM}월 ${day}일, 마감 ${matches.length}건" aria-pressed="${isSelected}" class="cal-day-btn min-h-[68px] sm:min-h-[78px] p-1.5 rounded-2xl border text-left flex flex-col justify-between transition ${borderCls}">
        <div class="flex items-center justify-between w-full">
          <span class="text-xs font-bold ${isToday ? 'bg-rose-600 text-white px-1.5 py-0.2 rounded-md' : 'text-slate-700'}">${day}</span>
          ${matches.length > 0 ? `<span class="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-slate-900 text-white">${matches.length}건</span>` : ''}
        </div>
        <div class="space-y-0.5 w-full overflow-hidden">
          ${matches.slice(0, 2).map(m => `<div class="truncate text-[10px] px-1 py-0.2 rounded bg-[#f6f5f2] text-slate-700 font-medium">${esc(m.subOrg.split(" ")[0])}</div>`).join("")}
        </div>
      </button>
    `);
  }
  grid.innerHTML = cells.join("");

  grid.querySelectorAll(".cal-day-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const d = btn.getAttribute("data-date");
      state.selectedCalendarDate = state.selectedCalendarDate === d ? null : d;
      renderCalendarView();
    });
  });

  const listItems = state.selectedCalendarDate
    ? state.competitions.filter(c => c.deadline === state.selectedCalendarDate)
    : state.competitions.filter(c => c.deadline.startsWith(ym)).sort((a, b) => a.deadline.localeCompare(b.deadline));

  if (sideTitle) {
    sideTitle.textContent = state.selectedCalendarDate
      ? `${state.selectedCalendarDate} 마감·진행 일정`
      : `${formatMonthLabel(ym)} 전체 마감·행사 타임라인`;
  }
  if (sideCount) {
    sideCount.textContent = `${listItems.length}건`;
  }

  if (listItems.length === 0) {
    sideList.innerHTML = `<div class="text-xs text-slate-400 py-8 text-center">선택한 날짜에 마감되는 일정이 없습니다.</div>`;
  } else {
    sideList.innerHTML = listItems.map(item => {
      const dday = formatDDayBadge(item.deadline);
      return `
        <div data-cal-item="${esc(item.id)}" class="cal-item-card p-3.5 rounded-2xl bg-white border border-slate-200 hover:border-rose-500 cursor-pointer transition space-y-1">
          <div class="flex items-center justify-between gap-2">
            <span class="text-[11px] font-extrabold text-rose-700">${esc(item.deadline)} 마감</span>
            <span class="px-2 py-0.2 rounded-md text-[10px] font-bold ${dday.classes}">${dday.label}</span>
          </div>
          <div class="text-xs font-extrabold text-slate-900 line-clamp-1">${esc(item.title)}</div>
          <div class="text-[11px] text-slate-500">${esc(item.subOrg)} · ${esc(item.benefit)}</div>
        </div>
      `;
    }).join("");

    sideList.querySelectorAll(".cal-item-card").forEach(card => {
      card.addEventListener("click", () => {
        const id = card.getAttribute("data-cal-item");
        if (id) openDetailModal(id);
      });
    });
  }
}

function populateQnaContestSelect() {
  const sel = document.getElementById("qna-input-contest");
  if (!sel) return;
  const options = ['<option value="">선택 안 함 / 일반 문의</option>'];
  state.competitions.forEach(c => {
    if (getDaysLeft(c.deadline) >= 0) options.push(`<option value="${esc(c.title)}">${esc(c.title)}</option>`);
  });
  sel.innerHTML = options.join("");
}

function switchTab(tabId) {
  state.activeTab = tabId;
  ["explore", "calendar", "qna"].forEach(t => {
    const el = document.getElementById("view-" + t);
    if (el) {
      if (t === tabId) el.classList.remove("hidden");
      else el.classList.add("hidden");
    }
  });

  document.querySelectorAll(".nav-tab-btn").forEach(btn => {
    const t = btn.getAttribute("data-tab");
    if (t === tabId) {
      btn.classList.add("bg-slate-950", "text-white", "shadow-sm");
      btn.classList.remove("text-slate-600", "bg-white/80");
    } else {
      btn.classList.remove("bg-slate-950", "text-white", "shadow-sm");
      btn.classList.add("text-slate-600");
    }
  });

  renderAll();
}

function updateSubPresetUI() {
  document.querySelectorAll(".sub-preset-btn").forEach(btn => {
    const p = btn.getAttribute("data-subpreset");
    if (p === state.subPreset) {
      btn.className = "sub-preset-btn px-3.5 py-2 rounded-xl text-xs font-bold bg-white text-slate-950 shadow-sm inline-flex items-center gap-1.5 transition";
    } else {
      btn.className = "sub-preset-btn px-3.5 py-2 rounded-xl text-xs font-bold bg-white/10 text-slate-200 hover:bg-white/20 inline-flex items-center gap-1.5 transition";
    }
  });
}

function updateTypeTabUI() {
  const type = state.selectedType || "all";
  document.querySelectorAll(".type-tab-btn").forEach(btn => {
    const t = btn.getAttribute("data-type-btn");
    if (t === type) {
      if (t === "contest") {
        btn.className = "type-tab-btn flex-1 min-w-[120px] py-2 px-3 rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-1.5 bg-indigo-600 text-white shadow-sm";
      } else if (t === "event") {
        btn.className = "type-tab-btn flex-1 min-w-[120px] py-2 px-3 rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-1.5 bg-amber-600 text-white shadow-sm";
      } else if (t === "campaign") {
        btn.className = "type-tab-btn flex-1 min-w-[120px] py-2 px-3 rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-1.5 bg-emerald-600 text-white shadow-sm";
      } else {
        btn.className = "type-tab-btn flex-1 min-w-[90px] py-2 px-3 rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-1.5 bg-slate-950 text-white shadow-sm";
      }
    } else {
      btn.className = "type-tab-btn flex-1 min-w-[90px] py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 bg-white text-slate-700 hover:bg-slate-100 border border-slate-200/70";
    }
  });

  const pillType = document.getElementById("pill-type-select");
  if (pillType && pillType.value !== type) {
    pillType.value = type;
  }

  const leadAccent = document.getElementById("section-lead-accent");
  const leadTitle = document.getElementById("section-lead-title");
  if (leadAccent && leadTitle) {
    if (type === "contest") {
      leadAccent.textContent = "KNU 공모전·경진대회";
      leadAccent.className = "text-indigo-600 font-extrabold";
      leadTitle.textContent = "단독 피드";
    } else if (type === "event") {
      leadAccent.textContent = "KNU 교내 행사·특강";
      leadAccent.className = "text-amber-700 font-extrabold";
      leadTitle.textContent = "단독 피드";
    } else if (type === "campaign") {
      leadAccent.textContent = "KNU 캠페인·서포터즈";
      leadAccent.className = "text-emerald-700 font-extrabold";
      leadTitle.textContent = "단독 피드";
    } else {
      leadAccent.textContent = "KNU";
      leadAccent.className = "text-rose-700 font-extrabold";
      leadTitle.textContent = "캠퍼스 모집 & 행사 피드";
    }
  }
}

function renderAll() {
  renderMetrics();
  renderOrgFilters();
  renderCategoryFilters();
  updateSubPresetUI();
  updateTypeTabUI();
  renderContestGrid();
  renderCalendarView();
  renderQnaBoard();
  if (window.lucide) window.lucide.createIcons();
}

window.addEventListener("DOMContentLoaded", () => {
  loadStorage();
  fetch('./data/competitions.json?t=' + Date.now(), { cache: 'no-store' })
    .then(r => r.ok ? r.json() : null)
    .then(d => {
      if (!d || !Array.isArray(d.items)) return;
      const items = d.items.slice(0, 500).map(normalizeItem).filter(Boolean);
      if (items.length === 0) return;
      state.competitions = items;
      if (typeof d.lastUpdated === "string") state.lastUpdated = d.lastUpdated.slice(0, 16);
      populateQnaContestSelect();
      renderAll();
    })
    .catch(() => {});
  populateQnaContestSelect();

  document.getElementById("cal-prev-btn").addEventListener("click", () => {
    state.calendarMonth = shiftMonth(state.calendarMonth, -1);
    state.selectedCalendarDate = null;
    renderCalendarView();
  });
  document.getElementById("cal-next-btn").addEventListener("click", () => {
    state.calendarMonth = shiftMonth(state.calendarMonth, 1);
    state.selectedCalendarDate = null;
    renderCalendarView();
  });
  document.getElementById("cal-today-label").addEventListener("click", () => {
    state.calendarMonth = TODAY_STR.slice(0, 7);
    state.selectedCalendarDate = TODAY_STR;
    renderCalendarView();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeDetailModal();
  });

  const bootcampBtn = document.getElementById("bootcamp-feed-btn");
  if (bootcampBtn) {
    bootcampBtn.addEventListener("click", () => {
      state.selectedOrg = "bootcamp";
      state.activeOnly = false;
      document.getElementById("active-only-checkbox").checked = false;
      renderAll();
      const feed = document.getElementById("contest-grid");
      if (feed) feed.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  document.querySelectorAll(".nav-tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const tab = btn.getAttribute("data-tab");
      if (tab) switchTab(tab);
    });
  });

  document.querySelectorAll(".sub-preset-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const preset = btn.getAttribute("data-subpreset") || "all";
      state.subPreset = preset;
      state.bookmarksOnly = false;
      if (preset === "all") {
        state.selectedType = "all";
        state.selectedOrg = "all";
        state.selectedCategory = "all";
        state.activeOnly = false;
        document.getElementById("active-only-checkbox").checked = false;
      } else if (preset === "contest") {
        state.selectedType = "contest";
        state.activeOnly = true;
        document.getElementById("active-only-checkbox").checked = true;
      } else if (preset === "event") {
        state.selectedType = "event";
        state.activeOnly = true;
        document.getElementById("active-only-checkbox").checked = true;
      } else if (preset === "campaign") {
        state.selectedType = "campaign";
        state.activeOnly = true;
        document.getElementById("active-only-checkbox").checked = true;
      } else {
        state.selectedType = "all";
        state.activeOnly = true;
        document.getElementById("active-only-checkbox").checked = true;
      }
      switchTab("explore");
    });
  });

  // Dedicated 3 Separate Type Tabs Event Listeners
  document.querySelectorAll(".type-tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const type = btn.getAttribute("data-type-btn") || "all";
      state.selectedType = type;
      if (["contest", "event", "campaign"].includes(type)) {
        state.subPreset = type;
      } else if (["contest", "event", "campaign"].includes(state.subPreset)) {
        state.subPreset = "all";
      }
      renderAll();
    });
  });

  const pillType = document.getElementById("pill-type-select");
  if (pillType) {
    pillType.addEventListener("change", (e) => {
      state.selectedType = e.target.value;
      if (["contest", "event", "campaign"].includes(state.selectedType)) {
        state.subPreset = state.selectedType;
      } else if (["contest", "event", "campaign"].includes(state.subPreset)) {
        state.subPreset = "all";
      }
      renderAll();
    });
  }

  const pillOrg = document.getElementById("pill-org-select");
  if (pillOrg) {
    pillOrg.addEventListener("change", (e) => {
      state.selectedOrg = e.target.value;
      renderAll();
    });
  }

  const pillCat = document.getElementById("pill-cat-select");
  if (pillCat) {
    pillCat.addEventListener("change", (e) => {
      state.selectedCategory = e.target.value;
      renderAll();
    });
  }

  document.getElementById("header-bookmark-btn").addEventListener("click", () => {
    state.bookmarksOnly = !state.bookmarksOnly;
    switchTab("explore");
    showToast(state.bookmarksOnly ? "저장한 관심 보관함만 표시합니다." : "전체 목록을 표시합니다.");
  });

  document.getElementById("hero-cal-btn").addEventListener("click", () => {
    switchTab("calendar");
  });

  const searchInput = document.getElementById("search-input");
  const clearBtn = document.getElementById("clear-search-btn");
  searchInput.addEventListener("input", () => {
    state.searchQuery = searchInput.value;
    if (state.searchQuery.trim().length > 0) clearBtn.classList.remove("hidden");
    else clearBtn.classList.add("hidden");
    renderContestGrid();
    if (window.lucide) window.lucide.createIcons();
  });

  clearBtn.addEventListener("click", () => {
    searchInput.value = "";
    state.searchQuery = "";
    clearBtn.classList.add("hidden");
    renderContestGrid();
    if (window.lucide) window.lucide.createIcons();
  });

  document.getElementById("sort-select").addEventListener("change", (e) => {
    state.sortBy = e.target.value;
    renderContestGrid();
    if (window.lucide) window.lucide.createIcons();
  });

  document.getElementById("active-only-checkbox").addEventListener("change", (e) => {
    state.activeOnly = e.target.checked;
    renderContestGrid();
    if (window.lucide) window.lucide.createIcons();
  });

  const resetFn = () => {
    state.selectedType = "all";
    state.selectedOrg = "all";
    state.selectedCategory = "all";
    state.searchQuery = "";
    state.subPreset = "search";
    state.activeOnly = false;
    state.bookmarksOnly = false;
    document.getElementById("search-input").value = "";
    document.getElementById("clear-search-btn").classList.add("hidden");
    document.getElementById("active-only-checkbox").checked = false;
    if (pillType) pillType.value = "all";
    if (pillOrg) pillOrg.value = "all";
    if (pillCat) pillCat.value = "all";
    renderAll();
    showToast("모든 검색 필터가 초기화되었습니다.");
  };
  document.getElementById("reset-filters-btn").addEventListener("click", resetFn);
  document.getElementById("empty-reset-btn").addEventListener("click", resetFn);

  document.getElementById("cal-show-all-btn").addEventListener("click", () => {
    state.selectedCalendarDate = null;
    renderCalendarView();
  });

  document.getElementById("close-modal-btn").addEventListener("click", closeDetailModal);
  document.getElementById("detail-modal").addEventListener("click", (e) => {
    if (e.target.id === "detail-modal") closeDetailModal();
  });
  document.getElementById("modal-bookmark-btn").addEventListener("click", () => {
    if (state.activeModalItemId) {
      toggleBookmark(state.activeModalItemId);
      const bmLabel = document.getElementById("modal-bookmark-label");
      bmLabel.textContent = state.bookmarks.has(state.activeModalItemId) ? "관심 공고 저장됨 ★" : "관심 공고 저장";
    }
  });

  renderAll();
});
