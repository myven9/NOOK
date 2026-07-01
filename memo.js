// ============================================================
// 메모장 기능
// 투두/일기와 마찬가지로 지금은 localStorage 사용.
// 나중에 Supabase 연동 시 loadMemos / saveMemoToDB / deleteMemoFromDB
// 함수만 교체하면 됨.
// ============================================================

const MEMO_FONT_SIZES = {
  small: "13px",
  normal: "16px",
  large: "22px",
};

let memos = []; // [{id, content(html), updatedAt}]
let currentMemoId = null; // null이면 새 메모
let memoInited = false;

// ----- 저장/불러오기 (Supabase) -----
async function loadMemos() {
  const { data, error } = await supabaseClient
    .from("memos")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) { console.error("메모 불러오기 실패:", error.message); memos = []; return; }
  memos = data.map(row => ({
    id: row.id,
    title: row.title || "",
    content: row.content || "",
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
  }));
}

async function addMemoToDB(title, content) {
  const { data, error } = await supabaseClient
    .from("memos")
    .insert({ title, content })
    .select()
    .single();
  if (error) { console.error("메모 추가 실패:", error.message); return null; }
  return data;
}

async function updateMemoInDB(id, title, content) {
  const { data, error } = await supabaseClient
    .from("memos")
    .update({ title, content, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) { console.error("메모 수정 실패:", error.message); return null; }
  return data;
}

async function deleteMemoFromDB(id) {
  const { error } = await supabaseClient.from("memos").delete().eq("id", id);
  if (error) console.error("메모 삭제 실패:", error.message);
}

// ----- 초기화 -----
async function initMemoApp() {
  await loadMemos();
  showMemoList();

  if (memoInited) return;
  memoInited = true;

  document.getElementById("memo-new-btn").addEventListener("click", () => openMemoEditor(null));
  document.getElementById("memo-back-btn").addEventListener("click", async () => {
    await saveCurrentMemoIfNeeded();
    showMemoList();
  });
  document.getElementById("memo-delete-btn").addEventListener("click", deleteCurrentMemo);

  document.querySelectorAll(".size-btn").forEach(btn => {
    // mousedown에서 preventDefault를 해야 선택 영역(selection)이 풀리지 않음
    btn.addEventListener("mousedown", (e) => e.preventDefault());
    btn.addEventListener("click", () => applyFontSize(MEMO_FONT_SIZES[btn.dataset.size]));
  });
}

// ----- 목록 화면 -----
function showMemoList() {
  document.getElementById("memo-editor-screen").classList.add("hidden");
  document.getElementById("memo-list-screen").classList.remove("hidden");
  renderMemoList();
}

function renderMemoList() {
  const wrap = document.getElementById("memo-list");
  wrap.innerHTML = "";

  if (memos.length === 0) {
    const p = document.createElement("p");
    p.className = "placeholder";
    p.textContent = "아직 작성한 메모가 없어요.";
    wrap.appendChild(p);
    return;
  }

  // 최근 수정 순
  const sorted = [...memos].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

  sorted.forEach(memo => {
    const card = document.createElement("div");
    card.className = "memo-card";

    const plain = memo.content.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

    if (memo.title) {
      const titleEl = document.createElement("p");
      titleEl.className = "memo-card-title";
      titleEl.textContent = memo.title;
      card.appendChild(titleEl);
    }

    const preview = document.createElement("p");
    preview.className = "memo-card-preview";
    preview.textContent = plain || (memo.title ? "" : "(빈 메모)");
    if (preview.textContent) card.appendChild(preview);

    const dateLabel = document.createElement("span");
    dateLabel.className = "memo-card-date";
    dateLabel.textContent = memo.updatedAt ? new Date(memo.updatedAt).toLocaleDateString("ko-KR") : "";

    card.appendChild(dateLabel);
    card.addEventListener("click", () => openMemoEditor(memo.id));

    wrap.appendChild(card);
  });
}

// ----- 에디터 화면 -----
function openMemoEditor(memoId) {
  currentMemoId = memoId;
  const titleEl = document.getElementById("memo-title-input");
  const contentEl = document.getElementById("memo-content");
  const deleteBtn = document.getElementById("memo-delete-btn");

  if (memoId) {
    const memo = memos.find(m => m.id === memoId);
    titleEl.value = memo ? memo.title : "";
    contentEl.innerHTML = memo ? memo.content : "";
    deleteBtn.classList.remove("hidden");
  } else {
    titleEl.value = "";
    contentEl.innerHTML = "";
    deleteBtn.classList.add("hidden");
  }

  document.getElementById("memo-list-screen").classList.add("hidden");
  document.getElementById("memo-editor-screen").classList.remove("hidden");
  titleEl.focus();
}

async function saveCurrentMemoIfNeeded() {
  const titleEl = document.getElementById("memo-title-input");
  const contentEl = document.getElementById("memo-content");
  const title = titleEl.value.trim();
  const html = contentEl.innerHTML.trim();
  const plain = contentEl.textContent.trim();
  const isEmpty = !title && !plain;

  if (currentMemoId) {
    if (isEmpty) {
      // 제목/내용을 다 지웠으면 메모 자체 삭제
      memos = memos.filter(m => m.id !== currentMemoId);
      await deleteMemoFromDB(currentMemoId);
    } else {
      const row = await updateMemoInDB(currentMemoId, title, html);
      if (row) {
        const memo = memos.find(m => m.id === currentMemoId);
        if (memo) {
          memo.title = row.title || "";
          memo.content = row.content;
          memo.updatedAt = new Date(row.updated_at).getTime();
        }
      }
    }
  } else {
    if (isEmpty) { currentMemoId = null; return; } // 새 메모인데 아무것도 안 썼으면 저장 안 함
    const row = await addMemoToDB(title, html);
    if (row) {
      memos.push({
        id: row.id,
        title: row.title || "",
        content: row.content,
        updatedAt: new Date(row.updated_at).getTime(),
      });
    }
  }

  currentMemoId = null;
}

async function deleteCurrentMemo() {
  if (!currentMemoId) return;
  if (!confirm("이 메모를 삭제하시겠습니까?")) return;
  const idToDelete = currentMemoId;
  memos = memos.filter(m => m.id !== idToDelete);
  currentMemoId = null;
  showMemoList();
  await deleteMemoFromDB(idToDelete);
}

// ----- 글씨 크기 적용 (선택한 영역만) -----
function applyFontSize(px) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;

  // execCommand의 fontSize(1~7) 트릭을 이용해 <font size="7">로 감싼 뒤
  // 그 태그를 원하는 px 값의 span으로 치환
  document.execCommand("styleWithCSS", false, false);
  document.execCommand("fontSize", false, "7");

  const contentEl = document.getElementById("memo-content");
  contentEl.querySelectorAll('font[size="7"]').forEach(el => {
    const span = document.createElement("span");
    span.style.fontSize = px;
    span.innerHTML = el.innerHTML;
    el.replaceWith(span);
  });
}
