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
let viewedMonth = new Date(2026, 9, 1);
let selectedDate = "2026-10-12";
let supabaseClient = null;
let authReady = false;
let isDhandaSignedIn = false;
let editingScheduleId = null;

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

function displayFlyerTitle(slug) {
  return slug.replace(/-/g, " ").replace(/\b\w/g, letter => letter.toUpperCase());
}

async function loadPartyFlyers() {
  const grid = document.querySelector("#flyer-grid");
  if (!grid) return;
  try {
    const client = await connectSupabase();
    if (!client) throw new Error("Supabase is not configured");
    const { data, error } = await client.storage.from(FLYER_BUCKET).list("", {
      limit: 100,
      sortBy: { column: "created_at", order: "desc" }
    });
    if (error) throw error;
    const todayParts = dateParts(new Date());
    const todayKey = `${todayParts.year}-${todayParts.month}-${todayParts.day}`;
    const flyers = (data || []).map(file => {
      const [date, slug, filename] = file.name.split("__");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "") || !slug || !filename) return null;
      const { data: publicFile } = client.storage.from(FLYER_BUCKET).getPublicUrl(file.name);
      return { ...file, date, title: displayFlyerTitle(slug), url: publicFile.publicUrl };
    }).filter(Boolean).sort((a, b) => {
      const aIsPast = a.date < todayKey;
      const bIsPast = b.date < todayKey;
      if (aIsPast !== bIsPast) return aIsPast ? 1 : -1;
      return aIsPast ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date);
    });
    grid.replaceChildren();
    if (!flyers.length) {
      const empty = document.createElement("p");
      empty.className = "flyer-empty";
      empty.textContent = "No event flyers published yet.";
      grid.append(empty);
      return;
    }
    for (const flyer of flyers) {
      const card = document.createElement("article");
      card.className = "flyer-card";
      const link = document.createElement("a");
      link.className = "flyer-image-link";
      link.href = flyer.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.setAttribute("aria-label", `View flyer: ${flyer.title}`);
      const image = document.createElement("img");
      image.src = flyer.url;
      image.alt = `${flyer.title} party flyer`;
      image.loading = "lazy";
      link.append(image);
      const info = document.createElement("div");
      info.className = "flyer-info";
      const date = document.createElement("span");
      date.className = "flyer-date";
      date.textContent = displayFlyerDate(flyer.date);
      const title = document.createElement("h3");
      title.textContent = flyer.title;
      info.append(date, title);
      card.append(link, info);
      if (isDhandaSignedIn) {
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "flyer-delete";
        remove.textContent = "REMOVE FLYER";
        remove.addEventListener("click", () => deletePartyFlyer(flyer.name, remove));
        card.append(remove);
      }
      grid.append(card);
    }
  } catch (error) {
    console.error("Could not load party flyers", error);
    grid.replaceChildren();
    const empty = document.createElement("p");
    empty.className = "flyer-empty";
    empty.textContent = "Party flyers will appear here soon.";
    grid.append(empty);
  }
}

async function publishPartyFlyer(event) {
  event.preventDefault();
  if (!isDhandaSignedIn) return;
  const message = document.querySelector("#flyer-message");
  const button = document.querySelector("#flyer-submit");
  const title = document.querySelector("#flyer-title").value.trim();
  const date = document.querySelector("#flyer-date").value;
  const file = document.querySelector("#flyer-file").files[0];
  if (!file || !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 10 * 1024 * 1024) {
    setMessage(message, "Choose a JPG, PNG, or WebP image up to 10 MB.", true);
    return;
  }
  const extension = ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" })[file.type];
  const slug = title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "party-flyer";
  const objectPath = `${date}__${slug}__${crypto.randomUUID()}.${extension}`;
  button.disabled = true;
  try {
    const client = await connectSupabase();
    if (!client) throw new Error("Supabase is not configured");
    const { error } = await client.storage.from(FLYER_BUCKET).upload(objectPath, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false
    });
    if (error) throw error;
    flyerForm.reset();
    setMessage(message, "Flyer published to the public gallery.");
    await loadPartyFlyers();
  } catch (error) {
    console.error("Could not publish party flyer", error);
    setMessage(message, "Could not publish. Confirm the flyer storage setup has been run in Supabase.", true);
  } finally {
    button.disabled = false;
  }
}

async function deletePartyFlyer(objectPath, button) {
  if (!isDhandaSignedIn || !supabaseClient) return;
  if (!window.confirm("Remove this flyer from the public gallery?")) return;
  button.disabled = true;
  try {
    const { error } = await supabaseClient.storage.from(FLYER_BUCKET).remove([objectPath]);
    if (error) throw error;
    await loadPartyFlyers();
  } catch (error) {
    console.error("Could not remove party flyer", error);
    button.disabled = false;
    window.alert("Could not remove flyer. Confirm the flyer storage setup has been run in Supabase.");
  }
}

