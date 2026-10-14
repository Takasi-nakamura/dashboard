// =========================
// DOM取得
// =========================
const $ = (id) => document.getElementById(id);

const clockEl = $("clock");

const todoForm = $("todoForm");
const todoInput = $("todoInput");
const todoList = $("todoList");

const timerDisplay = $("timerDisplay");
const timerMinutesInput = $("timerMinutes");
const timerStartBtn = $("timerStart");
const timerResetBtn = $("timerReset");

const stopwatchDisplay = $("stopwatchDisplay");
const stopwatchStartBtn = $("stopwatchStart");
const stopwatchResetBtn = $("stopwatchReset");

// =========================
// 共通ユーティリティ
// =========================
const pad = (n, len = 2) => String(n).padStart(len, "0");

// ボタンのアイコンと説明を切り替える
function setIcon(button, iconName, label) {
    button.innerHTML = `<i data-lucide="${iconName}"></i>`;
    if (label) {
        button.setAttribute("aria-label", label);
        button.title = label;
    }
    lucide.createIcons();
}

// 短いビープ音を鳴らす
function playBeep() {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.value = 880;
        osc.connect(gain);
        gain.connect(ctx.destination);

        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1);

        osc.start();
        osc.stop(ctx.currentTime + 1);
    } catch (e) {
        // 音が鳴らせない環境では何もしない
    }
}

// =========================
// 現在時刻
// =========================
function updateClock() {
    const now = new Date();
    clockEl.textContent =
        `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

function startClock() {
    updateClock();
    setInterval(updateClock, 250);
}

// =========================
// Todo List
// =========================
const STORAGE_KEY = "study-dashboard-todos";
let todos = loadTodos();

function loadTodos() {
    try {
        const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
        return Array.isArray(data) ? data : [];
    } catch {
        return [];
    }
}

function saveTodos() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
    } catch {
        // 保存できない環境でも動作は続ける
    }
}

function createIconButton(iconName, label, className, onClick) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = className;
    btn.setAttribute("aria-label", label);
    btn.title = label;
    btn.innerHTML = `<i data-lucide="${iconName}"></i>`;
    btn.addEventListener("click", onClick);
    return btn;
}

function renderTodos() {
    todoList.innerHTML = "";

    if (todos.length === 0) {
        const empty = document.createElement("li");
        empty.className = "todo-empty";
        empty.textContent = "やることを追加しましょう";
        todoList.appendChild(empty);
        return;
    }

    todos.forEach((todo) => {
        const li = document.createElement("li");
        if (todo.done) li.classList.add("done");

        const text = document.createElement("span");
        text.className = "todo-text";
        text.textContent = todo.text;

        const actions = document.createElement("div");
        actions.className = "todo-actions";

        const doneBtn = createIconButton(
            todo.done ? "undo-2" : "check",
            todo.done ? "未完了に戻す" : "完了にする",
            "todo-btn done-btn",
            () => toggleTodo(todo.id)
        );

        const deleteBtn = createIconButton(
            "trash-2",
            "削除",
            "todo-btn delete-btn",
            () => deleteTodo(todo.id)
        );

        actions.append(doneBtn, deleteBtn);
        li.append(text, actions);
        todoList.appendChild(li);
    });

    lucide.createIcons();
}

function addTodo(text) {
    todos.push({ id: Date.now() + Math.random(), text, done: false });
    saveTodos();
    renderTodos();
}

function toggleTodo(id) {
    const todo = todos.find((t) => t.id === id);
    if (!todo) return;
    todo.done = !todo.done;
    saveTodos();
    renderTodos();
}

function deleteTodo(id) {
    todos = todos.filter((t) => t.id !== id);
    saveTodos();
    renderTodos();
}

todoForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = todoInput.value.trim();
    if (!text) return;
    addTodo(text);
    todoInput.value = "";
    todoInput.focus();
});

// =========================
// タイマー（指定時間）
// =========================
const TIMER_STORAGE_KEY = "study-dashboard-timer";
const timerState = { remainingMs: 0, endAt: 0, running: false, intervalId: null };

function saveTimerState() {
    try {
        localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify({
            remainingMs: timerState.running ? Math.max(0, timerState.endAt - Date.now()) : timerState.remainingMs,
            endAt: timerState.endAt,
            running: timerState.running,
            minutes: timerMinutesInput.value
        }));
    } catch {}
}

function restoreTimerState() {
    try {
        const saved = JSON.parse(localStorage.getItem(TIMER_STORAGE_KEY));
        if (!saved || typeof saved !== "object") return;
        timerState.remainingMs = Math.max(0, Number(saved.remainingMs) || 0);
        timerState.endAt = Math.max(0, Number(saved.endAt) || 0);
        timerState.running = saved.running === true && timerState.endAt > 0;
        if (saved.minutes) timerMinutesInput.value = saved.minutes;
        if (timerState.running) timerState.remainingMs = Math.max(0, timerState.endAt - Date.now());
    } catch {}
}

function formatMinSec(ms) {
    const totalSec = Math.ceil(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${pad(m)}:${pad(s)}`;
}

function renderTimer(ms) {
    timerDisplay.textContent = formatMinSec(ms);
}

function stopTimerInterval() {
    clearInterval(timerState.intervalId);
    timerState.intervalId = null;
}

function tickTimer() {
    const left = Math.max(0, timerState.endAt - Date.now());
    timerState.remainingMs = left;
    renderTimer(left);
    saveTimerState();
    if (left === 0) finishTimer();
}

