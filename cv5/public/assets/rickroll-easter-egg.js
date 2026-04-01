(() => {
  const IMAGE_URL = "https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg";
  const AUDIO_URL = "/assets/rickroll.mp3";

  let overlayEl;
  let toastEl;
  let toastTimer;
  let audioEl;

  const ensureOverlay = () => {
    if (overlayEl) {
      return overlayEl;
    }

    const overlay = document.createElement("div");
    overlay.className = "rickroll-overlay";
    overlay.innerHTML = `
      <div class="rickroll-card" role="dialog" aria-label="Rickroll surprise" aria-modal="true">
        <img src="${IMAGE_URL}" alt="Rick Astley in Never Gonna Give You Up">
        <div class="rickroll-caption">
          <p>Surprise Rickroll unlocked.</p>
          <button type="button" class="rickroll-close">Close</button>
        </div>
      </div>
    `;

    const closeButton = overlay.querySelector(".rickroll-close");
    closeButton.addEventListener("click", () => {
      overlay.classList.remove("visible");
    });

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        overlay.classList.remove("visible");
      }
    });

    document.body.appendChild(overlay);
    overlayEl = overlay;
    return overlayEl;
  };

  const ensureToast = () => {
    if (toastEl) {
      return toastEl;
    }

    const toast = document.createElement("p");
    toast.className = "rickroll-toast";
    document.body.appendChild(toast);
    toastEl = toast;
    return toastEl;
  };

  const showToast = (text) => {
    const toast = ensureToast();
    toast.textContent = text;
    toast.classList.add("visible");

    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toast.classList.remove("visible");
    }, 1800);
  };

  const showRickImage = () => {
    const overlay = ensureOverlay();
    overlay.classList.add("visible");
    showToast("Rick photo triggered.");
  };

  const playRickAudio = async () => {
    if (!audioEl) {
      audioEl = new Audio(AUDIO_URL);
      audioEl.preload = "none";
    }

    audioEl.currentTime = 0;
    await audioEl.play();
    showToast("Rick audio triggered.");
  };

  window.setupRandomRickroll = (options = {}) => {
    const chance = Number(options.chance) > 0 ? Number(options.chance) : 100;
    const cooldownMs = Number(options.cooldownMs) > 0 ? Number(options.cooldownMs) : 8000;

    let lastTriggerAt = 0;

    document.addEventListener("click", () => {
      const now = Date.now();

      if (now - lastTriggerAt < cooldownMs) {
        return;
      }

      const hit = Math.floor(Math.random() * chance) === 0;
      if (!hit) {
        return;
      }

      lastTriggerAt = now;

      if (Math.random() < 0.5) {
        showRickImage();
        return;
      }

      playRickAudio().catch(() => {
        showRickImage();
      });
    });
  };
})();
