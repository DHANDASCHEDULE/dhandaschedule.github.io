const INITIAL_SCHEDULE = {
  "2026-10-01": ["09:00", "10:30", "12:00", "13:00", "14:00", "15:00", "18:00"],
  "2026-10-02": ["09:00", "10:30", "12:00", "14:00", "15:00", "17:00", "18:00", "19:00"],
  "2026-10-03": ["10:00", "14:00", "15:00", "17:00"],
  "2026-10-04": ["11:00", "13:00", "13:00", "15:00"],
  "2026-10-05": ["09:00", "12:00", "17:00"],
  "2026-10-06": ["09:00", "13:00", "14:30", "19:00"],
  "2026-10-07": ["09:00", "10:30", "12:00", "17:00"],
  "2026-10-08": ["12:00", "13:00", "14:00", "17:00", "18:00"],
  "2026-10-09": ["09:00", "10:30", "12:00", "13:00", "19:00"],
  "2026-10-10": ["09:00", "11:30", "14:00", "14:00", "17:00", "19:00"],
  "2026-10-11": ["08:00", "08:00", "11:00", "13:00"],
  "2026-10-12": ["09:00", "12:00", "14:00", "16:00", "17:00", "22:00"],
  "2026-10-13": ["09:00", "10:30", "14:30", "19:00", "21:00"],
  "2026-10-14": ["09:00", "10:30", "14:00", "17:00"],
  "2026-10-15": ["12:00", "13:00", "14:00", "17:00", "18:00"],
  "2026-10-16": ["09:00", "10:30", "12:00", "19:00"],
  "2026-10-17": ["10:00", "13:00", "15:00", "15:00", "17:00"],
  "2026-10-18": ["11:00", "13:00", "13:00"],
  "2026-10-19": ["09:00", "12:00", "12:00", "12:00", "17:00", "22:00"],
  "2026-10-20": ["09:00", "10:30", "14:30", "16:00", "19:00"],
  "2026-10-21": ["09:00", "10:30", "17:00"],
  "2026-10-22": ["12:00", "14:00", "18:00", "19:00"],
  "2026-10-23": ["09:00", "10:30", "12:00", "13:00", "19:00"],
  "2026-10-24": ["10:00", "13:00", "15:00", "17:00"],
  "2026-10-25": ["09:00", "09:00", "11:00"],
  "2026-10-26": ["09:00", "12:00", "17:00", "22:00"],
  "2026-10-27": ["09:00", "10:30", "14:30", "16:00", "19:00", "21:00"],
  "2026-10-28": ["09:00", "10:30", "14:00", "17:00"],
  "2026-10-29": ["12:00", "14:00", "18:00"],
  "2026-10-30": ["09:00", "10:30", "12:00", "14:00", "18:00", "19:30"],
  "2026-10-31": ["10:00", "14:00", "14:00", "15:00", "17:00"]
};

const PACIFIC = "America/Los_Angeles";
const ADMIN_USERNAME = "dhanda";
const ADMIN_EMAIL = "dhanda@dhandaschedule.github.io";
const dateFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: PACIFIC, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
const dateParts = (date) => Object.fromEntries(dateFormatter.formatToParts(date).filter(part => part.type !== "literal").map(part => [part.type, part.value]));
const toKey = (year, month, day) => `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

let schedule = structuredClone(INITIAL_SCHEDULE);
let viewedMonth = new Date(2026, 9, 1);
let selectedDate = "2026-10-12";
let supabaseClient = null;
let authReady = false;

const monthLabel = document.querySelector("#month-label");
const calendarGrid = document.querySelector("#calendar-grid");
const dayTitle = document.querySelector("#selected-date");
const dayCount = document.querySelector("#day-count");
const dayEvents = document.querySelector("#day-events");
const adminDialog = document.querySelector("#admin-dialog");
const loginForm = document.querySelector("#login-form");
const addForm = document.querySelector("#add-form");
const removeForm = document.querySelector("#remove-form");

function timeLabel(time) {
  const [hour, minute] = time.split(":").map(Number);
  return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`;
}

function humanDate(key, options = { weekday: "long", month: "long", day: "numeric" }) {
  return new Intl.DateTimeFormat("en-US", { ...options, timeZone: PACIFIC }).format(new Date(`${key}T12:00:00-07:00`));
}

