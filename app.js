(() => {
  const tg = window.Telegram?.WebApp;

  try {
    tg?.ready();
    tg?.expand();
    tg?.setHeaderColor?.("#080b12");
    tg?.setBackgroundColor?.("#080b12");
  } catch (_) {}

  const $ = (id) => document.getElementById(id);

  const state = {
    user: null,
    tasks: [],
    view: "home",
    referralCount: 0
  };

  const initData = tg?.initData || "";

  const startParam =
    tg?.initDataUnsafe?.start_param ||
    new URLSearchParams(location.search).get("ref") ||
    "";

  const notice = (msg) => {
    $("notice").textContent = msg || "";
  };

  const fmt = (n) =>
    Number(n || 0).toLocaleString(undefined, {
      maximumFractionDigits: 4
    });

  // API REQUEST
  async function api(path, body = {}) {
    const res = await fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Init-Data": initData
      },
      body: JSON.stringify(body)
    });

    const data = await res.json().catch(() => ({
      error: "Invalid server response"
    }));

    if (!res.ok) {
      throw new Error(data.error || "Request failed");
    }

    return data;
  }

  // OPEN TELEGRAM CHANNEL OR EXTERNAL LINK
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

  function setBalance(value) {
    $("balance").textContent = fmt(value);
  }

  function setUser(user) {
    state.user = user;

    setBalance(user.balance);

    const name =
      user.first_name ||
      user.username ||
      "ZYRO member";

    $("greeting").textContent = `Welcome, ${name}`;
  }

  function setCheckin(canClaim, reward, message) {
    $("checkin-btn").disabled = !canClaim;

    $("checkin-btn").textContent = canClaim
      ? `Claim ${fmt(reward)} ZYRO`
      : "Claimed";

    $("checkin-copy").textContent =
      message ||
      (canClaim
        ? "Your daily reward is ready."
        : "Your next daily reward will be available tomorrow.");
  }

  // NAVIGATION
  function activate(view) {
    state.view = view;

    document.querySelectorAll(".nav-item").forEach((button) => {
      button.classList.toggle(
        "active",
        button.dataset.view === view
      );
    });

    const box = $("content-view");

    if (view === "home") {
      box.hidden = true;
      return;
    }

    box.hidden = false;

    if (view === "tasks") renderTasks();
    if (view === "friends") renderFriends();
    if (view === "leaderboard") renderLeaderboard();
    if (view === "profile") renderProfile();

    box.scrollIntoView({
      behavior: "smooth",
      block: "nearest"
    });
  }

  // TASKS
  function renderTasks() {
    const box = $("content-view");

    box.innerHTML = "<h3>Available tasks</h3>";

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

      info.innerHTML = "<strong></strong><small></small>";

      info.querySelector("strong").textContent = task.title;

      info.querySelector("small").textContent =
        `Reward: ${fmt(task.reward)} ZYRO`;

      const btn = document.createElement("button");

      btn.className = "row-action";

      btn.textContent = task.completed
        ? "Completed"
        : task.task_type === "telegram_join"
          ? "Open channel"
          : "Open task";

      btn.disabled = !!task.completed;

      let opened = false;

      btn.onclick = async () => {

        // FIRST CLICK: OPEN CHANNEL
        if (task.task_type === "telegram_join" && !opened) {

          if (!task.task_url) {
            notice("Channel link is missing.");
            return;
          }

          openTaskLink(task.task_url);

          opened = true;

          btn.textContent = "Verify membership";

          notice("Join the channel, then tap Verify membership.");

          return;
        }

        // SECOND CLICK: VERIFY MEMBERSHIP
        if (task.task_type === "telegram_join") {

          btn.disabled = true;
          btn.textContent = "Checking…";

          try {
            const result = await api(
              "/api/complete-task",
              {
                taskId: task.id
              }
            );

            setBalance(result.balance);

            task.completed = true;

            btn.textContent = "Completed";

            notice(
              `+${fmt(result.reward)} ZYRO added.`
            );

          } catch (error) {

            btn.disabled = false;

            btn.textContent = "Verify membership";

            notice(error.message);
          }

          return;
        }

        // OTHER TASK LINKS
        if (task.task_url) {
          openTaskLink(task.task_url);
        } else {
          notice("Task link is not available.");
        }
      };

      row.append(info, btn);

      box.append(row);
    });
  }

  // FRIENDS
  function renderFriends() {
    const box = $("content-view");

    box.innerHTML = "<h3>Invite friends</h3>";

    const link = state.user?.referral_code
      ? `https://t.me/zyrobot?startapp=ref_${state.user.referral_code}`
      : "";

    const p = document.createElement("p");

    p.className = "empty";

    p.textContent =
      "Invite friends to join the ZYRO community. Referral rewards will be enabled after the reward rules are configured.";

    box.append(p);

    const row = document.createElement("div");

    row.className = "list-row";

    const info = document.createElement("div");

    info.innerHTML = "<strong>Your invite link</strong><small></small>";

    info.querySelector("small").textContent =
      link || "Not available";

    const btn = document.createElement("button");

    btn.className = "row-action";

    btn.textContent = "Share";

    btn.onclick = () => {
      if (!link) return;

      const share =
        `https://t.me/share/url?url=${encodeURIComponent(link)}` +
        `&text=${encodeURIComponent("Join me on ZYRO!")}`;

      if (tg?.openTelegramLink) {
        tg.openTelegramLink(share);
      } else {
        window.open(share, "_blank", "noopener,noreferrer");
      }
    };

    row.append(info, btn);

    box.append(row);

    const count = document.createElement("div");

    count.className = "empty";

    count.textContent =
      `Successful invites: ${state.referralCount}`;

    box.append(count);
  }

  // LEADERBOARD
  async function renderLeaderboard() {
    const box = $("content-view");

    box.innerHTML =
      "<h3>Leaderboard</h3><div class='empty'>Loading members…</div>";

    try {
      const data = await api("/api/leaderboard");

      box.innerHTML = "<h3>Leaderboard</h3>";

      if (!data.members?.length) {
        box.insertAdjacentHTML(
          "beforeend",
          '<div class="empty">No members yet.</div>'
        );
        return;
      }

      data.members.forEach((member, index) => {

        const row = document.createElement("div");

        row.className = "list-row";

        row.innerHTML =
          "<div><strong></strong><small></small></div><strong></strong>";

        row.querySelector("div strong").textContent =
          member.username
            ? `@${member.username}`
            : member.first_name || "ZYRO member";

        row.querySelector("small").textContent =
          `Rank #${index + 1}`;

        row.lastElementChild.textContent =
          `${fmt(member.balance)} ZYRO`;

        box.append(row);
      });

    } catch (error) {

      box.innerHTML = "<h3>Leaderboard</h3>";

      const message = document.createElement("div");

      message.className = "empty";

      message.textContent = error.message;

      box.append(message);
    }
  }

  // PROFILE
  function renderProfile() {
    const box = $("content-view");

    box.innerHTML = "<h3>Your profile</h3>";

    const row = document.createElement("div");

    row.className = "profile-line";

    if (state.user?.photo_url) {

      const img = document.createElement("img");

      img.className = "avatar";

      img.src = state.user.photo_url;

      img.alt = "Profile";

      row.append(img);
    }

    const txt = document.createElement("div");

    txt.innerHTML = "<strong></strong><small></small>";

    txt.querySelector("strong").textContent =
      state.user?.first_name || "ZYRO member";

    txt.querySelector("small").textContent =
      state.user?.username
        ? `@${state.user.username}`
        : "Telegram member";

    row.append(txt);

    box.append(row);

    const note = document.createElement("div");

    note.className = "empty";

    note.textContent =
      "Your ZYRO balance is an internal app record. Telegram account age is not provided by the standard Mini App profile and is not shown as verified.";

    box.append(note);
  }

  // NAVIGATION BUTTONS
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      activate(button.dataset.view);
    });
  });

  // DAILY CHECK-IN
  $("checkin-btn").addEventListener("click", async () => {

    $("checkin-btn").disabled = true;

    notice("Processing your daily reward…");

    try {

      const data = await api("/api/checkin");

      setBalance(data.balance);

      setCheckin(
        false,
        0,
        "Your daily reward has been added."
      );

      notice(
        `+${fmt(data.reward)} ZYRO added to your balance.`
      );

    } catch (error) {

      notice(error.message);

      $("checkin-btn").disabled = false;
    }
  });

  // INITIALIZE APP
  async function boot() {

    if (!initData) {

      $("greeting").textContent =
        "Open ZYRO in Telegram";

      setCheckin(
        false,
        0,
        "Please launch this app from @zyrobot in Telegram."
      );

      notice("Telegram authentication is required.");

      return;
    }

    try {

      const data = await api(
        "/api/me",
        {
          startParam
        }
      );

      setUser(data.user);

      state.tasks = data.tasks || [];

      state.referralCount =
        data.referralCount || 0;

      setCheckin(
        data.canClaimDaily,
        data.dailyReward,
        data.canClaimDaily
          ? "Your daily reward is ready."
          : "You have already checked in today."
      );

    } catch (error) {

      notice(error.message);

      $("greeting").textContent =
        "Unable to load your account";

      setCheckin(
        false,
        0,
        "Please try again later."
      );
    }
  }

  boot();

})();
