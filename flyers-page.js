const BUCKET = "dhanda-party-flyers";
const grid = document.querySelector("#public-flyer-grid");
const pacificDate = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" });
const displayDate = (value) => {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric", year: "numeric" }).format(new Date(Date.UTC(year, month - 1, day, 12)));
};

async function loadPublicFlyers() {
  try {
    const config = window.DHANDA_SUPABASE;
    if (!config?.url || !config?.anonKey) throw new Error("Flyer gallery is not configured.");
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const client = createClient(config.url, config.anonKey);
    const { data, error } = await client.from("party_flyers")
      .select("title,event_date,venue,landmark,description,object_path,sort_order")
      .eq("is_published", true)
      .order("sort_order")
      .order("event_date");
    if (error) throw error;
    const today = Object.fromEntries(pacificDate.formatToParts(new Date()).filter(part => part.type !== "literal").map(part => [part.type, part.value]));
    const todayKey = `${today.year}-${today.month}-${today.day}`;
    const flyers = (data || []).map(flyer => ({ ...flyer, url: client.storage.from(BUCKET).getPublicUrl(flyer.object_path).data.publicUrl }))
      .sort((a, b) => {
        const aPast = a.event_date < todayKey;
        const bPast = b.event_date < todayKey;
        if (aPast !== bPast) return aPast ? 1 : -1;
        return a.sort_order - b.sort_order || (aPast ? b.event_date.localeCompare(a.event_date) : a.event_date.localeCompare(b.event_date));
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
      image.alt = `${flyer.title} event flyer`;
      image.loading = "lazy";
      link.append(image);
      const info = document.createElement("div");
      info.className = "flyer-info";
      const date = document.createElement("span");
      date.className = "flyer-date";
      date.textContent = `${displayDate(flyer.event_date)}${flyer.event_date < todayKey ? " · PAST EVENT" : " · UPCOMING"}`;
      const title = document.createElement("h3");
      title.textContent = flyer.title;
      info.append(date, title);
      if (flyer.venue) { const venue = document.createElement("p"); venue.className = "flyer-meta"; venue.textContent = flyer.venue; info.append(venue); }
      if (flyer.landmark) { const landmark = document.createElement("p"); landmark.className = "flyer-meta"; landmark.textContent = flyer.landmark; info.append(landmark); }
      if (flyer.description) { const description = document.createElement("p"); description.className = "flyer-description"; description.textContent = flyer.description; info.append(description); }
      card.append(link, info);
      grid.append(card);
    }
  } catch (error) {
    console.error("Could not load published event flyers", error);
    grid.replaceChildren();
    const message = document.createElement("p");
    message.className = "flyer-empty";
    message.textContent = "The flyer gallery is temporarily unavailable. Please try again later.";
    grid.append(message);
  }
}

loadPublicFlyers();
