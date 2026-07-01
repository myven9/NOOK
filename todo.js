// ============================================================
// 투두리스트 기능
// 지금은 localStorage에 저장. 나중에 Supabase 연동 시
// loadCategories/saveCategories, loadTodos/saveTodos 함수만
// Supabase 호출로 교체하면 됨.
// ============================================================

const CATEGORY_COLORS = [
  "#8a8f98", // 그레이
  "#e3a6c1", // 핑크
  "#9bd1b0", // 그린
  "#8fb3e0", // 블루
  "#c9a6e3", // 퍼플
  "#e3c08a", // 옐로/베이지
  "#e08a8a", // 레드
];

let categories = [];
let todos = [];
let calYear, calMonth; // 0-indexed month
let selectedDate; // "YYYY-MM-DD"
let editingCategoryId = null; // null이면 새로 추가 중
let pickedColor = CATEGORY_COLORS[0];

// ----- 저장/불러오기 (Supabase) -----
async function loadCategories() {
  const { data, error } = await supabaseClient
    .from("categories")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) { console.error("카테고리 불러오기 실패:", error.message); categories = []; return; }
  categories = data.map(row => ({ id: row.id, name: row.name, color: row.color, sortOrder: row.sort_order ?? 0 }));
}

async function loadTodos() {
  const { data, error } = await supabaseClient
    .from("todos")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) { console.error("할일 불러오기 실패:", error.message); todos = []; return; }
  todos = data.map(row => ({
    id: row.id,
    categoryId: row.category_id,
    date: row.date,
    text: row.text,
    done: row.done,
    sortOrder: row.sort_order ?? 0,
  }));
}

async function addCategoryToDB(name, color, sortOrder) {
  const { data, error } = await supabaseClient
    .from("categories")
    .insert({ name, color, sort_order: sortOrder })
    .select()
    .single();
  if (error) { console.error("카테고리 추가 실패:", error.message); return null; }
  return data;
}

async function updateCategoryInDB(id, name, color) {
  const { error } = await supabaseClient
    .from("categories")
    .update({ name, color })
    .eq("id", id);
  if (error) console.error("카테고리 수정 실패:", error.message);
}

async function updateCategoryOrderInDB(id, sortOrder) {
  const { error } = await supabaseClient.from("categories").update({ sort_order: sortOrder }).eq("id", id);
  if (error) console.error("카테고리 순서 변경 실패:", error.message);
}

async function deleteCategoryFromDB(id) {
  const { error } = await supabaseClient.from("categories").delete().eq("id", id);
  if (error) console.error("카테고리 삭제 실패:", error.message);
}

async function addTodoToDB(categoryId, date, text, sortOrder) {
  const { data, error } = await supabaseClient
    .from("todos")
    .insert({ category_id: categoryId, date, text, done: false, sort_order: sortOrder })
    .select()
    .single();
  if (error) { console.error("할일 추가 실패:", error.message); return null; }
  return data;
}

async function updateTodoDoneInDB(id, done) {
  const { error } = await supabaseClient.from("todos").update({ done }).eq("id", id);
  if (error) console.error("할일 수정 실패:", error.message);
}

async function updateTodoOrderInDB(id, sortOrder) {
  const { error } = await supabaseClient.from("todos").update({ sort_order: sortOrder }).eq("id", id);
  if (error) console.error("할일 순서 변경 실패:", error.message);
}

async function updateTodoDateAndOrderInDB(id, date, sortOrder) {
  const { error } = await supabaseClient.from("todos").update({ date, sort_order: sortOrder }).eq("id", id);
  if (error) console.error("할일 날짜 변경 실패:", error.message);
}

async function deleteTodoFromDB(id) {
  const { error } = await supabaseClient.from("todos").delete().eq("id", id);
  if (error) console.error("할일 삭제 실패:", error.message);
}

