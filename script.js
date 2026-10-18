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
const FLYER_BUCKET = "dhanda-party-flyers";
const dateFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: PACIFIC, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
const dateParts = (date) => Object.fromEntries(dateFormatter.formatToParts(date).filter(part => part.type !== "literal").map(part => [part.type, part.value]));
const toKey = (year, month, day) => `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

let schedule = structuredClone(INITIAL_SCHEDULE);
let scheduleEntries = Object.entries(INITIAL_SCHEDULE).flatMap(([event_date, times]) => times.map(start_time => ({ id: null, event_date, start_time, status: "reserved" })));
const initialToday = dateParts(new Date());
let viewedMonth = new Date(Number(initialToday.year), Number(initialToday.month) - 1, 1);
let selectedDate = `${initialToday.year}-${initialToday.month}-${initialToday.day}`;
let supabaseClient = null;
let authReady = false;
let isDhandaSignedIn = false;
let editingScheduleId = null;
let editingFlyerId = null;
let flyerRecords = [];

const monthLabel = document.querySelector("#month-label");
const calendarGrid = document.querySelector("#calendar-grid");
const dayTitle = document.querySelector("#selected-date");
const dayCount = document.querySelector("#day-count");
const dayEvents = document.querySelector("#day-events");
const adminDialog = document.querySelector("#admin-dialog");
const loginForm = document.querySelector("#login-form");
const addForm = document.querySelector("#add-form");
const removeForm = document.querySelector("#remove-form");
const bookingDialog = document.querySelector("#booking-dialog");
const bookingForm = document.querySelector("#booking-form");
const bookingRequestsDialog = document.querySelector("#booking-requests-dialog");
const flyerDialog = document.querySelector("#flyer-dialog");
const flyerForm = document.querySelector("#flyer-form");

function displayFlyerDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: PACIFIC })
    .format(new Date(Date.UTC(year, month - 1, day, 12)));
}

async function loadPartyFlyers() {
  const grid = document.querySelector("#flyer-grid");
  if (!grid) return;
  try {
    const client = await connectSupabase();
    if (!client) throw new Error("Supabase is not configured");
    let query = client.from("party_flyers").select("id,title,event_date,venue,landmark,description,object_path,is_published,sort_order,created_at");
    if (!isDhandaSignedIn) query = query.eq("is_published", true);
    const { data, error } = await query.order("sort_order").order("event_date");
    if (error) throw error;
    const todayParts = dateParts(new Date());
    const todayKey = `${todayParts.year}-${todayParts.month}-${todayParts.day}`;
    const flyers = (data || []).map(flyer => {
      const { data: publicFile } = client.storage.from(FLYER_BUCKET).getPublicUrl(flyer.object_path);
      return { ...flyer, url: publicFile.publicUrl };
    }).filter(Boolean).sort((a, b) => {
      const aIsPast = a.event_date < todayKey;
      const bIsPast = b.event_date < todayKey;
      if (aIsPast !== bIsPast) return aIsPast ? 1 : -1;
      return a.sort_order - b.sort_order || (aIsPast ? b.event_date.localeCompare(a.event_date) : a.event_date.localeCompare(b.event_date));
    });
    flyerRecords = isDhandaSignedIn ? (data || []) : [];
    refreshDashboard();
    grid.replaceChildren();
    if (!flyers.length) {
      const empty = document.createElement("p");
      empty.className = "flyer-empty";
      empty.textContent = isDhandaSignedIn ? "Nenhum flyer ainda. Publique um novo ou salve como rascunho." : "No event flyers published yet.";
      grid.append(empty);
      return;
    }
    for (const flyer of flyers) {
      const card = document.createElement("article");
      card.className = `flyer-card${isDhandaSignedIn && !flyer.is_published ? " flyer-is-draft" : ""}`;
      const link = document.createElement("a");
      link.className = "flyer-image-link";
      link.href = flyer.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.setAttribute("aria-label", `${flyer.is_published ? "View" : "Preview"} flyer: ${flyer.title}`);
      const image = document.createElement("img");
      image.src = flyer.url;
      image.alt = `${flyer.title} party flyer`;
      image.loading = "lazy";
      link.append(image);
      const info = document.createElement("div");
      info.className = "flyer-info";
      const date = document.createElement("span");
      date.className = "flyer-date";
      date.textContent = `${displayFlyerDate(flyer.event_date)}${flyer.event_date < todayKey ? " · PAST EVENT" : " · UPCOMING"}`;
      const title = document.createElement("h3");
      title.textContent = flyer.title;
      info.append(date, title);
      if (flyer.venue) { const venue = document.createElement("p"); venue.className = "flyer-meta"; venue.textContent = flyer.venue; info.append(venue); }
      if (flyer.landmark) { const landmark = document.createElement("p"); landmark.className = "flyer-meta"; landmark.textContent = flyer.landmark; info.append(landmark); }
      if (flyer.description) { const description = document.createElement("p"); description.className = "flyer-description"; description.textContent = flyer.description; info.append(description); }
      card.append(link, info);
      if (isDhandaSignedIn) {
        const actions = document.createElement("div"); actions.className = "flyer-admin-actions";
        const edit = document.createElement("button"); edit.type = "button"; edit.textContent = "EDITAR"; edit.addEventListener("click", () => openFlyerEditor(flyer));
        const publish = document.createElement("button"); publish.type = "button"; publish.textContent = flyer.is_published ? "DESPUBLICAR" : "PUBLICAR"; publish.addEventListener("click", () => toggleFlyerPublication(flyer, publish));
        const up = document.createElement("button"); up.type = "button"; up.textContent = "↑"; up.setAttribute("aria-label", "Mover flyer para cima"); up.addEventListener("click", () => moveFlyer(flyer, -1));
        const down = document.createElement("button"); down.type = "button"; down.textContent = "↓"; down.setAttribute("aria-label", "Mover flyer para baixo"); down.addEventListener("click", () => moveFlyer(flyer, 1));
        const remove = document.createElement("button"); remove.type = "button"; remove.textContent = "APAGAR"; remove.className = "flyer-admin-delete"; remove.addEventListener("click", () => deletePartyFlyer(flyer, remove));
        actions.append(edit, publish, up, down, remove); card.append(actions);
      }
      grid.append(card);
    }
  } catch (error) {
    console.error("Could not load party flyers", error);
    grid.replaceChildren();
    const empty = document.createElement("p");
    empty.className = "flyer-empty";
    empty.textContent = isDhandaSignedIn ? "Não foi possível carregar os flyers. Execute a atualização de flyers no Supabase." : "Party flyers will appear here soon.";
    grid.append(empty);
  }
}

function openFlyerEditor(flyer = null) {
  if (!isDhandaSignedIn) return;
  editingFlyerId = flyer?.id || null;
  flyerForm.reset();
  document.querySelector("#flyer-id").value = flyer?.id || "";
  document.querySelector("#flyer-title").value = flyer?.title || "";
  document.querySelector("#flyer-date").value = flyer?.event_date || "";
  document.querySelector("#flyer-venue").value = flyer?.venue || "";
  document.querySelector("#flyer-landmark").value = flyer?.landmark || "";
  document.querySelector("#flyer-description").value = flyer?.description || "";
  document.querySelector("#flyer-state").value = flyer?.is_published === false ? "draft" : "published";
  document.querySelector("#flyer-file").required = !flyer;
  document.querySelector("#flyer-submit").innerHTML = flyer ? "SALVAR ALTERAÇÕES <span>↗</span>" : "PUBLICAR FLYER <span>↗</span>";
  document.querySelector("#flyer-dialog-title").innerHTML = flyer ? "EDIT FLYER<span>.</span>" : "PUBLISH A FLYER<span>.</span>";
  setMessage(document.querySelector("#flyer-message"), "");
  flyerDialog.showModal();
}

async function publishPartyFlyer(event) {
  event.preventDefault();
  if (!isDhandaSignedIn) return;
  const message = document.querySelector("#flyer-message");
  const button = document.querySelector("#flyer-submit");
  const title = document.querySelector("#flyer-title").value.trim();
  const date = document.querySelector("#flyer-date").value;
  const venue = document.querySelector("#flyer-venue").value.trim();
  const landmark = document.querySelector("#flyer-landmark").value.trim();
  const description = document.querySelector("#flyer-description").value.trim();
  const isPublished = document.querySelector("#flyer-state").value === "published";
  const fileId = document.querySelector("#flyer-id").value;
  const file = document.querySelector("#flyer-file").files[0];
  if ((!file && !fileId) || (file && (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 10 * 1024 * 1024))) {
    setMessage(message, "Choose a JPG, PNG, or WebP image up to 10 MB.", true);
    return;
  }
  button.disabled = true;
  try {
    const client = await connectSupabase();
    if (!client) throw new Error("Supabase is not configured");
    const current = fileId ? flyerRecords.find(item => item.id === fileId) : null;
    let objectPath = current?.object_path || "";
    if (file) {
      const extension = ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" })[file.type];
      objectPath = `${date}__${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await client.storage.from(FLYER_BUCKET).upload(objectPath, file, {
        cacheControl: "3600", contentType: file.type, upsert: false
      });
      if (uploadError) throw uploadError;
    }
    const values = {
      title, event_date: date, venue, landmark, description, object_path: objectPath,
      is_published: isPublished,
      sort_order: current?.sort_order ?? (flyerRecords.length ? Math.max(...flyerRecords.map(item => item.sort_order || 0)) + 1 : 0)
    };
    const { error: saveError } = current
      ? await client.from("party_flyers").update(values).eq("id", current.id)
      : await client.from("party_flyers").insert(values);
    if (saveError) {
      if (file) await client.storage.from(FLYER_BUCKET).remove([objectPath]);
      throw saveError;
    }
    if (file && current?.object_path) await client.storage.from(FLYER_BUCKET).remove([current.object_path]);
    flyerForm.reset();
    editingFlyerId = null;
    setMessage(message, isPublished ? "Flyer salvo e publicado." : "Flyer salvo como rascunho.");
    await loadPartyFlyers();
  } catch (error) {
    console.error("Could not save party flyer", error);
    setMessage(message, "Não foi possível salvar. Confira se a atualização de gerenciamento de flyers foi executada no Supabase.", true);
  } finally {
    button.disabled = false;
  }
}

