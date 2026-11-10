const STORAGE_KEY = "qonaqbook.entries.v1";
const form = document.querySelector("#entry-form");
const statusMessage = document.querySelector("#form-status");
const searchInput = document.querySelector("#entry-search");
const entriesList = document.querySelector("#entries-list");
const entryCount = document.querySelector("#entry-count");
const entriesTitle = document.querySelector("#entries-title");
const entriesEyebrow = document.querySelector("#entries-eyebrow");
const footerYear = document.querySelector("#footer-year");

footerYear.textContent = new Date().getFullYear();

function getTodayKey() {
  const now = new Date();
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
}

function loadEntries() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return [];

  const entries = JSON.parse(saved);
  if (!Array.isArray(entries)) {
    throw new Error("Сақталған жазбалардың пішімі дұрыс емес.");
  }
  return entries;
}

function saveEntries(entries) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function setFormStatus(message, isError = false) {
  statusMessage.textContent = message;
  statusMessage.classList.toggle("error", isError);
}

function formatDate(partitionKey) {
  return `${partitionKey.slice(6, 8)}.${partitionKey.slice(4, 6)}.${partitionKey.slice(0, 4)}`;
}

function createEntryCard(entry) {
  const card = document.createElement("article");
  card.className = "entry-card";

  if (entry.photoUrl) {
    const photo = document.createElement("img");
    photo.className = "entry-photo";
    photo.src = entry.photoUrl;
    photo.alt = `${entry.guestName} есімінің жанындағы фото`;
    photo.loading = "lazy";
    photo.referrerPolicy = "no-referrer";
    photo.addEventListener("error", () => {
      const avatar = document.createElement("span");
      avatar.className = "entry-avatar";
      avatar.textContent = entry.guestName.charAt(0).toLocaleUpperCase("kk-KZ");
      photo.replaceWith(avatar);
    }, { once: true });
    card.append(photo);
  } else {
    const avatar = document.createElement("span");
    avatar.className = "entry-avatar";
    avatar.textContent = entry.guestName.charAt(0).toLocaleUpperCase("kk-KZ");
    card.append(avatar);
  }

  const body = document.createElement("div");
  body.className = "entry-body";

  const meta = document.createElement("div");
  meta.className = "entry-meta";
  const name = document.createElement("h3");
  name.className = "entry-name";
  name.textContent = entry.guestName;
  const date = document.createElement("time");
  date.className = "entry-date";
  date.dateTime = `${entry.partitionKey.slice(0, 4)}-${entry.partitionKey.slice(4, 6)}-${entry.partitionKey.slice(6, 8)}`;
  date.textContent = formatDate(entry.partitionKey);
  meta.append(name, date);

  const message = document.createElement("p");
  message.className = "entry-message";
  message.textContent = entry.message;

  const actions = document.createElement("div");
  actions.className = "entry-actions";
  const deleteButton = document.createElement("button");
  deleteButton.className = "delete-button";
  deleteButton.type = "button";
  deleteButton.dataset.rowKey = entry.rowKey;
  deleteButton.textContent = "Жазбаны өшіру";
  actions.append(deleteButton);

  body.append(meta, message, actions);
  card.append(body);
  return card;
}

function renderEntries() {
  const allEntriesView = window.location.hash === "#all";
  const query = searchInput.value.trim().toLocaleLowerCase("kk-KZ");
  entriesTitle.textContent = allEntriesView ? "Барлық жазбалар" : "Қонақтардың жазбалары";
  entriesEyebrow.textContent = allEntriesView ? "Қонақтар қалдырған барлық лебіз" : "Бүгінгі лебіздер";
  document.querySelectorAll("[data-page-link]").forEach((link) => {
    if (link.dataset.pageLink === (allEntriesView ? "all" : "home")) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });

  try {
    const entries = loadEntries();
    const visibleEntries = entries
      .filter((entry) => allEntriesView || entry.partitionKey === getTodayKey())
      .filter((entry) => entry.guestName.toLocaleLowerCase("kk-KZ").includes(query))
      .sort((left, right) => right.partitionKey.localeCompare(left.partitionKey) || right.rowKey.localeCompare(left.rowKey));

    entryCount.textContent = String(visibleEntries.length);
    entriesList.replaceChildren();

    if (visibleEntries.length === 0) {
      const emptyState = document.createElement("p");
      emptyState.className = "empty-state";
      emptyState.textContent = query
        ? "Бұл есім бойынша жазбалар табылмады."
        : allEntriesView
          ? "Әзірге жазба жоқ. Алғашқы болып өз лебізіңізді қалдырыңыз!"
          : "Бүгін әлі жазба қалдырылмады. Алғашқы болып өз лебізіңізді қалдырыңыз!";
      entriesList.append(emptyState);
      return;
    }

    entriesList.append(...visibleEntries.map(createEntryCard));
  } catch (error) {
    entriesList.replaceChildren();
    entryCount.textContent = "!";
    const errorState = document.createElement("p");
    errorState.className = "empty-state";
    errorState.textContent = `Жазбаларды оқу мүмкін болмады: ${error.message}`;
    entriesList.append(errorState);
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(form);
  const guestName = String(formData.get("guestName") || "").trim();
  const message = String(formData.get("message") || "").trim();
  const photoUrl = String(formData.get("photoUrl") || "").trim();

  if (!guestName || !message) {
    setFormStatus("Есіміңіз бен хабарламаңызды толтырыңыз.", true);
    return;
  }

  if (photoUrl) {
    try {
      const parsedUrl = new URL(photoUrl);
      if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
        throw new Error("Фотоға тек http немесе https сілтемесін қолдануға болады.");
      }
    } catch (error) {
      setFormStatus(error.message || "Фото сілтемесінің пішімін тексеріңіз.", true);
      return;
    }
  }

  try {
    const entries = loadEntries();
    const rowKey = typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    entries.push({
      partitionKey: getTodayKey(),
      rowKey,
      guestName,
      message,
      photoUrl
    });
    saveEntries(entries);
    form.reset();
    setFormStatus("Жазбаңыз сәтті жарияланды. Рақмет!");
    renderEntries();
  } catch (error) {
    setFormStatus(`Жазбаны сақтау мүмкін болмады: ${error.message}`, true);
  }
});

entriesList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-row-key]");
  if (!button) return;
  if (!window.confirm("Бұл жазбаны өшіргіңіз келе ме?")) return;

  try {
    const entries = loadEntries();
    saveEntries(entries.filter((entry) => entry.rowKey !== button.dataset.rowKey));
    setFormStatus("Жазба өшірілді.");
    renderEntries();
  } catch (error) {
    setFormStatus(`Жазбаны өшіру мүмкін болмады: ${error.message}`, true);
  }
});

searchInput.addEventListener("input", renderEntries);
window.addEventListener("hashchange", renderEntries);

if (!window.location.hash) {
  window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#home`);
}
renderEntries();