// ----- 날짜 유틸 -----
function pad2(n) { return String(n).padStart(2, "0"); }
function toDateStr(y, m, d) { return `${y}-${pad2(m + 1)}-${pad2(d)}`; }
function todayStr() {
  const t = new Date();
  return toDateStr(t.getFullYear(), t.getMonth(), t.getDate());
}
function nextDateStr(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + 1);
  return toDateStr(dt.getFullYear(), dt.getMonth(), dt.getDate());
}

// ----- 초기화 -----
let todoListenersBound = false;

async function initTodoApp() {
  const today = new Date();
  calYear = today.getFullYear();
  calMonth = today.getMonth();
  selectedDate = todayStr();

  renderColorPicker();
  renderCategoryList(); // 로딩 중 빈 화면 깜빡임 방지용 1차 렌더

  await loadCategories();
  await loadTodos();

  renderCalendar();
  renderCategoryList();

  if (todoListenersBound) return; // 중복 등록 방지
  todoListenersBound = true;

  document.getElementById("cal-prev").addEventListener("click", () => {
    calMonth--;
    if (calMonth < 0) { calMonth = 11; calYear--; }
    renderCalendar();
  });
  document.getElementById("cal-next").addEventListener("click", () => {
    calMonth++;
    if (calMonth > 11) { calMonth = 0; calYear++; }
    renderCalendar();
  });

  document.getElementById("add-category-btn").addEventListener("click", () => openCategoryModal(null));
  document.getElementById("category-cancel-btn").addEventListener("click", closeCategoryModal);
  document.getElementById("category-save-btn").addEventListener("click", saveCategoryFromModal);
  document.getElementById("category-delete-btn").addEventListener("click", deleteCategoryFromModal);
}

// ----- 미니 캘린더 렌더링 -----
function renderCalendar() {
  const label = document.getElementById("cal-month-label");
  label.innerHTML = "";

  const yearBtn = document.createElement("button");
  yearBtn.className = "ym-label-btn";
  yearBtn.textContent = `${calYear}년`;
  yearBtn.addEventListener("click", () => {
    openYearPicker(calYear, (y) => { calYear = y; renderCalendar(); });
  });

  const monthBtn = document.createElement("button");
  monthBtn.className = "ym-label-btn";
  monthBtn.textContent = `${calMonth + 1}월`;
  monthBtn.addEventListener("click", () => {
    openMonthPicker(calMonth, (m) => { calMonth = m; renderCalendar(); });
  });

  label.appendChild(yearBtn);
  label.appendChild(monthBtn);

  const grid = document.getElementById("mini-cal-grid");
  grid.innerHTML = "";

  const firstDay = new Date(calYear, calMonth, 1).getDay(); // 0=일
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const today = todayStr();

  for (let i = 0; i < firstDay; i++) {
    const empty = document.createElement("div");
    empty.className = "cal-cell empty";
    grid.appendChild(empty);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = toDateStr(calYear, calMonth, d);
    const cell = document.createElement("div");
    cell.className = "cal-cell";
    if (dateStr === today) cell.classList.add("today");
    if (dateStr === selectedDate) cell.classList.add("selected");

    const num = document.createElement("span");
    num.textContent = d;
    cell.appendChild(num);

    // 그 날짜에 할일이 있는 카테고리들의 색상을 클로버 모양으로 합쳐서 표시 (최대 4개)
    const dayCategoryIds = [...new Set(
      todos.filter(t => t.date === dateStr).map(t => t.categoryId)
    )];
    const dayColors = dayCategoryIds
      .map(catId => categories.find(c => c.id === catId))
      .filter(Boolean)
      .map(c => c.color)
      .slice(0, 4);
    if (dayColors.length > 0) {
      const flower = document.createElement("div");
      flower.className = `cal-flower count-${dayColors.length}`;
      dayColors.forEach(color => {
        const blob = document.createElement("span");
        blob.className = "flower-blob";
        blob.style.background = color;
        flower.appendChild(blob);
      });
      cell.appendChild(flower);
    }

    cell.addEventListener("click", () => {
      selectedDate = dateStr;
      renderCalendar();
      renderSelectedDateLabel();
      renderCategoryList();
    });

    grid.appendChild(cell);
  }

  renderSelectedDateLabel();
}