async function toggleFlyerPublication(flyer, button) {
  if (!isDhandaSignedIn || !supabaseClient) return;
  button.disabled = true;
  try {
    const { error } = await supabaseClient.from("party_flyers").update({ is_published: !flyer.is_published }).eq("id", flyer.id);
    if (error) throw error;
    await loadPartyFlyers();
  } catch (error) {
    button.disabled = false;
    window.alert("Não foi possível atualizar a publicação do flyer.");
  }
}

async function moveFlyer(flyer, direction) {
  if (!isDhandaSignedIn || !supabaseClient) return;
  const ordered = [...flyerRecords].sort((a, b) => a.sort_order - b.sort_order);
  const index = ordered.findIndex(item => item.id === flyer.id);
  const target = ordered[index + direction];
  if (!target) return;
  const { error } = await supabaseClient.from("party_flyers").update({ sort_order: target.sort_order }).eq("id", flyer.id);
  if (!error) await supabaseClient.from("party_flyers").update({ sort_order: flyer.sort_order }).eq("id", target.id);
  await loadPartyFlyers();
}

async function deletePartyFlyer(flyer, button) {
  if (!isDhandaSignedIn || !supabaseClient) return;
  if (!window.confirm("Apagar este flyer da galeria?")) return;
  button.disabled = true;
  try {
    const { error: rowError } = await supabaseClient.from("party_flyers").delete().eq("id", flyer.id);
    if (rowError) throw rowError;
    const { error } = await supabaseClient.storage.from(FLYER_BUCKET).remove([flyer.object_path]);
    if (error) throw error;
    await loadPartyFlyers();
  } catch (error) {
    console.error("Could not remove party flyer", error);
    button.disabled = false;
    window.alert("Não foi possível apagar o flyer. Confira a sessão e a configuração do Supabase.");
  }
}

