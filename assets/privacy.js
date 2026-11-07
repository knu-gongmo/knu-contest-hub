"use strict";
// config.js의 운영자 연락처를 처리방침 페이지에 채워 넣습니다.
(function () {
  const cfg = window.KNU_SQUARE_CONFIG || {};
  const mail = String(cfg.contactEmail || "");
  if (!/^[^\s@<>"']+@[^\s@<>"']+\.[a-z]{2,}$/i.test(mail)) return;
  document.querySelectorAll("[data-contact]").forEach(function (el) {
    const a = document.createElement("a");
    a.href = "mailto:" + mail;
    a.textContent = mail;
    el.textContent = "";
    el.appendChild(a);
  });
})();