function renderSelectedDateLabel() {
  const [y, m, d] = selectedDate.split("-").map(Number);
  const weekday = ["일", "월", "화", "수", "목", "금", "토"][new Date(y, m - 1, d).getDay()];
  document.getElementById("selected-date-label").textContent =
    `${y}년 ${m}월 ${d}일 (${weekday})`;
}

// ----- 카테고리 + 할일 목록 렌더링 -----
function renderCategoryList() {
  const wrap = document.getElementById("category-list");
  wrap.innerHTML = "";

  if (categories.length === 0) {
    const p = document.createElement("p");
    p.className = "placeholder";
    p.textContent = "카테고리를 추가하고 할 일을 적어보세요.";
    wrap.appendChild(p);
    return;
  }

  categories.forEach((cat, catIndex) => {
    const block = document.createElement("div");
    block.className = "category-block";

    // 헤더
    const head = document.createElement("div");
    head.className = "category-head";

    const dot = document.createElement("span");
    dot.className = "category-color-dot";
    dot.style.background = cat.color;
    head.appendChild(dot);

    const name = document.createElement("span");
    name.className = "category-name";
    name.textContent = cat.name;
    name.style.color = cat.color;
    head.appendChild(name);

    const moveWrap = document.createElement("span");
    moveWrap.className = "move-btn-group";

    const upBtn = document.createElement("button");
    upBtn.className = "move-btn";
    upBtn.textContent = "▲";
    upBtn.disabled = catIndex === 0;
    upBtn.addEventListener("click", () => moveCategory(cat.id, -1));
    moveWrap.appendChild(upBtn);

    const downBtn = document.createElement("button");
    downBtn.className = "move-btn";
    downBtn.textContent = "▼";
    downBtn.disabled = catIndex === categories.length - 1;
    downBtn.addEventListener("click", () => moveCategory(cat.id, 1));
    moveWrap.appendChild(downBtn);

    head.appendChild(moveWrap);

    const editBtn = document.createElement("button");
    editBtn.className = "category-edit-btn";
    editBtn.textContent = "수정";
    editBtn.addEventListener("click", () => openCategoryModal(cat.id));
    head.appendChild(editBtn);

    block.appendChild(head);

    // 해당 카테고리 + 선택된 날짜의 할일들 (순서대로)
    const catTodos = todos
      .filter(t => t.categoryId === cat.id && t.date === selectedDate)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    catTodos.forEach((todo, todoIndex) => {
      block.appendChild(renderTodoRow(todo, cat.color, todoIndex, catTodos.length));
    });

    // 할일 추가 입력
    const addRow = document.createElement("div");
    addRow.className = "todo-add-row";

    const input = document.createElement("input");
    input.className = "todo-add-input";
    input.type = "text";
    input.placeholder = "할 일 추가";

    const addBtn = document.createElement("button");
    addBtn.className = "todo-add-btn";
    addBtn.textContent = "추가";

    const submit = async () => {
      const text = input.value.trim();
      if (!text) return;
      input.disabled = true;
      const sameList = todos.filter(t => t.categoryId === cat.id && t.date === selectedDate);
      const newOrder = sameList.length ? Math.max(...sameList.map(t => t.sortOrder)) + 1 : 0;
      const row = await addTodoToDB(cat.id, selectedDate, text, newOrder);
      input.disabled = false;
      if (!row) return;
      todos.push({
        id: row.id,
        categoryId: row.category_id,
        date: row.date,
        text: row.text,
        done: row.done,
        sortOrder: row.sort_order ?? newOrder,
      });
      input.value = "";
      renderCategoryList();
      renderCalendar();
    };

    addBtn.addEventListener("click", submit);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") submit();
    });

    addRow.appendChild(input);
    addRow.appendChild(addBtn);
    block.appendChild(addRow);

    wrap.appendChild(block);
  });
}