function entriesForDate(date) {
  return scheduleEntries.filter(entry => entry.event_date === date).sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)));
}

function setScheduleFromEntries(entries) {
  scheduleEntries = entries.map(entry => ({
    ...entry,
    start_time: String(entry.start_time).slice(0, 5),
    end_time: entry.end_time ? String(entry.end_time).slice(0, 5) : null,
    status: entry.status || "reserved"
  }));
  schedule = {};
  for (const entry of scheduleEntries) (schedule[entry.event_date] ||= []).push(entry.start_time);
}

function statusLabel(status) {
  return ({ available: "AVAILABLE", reserved: "RESERVED", unavailable: "UNAVAILABLE" })[status] || "RESERVED";
}

function timeLabel(time) {
  const [hour, minute] = time.split(":").map(Number);
  return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`;
}

function timeToMinutes(time) {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

function timeRangeEndMinutes(startTime, endTime) {
  const startMinute = timeToMinutes(startTime);
  const endMinute = timeToMinutes(endTime);
  return endMinute === 0 && startMinute > 0 ? 24 * 60 : endMinute;
}

function timeRangeLabel(entry) {
  if (!entry.end_time) return timeLabel(entry.start_time);
  const nextDay = String(entry.end_time).slice(0, 5) === "00:00" && timeToMinutes(entry.start_time) > 0;
  return `${timeLabel(entry.start_time)} – ${timeLabel(String(entry.end_time).slice(0, 5))}${nextDay ? " (+1 day)" : ""}`;
}

function refreshDashboard() {
  if (!isDhandaSignedIn) return;
  const parts = dateParts(new Date());
  const nowKey = `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
  const upcoming = scheduleEntries.filter(entry => entry.status === "available")
    .map(entry => ({ ...entry, stamp: `${entry.event_date}T${entry.start_time}` }))
    .sort((a, b) => a.stamp.localeCompare(b.stamp));
  const next = upcoming.find(entry => entry.stamp > nowKey);
  document.querySelector("#dashboard-next").textContent = next
    ? humanDate(next.event_date, { weekday: "short", month: "short", day: "numeric" }).toUpperCase()
    : "—";
  document.querySelector("#dashboard-next-time").textContent = next
    ? `${timeRangeLabel(next)} SLT`
    : "Nenhum período futuro";
  document.querySelector("#dashboard-available").textContent = String(upcoming.length);
  document.querySelector("#dashboard-flyers").textContent = String(flyerRecords.filter(flyer => flyer.is_published).length);
  document.querySelector("#dashboard-drafts").textContent = `${flyerRecords.filter(flyer => !flyer.is_published).length} rascunhos`;
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

function setNext() {
  const parts = dateParts(new Date());
  const nowKey = `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
  const upcomingEntries = scheduleEntries
    .filter(entry => entry.status === "reserved" || entry.status === "available")
    .map(entry => ({ date: entry.event_date, time: entry.start_time, end: entry.end_time, status: entry.status, stamp: `${entry.event_date}T${entry.start_time}` }))
    .filter(slot => slot.stamp > nowKey)
    .sort((a, b) => a.stamp.localeCompare(b.stamp));
  const nextSet = upcomingEntries.find(slot => slot.status === "reserved");
  const nextAvailable = upcomingEntries.find(slot => slot.status === "available");
  const next = nextSet || nextAvailable;
  const label = document.querySelector("#next-label");
  const heading = document.querySelector("#next-day");
  const time = document.querySelector("#next-time");
  const index = document.querySelector("#next-index");
  const subtitle = document.querySelector("#next-subtitle");
  const countdown = document.querySelector("#countdown");
  if (!next) {
    label.textContent = "NEXT SET";
    heading.textContent = "REQUEST A DATE";
    time.textContent = "—";
    index.textContent = "BY INQUIRY";
    subtitle.textContent = "SEND A BOOKING REQUEST";
    countdown.textContent = "PREFERRED DATES ARE WELCOME";
    return;
  }
  const isConfirmedSet = Boolean(nextSet);
  label.textContent = isConfirmedSet ? "NEXT SET" : "NEXT AVAILABLE";
  heading.textContent = humanDate(next.date).toUpperCase();
  time.textContent = next.end ? `${timeLabel(next.time)} – ${timeLabel(next.end)}` : timeLabel(next.time);
  index.textContent = `01 / ${new Intl.DateTimeFormat("en-US", { month: "short", timeZone: PACIFIC }).format(new Date(`${next.date}T12:00:00-07:00`)).toUpperCase()}`;
  subtitle.textContent = isConfirmedSet ? "SCHEDULED SET · CONFIRMED" : "AVAILABLE FOR BOOKING";
  const remaining = Math.max(0, pacificInstant(next.date, next.time).getTime() - Date.now());
  const days = Math.floor(remaining / 86400000);
  const hours = Math.floor(remaining % 86400000 / 3600000);
  const minutes = Math.floor(remaining % 3600000 / 60000);
  const seconds = Math.floor(remaining % 60000 / 1000);
  const countdownLabel = isConfirmedSet ? "SET STARTS IN" : "AVAILABLE IN";
  countdown.textContent = days ? `${countdownLabel} ${days}D ${hours}H ${minutes}M` : `${countdownLabel} ${hours}H ${minutes}M ${seconds}S`;
}

function showSelectedDay() {
  const entries = entriesForDate(selectedDate);
  dayTitle.textContent = humanDate(selectedDate, { weekday: "long", month: "long", day: "numeric" }).toUpperCase();
  dayCount.textContent = entries.length ? `${entries.length} TIME ${entries.length === 1 ? "BLOCK" : "BLOCKS"} · ${entries.filter(entry => entry.status === "available").length} AVAILABLE` : "No time slots posted. Send your preferred time to ask about availability.";
  dayEvents.replaceChildren();
  entries.forEach(entry => {
    const row = document.createElement("div");
    row.className = "day-event";
    const clock = document.createElement("time");
    clock.className = "event-time";
    clock.textContent = timeRangeLabel(entry);
    const status = document.createElement("span");
    status.className = `slot-status status-${entry.status}`;
    status.textContent = statusLabel(entry.status);
    row.append(clock, status);
    if (entry.status === "available") {
      const request = document.createElement("button");
      request.type = "button";
      request.className = "slot-book";
      request.textContent = "BOOK";
      request.addEventListener("click", () => openBookingDialog(selectedDate, entry.start_time, entry.end_time));
      row.append(request);
    }
    if (isDhandaSignedIn && entry.id) {
      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "slot-edit";
      edit.textContent = "EDIT";
      edit.addEventListener("click", () => openEditSlot(entry));
      row.append(edit);
    }
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
  let totalSlots = 0;
  const todayParts = dateParts(new Date());
  const todayKey = `${todayParts.year}-${todayParts.month}-${todayParts.day}`;
  for (let index = 0; index < cells; index += 1) {
    const date = new Date(year, month, index - offset + 1);
    const key = toKey(date.getFullYear(), date.getMonth(), date.getDate());
    const entries = entriesForDate(key);
    totalSlots += entries.length;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "date-cell";
    button.setAttribute("role", "gridcell");
    button.setAttribute("aria-label", `${humanDate(key)}${entries.length ? `, ${entries.length} time slots` : ", no posted time slots"}`);
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
    entries.slice(0, 3).forEach(entry => {
      const pip = document.createElement("span");
      pip.className = `set-pip is-${entry.status}`;
      pip.textContent = timeRangeLabel(entry);
      pips.append(pip);
    });
    if (entries.length > 3) {
      const more = document.createElement("span");
      more.className = "set-pip extra";
      more.textContent = `+${entries.length - 3} MORE`;
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
  document.querySelector("#month-total").textContent = `${totalSlots} TIME SLOTS`;
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
    const { data, error } = await client.from("schedule_events").select("id,event_date,start_time,end_time,status").order("event_date").order("start_time");
    if (error) throw error;
    setScheduleFromEntries(data);
    renderCalendar();
    setNext();
    refreshDashboard();
  } catch (error) {
    console.error("Could not load DHANDA schedule", error);
    document.querySelector("#day-count").textContent = "Could not load saved schedule. Please try again later.";
  }
}

function setAdminSession(isSignedIn) {
  authReady = true;
  isDhandaSignedIn = isSignedIn;
  document.querySelector("#admin-tools").hidden = !isSignedIn;
  document.querySelector("#admin-dashboard").hidden = !isSignedIn;
  document.querySelector("#admin-flyer-library").hidden = !isSignedIn;
  document.querySelector("#login-open").hidden = isSignedIn;
  if (isSignedIn) loadBookingRequests();
  else document.querySelector("#request-count").textContent = "0";
  loadPartyFlyers();
  refreshDashboard();
  showSelectedDay();
}

function showAdminForm(form) {
  loginForm.hidden = form !== loginForm;
  addForm.hidden = form !== addForm;
  removeForm.hidden = form !== removeForm;
  const title = form === loginForm ? "LOGIN" : form === addForm ? (editingScheduleId ? "EDIT SLOT" : "TIME SLOT") : "REMOVER";
  document.querySelector("#admin-dialog-title").innerHTML = `${title}<span>.</span>`;
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

async function saveScheduleEntry(event) {
  event.preventDefault();
  const message = document.querySelector("#add-message");
  const date = document.querySelector("#add-date").value;
  const time = document.querySelector("#add-time").value;
  const endTime = document.querySelector("#add-end-time").value;
  const status = document.querySelector("#schedule-status").value;
  const startMinute = timeToMinutes(time);
  const endMinute = timeRangeEndMinutes(time, endTime);
  if (!endTime || endMinute <= startMinute) {
    setMessage(message, "O horário ATÉ precisa ser posterior ao horário DE. Use 00:00 para indicar meia-noite.", true);
    return;
  }
  try {
    const client = await connectSupabase();
    if (!client || !authReady || !isDhandaSignedIn) throw new Error("Admin access is not configured.");
    const { data: sameDayEntries, error: lookupError } = await client.from("schedule_events")
      .select("id,start_time,end_time").eq("event_date", date);
    if (lookupError) throw lookupError;
    const overlaps = sameDayEntries.some(entry => {
      if (editingScheduleId && entry.id === editingScheduleId) return false;
      const existingStart = String(entry.start_time).slice(0, 5);
      const existingStartMinute = timeToMinutes(existingStart);
      const existingEndMinute = entry.end_time
        ? timeRangeEndMinutes(existingStart, String(entry.end_time).slice(0, 5))
        : Math.min(24 * 60, existingStartMinute + 1);
      return startMinute < existingEndMinute && existingStartMinute < endMinute;
    });
    if (overlaps) {
      setMessage(message, "Esse intervalo se sobrepõe a outro horário cadastrado nesse dia.", true);
      return;
    }
    const values = { event_date: date, start_time: `${time}:00`, end_time: `${endTime}:00`, status };
    const { error } = editingScheduleId
      ? await client.from("schedule_events").update(values).eq("id", editingScheduleId)
      : await client.from("schedule_events").insert(values);
    if (error) throw error;
    selectedDate = date;
    editingScheduleId = null;
    setMessage(message, "Horário e status atualizados no schedule público.");
    await loadRemoteSchedule();
  } catch (error) {
    if (error?.code === "23514") {
      setMessage(message, "O Supabase ainda bloqueia horários até 00:00. Execute a atualização SQL de meia-noite para liberar esse horário.", true);
      return;
    }
    setMessage(message, "Não foi possível salvar. Confira sua sessão e tente novamente.", true);
  }
}

function openEditSlot(entry) {
  if (!isDhandaSignedIn || !entry.id) return;
  editingScheduleId = entry.id;
  document.querySelector("#add-date").value = entry.event_date;
  document.querySelector("#add-time").value = entry.start_time;
  document.querySelector("#add-end-time").value = entry.end_time || "";
  document.querySelector("#schedule-status").value = entry.status;
  setMessage(document.querySelector("#add-message"), "");
  showAdminForm(addForm);
}

function renderBookingRequests(requests) {
  const list = document.querySelector("#booking-request-list");
  list.replaceChildren();
  if (!requests.length) {
    const empty = document.createElement("p");
    empty.className = "request-empty";
    empty.textContent = "No booking inquiries yet.";
    list.append(empty);
    return;
  }

  for (const request of requests) {
    const storedMessage = request.message || "";
    const metaMatch = storedMessage.match(/^Request type: (Host booking|Party \/ special event)\n---\n([\s\S]*)$/);
    const requestType = metaMatch?.[1] || "Host booking";
    const requestMessage = metaMatch ? metaMatch[2] : storedMessage;
    const card = document.createElement("article");
    card.className = "request-card";
    const header = document.createElement("div");
    header.className = "request-card-header";
    const club = document.createElement("h3");
    club.textContent = request.club_name;
    const state = document.createElement("span");
    state.className = `request-state request-${request.status}`;
    state.textContent = request.status.toUpperCase();
    header.append(club, state);

    const kind = document.createElement("p");
    kind.className = `request-kind${requestType === "Party / special event" ? " request-kind-party" : ""}`;
    kind.textContent = requestType === "Party / special event" ? "PARTY / SPECIAL EVENT" : "HOST BOOKING · CLUB / DJ / SINGER";

    const contact = document.createElement("p");
    contact.className = "request-contact";
    contact.textContent = `SL: ${request.contact_name}`;
    const discord = document.createElement("p");
    discord.className = "request-contact";
    discord.textContent = `DISCORD: ${request.discord_handle || "Not provided"}`;
    const landmark = document.createElement("p");
    landmark.className = "request-contact";
    landmark.textContent = `LANDMARK: ${request.landmark || "Not provided"}`;
    const email = request.contact_email ? document.createElement("a") : null;
    if (email) {
      email.className = "request-email";
      email.href = `mailto:${request.contact_email}`;
      email.textContent = request.contact_email;
    }
    const when = document.createElement("p");
    when.className = "request-when";
    const startLabel = timeLabel(String(request.requested_time).slice(0, 5));
    const endLabel = request.requested_end_time ? ` – ${timeLabel(String(request.requested_end_time).slice(0, 5))}` : "";
    when.textContent = `${humanDate(request.requested_date, { weekday: "long", month: "long", day: "numeric", year: "numeric" })} · ${startLabel}${endLabel} SLT`;
    const message = document.createElement("p");
    message.className = "request-message";
    message.textContent = requestMessage || "No additional event details.";
    card.append(header, kind, contact, discord, landmark);
    if (email) card.append(email);
    card.append(when, message);

    const actions = document.createElement("div");
    actions.className = "request-actions";
    if (request.status === "pending") {
      const accept = document.createElement("button");
      accept.type = "button";
      accept.className = "request-accept";
      accept.textContent = "ACEITAR E RESERVAR";
      accept.addEventListener("click", () => decideBookingRequest(request.id, "accepted", accept));
      const decline = document.createElement("button");
      decline.type = "button";
      decline.className = "request-decline";
      decline.textContent = "RECUSAR";
      decline.addEventListener("click", () => decideBookingRequest(request.id, "declined", decline));
      actions.append(accept, decline);
    }
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "request-delete";
    remove.textContent = "APAGAR MENSAGEM";
    remove.addEventListener("click", () => deleteBookingRequest(request.id, remove));
    actions.append(remove);
    card.append(actions);
    list.append(card);
  }
}

async function loadBookingRequests() {
  if (!isDhandaSignedIn || !supabaseClient) return;
  const list = document.querySelector("#booking-request-list");
  try {
    const { data, error } = await supabaseClient.from("booking_inquiries")
      .select("id,club_name,contact_name,contact_email,discord_handle,landmark,requested_date,requested_time,requested_end_time,message,status,created_at")
      .order("created_at", { ascending: false });
    if (error) throw error;
    document.querySelector("#request-count").textContent = String(data.filter(request => request.status === "pending").length);
    document.querySelector("#dashboard-requests").textContent = String(data.filter(request => request.status === "pending").length);
    renderBookingRequests(data);
  } catch (error) {
    console.error("Could not load private booking inquiries", error);
    list.replaceChildren();
    const warning = document.createElement("p");
    warning.className = "request-empty is-error";
    warning.textContent = "Não foi possível carregar as solicitações. Confirme se a configuração do booking foi executada no Supabase.";
    list.append(warning);
  }
}

async function decideBookingRequest(requestId, decision, button) {
  if (!isDhandaSignedIn || !supabaseClient) return;
  button.disabled = true;
  try {
    const { error } = await supabaseClient.rpc("dhanda_decide_booking_request", {
      p_request_id: requestId,
      p_decision: decision
    });
    if (error) throw error;
    await Promise.all([loadBookingRequests(), loadRemoteSchedule()]);
  } catch (error) {
    button.disabled = false;
    const message = decision === "accepted"
      ? "Não foi possível reservar; esse horário pode já estar reservado ou indisponível."
      : "Não foi possível recusar esta solicitação. Tente novamente.";
    window.alert(message);
  }
}

async function deleteBookingRequest(requestId, button) {
  if (!isDhandaSignedIn || !supabaseClient) return;
  if (!window.confirm("Apagar esta solicitação? A mensagem será excluída, mas um horário já aceito continuará reservado no schedule.")) return;
  button.disabled = true;
  try {
    const { error } = await supabaseClient.rpc("dhanda_delete_booking_request", {
      p_request_id: requestId
    });
    if (error) throw error;
    await loadBookingRequests();
  } catch (error) {
    console.error("Could not delete booking inquiry", error);
    button.disabled = false;
    const detail = error?.message ? `\n\nDetalhe: ${error.message}` : "";
    window.alert(`Não foi possível apagar a mensagem. Confirme se a atualização de exclusão foi executada no Supabase.${detail}`);
  }
}

async function submitBookingInquiry(event) {
  event.preventDefault();
  const message = document.querySelector("#booking-message-status");
  if (document.querySelector("#booking-website").value) {
    setMessage(message, "Booking request sent. DHANDA will review it.");
    bookingForm.reset();
    return;
  }
  try {
    const client = await connectSupabase();
    if (!client) throw new Error("Booking is not configured.");
    const startTime = document.querySelector("#requested-time").value;
    const endTime = document.querySelector("#requested-end-time").value;
    if (!endTime || timeRangeEndMinutes(startTime, endTime) <= timeToMinutes(startTime)) {
      setMessage(message, "The UNTIL time must be after the FROM time. Use 00:00 to indicate midnight.", true);
      return;
    }
    const requestType = document.querySelector("#booking-type").value === "party" ? "Party / special event" : "Host booking";
    const details = document.querySelector("#booking-message").value.trim();
    const { error } = await client.from("booking_inquiries").insert({
      club_name: document.querySelector("#club-name").value.trim(),
      contact_name: document.querySelector("#sl-nick").value.trim(),
      contact_email: null,
      discord_handle: document.querySelector("#discord-handle").value.trim(),
      landmark: document.querySelector("#landmark").value.trim(),
      requested_date: document.querySelector("#requested-date").value,
      requested_time: `${startTime}:00`,
      requested_end_time: `${endTime}:00`,
      message: `Request type: ${requestType}\n---\n${details}`
    });
    if (error) throw error;
    bookingForm.reset();
    setMessage(message, "Request sent. DHANDA will review your booking inquiry.");
  } catch (error) {
    if (error?.code === "23514") {
      setMessage(message, "O Supabase ainda bloqueia horários até 00:00. Execute a atualização SQL de meia-noite para liberar esse horário.", true);
      return;
    }
    setMessage(message, "Não foi possível enviar agora. Tente novamente mais tarde.", true);
  }
}

function openBookingDialog(date = "", time = "", endTime = "") {
  const today = dateParts(new Date());
  document.querySelector("#requested-date").min = `${today.year}-${today.month}-${today.day}`;
  document.querySelector("#requested-date").value = date;
  document.querySelector("#requested-time").value = time;
  document.querySelector("#requested-end-time").value = endTime || "";
  document.querySelector("#booking-type").value = "host";
  document.querySelector("#booking-message").placeholder = "Tell DHANDA about the booking.";
  setMessage(document.querySelector("#booking-message-status"), "");
  bookingDialog.showModal();
}

function refreshRemoveTimes() {
  const date = document.querySelector("#remove-date").value;
  const select = document.querySelector("#remove-time");
  select.replaceChildren(new Option("DIA INTEIRO", ""));
  const entries = entriesForDate(date);
  const uniqueEntries = new Map(entries.map(entry => [entry.start_time, entry]));
  [...uniqueEntries.values()].forEach(entry => select.add(new Option(timeRangeLabel(entry), entry.start_time)));
}

async function removeScheduledSet(event) {
  event.preventDefault();
  const message = document.querySelector("#remove-message");
  const date = document.querySelector("#remove-date").value;
  const time = document.querySelector("#remove-time").value;
  const selectedEntry = entriesForDate(date).find(entry => entry.start_time === time);
  const confirmText = time ? `Remover o horário ${selectedEntry ? timeRangeLabel(selectedEntry) : timeLabel(time)} de ${humanDate(date)}?` : `Remover todos os horários de ${humanDate(date)}?`;
  if (!window.confirm(confirmText)) return;
  try {
    const client = await connectSupabase();
    if (!client || !authReady || !isDhandaSignedIn) throw new Error("Admin access is not configured.");
    let request = client.from("schedule_events").delete().eq("event_date", date);
    if (time) request = request.eq("start_time", `${time}:00`);
    const { data, error } = await request.select("id");
    if (error) throw error;
    if (!data.length) {
      setMessage(message, "Nenhum horário encontrado para essa seleção.", true);
      return;
    }
    setMessage(message, time ? "Horário removido do schedule." : "Horários desse dia removidos do schedule.");
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
  editingScheduleId = null;
  showAdminForm(loginForm);
});
document.querySelector("#add-open").addEventListener("click", () => {
  editingScheduleId = null;
  document.querySelector("#add-date").value = selectedDate;
  document.querySelector("#add-time").value = "";
  document.querySelector("#add-end-time").value = "";
  document.querySelector("#schedule-status").value = "available";
  setMessage(document.querySelector("#add-message"), "");
  showAdminForm(addForm);
});
document.querySelector("#remove-open").addEventListener("click", () => {
  document.querySelector("#remove-date").value = selectedDate;
  refreshRemoveTimes();
  setMessage(document.querySelector("#remove-message"), "");
  showAdminForm(removeForm);
});
document.querySelector("#booking-requests-open").addEventListener("click", () => {
  if (!isDhandaSignedIn) return;
  loadBookingRequests();
  bookingRequestsDialog.showModal();
});
document.querySelector("#flyer-open").addEventListener("click", () => {
  if (!isDhandaSignedIn) return;
  openFlyerEditor();
});
document.querySelector("#dashboard-open").addEventListener("click", () => {
  if (!isDhandaSignedIn) return;
  refreshDashboard();
  document.querySelector("#admin-dashboard").scrollIntoView({ behavior: "smooth", block: "center" });
});
document.querySelector("#flyer-library-open").addEventListener("click", () => {
  if (!isDhandaSignedIn) return;
  document.querySelector("#admin-flyer-library").scrollIntoView({ behavior: "smooth", block: "start" });
});
document.querySelectorAll("[data-dashboard-action]").forEach(button => button.addEventListener("click", () => {
  const action = button.dataset.dashboardAction;
  if (action === "add") document.querySelector("#add-open").click();
  if (action === "requests") document.querySelector("#booking-requests-open").click();
  if (action === "flyer") document.querySelector("#flyer-open").click();
  if (action === "manage-flyers") document.querySelector("#flyer-library-open").click();
}));
document.querySelector("#logout-button").addEventListener("click", async () => {
  if (supabaseClient) await supabaseClient.auth.signOut();
  setAdminSession(false);
});
document.querySelector("#dialog-close").addEventListener("click", () => adminDialog.close());
document.querySelector("#booking-close").addEventListener("click", () => bookingDialog.close());
document.querySelector("#requests-close").addEventListener("click", () => bookingRequestsDialog.close());
document.querySelector("#flyer-close").addEventListener("click", () => flyerDialog.close());
document.querySelector("#login-form").addEventListener("submit", event => { event.preventDefault(); startLogin(); });
document.querySelector("#add-form").addEventListener("submit", saveScheduleEntry);
document.querySelector("#remove-form").addEventListener("submit", removeScheduledSet);
document.querySelector("#remove-date").addEventListener("change", refreshRemoveTimes);
bookingForm.addEventListener("submit", submitBookingInquiry);
flyerForm.addEventListener("submit", publishPartyFlyer);
document.querySelector("#booking-type").addEventListener("change", event => {
  document.querySelector("#booking-message").placeholder = event.target.value === "party"
    ? "Share the party name, occasion, and any details DHANDA should know."
    : "Tell DHANDA about the booking.";
});

document.querySelector("#remove-form").addEventListener("reset", refreshRemoveTimes);
adminDialog.addEventListener("click", event => { if (event.target === adminDialog) adminDialog.close(); });
bookingDialog.addEventListener("click", event => { if (event.target === bookingDialog) bookingDialog.close(); });
bookingRequestsDialog.addEventListener("click", event => { if (event.target === bookingRequestsDialog) bookingRequestsDialog.close(); });
flyerDialog.addEventListener("click", event => { if (event.target === flyerDialog) flyerDialog.close(); });

setNext();
renderCalendar();
loadPartyFlyers();
window.setInterval(setNext, 1000);

if (supabaseConfigured()) {
  connectSupabase().then(async client => {
    const { data: { session } } = await client.auth.getSession();
    const emailMatches = session?.user?.email?.toLowerCase() === ADMIN_EMAIL;
    setAdminSession(emailMatches);
    client.auth.onAuthStateChange((_event, nextSession) => {
      setAdminSession(nextSession?.user?.email?.toLowerCase() === ADMIN_EMAIL);
      if (nextSession?.user?.email?.toLowerCase() === ADMIN_EMAIL) window.setTimeout(loadBookingRequests, 0);
    });
    await loadRemoteSchedule();
  }).catch(error => console.error("Supabase initialization failed", error));
}

if (new URLSearchParams(window.location.search).get("login") === "1") {
  showAdminForm(loginForm);
}