function entriesForDate(date) {
  return scheduleEntries.filter(entry => entry.event_date === date).sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)));
}

function setScheduleFromEntries(entries) {
  scheduleEntries = entries.map(entry => ({ ...entry, start_time: String(entry.start_time).slice(0, 5), status: entry.status || "reserved" }));
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
  const next = scheduleEntries
    .filter(entry => entry.status === "available")
    .map(entry => ({ date: entry.event_date, time: entry.start_time, stamp: `${entry.event_date}T${entry.start_time}` }))
    .sort((a, b) => a.stamp.localeCompare(b.stamp))
    .find(slot => slot.stamp > nowKey);
  const heading = document.querySelector("#next-day");
  const time = document.querySelector("#next-time");
  const index = document.querySelector("#next-index");
  const subtitle = document.querySelector("#next-subtitle");
  const countdown = document.querySelector("#countdown");
  if (!next) {
    heading.textContent = "REQUEST A DATE";
    time.textContent = "—";
    index.textContent = "BY INQUIRY";
    subtitle.textContent = "SEND A BOOKING REQUEST";
    countdown.textContent = "PREFERRED DATES ARE WELCOME";
    return;
  }
  heading.textContent = humanDate(next.date).toUpperCase();
  time.textContent = timeLabel(next.time);
  index.textContent = `01 / ${new Intl.DateTimeFormat("en-US", { month: "short", timeZone: PACIFIC }).format(new Date(`${next.date}T12:00:00-07:00`)).toUpperCase()}`;
  subtitle.textContent = "AVAILABLE FOR BOOKING";
  const remaining = Math.max(0, pacificInstant(next.date, next.time).getTime() - Date.now());
  const days = Math.floor(remaining / 86400000);
  const hours = Math.floor(remaining % 86400000 / 3600000);
  const minutes = Math.floor(remaining % 3600000 / 60000);
  const seconds = Math.floor(remaining % 60000 / 1000);
  countdown.textContent = days ? `AVAILABLE IN ${days}D ${hours}H ${minutes}M` : `AVAILABLE IN ${hours}H ${minutes}M ${seconds}S`;
}

