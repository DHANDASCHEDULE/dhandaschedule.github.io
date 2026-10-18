const form = document.querySelector("#booking-page-form");
const statusMessage = document.querySelector("#booking-message-status");
const minutes = (value) => { const [hours, mins] = value.split(":").map(Number); return hours * 60 + mins; };
const endMinutes = (start, end) => end === "00:00" && minutes(start) > 0 ? 24 * 60 : minutes(end);

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  statusMessage.classList.remove("is-error");
  if (document.querySelector("#booking-website").value) {
    statusMessage.textContent = "Booking request sent. DHANDA will review it.";
    form.reset();
    return;
  }
  const startTime = document.querySelector("#requested-time").value;
  const endTime = document.querySelector("#requested-end-time").value;
  if (!endTime || endMinutes(startTime, endTime) <= minutes(startTime)) {
    statusMessage.textContent = "The UNTIL time must be after the FROM time. Use 00:00 to indicate midnight.";
    statusMessage.classList.add("is-error");
    return;
  }
  const button = form.querySelector("button[type=submit]");
  button.disabled = true;
  try {
    const config = window.DHANDA_SUPABASE;
    if (!config?.url || !config?.anonKey) throw new Error("Booking is not configured.");
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const client = createClient(config.url, config.anonKey);
    const type = document.querySelector("#booking-type").value === "party" ? "Party / special event" : "Host booking";
    const message = document.querySelector("#booking-message").value.trim();
    const { error } = await client.from("booking_inquiries").insert({
      club_name: document.querySelector("#club-name").value.trim(),
      contact_name: document.querySelector("#sl-nick").value.trim(),
      contact_email: null,
      discord_handle: document.querySelector("#discord-handle").value.trim(),
      landmark: document.querySelector("#landmark").value.trim(),
      requested_date: document.querySelector("#requested-date").value,
      requested_time: `${startTime}:00`,
      requested_end_time: `${endTime}:00`,
      message: `Request type: ${type}\n---\n${message}`
    });
    if (error) throw error;
    form.reset();
    statusMessage.textContent = "Request sent. DHANDA will review your booking inquiry.";
  } catch (error) {
    console.error("Could not submit booking inquiry", error);
    statusMessage.textContent = error?.code === "23514"
      ? "The database still blocks 00:00 end times. Ask DHANDA to run the midnight-time SQL update."
      : "Could not send the request right now. Please try again later.";
    statusMessage.classList.add("is-error");
  } finally {
    button.disabled = false;
  }
});

document.querySelector("#booking-type").addEventListener("change", (event) => {
  document.querySelector("#booking-message").placeholder = event.target.value === "party"
    ? "Share the party name, occasion, and any details DHANDA should know."
    : "Tell DHANDA about the booking.";
});
