// ============================================================
// 다크모드 / 라이트모드 전환
// ============================================================

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("app_theme", theme);

  document.getElementById("theme-light-btn").classList.toggle("active", theme === "light");
  document.getElementById("theme-dark-btn").classList.toggle("active", theme === "dark");
}

document.addEventListener("DOMContentLoaded", () => {
  const saved = localStorage.getItem("app_theme") || "dark";
  applyTheme(saved); // 버튼 active 표시 동기화

  document.getElementById("theme-light-btn").addEventListener("click", () => applyTheme("light"));
  document.getElementById("theme-dark-btn").addEventListener("click", () => applyTheme("dark"));
});