function showSelectedDay() {
  const entries = entriesForDate(selectedDate);
  dayTitle.textContent = humanDate(selectedDate, { weekday: "long", month: "long", day: "numeric" }).toUpperCase();
  dayCount.textContent = entries.length ? `${entries.length} TIME ${entries.length === 1 ? "SLOT" : "SLOTS"} · ${entries.filter(entry => entry.status === "available").length} AVAILABLE` : "No time slots posted. Send your preferred time to ask about availability.";
  dayEvents.replaceChildren();
  entries.forEach(entry => {
    const row = document.createElement("div");
    row.className = "day-event";
    const clock = document.createElement("time");
    clock.className = "event-time";
    clock.textContent = timeLabel(entry.start_time);
    const status = document.createElement("span");
    status.className = `slot-status status-${entry.status}`;
    status.textContent = statusLabel(entry.status);
    row.append(clock, status);
    if (entry.status === "available") {
      const request = document.createElement("button");
      request.type = "button";
      request.className = "slot-book";
      request.textContent = "BOOK";
      request.addEventListener("click", () => openBookingDialog(selectedDate, entry.start_time));
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
      pip.textContent = timeLabel(entry.start_time);
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
    const { data, error } = await client.from("schedule_events").select("id,event_date,start_time,status").order("event_date").order("start_time");
    if (error) throw error;
    setScheduleFromEntries(data);
    renderCalendar();
    setNext();
  } catch (error) {
    console.error("Could not load DHANDA schedule", error);
    document.querySelector("#day-count").textContent = "Could not load saved schedule. Please try again later.";
  }
}

function setAdminSession(isSignedIn) {
  authReady = true;
  isDhandaSignedIn = isSignedIn;
  document.querySelector("#admin-tools").hidden = !isSignedIn;
  document.querySelector("#login-open").hidden = isSignedIn;
  if (isSignedIn) loadBookingRequests();
  else document.querySelector("#request-count").textContent = "0";
  loadPartyFlyers();
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
  const status = document.querySelector("#schedule-status").value;
  try {
    const client = await connectSupabase();
    if (!client || !authReady || !isDhandaSignedIn) throw new Error("Admin access is not configured.");
    let lookup = client.from("schedule_events").select("id").eq("event_date", date).eq("start_time", `${time}:00`);
    if (editingScheduleId) lookup = lookup.neq("id", editingScheduleId);
    const { data: duplicate, error: lookupError } = await lookup.limit(1);
    if (lookupError) throw lookupError;
    if (duplicate.length) {
      setMessage(message, "Esse horário já está cadastrado nesse dia.", true);
      return;
    }
    const values = { event_date: date, start_time: `${time}:00`, status };
    const { error } = editingScheduleId
      ? await client.from("schedule_events").update(values).eq("id", editingScheduleId)
      : await client.from("schedule_events").insert(values);
    if (error) throw error;
    selectedDate = date;
    editingScheduleId = null;
    setMessage(message, "Horário e status atualizados na agenda pública.");
    await loadRemoteSchedule();
  } catch (error) {
    setMessage(message, "Não foi possível salvar. Confira sua sessão e tente novamente.", true);
  }
}

function openEditSlot(entry) {
  if (!isDhandaSignedIn || !entry.id) return;
  editingScheduleId = entry.id;
  document.querySelector("#add-date").value = entry.event_date;
  document.querySelector("#add-time").value = entry.start_time;
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
    contact.textContent = request.contact_name;
    const email = document.createElement("a");
    email.className = "request-email";
    email.href = `mailto:${request.contact_email}`;
    email.textContent = request.contact_email;
    const when = document.createElement("p");
    when.className = "request-when";
    when.textContent = `${humanDate(request.requested_date, { weekday: "long", month: "long", day: "numeric", year: "numeric" })} · ${timeLabel(String(request.requested_time).slice(0, 5))} SLT`;
    const message = document.createElement("p");
    message.className = "request-message";
    message.textContent = requestMessage || "No additional event details.";
    card.append(header, kind, contact, email, when, message);

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
      .select("id,club_name,contact_name,contact_email,requested_date,requested_time,message,status,created_at")
      .order("created_at", { ascending: false });
    if (error) throw error;
    document.querySelector("#request-count").textContent = String(data.filter(request => request.status === "pending").length);
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
  if (!window.confirm("Apagar esta solicitação? A mensagem será excluída, mas um horário já aceito continuará reservado na agenda.")) return;
  button.disabled = true;
  try {
    const { error } = await supabaseClient.from("booking_inquiries").delete().eq("id", requestId);
    if (error) throw error;
    await loadBookingRequests();
  } catch (error) {
    button.disabled = false;
    window.alert("Não foi possível apagar a mensagem. Confirme se a atualização de permissões de exclusão foi executada no Supabase.");
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
    const requestType = document.querySelector("#booking-type").value === "party" ? "Party / special event" : "Host booking";
    const details = document.querySelector("#booking-message").value.trim();
    const { error } = await client.from("booking_inquiries").insert({
      club_name: document.querySelector("#club-name").value.trim(),
      contact_name: document.querySelector("#contact-name").value.trim(),
      contact_email: document.querySelector("#contact-email").value.trim(),
      requested_date: document.querySelector("#requested-date").value,
      requested_time: `${document.querySelector("#requested-time").value}:00`,
      message: `Request type: ${requestType}\n---\n${details}`
    });
    if (error) throw error;
    bookingForm.reset();
    setMessage(message, "Request sent. DHANDA will review your booking inquiry.");
  } catch (error) {
    setMessage(message, "Não foi possível enviar agora. Tente novamente mais tarde.", true);
  }
}

function openBookingDialog(date = "", time = "") {
  const today = dateParts(new Date());
  document.querySelector("#requested-date").min = `${today.year}-${today.month}-${today.day}`;
  document.querySelector("#requested-date").value = date;
  document.querySelector("#requested-time").value = time;
  document.querySelector("#booking-type").value = "host";
  document.querySelector("#booking-message").placeholder = "Tell DHANDA about the booking.";
  setMessage(document.querySelector("#booking-message-status"), "");
  bookingDialog.showModal();
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
    if (!client || !authReady || !isDhandaSignedIn) throw new Error("Admin access is not configured.");
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
  editingScheduleId = null;
  showAdminForm(loginForm);
});
document.querySelector("#add-open").addEventListener("click", () => {
  editingScheduleId = null;
  document.querySelector("#add-date").value = selectedDate;
  document.querySelector("#add-time").value = "";
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
document.querySelector("#booking-open").addEventListener("click", openBookingDialog);
document.querySelector("#booking-requests-open").addEventListener("click", () => {
  if (!isDhandaSignedIn) return;
  loadBookingRequests();
  bookingRequestsDialog.showModal();
});
document.querySelector("#flyer-open").addEventListener("click", () => {
  if (!isDhandaSignedIn) return;
  flyerForm.reset();
  setMessage(document.querySelector("#flyer-message"), "");
  flyerDialog.showModal();
});
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
