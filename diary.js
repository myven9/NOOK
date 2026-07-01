// ============================================================
// 일기 기능
// 투두와 마찬가지로 지금은 localStorage 사용.
// 나중에 Supabase 연동 시 loadDiaryEntries / upsertDiaryEntry /
// deleteDiaryEntry 함수만 교체하면 됨.
// ============================================================

// 캘린더/에디터에 쓰는 아이콘 목록.
// img: /icons/diary/ 폴더에 직접 그린 아이콘 이미지(png 또는 svg)를 넣어주세요.
// 파일명이 id와 같아야 합니다 (예: happy.png). 이미지가 아직 없으면
// 자동으로 emoji가 대신 표시됩니다.
const DIARY_ICON_OPTIONS = [
  { id: "happy",   label: "행복", emoji: "😊", category: "mood" },
  { id: "sad",      label: "슬픔", emoji: "😢", category: "mood" },
  { id: "angry",    label: "화남", emoji: "😡", category: "mood" },
  { id: "sleepy",   label: "졸림", emoji: "😴", category: "mood" },
  { id: "love",     label: "설렘", emoji: "😍", category: "mood" },
  { id: "crying",   label: "눈물", emoji: "😭", category: "mood" },
  { id: "laugh",    label: "웃김", emoji: "😆", category: "mood" },
  { id: "neutral",  label: "그냥그럼", emoji: "😐", category: "mood" },
  { id: "anxious",  label: "불안", emoji: "😰", category: "mood" },
  { id: "party",    label: "신남", emoji: "🥳", category: "mood" },
  { id: "movie",    label: "영화", emoji: "🍿", category: "daily" },
  { id: "coffee",   label: "커피", emoji: "☕", category: "daily" },
  { id: "music",    label: "음악", emoji: "🎵", category: "daily" },
  { id: "book",     label: "독서", emoji: "📚", category: "daily" },
  { id: "exercise", label: "운동", emoji: "🏃", category: "daily" },
  { id: "food",     label: "음식", emoji: "🍔", category: "daily" },
  { id: "work",     label: "일", emoji: "💼", category: "daily" },
  { id: "rain",     label: "비", emoji: "🌧️", category: "daily" },
  { id: "sun",      label: "맑음", emoji: "☀️", category: "daily" },
  { id: "night",    label: "밤", emoji: "💤", category: "daily" },
];

let diaryIconTab = "mood"; // 현재 보고 있는 아이콘 탭 ("mood" | "daily")

function diaryIconById(id) {
  return DIARY_ICON_OPTIONS.find(o => o.id === id) || null;
}

// 아이콘 이미지(또는 이미지가 없을 때 이모지 대체) 엘리먼트를 만들어준다.
function buildDiaryIconEl(id, size) {
  const opt = diaryIconById(id);
  if (!opt) return document.createTextNode("");

  const fill = size === "fill";
  const img = document.createElement("img");
  img.src = `icons/diary/${opt.id}.png`;
  img.alt = opt.label;
  img.className = "diary-icon-img";
  if (fill) {
    img.style.width = "100%";
    img.style.height = "100%";
  } else {
    img.style.width = size + "px";
    img.style.height = size + "px";
  }
  img.addEventListener("error", () => {
    // 이미지 파일이 없으면 이모지로 대체 표시
    const span = document.createElement("span");
    span.textContent = opt.emoji;
    span.style.fontSize = fill ? "70%" : Math.round(size * 0.75) + "px";
    span.className = "diary-icon-fallback" + (fill ? " fill" : "");
    img.replaceWith(span);
  }, { once: true });
  return img;
}

let diaryEntries = []; // [{id, date, emojis:[...], rating, text}]
let diaryCalYear, diaryCalMonth;
let diarySelectedDate;
let diarySelectedEmojis = [];
let diarySelectedRating = 0;
let diaryEditMode = false; // true면 편집 화면, false면 보기 화면

// ----- 저장/불러오기 (Supabase) -----
async function loadDiaryEntries() {
  const { data, error } = await supabaseClient
    .from("diary_entries")
    .select("*")
    .order("date", { ascending: true });
  if (error) { console.error("일기 불러오기 실패:", error.message); diaryEntries = []; return; }
  diaryEntries = data.map(row => ({
    id: row.id,
    date: row.date,
    emojis: row.emojis || [],
    rating: Number(row.rating) || 0,
    text: row.text || "",
  }));
}

