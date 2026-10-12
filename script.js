const schedule = {
  "2026-10-01": ["09:00", "10:30", "12:00", "13:00", "14:00", "15:00", "18:00"],
  "2026-10-02": ["09:00", "10:30", "12:00", "14:00", "15:00", "17:00", "18:00", "19:00"],
  "2026-10-03": ["10:00", "14:00", "15:00", "17:00"],
  "2026-10-04": ["11:00", "13:00", "15:00"],
  "2026-10-05": ["09:00", "12:00", "17:00"],
  "2026-10-06": ["09:00", "13:00", "14:30", "19:00"],
  "2026-10-07": ["09:00", "10:30", "12:00", "17:00"],
  "2026-10-08": ["12:00", "13:00", "14:00", "17:00", "18:00"],
  "2026-10-09": ["09:00", "10:30", "12:00", "13:00", "19:00"],
  "2026-10-10": ["09:00", "11:30", "14:00", "17:00", "19:00"],
  "2026-10-11": ["08:00", "11:00", "13:00"],
  "2026-10-12": ["09:00", "12:00", "14:00", "16:00", "17:00", "22:00"],
  "2026-10-13": ["09:00", "10:30", "14:30", "19:00", "21:00"],
  "2026-10-14": ["09:00", "10:30", "14:00", "17:00"],
  "2026-10-15": ["12:00", "13:00", "14:00", "17:00", "18:00"],
  "2026-10-16": ["09:00", "10:30", "12:00", "19:00"],
  "2026-10-17": ["10:00", "13:00", "15:00", "17:00"],
  "2026-10-18": ["11:00", "13:00"],
  "2026-10-19": ["09:00", "12:00", "17:00", "22:00"],
  "2026-10-20": ["09:00", "10:30", "14:30", "16:00", "19:00"],
  "2026-10-21": ["09:00", "10:30", "17:00"],
  "2026-10-22": ["12:00", "14:00", "18:00", "19:00"],
  "2026-10-23": ["09:00", "10:30", "12:00", "13:00", "19:00"],
  "2026-10-24": ["10:00", "13:00", "15:00", "17:00"],
  "2026-10-25": ["09:00", "11:00"],
  "2026-10-26": ["09:00", "12:00", "17:00", "22:00"],
  "2026-10-27": ["09:00", "10:30", "14:30", "16:00", "19:00", "21:00"],
  "2026-10-28": ["09:00", "10:30", "14:00", "17:00"],
  "2026-10-29": ["12:00", "14:00", "18:00"],
  "2026-10-30": ["09:00", "10:30", "12:00", "14:00", "18:00", "19:30"],
  "2026-10-31": ["10:00", "14:00", "15:00", "17:00"]
};

const pacificFormat = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
const dateParts = (date) => Object.fromEntries(pacificFormat.formatToParts(date).filter(part => part.type !== "literal").map(part => [part.type, part.value]));
const toKey = (year, month, day) => `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
const allSets = Object.entries(schedule).flatMap(([date, times]) => times.map(time => ({ date, time, stamp: `${date}T${time}:00` }))).sort((a, b) => a.stamp.localeCompare(b.stamp));
let viewedMonth = new Date(2026, 9, 1);
let selectedDate = "2026-10-12";

const monthLabel = document.querySelector("#month-label");
const calendarGrid = document.querySelector("#calendar-grid");
const dayTitle = document.querySelector("#selected-date");
const dayCount = document.querySelector("#day-count");
const dayEvents = document.querySelector("#day-events");

function timeLabel(time) {
  const [hour, minute] = time.split(":").map(Number);
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${String(minute).padStart(2, "0")} ${period}`;
}

function humanDate(key, options = { weekday: "long", month: "long", day: "numeric" }) {
  return new Intl.DateTimeFormat("en-US", { ...options, timeZone: "America/Los_Angeles" }).format(new Date(`${key}T12:00:00-07:00`));
}

function setNext() {
  const parts = dateParts(new Date());
  const todayKey = `${parts.year}-${parts.month}-${parts.day}`;
  const nowMinutes = Number(parts.hour) * 60 + Number(parts.minute);
  const next = allSets.find(set => set.date > todayKey || (set.date === todayKey && Number(set.time.slice(0, 2)) * 60 + Number(set.time.slice(3)) > nowMinutes));
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
    countdown.textContent = "OCTOBER 2026";
    return;
  }
  selectedDate = next.date;
  heading.textContent = humanDate(next.date).toUpperCase();
  time.textContent = timeLabel(next.time);
  index.textContent = `01 / ${new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "America/Los_Angeles" }).format(new Date(`${next.date}T12:00:00-07:00`)).toUpperCase()}`;
  subtitle.textContent = "DHANDA / SCHEDULED SET";
  const target = new Date(`${next.date}T${next.time}:00-07:00`);
  const remaining = Math.max(0, target.getTime() - Date.now());
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

document.querySelector("#previous-month").addEventListener("click", () => { viewedMonth = new Date(viewedMonth.getFullYear(), viewedMonth.getMonth() - 1, 1); renderCalendar(); });
document.querySelector("#next-month").addEventListener("click", () => { viewedMonth = new Date(viewedMonth.getFullYear(), viewedMonth.getMonth() + 1, 1); renderCalendar(); });
document.querySelector("#today-button").addEventListener("click", () => {
  const parts = dateParts(new Date());
  viewedMonth = new Date(Number(parts.year), Number(parts.month) - 1, 1);
  selectedDate = `${parts.year}-${parts.month}-${parts.day}`;
  renderCalendar();
});

setNext();
renderCalendar();
window.setInterval(setNext, 1000);
