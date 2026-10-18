(() => {
  const clock = document.querySelector("#slt-clock");
  if (!clock) return;

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });

  const updateClock = () => {
    clock.textContent = formatter.format(new Date());
  };

  updateClock();
  window.setInterval(updateClock, 1000);
})();
