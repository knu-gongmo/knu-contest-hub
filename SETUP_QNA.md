# 경북대생 전용 Q&A · 팀원모집 게시판 설정 방법

게시판은 **Supabase**(무료 데이터베이스)에 글을 저장합니다.
`@knu.ac.kr` 메일로 받은 인증코드를 입력한 학생만 글을 보고 쓸 수 있습니다.
이 제한은 웹페이지가 아니라 데이터베이스 규칙(RLS)에서 걸려 있어서, API를 직접 호출해도 우회할 수 없습니다.

전체 소요 시간은 약 15분입니다. 설정 전에는 게시판 자리에 "게시판 준비 중입니다"가 표시됩니다.

---

## 1. Supabase 프로젝트 만들기
1. https://supabase.com 에 접속해 **Start your project** → GitHub 계정으로 가입합니다.
2. **New project**
   - Name: `knu-square` (아무거나)
   - Database Password: 자동 생성된 값을 그대로 두고 따로 보관 (사이트에는 쓰이지 않음)
   - Region: **Northeast Asia (Seoul)**
   - Plan: Free
3. 프로젝트가 만들어질 때까지 1~2분 기다립니다.

## 2. 데이터베이스 만들기
1. 왼쪽 메뉴 **SQL Editor** → **New query**
2. 이 저장소의 `supabase/schema.sql` 내용을 **전부 복사해 붙여넣고 Run**
3. "Success. No rows returned"가 나오면 완료입니다.

## 3. 메일 발송 설정 (중요)
Supabase 기본 메일 발송기는 **프로젝트 관리자 본인 주소로만, 시간당 몇 통만** 보냅니다.
학생들에게 인증코드를 보내려면 반드시 SMTP를 연결해야 합니다. Gmail로 하는 방법:

1. 사용할 Google 계정에서 **2단계 인증**을 켭니다.
2. https://myaccount.google.com/apppasswords 에서 **앱 비밀번호**를 만듭니다 (16자리).
3. Supabase → **Authentication → Emails → SMTP Settings** → Enable Custom SMTP
   - Sender email: 그 Gmail 주소
   - Sender name: `KNU 스퀘어`
   - Host: `smtp.gmail.com` / Port: `465`
   - Username: 그 Gmail 주소 / Password: 위에서 만든 앱 비밀번호
4. **Authentication → Rate Limits**에서 "emails sent per hour"를 `30` 정도로 올립니다.

> Gmail은 하루 약 500통까지 보낼 수 있어 학내 게시판 용도로 충분합니다.
> 앱 비밀번호는 이 SMTP 설정 칸에만 넣고, 절대로 GitHub 파일에 넣지 마세요.

## 4. 인증 메일에 "코드"가 나오게 바꾸기
기본 메일은 링크만 보내므로, 숫자 코드가 보이도록 템플릿 두 개를 바꿉니다.
**Authentication → Emails → Templates**

- **Confirm signup** (처음 로그인하는 학생에게 발송)
- **Magic Link** (두 번째 로그인부터 발송)

두 템플릿 모두 Subject와 Body를 아래처럼 바꾸고 저장합니다.

Subject:
```
[KNU 스퀘어] 로그인 인증코드
```
Body:
```html
<h2>KNU 스퀘어 로그인 인증코드</h2>
<p>아래 코드를 사이트에 입력하세요. (1시간 동안 유효)</p>
<p style="font-size:28px;font-weight:bold;letter-spacing:6px">{{ .Token }}</p>
<p>본인이 요청하지 않았다면 이 메일을 무시하세요.</p>
```

## 5. 로그인 방식 정리
**Authentication → Sign In / Providers**
- **Email**: 켜짐, "Confirm email" 켜짐
- 그 외 Google·GitHub 등 다른 로그인 방식: 모두 꺼짐

**Authentication → URL Configuration**
- Site URL: GitHub Pages 주소 (예: `https://아이디.github.io/저장소이름/`)

## 6. 사이트에 연결하기
1. Supabase → **Project Settings → API** (또는 **API Keys**)
2. 두 값을 복사합니다.
   - **Project URL** (예: `https://abcdefghijkl.supabase.co`)
   - **anon / public** 키 (`eyJ...`로 시작하는 긴 문자열 또는 `sb_publishable_...`)
3. `assets/config.js` 파일에 붙여넣습니다. `contactEmail`에는 **개인정보 문의·신고를 받을 운영자 메일**을 넣습니다.
   이 메일은 사이트에 공개되므로 개인 메일 대신 운영용 Gmail을 따로 만드는 것을 추천합니다.
   ```js
   window.KNU_SQUARE_CONFIG = {
     supabaseUrl: "https://abcdefghijkl.supabase.co",
     supabaseAnonKey: "eyJhbGciOi...",
     contactEmail: "knusquare.help@gmail.com"
   };
   ```
   연락처를 넣으면 개인정보 처리방침(`privacy.html`)에 표시되고, 게시판의 각 글에 **신고** 버튼이 생깁니다.
4. GitHub에 업로드합니다.

> 개인정보 처리방침(`privacy.html`)에는 위탁 업체로 Supabase(서울 리전)와 Google(Gmail 발송)이 적혀 있습니다.
> 다른 리전이나 다른 메일 발송 서비스를 쓰면 그 표의 내용도 맞게 고쳐주세요.

> ⚠️ **service_role / secret 키는 절대 넣지 마세요.** 모든 보안을 우회하는 관리자 키입니다.
> 실수로 넣으면 사이트가 연결을 거부하도록 막아 두었지만, 그 경우 Supabase에서 키를 즉시 재발급하세요.
> anon 키는 원래 공개용이라 GitHub에 올라가도 안전합니다.

## 7. 테스트
1. 사이트 → **Q&A 게시판** 탭 → 본인 경북대 메일 아이디 입력 → **인증코드 받기**
2. 메일로 받은 숫자 코드 입력 → "경북대 인증 완료"가 뜨면 성공
3. 글쓰기 → 다른 기기나 브라우저에서 로그인해 같은 글이 보이는지 확인

## 운영 팁
- **부적절한 글 삭제**: Supabase → Table Editor → `qna_posts`에서 해당 행을 삭제하면 댓글까지 함께 지워집니다.
- **탈퇴(개인정보 삭제)**: 학생이 게시판의 **탈퇴** 버튼을 누르면 `qna_delete_my_account` 함수가 메일 주소와 글·댓글·공감을 즉시 지웁니다.
  `schema.sql`을 예전에 실행했다면, 최신 `schema.sql`을 한 번 더 Run 해야 이 함수가 생깁니다 (여러 번 실행해도 안전).
- **특정 사용자 차단**: Authentication → Users에서 해당 사용자를 Ban 또는 Delete합니다.
- **도배 방지**: 1인당 하루 글 10개, 댓글 60개로 제한되어 있습니다 (`schema.sql`의 `qna_rate_limit`).
- **무료 플랜 일시정지**: Supabase 무료 프로젝트는 7일간 요청이 없으면 일시정지됩니다.
  매일 도는 GitHub Actions 크롤러가 하루 한 번 게시판 통계를 조회해서 자동으로 깨워 둡니다.