function renderTodoRow(todo, color, index, listLength) {
  const row = document.createElement("div");
  row.className = "todo-row";

  const check = document.createElement("button");
  check.className = "todo-check" + (todo.done ? " checked" : "");
  check.style.background = todo.done ? color : "transparent";
  check.style.borderColor = todo.done ? "transparent" : color;
  check.textContent = todo.done ? "✓" : "";
  check.addEventListener("click", async () => {
    todo.done = !todo.done;
    renderCategoryList(); // 먼저 화면 반영(반응 빠르게)
    await updateTodoDoneInDB(todo.id, todo.done);
  });
  row.appendChild(check);

  const text = document.createElement("span");
  text.className = "todo-text" + (todo.done ? " done" : "");
  text.textContent = todo.text;
  row.appendChild(text);

  const moveWrap = document.createElement("span");
  moveWrap.className = "move-btn-group";

  const upBtn = document.createElement("button");
  upBtn.className = "move-btn";
  upBtn.textContent = "▲";
  upBtn.disabled = index === 0;
  upBtn.addEventListener("click", () => moveTodo(todo, -1));
  moveWrap.appendChild(upBtn);

  const downBtn = document.createElement("button");
  downBtn.className = "move-btn";
  downBtn.textContent = "▼";
  downBtn.disabled = index === listLength - 1;
  downBtn.addEventListener("click", () => moveTodo(todo, 1));
  moveWrap.appendChild(downBtn);

  row.appendChild(moveWrap);

  const nextDayBtn = document.createElement("button");
  nextDayBtn.className = "todo-nextday-btn";
  nextDayBtn.textContent = "→";
  nextDayBtn.title = "내일로 넘기기";
  nextDayBtn.addEventListener("click", () => moveTodoToNextDay(todo));
  row.appendChild(nextDayBtn);

  const delBtn = document.createElement("button");
  delBtn.className = "todo-del-btn";
  delBtn.textContent = "×";
  delBtn.addEventListener("click", async () => {
    if (!confirm(`"${todo.text}" 항목을 삭제하시겠습니까?`)) return;
    todos = todos.filter(t => t.id !== todo.id);
    renderCategoryList();
    renderCalendar();
    await deleteTodoFromDB(todo.id);
  });
  row.appendChild(delBtn);

  return row;
}

// ----- 순서 변경 -----
async function moveCategory(id, direction) {
  const idx = categories.findIndex(c => c.id === id);
  const swapIdx = idx + direction;
  if (idx === -1 || swapIdx < 0 || swapIdx >= categories.length) return;

  const a = categories[idx];
  const b = categories[swapIdx];
  [a.sortOrder, b.sortOrder] = [b.sortOrder, a.sortOrder];
  categories.sort((x, y) => x.sortOrder - y.sortOrder);

  renderCategoryList();
  await Promise.all([
    updateCategoryOrderInDB(a.id, a.sortOrder),
    updateCategoryOrderInDB(b.id, b.sortOrder),
  ]);
}

async function moveTodo(todo, direction) {
  const list = todos
    .filter(t => t.categoryId === todo.categoryId && t.date === todo.date)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const idx = list.findIndex(t => t.id === todo.id);
  const swapIdx = idx + direction;
  if (idx === -1 || swapIdx < 0 || swapIdx >= list.length) return;

  const a = list[idx];
  const b = list[swapIdx];
  [a.sortOrder, b.sortOrder] = [b.sortOrder, a.sortOrder];

  renderCategoryList();
  await Promise.all([
    updateTodoOrderInDB(a.id, a.sortOrder),
    updateTodoOrderInDB(b.id, b.sortOrder),
  ]);
}

