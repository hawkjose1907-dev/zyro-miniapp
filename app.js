(() => {
  "use strict";

  // ==========================================
  // ZYRO MINI APP
  // ==========================================

  const tg = window.Telegram?.WebApp;

  try {
    tg?.ready();
    tg?.expand();
    tg?.setHeaderColor?.("#080b12");
    tg?.setBackgroundColor?.("#080b12");
  } catch (error) {
    console.warn("Telegram initialization:", error);
  }

  const $ = (id) => document.getElementById(id);

  const BOT_USERNAME = "zyrominiappbot";

  const TON_MANIFEST =
    "https://zyro-miniapp.vercel.app/tonconnect-manifest.json";

  const state = {
    user: null,
    tasks: [],
    view: "home",
    referralCount: 0,
    tonWallet: null,
    tonUI: null,
    tonInitPromise: null
  };

  const initData = tg?.initData || "";

  const startParam =
    tg?.initDataUnsafe?.start_param ||
    new URLSearchParams(location.search).get("startapp") ||
    new URLSearchParams(location.search).get("ref") ||
    "";

  // ==========================================
  // HELPERS
  // ==========================================

  function notice(message) {
    const el = $("notice");
    if (el) el.textContent = message || "";
  }

  function fmt(value) {
    return Number(value || 0).toLocaleString(undefined, {
      maximumFractionDigits: 4
    });
  }

  function setBalance(value) {
    const el = $("balance");

    if (el) {
      el.textContent = fmt(value);
    }

    if (state.user) {
      state.user.balance = Number(value || 0);
    }
  }

  // ==========================================
  // API
  // ==========================================

  async function api(path, body = {}) {
    if (!initData) {
      throw new Error("Please open ZYRO inside Telegram.");
    }

    const response = await fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Init-Data": initData
      },
      body: JSON.stringify(body)
    });

    const data = await response.json().catch(() => ({
      error: "Invalid server response."
    }));

    if (!response.ok) {
      throw new Error(
        data.error || `Request failed (${response.status})`
      );
    }

    return data;
  }

  // ==========================================
  // USER
  // ==========================================

  function setUser(user) {
    if (!user) {
      throw new Error("User information could not be loaded.");
    }

    state.user = user;

    setBalance(user.balance);

    const greeting = $("greeting");

    if (greeting) {
      greeting.textContent =
        `Welcome, ${user.first_name || "ZYRO member"}`;
    }
  }

  // ==========================================
  // DAILY CHECK-IN
  // ==========================================

  function setCheckin(canClaim, reward, message) {
    const button = $("checkin-btn");
    const copy = $("checkin-copy");

    if (button) {
      button.disabled = !canClaim;

      button.textContent = canClaim
        ? `Claim ${fmt(reward)} ZYRO`
        : "Claimed";
    }

    if (copy) {
      copy.textContent =
        message ||
        (canClaim
          ? "Your daily reward is ready."
          : "Your next daily reward will be available tomorrow.");
    }
  }

  // ==========================================
  // OPEN LINKS
  // ==========================================

  function openTaskLink(url) {
    if (!url) {
      notice("Task link is not available.");
      return;
    }

    try {
      if (url.includes("t.me/") && tg?.openTelegramLink) {
        tg.openTelegramLink(url);
      } else if (tg?.openLink) {
        tg.openLink(url);
      } else {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    } catch (error) {
      window.location.href = url;
    }
  }

  // ==========================================
  // NAVIGATION
  // ==========================================

  function activate(view) {
    const allowed = [
      "home",
      "tasks",
      "friends",
      "leaderboard",
      "profile"
    ];

    if (!allowed.includes(view)) {
      view = "home";
    }

    state.view = view;

    const home = $("home-view");
    const content = $("content-view");

    document.querySelectorAll(".nav-item").forEach((button) => {
      button.classList.toggle(
        "active",
        button.dataset.view === view
      );
    });

    if (view === "home") {
      if (home) home.hidden = false;
      if (content) content.hidden = true;
    } else {
      if (home) home.hidden = true;
      if (content) content.hidden = false;

      if (view === "tasks") renderTasks();
      if (view === "friends") renderFriends();
      if (view === "leaderboard") renderLeaderboard();
      if (view === "profile") renderProfile();
    }

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }

  // ==========================================
  // TASK ICONS
  // ==========================================

  const telegramIcon = `
    <svg viewBox="0 0 48 48" width="38" height="38"
      xmlns="http://www.w3.org/2000/svg">
      <circle cx="24" cy="24" r="24" fill="#229ED9"/>
      <path d="M36.8 13.1 32.4 34c-.3 1.5-1.2 1.9-2.4 1.2l-7-5.2-3.4 3.3c-.4.4-.7.7-1.4.7l.5-7.1 13-11.7c.6-.5-.1-.8-.9-.3L14.7 25.1l-6.9-2.2c-1.5-.5-1.5-1.5.3-2.2l27-10.4c1.2-.4 2.2.3 1.7 2.8Z"
        fill="#FFFFFF"/>
    </svg>
  `;

  const xIcon = `
    <svg viewBox="0 0 48 48" width="38" height="38"
      xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="48" rx="12" fill="#000000"/>
      <path d="M27.4 21.8 38.1 9h-3.8l-8.6 10.3L18.8 9H8l11.2 16.3L8 39h3.8l9.2-11 7.7 11H40L27.4 21.8Z"
        fill="#FFFFFF"/>
    </svg>
  `;

  // ==========================================
  // TASKS
  // ==========================================

  function renderTasks() {
    const box = $("content-view");
    if (!box) return;

    box.innerHTML = "<h3>Available Tasks</h3>";

    if (!state.tasks.length) {
      box.insertAdjacentHTML(
        "beforeend",
        '<div class="empty">There are no active tasks yet. Please check back later.</div>'
      );
      return;
    }

    state.tasks.forEach((task) => {
      const row = document.createElement("div");
      row.className = "list-row";

      const info = document.createElement("div");

      if (
        task.task_type === "telegram_join" ||
        task.task_type === "x_follow"
      ) {
        info.style.display = "flex";
        info.style.alignItems = "center";
        info.style.gap = "12px";

        const icon = document.createElement("div");

        icon.innerHTML =
          task.task_type === "telegram_join"
            ? telegramIcon
            : xIcon;

        icon.style.width = "38px";
        icon.style.height = "38px";
        icon.style.flexShrink = "0";

        const textInfo = document.createElement("div");

        textInfo.innerHTML = "<strong></strong><small></small>";

        textInfo.querySelector("strong").textContent =
          task.title || "ZYRO Task";

        textInfo.querySelector("small").textContent =
          `Reward: ${fmt(task.reward)} ZYRO`;

        info.append(icon, textInfo);
      } else {
        info.innerHTML = "<strong></strong><small></small>";

        info.querySelector("strong").textContent =
          task.title || "ZYRO Task";

        info.querySelector("small").textContent =
          `Reward: ${fmt(task.reward)} ZYRO`;
      }

      const button = document.createElement("button");
      button.className = "row-action";

      let opened = false;

      if (task.completed) {
        button.textContent = "Completed ✓";
        button.disabled = true;
      } else if (task.task_type === "telegram_join") {
        button.textContent = "Open channel";
      } else if (task.task_type === "x_follow") {
        button.textContent = "Follow on X";
      } else {
        button.textContent = "Open task";
      }

      button.addEventListener("click", async () => {
        if (task.completed) return;

        // TELEGRAM TASK

        if (task.task_type === "telegram_join") {
          if (!opened) {
            if (!task.task_url) {
              notice("Channel link is missing.");
              return;
            }

            openTaskLink(task.task_url);

            opened = true;
            button.textContent = "Verify membership";

            notice(
              "Join the channel, then tap Verify membership."
            );

            return;
          }

          button.disabled = true;
          button.textContent = "Checking…";

          try {
            const result = await api("/api/complete-task", {
              taskId: task.id
            });

            setBalance(result.balance);

            task.completed = true;

            button.textContent = "Completed ✓";

            notice(
              `+${fmt(result.reward)} ZYRO added.`
            );
          } catch (error) {
            button.disabled = false;
            button.textContent = "Verify membership";
            notice(error.message);
          }

          return;
        }

        // X TASK

        if (task.task_type === "x_follow") {
          if (!opened) {
            openTaskLink(task.task_url);

            opened = true;

            button.textContent =
              `Claim ${fmt(task.reward)} ZYRO`;

            notice(
              "You can now claim your X task reward."
            );

            return;
          }

          button.disabled = true;
          button.textContent = "Claiming…";

          try {
            const result = await api("/api/complete-task", {
              taskId: task.id
            });

            setBalance(result.balance);

            task.completed = true;

            button.textContent = "Completed ✓";

            notice(
              `+${fmt(result.reward)} ZYRO added to your balance.`
            );
          } catch (error) {
            button.disabled = false;

            button.textContent =
              `Claim ${fmt(task.reward)} ZYRO`;

            notice(error.message);
          }

          return;
        }

        // OTHER TASKS

        if (task.task_url) {
          openTaskLink(task.task_url);
        } else {
          notice("Task link is not available.");
        }
      });

      row.append(info, button);
      box.append(row);
    });
  }

  // ==========================================
  // FRIENDS / REFERRALS
  // ==========================================

  function renderFriends() {
    const box = $("content-view");
    if (!box) return;

    box.innerHTML = "<h3>Invite Friends</h3>";

    const link = state.user?.referral_code
      ? `https://t.me/${BOT_USERNAME}?startapp=ref_${state.user.referral_code}`
      : "";

    const description = document.createElement("p");

    description.className = "empty";
    description.textContent =
      "Invite your friends and grow the ZYRO community.";

    box.append(description);

    const row = document.createElement("div");
    row.className = "list-row";

    const info = document.createElement("div");

    info.innerHTML =
      "<strong>Your invite link</strong><small></small>";

    info.querySelector("small").textContent =
      link || "Not available";

    const button = document.createElement("button");

    button.className = "row-action";
    button.textContent = "Share";

    button.addEventListener("click", async () => {
      if (!link) {
        notice("Invite link is not available.");
        return;
      }

      const message = "Join me on ZYRO! 🚀";

      const shareUrl =
        `https://t.me/share/url?url=${encodeURIComponent(link)}` +
        `&text=${encodeURIComponent(message)}`;

      try {
        if (tg?.openTelegramLink) {
          tg.openTelegramLink(shareUrl);
          notice("Choose a Telegram chat to share ZYRO.");
          return;
        }

        if (navigator.share) {
          await navigator.share({
            title: "Join ZYRO",
            text: message,
            url: link
          });

          notice("Share completed.");
          return;
        }

        await navigator.clipboard.writeText(link);
        notice("Invite link copied!");
      } catch (error) {
        if (error.name === "AbortError") return;

        notice("Unable to share. Please copy your invite link.");
      }
    });

    row.append(info, button);
    box.append(row);

    const count = document.createElement("div");
    count.className = "profile-info";

    const label = document.createElement("span");
    label.textContent = "Successful invites";

    const value = document.createElement("strong");
    value.textContent = String(state.referralCount);

    count.append(label, value);
    box.append(count);

    const rewardInfo = document.createElement("div");

    rewardInfo.className = "empty";
    rewardInfo.textContent =
      "Earn 100 ZYRO for every friend who completes their first daily check-in.";

    box.append(rewardInfo);
  }

  // ==========================================
  // LEADERBOARD
  // ==========================================

  async function renderLeaderboard() {
    const box = $("content-view");
    if (!box) return;

    box.innerHTML =
      "<h3>🏆 Top 100 ZYRO</h3>" +
      '<div class="empty">Loading rankings…</div>';

    try {
      const data = await api("/api/leaderboard");

      box.innerHTML = "<h3>🏆 Top 100 ZYRO</h3>";

      const members = (data.members || []).slice(0, 100);

      if (!members.length) {
        box.insertAdjacentHTML(
          "beforeend",
          '<div class="empty">No members yet.</div>'
        );

        return;
      }

      members.forEach((member, index) => {
        const rank = index + 1;

        const row = document.createElement("div");
        row.className = "list-row";

        if (rank <= 3) {
          row.classList.add("top-rank");
        }

        row.innerHTML = `
          <div class="rank-user">
            <span class="rank-medal"></span>
            <div>
              <strong></strong>
              <small></small>
            </div>
          </div>
          <strong class="rank-balance"></strong>
        `;

        const medal = row.querySelector(".rank-medal");

        if (rank === 1) medal.textContent = "🥇";
        else if (rank === 2) medal.textContent = "🥈";
        else if (rank === 3) medal.textContent = "🥉";
        else medal.textContent = `#${rank}`;

        row.querySelector(
          ".rank-user div strong"
        ).textContent = member.first_name || "ZYRO member";

        row.querySelector(
          ".rank-user div small"
        ).textContent = rank <= 3 ? "" : `Rank #${rank}`;

        row.querySelector(
          ".rank-balance"
        ).textContent = `${fmt(member.balance)} ZYRO`;

        box.append(row);
      });
    } catch (error) {
      box.innerHTML = "<h3>🏆 Top 100 ZYRO</h3>";

      const message = document.createElement("div");

      message.className = "empty";
      message.textContent = error.message;

      box.append(message);
    }
  }

  // ==========================================
  // PROFILE
  // ==========================================

  function renderProfile() {
    const box = $("content-view");
    if (!box) return;

    box.innerHTML = "<h3>Your Profile</h3>";

    const row = document.createElement("div");
    row.className = "profile-line";

    if (state.user?.photo_url) {
      const image = document.createElement("img");

      image.className = "avatar";
      image.src = state.user.photo_url;
      image.alt = "Profile";

      row.append(image);
    }

    const text = document.createElement("div");

    text.innerHTML = "<strong></strong><small></small>";

    text.querySelector("strong").textContent =
      state.user?.first_name || "ZYRO member";

    text.querySelector("small").textContent =
      state.user?.username
        ? `@${state.user.username}`
        : "Telegram member";

    row.append(text);
    box.append(row);

    const balance = document.createElement("div");

    balance.className = "profile-info";
    balance.innerHTML =
      "<span>ZYRO Balance</span><strong></strong>";

    balance.querySelector("strong").textContent =
      `${fmt(state.user?.balance)} ZYRO`;

    box.append(balance);

    const referral = document.createElement("div");

    referral.className = "profile-info";
    referral.innerHTML =
      "<span>Successful invites</span><strong></strong>";

    referral.querySelector("strong").textContent =
      String(state.referralCount);

    box.append(referral);
  }

  // ==========================================
  // TON CONNECT
  // ==========================================

  function shortenAddress(address) {
    if (!address) return "";

    if (address.length <= 16) return address;

    return (
      address.substring(0, 6) +
      "..." +
      address.substring(address.length - 6)
    );
  }

  function updateHeaderWalletButton() {
    const button = $("ton-header-button");
    const label = $("ton-header-label");

    if (!button || !label) return;

    const wallet =
      state.tonWallet ||
      state.tonUI?.wallet ||
      null;

    const address = wallet?.account?.address;

    if (address) {
      label.textContent = shortenAddress(address);

      button.classList.add("wallet-connected");
      button.title = address;

      button.setAttribute(
        "aria-label",
        `Connected TON wallet ${address}. Tap to disconnect.`
      );
    } else {
      label.textContent = "CONNECT";

      button.classList.remove("wallet-connected");
      button.title = "Connect TON Wallet";

      button.setAttribute(
        "aria-label",
        "Connect TON Wallet"
      );
    }
  }

  async function initializeTonConnect() {
    if (state.tonUI) {
      return state.tonUI;
    }

    if (state.tonInitPromise) {
      return state.tonInitPromise;
    }

    state.tonInitPromise = (async () => {
      let library = window.TON_CONNECT_UI;

      // Wait for CDN library if it has not loaded yet.
      for (let i = 0; i < 20 && !library?.TonConnectUI; i++) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        library = window.TON_CONNECT_UI;
      }

      if (!library?.TonConnectUI) {
        throw new Error(
          "TON Connect library could not be loaded. Please refresh."
        );
      }

      const ui = new library.TonConnectUI({
        manifestUrl: TON_MANIFEST,
        uiPreferences: {
          theme: "DARK",
          borderRadius: "m"
        }
      });

      state.tonUI = ui;

      ui.onStatusChange((wallet) => {
        state.tonWallet = wallet || null;
        updateHeaderWalletButton();
      });

      try {
        await ui.connectionRestored;

        state.tonWallet = ui.wallet || null;
        updateHeaderWalletButton();
      } catch (error) {
        console.warn("TON connection restore:", error);
      }

      return ui;
    })();

    try {
      return await state.tonInitPromise;
    } catch (error) {
      state.tonInitPromise = null;
      throw error;
    }
  }

  async function handleHeaderWalletClick() {
    const button = $("ton-header-button");
    if (!button) return;

    button.disabled = true;
    button.classList.add("wallet-loading");

    try {
      const ui = await initializeTonConnect();

      const wallet =
        state.tonWallet ||
        ui.wallet ||
        null;

      if (wallet?.account?.address) {
        await ui.disconnect();

        state.tonWallet = null;

        updateHeaderWalletButton();

        notice("TON wallet disconnected.");
      } else {
        await ui.openModal();
      }
    } catch (error) {
      console.error("TON Connect:", error);
      notice(error.message || "Unable to connect TON wallet.");
    } finally {
      button.disabled = false;
      button.classList.remove("wallet-loading");

      updateHeaderWalletButton();
    }
  }

  // ==========================================
  // DAILY REWARD BUTTON
  // ===================================