function pacificInstant(key, time) {
  const [year, month, day] = key.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const desired = Date.UTC(year, month - 1, day, hour, minute);
  let guess = desired;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = dateParts(new Date(guess));
    const represented = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
    guess += desired - represented;
  }
  return new Date(guess);
}

function allSets() {
  return Object.entries(schedule).flatMap(([date, times]) => times.map(time => ({ date, time, stamp: `${date}T${time}` }))).sort((a, b) => a.stamp.localeCompare(b.stamp));
}

function setNext() {
  const parts = dateParts(new Date());
  const nowKey = `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
  const next = allSets().find(set => set.stamp > nowKey);
  const heading = document.querySelector("#next-day");
  const time = document.querySelector("#next-time");
  const index = document.querySelector("#next-index");
  const subtitle = document.querySelector("#next-subtitle");
  const countdown = document.querySelector("#countdown");
  if (!next) {
    heading.textContent = "NO UPCOMING SETS";
    time.textContent = "—";
    index.textContent = "SCHEDULE COMPLETE";
    subtitle.textContent = "CHECK BACK FOR THE NEXT DATE";
    countdown.textContent = "CHECK BACK SOON";
    return;
  }
  heading.textContent = humanDate(next.date).toUpperCase();
  time.textContent = timeLabel(next.time);
  index.textContent = `01 / ${new Intl.DateTimeFormat("en-US", { month: "short", timeZone: PACIFIC }).format(new Date(`${next.date}T12:00:00-07:00`)).toUpperCase()}`;
  subtitle.textContent = "DHANDA / SCHEDULED SET";
  const remaining = Math.max(0, pacificInstant(next.date, next.time).getTime() - Date.now());
  const days = Math.floor(remaining / 86400000);
  const hours = Math.floor(remaining % 86400000 / 3600000);
  const minutes = Math.floor(remaining % 3600000 / 60000);
  const seconds = Math.floor(remaining % 60000 / 1000);
  countdown.textContent = days ? `STARTS IN ${days}D ${hours}H ${minutes}M` : `STARTS IN ${hours}H ${minutes}M ${seconds}S`;
}

function showSelectedDay() {
  const times = schedule[selectedDate] || [];
  dayTitle.textContent = humanDate(selectedDate, { weekday: "long", month: "long", day: "numeric" }).toUpperCase();
  dayCount.textContent = times.length ? `${times.length} SCHEDULED ${times.length === 1 ? "SET" : "SETS"}` : "No sets scheduled for this date.";
  dayEvents.replaceChildren();
  times.forEach((time, index) => {
    const row = document.createElement("div");
    row.className = "day-event";
    const clock = document.createElement("time");
    clock.className = "event-time";
    clock.textContent = timeLabel(time);
    const label = document.createElement("span");
    label.className = "event-label";
    label.textContent = `SET ${String(index + 1).padStart(2, "0")}`;
    row.append(clock, label);
    dayEvents.append(row);
  });
}

function renderCalendar() {
  const year = viewedMonth.getFullYear();
  const month = viewedMonth.getMonth();
  monthLabel.textContent = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(viewedMonth).toUpperCase();
  const offset = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = Math.ceil((offset + daysInMonth) / 7) * 7;
  calendarGrid.replaceChildren();
  let totalSets = 0;
  const todayParts = dateParts(new Date());
  const todayKey = `${todayParts.year}-${todayParts.month}-${todayParts.day}`;
  for (let index = 0; index < cells; index += 1) {
    const date = new Date(year, month, index - offset + 1);
    const key = toKey(date.getFullYear(), date.getMonth(), date.getDate());
    const times = schedule[key] || [];
    totalSets += times.length;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "date-cell";
    button.setAttribute("role", "gridcell");
    button.setAttribute("aria-label", `${humanDate(key)}${times.length ? `, ${times.length} sets` : ", no sets scheduled"}`);
    button.setAttribute("aria-pressed", String(key === selectedDate));
    if (date.getMonth() !== month) button.classList.add("is-outside");
    if (key === selectedDate) button.classList.add("is-selected");
    if (key === todayKey) button.classList.add("is-today");
    const top = document.createElement("div");
    top.className = "date-top";
    const num = document.createElement("span");
    num.className = "date-number";
    num.textContent = String(date.getDate()).padStart(2, "0");
    const monthMark = document.createElement("span");
    monthMark.className = "date-month";
    monthMark.textContent = date.getMonth() !== month ? new Intl.DateTimeFormat("en-US", { month: "short" }).format(date).toUpperCase() : "";
    top.append(num, monthMark);
    const pips = document.createElement("div");
    pips.className = "set-pips";
    times.slice(0, 3).forEach(time => {
      const pip = document.createElement("span");
      pip.className = "set-pip";
      pip.textContent = timeLabel(time);
      pips.append(pip);
    });
    if (times.length > 3) {
      const more = document.createElement("span");
      more.className = "set-pip extra";
      more.textContent = `+${times.length - 3} MORE`;
      pips.append(more);
    }
    button.append(top, pips);
    button.addEventListener("click", () => {
      selectedDate = key;
      showSelectedDay();
      renderCalendar();
    });
    calendarGrid.append(button);
  }
  document.querySelector("#month-total").textContent = `${totalSets} SCHEDULED SETS`;
  showSelectedDay();
}

function supabaseConfigured() {
  const config = window.DHANDA_SUPABASE;
  return Boolean(config?.url && config?.anonKey && !config.url.includes("YOUR_PROJECT") && !config.anonKey.includes("YOUR_SUPABASE"));
}

async function connectSupabase() {
  if (!supabaseConfigured()) return null;
  if (!supabaseClient) {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    supabaseClient = createClient(window.DHANDA_SUPABASE.url, window.DHANDA_SUPABASE.anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
  }
  return supabaseClient;
}

async function loadRemoteSchedule() {
  try {
    const client = await connectSupabase();
    if (!client) return;
    const { data, error } = await client.from("schedule_events").select("event_date,start_time").order("event_date").order("start_time");
    if (error) throw error;
    schedule = {};
    for (const row of data) {
      const date = row.event_date;
      const time = String(row.start_time).slice(0, 5);
      (schedule[date] ||= []).push(time);
    }
    renderCalendar();
    setNext();
  } catch (error) {
    console.error("Could not load DHANDA schedule", error);
    document.querySelector("#day-count").textContent = "Could not load saved schedule. Please try again later.";
  }
}

function setAdminSession(isSignedIn) {
  authReady = true;
  document.querySelector("#admin-tools").hidden = !isSignedIn;
  document.querySelector("#login-open").hidden = isSignedIn;
}

function showAdminForm(form) {
  loginForm.hidden = form !== loginForm;
  addForm.hidden = form !== addForm;
  removeForm.hidden = form !== removeForm;
  document.querySelector("#admin-dialog-title").innerHTML = form === loginForm ? "LOGIN<span>.</span>" : form === addForm ? "ADICIONAR<span>.</span>" : "REMOVER<span>.</span>";
  document.querySelector("#dialog-eyebrow").textContent = form === loginForm ? "DHANDA / PRIVATE ACCESS" : "DHANDA / CALENDAR EDITOR";
  adminDialog.showModal();
}

function setMessage(element, message, isError = false) {
  element.textContent = message;
  element.classList.toggle("is-error", isError);
}

async function startLogin() {
  try {
    const client = await connectSupabase();
    if (!client) {
      setMessage(document.querySelector("#login-message"), "O acesso está aguardando a configuração do Supabase.", true);
      return;
    }
    const username = document.querySelector("#login-username").value.trim().toLowerCase();
    const password = document.querySelector("#login-password").value;
    if (username !== ADMIN_USERNAME) {
      setMessage(document.querySelector("#login-message"), "Usuário ou senha inválidos.", true);
      return;
    }
    const { error } = await client.auth.signInWithPassword({ email: ADMIN_EMAIL, password });
    if (error) throw error;
    setAdminSession(true);
    document.querySelector("#login-password").value = "";
    adminDialog.close();
  } catch (error) {
    setMessage(document.querySelector("#login-message"), "Não foi possível entrar. Confira o acesso e tente novamente.", true);
  }
}

async function saveNewSet(event) {
  event.preventDefault();
  const message = document.querySelector("#add-message");
  const date = document.querySelector("#add-date").value;
  const time = document.querySelector("#add-time").value;
  try {
    const client = await connectSupabase();
    if (!client || !authReady) throw new Error("Admin access is not configured.");
    const { data: duplicate, error: lookupError } = await client.from("schedule_events").select("id").eq("event_date", date).eq("start_time", `${time}:00`).limit(1);
    if (lookupError) throw lookupError;
    if (duplicate.length) {
      setMessage(message, "Esse horário já está cadastrado nesse dia.", true);
      return;
    }
    const { error } = await client.from("schedule_events").insert({ event_date: date, start_time: `${time}:00` });
    if (error) throw error;
    setMessage(message, "Horário salvo e publicado na agenda.");
    await loadRemoteSchedule();
  } catch (error) {
    setMessage(message, "Não foi possível salvar. Confira sua sessão e tente novamente.", true);
  }
}

function refreshRemoveTimes() {
  const date = document.querySelector("#remove-date").value;
  const select = document.querySelector("#remove-time");
  select.replaceChildren(new Option("DIA INTEIRO", ""));
  [...new Set(schedule[date] || [])].sort().forEach(time => select.add(new Option(timeLabel(time), time)));
}

async function removeScheduledSet(event) {
  event.preventDefault();
  const message = document.querySelector("#remove-message");
  const date = document.querySelector("#remove-date").value;
  const time = document.querySelector("#remove-time").value;
  const confirmText = time ? `Remover o horário ${timeLabel(time)} de ${humanDate(date)}?` : `Remover todos os horários de ${humanDate(date)}?`;
  if (!window.confirm(confirmText)) return;
  try {
    const client = await connectSupabase();
    if (!client || !authReady) throw new Error("Admin access is not configured.");
    let request = client.from("schedule_events").delete().eq("event_date", date);
    if (time) request = request.eq("start_time", `${time}:00`);
    const { data, error } = await request.select("id");
    if (error) throw error;
    if (!data.length) {
      setMessage(message, "Nenhum horário encontrado para essa seleção.", true);
      return;
    }
    setMessage(message, time ? "Horário removido da agenda." : "Horários desse dia removidos da agenda.");
    await loadRemoteSchedule();
    refreshRemoveTimes();
  } catch (error) {
    setMessage(message, "Não foi possível remover. Confira sua sessão e tente novamente.", true);
  }
}

document.querySelector("#previous-month").addEventListener("click", () => { viewedMonth = new Date(viewedMonth.getFullYear(), viewedMonth.getMonth() - 1, 1); renderCalendar(); });
document.querySelector("#next-month").addEventListener("click", () => { viewedMonth = new Date(viewedMonth.getFullYear(), viewedMonth.getMonth() + 1, 1); renderCalendar(); });
document.querySelector("#today-button").addEventListener("click", () => {
  const parts = dateParts(new Date());
  viewedMonth = new Date(Number(parts.year), Number(parts.month) - 1, 1);
  selectedDate = `${parts.year}-${parts.month}-${parts.day}`;
  renderCalendar();
});

document.querySelector("#login-open").addEventListener("click", () => {
  setMessage(document.querySelector("#login-message"), "");
  showAdminForm(loginForm);
});
document.querySelector("#add-open").addEventListener("click", () => {
  document.querySelector("#add-date").value = selectedDate;
  setMessage(document.querySelector("#add-message"), "");
  showAdminForm(addForm);
});
document.querySelector("#remove-open").addEventListener("click", () => {
  document.querySelector("#remove-date").value = selectedDate;
  refreshRemoveTimes();
  setMessage(document.querySelector("#remove-message"), "");
  showAdminForm(removeForm);
});
document.querySelector("#logout-button").addEventListener("click", async () => {
  if (supabaseClient) await supabaseClient.auth.signOut();
  setAdminSession(false);
});
document.querySelector("#dialog-close").addEventListener("click", () => adminDialog.close());
document.querySelector("#login-form").addEventListener("submit", event => { event.preventDefault(); startLogin(); });
document.querySelector("#add-form").addEventListener("submit", saveNewSet);
document.querySelector("#remove-form").addEventListener("submit", removeScheduledSet);
document.querySelector("#remove-date").addEventListener("change", refreshRemoveTimes);

document.querySelector("#remove-form").addEventListener("reset", refreshRemoveTimes);
adminDialog.addEventListener("click", event => { if (event.target === adminDialog) adminDialog.close(); });

setNext();
renderCalendar();
window.setInterval(setNext, 1000);

if (supabaseConfigured()) {
  connectSupabase().then(async client => {
    const { data: { session } } = await client.auth.getSession();
    const emailMatches = session?.user?.email?.toLowerCase() === ADMIN_EMAIL;
    setAdminSession(emailMatches);
    client.auth.onAuthStateChange((_event, nextSession) => setAdminSession(nextSession?.user?.email?.toLowerCase() === ADMIN_EMAIL));
    await loadRemoteSchedule();
  }).catch(error => console.error("Supabase initialization failed", error));
}