// 있으면 수정, 없으면 새로 추가 (date에 unique 제약이 있어서 upsert 사용)
async function upsertDiaryEntryToDB(date, emojis, rating, text) {
  const { data, error } = await supabaseClient
    .from("diary_entries")
    .upsert({ date, emojis, rating, text }, { onConflict: "date" })
    .select()
    .single();
  if (error) { console.error("일기 저장 실패:", error.message); return null; }
  return data;
}

async function deleteDiaryEntryFromDB(date) {
  const { error } = await supabaseClient.from("diary_entries").delete().eq("date", date);
  if (error) console.error("일기 삭제 실패:", error.message);
}

function getEntryByDate(dateStr) {
  return diaryEntries.find(e => e.date === dateStr) || null;
}

// ----- 초기화 -----
let diaryInited = false;

async function initDiaryApp() {
  await loadDiaryEntries();

  const today = new Date();
  diaryCalYear = today.getFullYear();
  diaryCalMonth = today.getMonth();
  diarySelectedDate = todayStr();

  renderDiaryEmojiPicker();
  renderDiaryCalendar();
  loadEntryIntoEditor(diarySelectedDate);
  renderDiaryGraph();

  if (diaryInited) return;
  diaryInited = true;

  document.getElementById("diary-cal-prev").addEventListener("click", () => {
    diaryCalMonth--;
    if (diaryCalMonth < 0) { diaryCalMonth = 11; diaryCalYear--; }
    renderDiaryCalendar();
    renderDiaryGraph();
  });
  document.getElementById("diary-cal-next").addEventListener("click", () => {
    diaryCalMonth++;
    if (diaryCalMonth > 11) { diaryCalMonth = 0; diaryCalYear++; }
    renderDiaryCalendar();
    renderDiaryGraph();
  });

  document.getElementById("diary-save-btn").addEventListener("click", saveDiaryEntry);
  document.getElementById("diary-delete-btn").addEventListener("click", deleteDiaryEntry);
  document.getElementById("diary-edit-btn").addEventListener("click", () => {
    diaryEditMode = true;
    updateDiaryEditorMode();
  });
  document.getElementById("diary-cancel-btn").addEventListener("click", () => {
    loadEntryIntoEditor(diarySelectedDate); // 편집 취소 -> 저장된 내용으로 되돌리고 보기 모드로
  });

  document.querySelectorAll(".diary-icon-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      diaryIconTab = tab.dataset.cat;
      document.querySelectorAll(".diary-icon-tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      renderDiaryEmojiPicker();
    });
  });
}

// ----- 캘린더 -----
function renderDiaryCalendar() {
  const label = document.getElementById("diary-cal-month-label");
  label.innerHTML = "";

  const yearBtn = document.createElement("button");
  yearBtn.className = "ym-label-btn";
  yearBtn.textContent = `${diaryCalYear}년`;
  yearBtn.addEventListener("click", () => {
    openYearPicker(diaryCalYear, (y) => {
      diaryCalYear = y;
      renderDiaryCalendar();
      renderDiaryGraph();
    });
  });

  const monthBtn = document.createElement("button");
  monthBtn.className = "ym-label-btn";
  monthBtn.textContent = `${diaryCalMonth + 1}월`;
  monthBtn.addEventListener("click", () => {
    openMonthPicker(diaryCalMonth, (m) => {
      diaryCalMonth = m;
      renderDiaryCalendar();
      renderDiaryGraph();
    });
  });

  label.appendChild(yearBtn);
  label.appendChild(monthBtn);

  const grid = document.getElementById("diary-cal-grid");
  grid.innerHTML = "";

  const firstDay = new Date(diaryCalYear, diaryCalMonth, 1).getDay();
  const daysInMonth = new Date(diaryCalYear, diaryCalMonth + 1, 0).getDate();
  const today = todayStr();

  for (let i = 0; i < firstDay; i++) {
    const empty = document.createElement("div");
    empty.className = "cal-cell empty";
    grid.appendChild(empty);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = toDateStr(diaryCalYear, diaryCalMonth, d);
    const cell = document.createElement("div");
    cell.className = "cal-cell";
    if (dateStr === today) cell.classList.add("today");
    if (dateStr === diarySelectedDate) cell.classList.add("selected");

    const entry = getEntryByDate(dateStr);
    const hasIcon = entry && entry.emojis && entry.emojis.length > 0;
    if (hasIcon) cell.classList.add("has-icon");

    if (hasIcon) {
      // 아이콘이 셀 전체를 채우는 배경처럼 보이도록 함
      const iconWrap = document.createElement("span");
      iconWrap.className = "diary-cal-icon-fill";
      iconWrap.appendChild(buildDiaryIconEl(entry.emojis[0], "fill"));
      cell.appendChild(iconWrap);
    }

    const num = document.createElement("span");
    num.textContent = d;
    num.className = "cal-num" + (hasIcon ? " on-icon" : "");
    cell.appendChild(num);

    cell.addEventListener("click", () => {
      diarySelectedDate = dateStr;
      renderDiaryCalendar();
      loadEntryIntoEditor(dateStr);
    });

    grid.appendChild(cell);
  }
}