// ----- 다음 날로 넘기기 -----
async function moveTodoToNextDay(todo) {
  const newDate = nextDateStr(todo.date);
  const sameList = todos.filter(t => t.categoryId === todo.categoryId && t.date === newDate && t.id !== todo.id);
  const newOrder = sameList.length ? Math.max(...sameList.map(t => t.sortOrder)) + 1 : 0;

  todo.date = newDate;
  todo.sortOrder = newOrder;

  renderCategoryList();
  renderCalendar();
  await updateTodoDateAndOrderInDB(todo.id, newDate, newOrder);
}

// ----- 카테고리 추가/수정 모달 -----
function renderColorPicker() {
  const wrap = document.getElementById("color-picker");
  wrap.innerHTML = "";
  CATEGORY_COLORS.forEach(color => {
    const sw = document.createElement("span");
    sw.className = "color-swatch" + (color === pickedColor ? " selected" : "");
    sw.style.background = color;
    sw.addEventListener("click", () => {
      pickedColor = color;
      renderColorPicker();
    });
    wrap.appendChild(sw);
  });
}

function openCategoryModal(categoryId) {
  editingCategoryId = categoryId;
  const modal = document.getElementById("category-modal");
  const title = document.getElementById("category-modal-title");
  const nameInput = document.getElementById("category-name-input");
  const deleteBtn = document.getElementById("category-delete-btn");

  if (categoryId) {
    const cat = categories.find(c => c.id === categoryId);
    title.textContent = "카테고리 수정";
    nameInput.value = cat.name;
    pickedColor = cat.color;
    deleteBtn.classList.remove("hidden");
  } else {
    title.textContent = "카테고리 추가";
    nameInput.value = "";
    pickedColor = CATEGORY_COLORS[categories.length % CATEGORY_COLORS.length];
    deleteBtn.classList.add("hidden");
  }

  renderColorPicker();
  modal.classList.remove("hidden");
  nameInput.focus();
}

function closeCategoryModal() {
  document.getElementById("category-modal").classList.add("hidden");
  editingCategoryId = null;
}

async function saveCategoryFromModal() {
  const name = document.getElementById("category-name-input").value.trim();
  if (!name) return;

  if (editingCategoryId) {
    const cat = categories.find(c => c.id === editingCategoryId);
    cat.name = name;
    cat.color = pickedColor;
    closeCategoryModal();
    renderCategoryList();
    renderCalendar();
    await updateCategoryInDB(editingCategoryId, name, pickedColor);
  } else {
    closeCategoryModal();
    const newOrder = categories.length ? Math.max(...categories.map(c => c.sortOrder)) + 1 : 0;
    const row = await addCategoryToDB(name, pickedColor, newOrder);
    if (!row) return;
    categories.push({ id: row.id, name: row.name, color: row.color, sortOrder: row.sort_order ?? newOrder });
    renderCategoryList();
    renderCalendar();
  }
}

async function deleteCategoryFromModal() {
  if (!editingCategoryId) return;
  const catName = categories.find(c => c.id === editingCategoryId)?.name || "이 카테고리";
  if (!confirm(`"${catName}" 카테고리를 삭제하시겠습니까?\n포함된 할 일도 모두 삭제됩니다.`)) return;
  const idToDelete = editingCategoryId;
  categories = categories.filter(c => c.id !== idToDelete);
  todos = todos.filter(t => t.categoryId !== idToDelete);
  closeCategoryModal();
  renderCategoryList();
  renderCalendar();
  await deleteCategoryFromDB(idToDelete); // todos는 DB의 on delete cascade 설정으로 같이 정리됨
}

// 참고: 이제 초기화는 app.js에서 PIN 통과 + Supabase 로그인 성공 후 initTodoApp()을 호출하는 방식으로 바뀜