function startTimer() {
    // 動作中なら一時停止
    if (timerState.running) {
        pauseTimer();
        return;
    }

    // 停止位置から再開しない場合は入力値から開始
    if (timerState.remainingMs <= 0) {
        const minutes = Number(timerMinutesInput.value);
        if (!minutes || minutes <= 0) {
            alert("分数を入力してください");
            timerMinutesInput.focus();
            return;
        }
        timerState.remainingMs = minutes * 60 * 1000;
    }

    timerState.endAt = Date.now() + timerState.remainingMs;
    timerState.running = true;
    saveTimerState();
    stopTimerInterval();
    timerState.intervalId = setInterval(tickTimer, 250);

    setIcon(timerStartBtn, "pause", "タイマー一時停止");
    tickTimer();
}

function pauseTimer() {
    timerState.remainingMs = Math.max(0, timerState.endAt - Date.now());
    timerState.running = false;
    stopTimerInterval();
    saveTimerState();

    setIcon(timerStartBtn, "play", "タイマー開始");
    renderTimer(timerState.remainingMs);
}

function finishTimer() {
    timerState.running = false;
    timerState.remainingMs = 0;
    stopTimerInterval();
    saveTimerState();

    setIcon(timerStartBtn, "play", "タイマー開始");
    renderTimer(0);
    playBeep();
    setTimeout(() => alert("時間です！お疲れさまでした。"), 100);
}

function resetTimer() {
    timerState.running = false;
    timerState.remainingMs = 0;
    timerState.endAt = 0;
    stopTimerInterval();
    saveTimerState();

    setIcon(timerStartBtn, "play", "タイマー開始");
    renderTimer(0);
}

timerStartBtn.addEventListener("click", startTimer);
timerResetBtn.addEventListener("click", resetTimer);

timerMinutesInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        e.preventDefault();
        startTimer();
    }
});

// 未開始の間は入力した分数をプレビュー表示
timerMinutesInput.addEventListener("input", () => {
    if (!timerState.running && timerState.remainingMs === 0) {
        const minutes = Math.max(0, Number(timerMinutesInput.value) || 0);
        renderTimer(minutes * 60 * 1000);
    }
});

// =========================
// ストップウォッチ
// =========================
const STOPWATCH_STORAGE_KEY = "study-dashboard-stopwatch";
const swState = { elapsed: 0, startedAt: 0, running: false, intervalId: null };

function saveStopwatchState() {
    try {
        localStorage.setItem(STOPWATCH_STORAGE_KEY, JSON.stringify({
            elapsed: swState.elapsed,
            startedAt: swState.startedAt,
            running: swState.running
        }));
    } catch {}
}

function restoreStopwatchState() {
    try {
        const saved = JSON.parse(localStorage.getItem(STOPWATCH_STORAGE_KEY));
        if (!saved || typeof saved !== "object") return;
        swState.elapsed = Math.max(0, Number(saved.elapsed) || 0);
        swState.startedAt = Math.max(0, Number(saved.startedAt) || 0);
        swState.running = saved.running === true && swState.startedAt > 0;
    } catch {}
}

function currentStopwatchMs() {
    return swState.running
        ? swState.elapsed + (Date.now() - swState.startedAt)
        : swState.elapsed;
}

function formatStopwatch(ms) {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    const tenths = Math.floor((ms % 1000) / 100);
    return `${pad(m)}:${pad(s)}.${tenths}`;
}

function renderStopwatch() {
    stopwatchDisplay.textContent = formatStopwatch(currentStopwatchMs());
    saveStopwatchState();
}

function toggleStopwatch() {
    if (swState.running) {
        swState.elapsed = currentStopwatchMs();
        swState.running = false;
        clearInterval(swState.intervalId);
        swState.intervalId = null;
        setIcon(stopwatchStartBtn, "play", "ストップウォッチ開始");
    } else {
        swState.startedAt = Date.now();
        swState.running = true;
        swState.intervalId = setInterval(renderStopwatch, 100);
        setIcon(stopwatchStartBtn, "pause", "ストップウォッチ一時停止");
    }
    renderStopwatch();
}

function resetStopwatch() {
    swState.running = false;
    swState.elapsed = 0;
    swState.startedAt = 0;
    clearInterval(swState.intervalId);
    swState.intervalId = null;

    setIcon(stopwatchStartBtn, "play", "ストップウォッチ開始");
    renderStopwatch();
}

stopwatchStartBtn.addEventListener("click", toggleStopwatch);
stopwatchResetBtn.addEventListener("click", resetStopwatch);

// =========================
// 初期化
// =========================
function init() {
    startClock();
    renderTodos();

    restoreTimerState();
    if (timerState.running) {
        setIcon(timerStartBtn, "pause", "タイマー一時停止");
        timerState.intervalId = setInterval(tickTimer, 250);
        tickTimer();
    } else {
        setIcon(timerStartBtn, "play", "タイマー開始");
        renderTimer(timerState.remainingMs);
        if (timerState.remainingMs === 0 && timerMinutesInput.value) {
            renderTimer((Number(timerMinutesInput.value) || 0) * 60 * 1000);
        }
    }

    restoreStopwatchState();
    if (swState.running) {
        setIcon(stopwatchStartBtn, "pause", "ストップウォッチ一時停止");
        swState.intervalId = setInterval(renderStopwatch, 100);
    } else {
        setIcon(stopwatchStartBtn, "play", "ストップウォッチ開始");
    }
    renderStopwatch();
    lucide.createIcons();
}

init();