// ----- 에디터 -----
function loadEntryIntoEditor(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const weekday = ["일", "월", "화", "수", "목", "금", "토"][new Date(y, m - 1, d).getDay()];
  document.getElementById("diary-selected-date-label").textContent = `${y}년 ${m}월 ${d}일 (${weekday})`;

  const entry = getEntryByDate(dateStr);
  diarySelectedEmojis = entry ? [...entry.emojis] : [];
  diarySelectedRating = entry ? entry.rating : 0;
  document.getElementById("diary-text").value = entry ? entry.text : "";

  // 저장된 일기가 있으면 보기 모드로, 없으면 바로 작성할 수 있게 편집 모드로 시작
  diaryEditMode = !entry;

  renderDiaryViewBlock(entry);
  renderDiaryEmojiPicker();
  renderStarRating();
  updateDiaryEditorMode();
}

// 보기 모드 화면(아이콘/기분점수/본문)을 채워준다
function renderDiaryViewBlock(entry) {
  const iconWrap = document.getElementById("diary-view-icons");
  iconWrap.innerHTML = "";
  if (entry && entry.emojis && entry.emojis.length > 0) {
    entry.emojis.forEach(id => {
      const el = buildDiaryIconEl(id, 30);
      const box = document.createElement("span");
      box.className = "diary-view-icon";
      box.appendChild(el);
      iconWrap.appendChild(box);
    });
  }

  renderReadonlyStars(entry ? entry.rating : 0);

  const textEl = document.getElementById("diary-view-text");
  textEl.textContent = entry && entry.text ? entry.text : "";
  textEl.classList.toggle("empty", !(entry && entry.text));
}

// 보기 모드용 읽기 전용 별점 (클릭 불가)
function renderReadonlyStars(rating) {
  const wrap = document.getElementById("diary-view-rating");
  wrap.innerHTML = "";
  for (let i = 0; i < 5; i++) {
    const slot = document.createElement("span");
    slot.className = "star-slot";

    const bg = document.createElement("span");
    bg.className = "star-bg";
    bg.textContent = "★";

    const fill = document.createElement("span");
    fill.className = "star-fill";
    fill.textContent = "★";

    const starValue = rating - i;
    const pct = Math.max(0, Math.min(1, starValue)) * 100;
    fill.style.width = pct + "%";

    slot.appendChild(bg);
    slot.appendChild(fill);
    wrap.appendChild(slot);
  }
}

// 보기 모드 / 편집 모드 화면 전환
function updateDiaryEditorMode() {
  const hasEntry = !!getEntryByDate(diarySelectedDate);
  document.getElementById("diary-view-block").classList.toggle("hidden", diaryEditMode || !hasEntry);
  document.getElementById("diary-edit-block").classList.toggle("hidden", !diaryEditMode);
  // 저장된 일기가 있을 때만 "취소"로 되돌아갈 보기 화면이 있음
  document.getElementById("diary-cancel-btn").classList.toggle("hidden", !hasEntry);
}

function renderDiaryEmojiPicker() {
  const wrap = document.getElementById("diary-emoji-picker");
  wrap.innerHTML = "";
  DIARY_ICON_OPTIONS
    .filter(opt => opt.category === diaryIconTab)
    .forEach(opt => {
    const btn = document.createElement("button");
    btn.className = "emoji-option" + (diarySelectedEmojis.includes(opt.id) ? " selected" : "");
    btn.title = opt.label;
    btn.appendChild(buildDiaryIconEl(opt.id, 22));

    // 대표 아이콘(첫 번째로 선택한 아이콘) 표시용 순번 뱃지
    const order = diarySelectedEmojis.indexOf(opt.id);
    if (order === 0) {
      const badge = document.createElement("span");
      badge.className = "emoji-rep-badge";
      badge.textContent = "대표";
      btn.appendChild(badge);
    }

    btn.addEventListener("click", () => {
      if (diarySelectedEmojis.includes(opt.id)) {
        diarySelectedEmojis = diarySelectedEmojis.filter(e => e !== opt.id);
      } else {
        diarySelectedEmojis.push(opt.id); // 선택한 순서 그대로 저장 -> 첫 항목이 대표 아이콘
      }
      renderDiaryEmojiPicker();
    });
    wrap.appendChild(btn);
  });
}

