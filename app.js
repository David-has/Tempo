(() => {
  "use strict";

  const $ = (selector, parent = document) => parent.querySelector(selector);
  const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];
  const root = document.documentElement;
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const store = {
    get(key) {
      try {
        return localStorage.getItem(key);
      } catch (error) {
        return null;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, value);
      } catch (error) {
        return;
      }
    },
    remove(key) {
      try {
        localStorage.removeItem(key);
      } catch (error) {
        return;
      }
    },
  };

  const state = {
    member: null,
    stats: { total: 0, leaderboard: [], votes: {} },
    pendingRef: new URLSearchParams(location.search).get("ref"),
    shownTotal: 0,
  };

  const escapeHtml = (value) =>
    String(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[char]);

  let toastTimer;

  function toast(message) {
    const element = $("#toast");
    element.textContent = message;
    element.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => element.classList.remove("show"), 3200);
  }

  function isDark() {
    const theme = root.getAttribute("data-theme");
    return theme ? theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  }

  function updateThemeIcon() {
    $("#themeIcon use").setAttribute("href", isDark() ? "#i-sun" : "#i-moon");
  }

  function initTheme() {
    const saved = store.get("tempo-theme");
    if (saved) root.setAttribute("data-theme", saved);
    updateThemeIcon();

    $("#themeBtn").addEventListener("click", () => {
      const next = isDark() ? "light" : "dark";
      root.setAttribute("data-theme", next);
      store.set("tempo-theme", next);
      updateThemeIcon();
    });
  }

  function countUp(element, target) {
    const from = state.shownTotal;
    state.shownTotal = target;

    if (reduceMotion || from === target) {
      element.textContent = target.toLocaleString("ro-RO");
      return;
    }

    const start = performance.now();
    const duration = 900;

    const step = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      element.textContent = Math.round(from + (target - from) * eased).toLocaleString("ro-RO");
      if (progress < 1) requestAnimationFrame(step);
    };

    requestAnimationFrame(step);
  }

  function inviteLink() {
    const base = `${location.origin}${location.pathname}`;
    return `${base}?ref=${state.member.code}`;
  }

  function renderCounter() {
    $$("[data-total]").forEach((element) => countUp(element, state.stats.total));
  }

  function renderSignup() {
    const box = $("#signup");

    if (!state.member) {
      box.innerHTML = `
        <h3>Prinde un loc în listă</h3>
        <p>Primești acces înaintea celorlalți și un link cu care urci în clasament.</p>
        <form class="join-form" id="joinForm" novalidate>
          <input id="email" type="email" placeholder="adresa@email.ro" autocomplete="email" aria-label="Adresa de email">
          <button class="btn" type="submit">Intră în listă</button>
          <p class="hint" id="hint" aria-live="polite"></p>
        </form>`;

      $("#joinForm").addEventListener("submit", handleJoin);
      return;
    }

    const message = encodeURIComponent(`Intră și tu în lista de așteptare Tempo: ${inviteLink()}`);

    box.innerHTML = `
      <div class="member">
        <div>
          <h3>Ești în listă!</h3>
          <p>Fiecare prieten care intră cu linkul tău te urcă în clasament.</p>
        </div>
        <div class="stats-row">
          <div class="stat-box"><span>Locul tău</span><b>#${state.member.position}</b></div>
          <div class="stat-box"><span>Prieteni invitați</span><b>${state.member.referrals}</b></div>
        </div>
        <div>
          <div class="copy-row">
            <input id="inviteInput" type="text" readonly value="${escapeHtml(inviteLink())}" aria-label="Linkul tău de invitație">
            <button id="copyBtn" type="button">Copiază</button>
          </div>
        </div>
        <a class="btn ghost" href="https://wa.me/?text=${message}" target="_blank" rel="noopener">Trimite pe WhatsApp</a>
      </div>`;

    $("#copyBtn").addEventListener("click", copyInvite);
  }

  async function copyInvite() {
    const link = inviteLink();

    try {
      await navigator.clipboard.writeText(link);
    } catch (error) {
      const input = $("#inviteInput");
      input.select();
      document.execCommand("copy");
    }

    toast("Linkul a fost copiat.");
  }

  function renderRewards() {
    const referrals = state.member ? state.member.referrals : 0;
    const top = Config.rewards[Config.rewards.length - 1].at;

    $("#progressBar").style.width = `${Math.min(100, (referrals / top) * 100)}%`;

    $("#rewards").innerHTML = Config.rewards
      .map((reward) => {
        const unlocked = referrals >= reward.at;
        return `
          <li class="reward ${unlocked ? "unlocked" : ""}">
            <span class="at">${unlocked ? "✓" : reward.at}</span>
            <div>
              <b>${reward.title}</b>
              <p>${reward.text}</p>
            </div>
          </li>`;
      })
      .join("");

    $("#rewardsNote").textContent = state.member
      ? `Ai invitat ${referrals} ${referrals === 1 ? "prieten" : "prieteni"}.`
      : "Intră în listă ca să începi să aduni invitații.";
  }

  function renderBoard() {
    $("#board").innerHTML = state.stats.leaderboard
      .map(
        (entry, index) => `
          <li>
            <span class="pos">${index + 1}</span>
            <span>${escapeHtml(entry.name)}</span>
            <b>${entry.referrals} invitați</b>
          </li>`
      )
      .join("");
  }

  function renderVotes() {
    const counts = state.stats.votes;
    const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
    const mine = state.member ? state.member.votes : [];

    $("#votes").innerHTML = Config.features
      .map((feature) => {
        const count = counts[feature.id] || 0;
        const percent = total ? Math.round((count / total) * 100) : 0;
        const active = mine.includes(feature.id);

        return `
          <article class="vote ${active ? "active" : ""}">
            <div class="vote-fill" style="width: ${percent}%"></div>
            <div class="vote-body">
              <h3>${feature.title}</h3>
              <p>${feature.text}</p>
            </div>
            <span class="vote-pct">${percent}%</span>
            <button type="button" data-feature="${feature.id}" aria-pressed="${active}">
              ${active ? "Votat" : "Votează"}
            </button>
          </article>`;
      })
      .join("");

    $("#voteNote").textContent = state.member
      ? `Ai folosit ${mine.length} din ${Config.maxVotes} voturi.`
      : `Fiecare membru are ${Config.maxVotes} voturi.`;
  }

  function renderAll() {
    renderCounter();
    renderSignup();
    renderRewards();
    renderBoard();
    renderVotes();
  }

  async function refreshStats() {
    try {
      state.stats = await Api.stats();
      if (state.member) {
        const fresh = await Api.member(state.member.code);
        if (fresh) state.member = fresh;
      }
      renderAll();
    } catch (error) {
      toast("Nu am putut actualiza datele.");
    }
  }

  async function handleJoin(event) {
    event.preventDefault();

    const input = $("#email");
    const hint = $("#hint");
    const button = $("button", event.target);
    const email = input.value.trim();

    if (!EMAIL_PATTERN.test(email)) {
      hint.textContent = "Introdu o adresă validă, de exemplu nume@email.ro.";
      input.focus();
      return;
    }

    hint.textContent = "";
    button.disabled = true;
    button.textContent = "Se salvează...";

    try {
      state.member = await Api.join(email, state.pendingRef);
      store.set("tempo-member", state.member.code);
      state.stats = await Api.stats();
      renderAll();
      launchConfetti();
      toast(`Bine ai venit! Ești pe locul #${state.member.position}.`);
    } catch (error) {
      hint.textContent = "Ceva n-a mers. Încearcă din nou.";
      button.disabled = false;
      button.textContent = "Intră în listă";
    }
  }

  async function handleVote(event) {
    const button = event.target.closest("[data-feature]");
    if (!button) return;

    if (!state.member) {
      toast("Intră în listă ca să poți vota.");
      $("#signup").scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    const id = button.dataset.feature;

    if (!state.member.votes.includes(id) && state.member.votes.length >= Config.maxVotes) {
      toast(`Poți vota maximum ${Config.maxVotes} funcții. Retrage un vot ca să alegi altceva.`);
      return;
    }

    button.disabled = true;

    try {
      state.member = await Api.vote(state.member.code, id);
      state.stats = await Api.stats();
      renderVotes();
    } catch (error) {
      toast("Votul nu a putut fi salvat.");
      button.disabled = false;
    }
  }

  function launchConfetti() {
    if (reduceMotion) return;

    const canvas = $("#confetti");
    const context = canvas.getContext("2d");
    canvas.width = innerWidth;
    canvas.height = innerHeight;

    const colors = ["#ff5a3c", "#7c3aed", "#fcd34d", "#22c55e", "#38bdf8"];
    const pieces = Array.from({ length: 110 }, () => ({
      x: innerWidth / 2,
      y: innerHeight * 0.35,
      vx: (Math.random() - 0.5) * 16,
      vy: Math.random() * -14 - 3,
      size: 5 + Math.random() * 6,
      color: colors[Math.floor(Math.random() * colors.length)],
      spin: Math.random() * 6,
    }));

    const start = performance.now();

    const frame = (now) => {
      const age = now - start;
      context.clearRect(0, 0, canvas.width, canvas.height);

      pieces.forEach((piece) => {
        piece.vy += 0.38;
        piece.x += piece.vx;
        piece.y += piece.vy;
        piece.spin += 0.2;
        context.save();
        context.translate(piece.x, piece.y);
        context.rotate(piece.spin);
        context.globalAlpha = Math.max(0, 1 - age / 2200);
        context.fillStyle = piece.color;
        context.fillRect(-piece.size / 2, -piece.size / 2, piece.size, piece.size * 0.6);
        context.restore();
      });

      if (age < 2200) requestAnimationFrame(frame);
      else context.clearRect(0, 0, canvas.width, canvas.height);
    };

    requestAnimationFrame(frame);
  }

  function bindEvents() {
    $("#votes").addEventListener("click", handleVote);

    $("#headerJoin").addEventListener("click", (event) => {
      event.preventDefault();
      $("#signup").scrollIntoView({ behavior: "smooth", block: "center" });
      const input = $("#email");
      if (input) setTimeout(() => input.focus(), 500);
    });

    $$("[data-scroll-signup]").forEach((link) =>
      link.addEventListener("click", (event) => {
        event.preventDefault();
        $("#signup").scrollIntoView({ behavior: "smooth", block: "center" });
      })
    );
  }

  async function start() {
    initTheme();
    bindEvents();
    $("#year").textContent = new Date().getFullYear();

    const savedCode = store.get("tempo-member");

    try {
      state.stats = await Api.stats();

      if (savedCode) {
        state.member = await Api.member(savedCode);
        if (!state.member) store.remove("tempo-member");
      }
    } catch (error) {
      toast("Nu m-am putut conecta la baza de date.");
    }

    renderAll();

    if (Api.mode === "supabase") setInterval(refreshStats, 30000);
  }

  start();
})();