function renderStarRating() {
  const wrap = document.getElementById("diary-star-rating");
  wrap.innerHTML = "";

  for (let i = 0; i < 5; i++) {
    const slot = document.createElement("span");
    slot.className = "star-slot";

    const bg = document.createElement("span");
    bg.className = "star-bg";
    bg.textContent = "★";

    const fill = document.createElement("span");
    fill.className = "star-fill";
    fill.textContent = "★";

    const starValue = diarySelectedRating - i; // 이 별이 채워진 비율 (0~1)
    const pct = Math.max(0, Math.min(1, starValue)) * 100;
    fill.style.width = pct + "%";

    slot.appendChild(bg);
    slot.appendChild(fill);

    slot.addEventListener("click", (e) => {
      const rect = slot.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const isLeftHalf = clickX < rect.width / 2;
      diarySelectedRating = i + (isLeftHalf ? 0.5 : 1);
      renderStarRating();
    });

    wrap.appendChild(slot);
  }
}

// ----- 저장/삭제 -----
async function saveDiaryEntry() {
  const text = document.getElementById("diary-text").value.trim();

  const row = await upsertDiaryEntryToDB(diarySelectedDate, diarySelectedEmojis, diarySelectedRating, text);
  if (!row) return;

  const entryData = {
    id: row.id,
    date: row.date,
    emojis: row.emojis || [],
    rating: Number(row.rating) || 0,
    text: row.text || "",
  };

  const existing = getEntryByDate(diarySelectedDate);
  if (existing) {
    Object.assign(existing, entryData);
  } else {
    diaryEntries.push(entryData);
  }

  renderDiaryCalendar();
  loadEntryIntoEditor(diarySelectedDate);
  renderDiaryGraph();
}

async function deleteDiaryEntry() {
  if (!confirm("이 날짜의 일기를 삭제하시겠습니까?")) return;
  diaryEntries = diaryEntries.filter(e => e.date !== diarySelectedDate);
  renderDiaryCalendar();
  loadEntryIntoEditor(diarySelectedDate);
  renderDiaryGraph();
  await deleteDiaryEntryFromDB(diarySelectedDate);
}

// ----- 월간 기분 그래프 (간단한 SVG 꺾은선) -----
function renderDiaryGraph() {
  const container = document.getElementById("diary-graph");
  const daysInMonth = new Date(diaryCalYear, diaryCalMonth + 1, 0).getDate();

  const points = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = toDateStr(diaryCalYear, diaryCalMonth, d);
    const entry = getEntryByDate(dateStr);
    if (entry) points.push({ day: d, rating: entry.rating });
  }

  if (points.length === 0) {
    container.innerHTML = '<p class="placeholder">이번 달 기록이 아직 없어요.</p>';
    return;
  }

  const width = 600;
  const height = 190;
  const padX = 20;
  const padY = 16;
  const labelY = height - 4; // 날짜 숫자가 그려질 y 위치
  const chartHeight = height - padY - 28; // 그래프 영역(아래쪽에 날짜 숫자 공간 확보)
  const xStep = (width - padX * 2) / (daysInMonth - 1 || 1);
  const yFor = (rating) => padY + chartHeight - (rating / 5) * chartHeight;

  const lineCoords = points.map(p => `${padX + (p.day - 1) * xStep},${yFor(p.rating)}`).join(" ");

  const dots = points.map(p =>
    `<circle cx="${padX + (p.day - 1) * xStep}" cy="${yFor(p.rating)}" r="3.5" fill="var(--accent)" />`
  ).join("");

  // 날짜 숫자는 너무 빽빽해지지 않도록 간격을 두고 표시 (월 길이에 따라 자동 조절)
  const labelStep = daysInMonth > 20 ? 2 : 1;
  const dayLabels = [];
  for (let d = 1; d <= daysInMonth; d += labelStep) {
    dayLabels.push(
      `<text x="${padX + (d - 1) * xStep}" y="${labelY}" text-anchor="middle" font-size="9" fill="var(--text-dim)">${d}</text>`
    );
  }
  if (dayLabels.length && (daysInMonth - 1) % labelStep !== 0) {
    dayLabels.push(
      `<text x="${padX + (daysInMonth - 1) * xStep}" y="${labelY}" text-anchor="middle" font-size="9" fill="var(--text-dim)">${daysInMonth}</text>`
    );
  }

  container.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" style="width:100%; height:auto;">
      <polyline points="${lineCoords}" fill="none" stroke="var(--accent)" stroke-width="2" />
      ${dots}
      ${dayLabels.join("")}
    </svg>
  `;
}
