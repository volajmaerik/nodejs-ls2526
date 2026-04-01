const formatTimestamp = (unixSeconds) => {
  if (!unixSeconds) {
    return "Unknown";
  }
  return new Date(unixSeconds * 1000).toLocaleString();
};

const formatDueDate = (unixSeconds) => {
  if (!unixSeconds) {
    return "Not set";
  }
  return new Date(unixSeconds * 1000).toLocaleDateString();
};

const setupAutoSaveForm = () => {
  const form = document.querySelector(".edit-form");
  if (!form) {
    return {
      shouldSuppressReload: () => false,
    };
  }

  const titleInput = form.querySelector('input[name="title"]');
  const descriptionInput = form.querySelector('textarea[name="description"]');
  const tagsInput = form.querySelector('input[name="tags"]');
  const dueDateInput = form.querySelector('input[name="dueDate"]');
  const priorityInputs = form.querySelectorAll('input[name="priority"]');
  const archivedInput = form.querySelector('input[name="archived"]');

  const saveStatus = document.getElementById("autosave-status");
  const updatedAtEl = document.getElementById("todo-updated-at");
  const dueViewEl = document.getElementById("todo-due-view");
  const tagsViewEl = document.getElementById("todo-tags-view");
  const titleViewEl = document.getElementById("todo-title-view");
  const priorityBadgeEl = document.getElementById("priority-badge");
  const archivedBadgeEl = document.getElementById("archived-badge");
  const dueBadgeEl = document.getElementById("due-badge");

  let isSaving = false;
  let suppressNextWsReload = false;

  const setSaveStatus = (text, type = "") => {
    if (!saveStatus) {
      return;
    }
    saveStatus.textContent = text;
    saveStatus.className = `autosave${type ? ` ${type}` : ""}`;
  };

  const readFormData = () => {
    const selectedPriority = form.querySelector('input[name="priority"]:checked');
    return {
      title: titleInput ? titleInput.value.trim() : "",
      description: descriptionInput ? descriptionInput.value.trim() : "",
      tags: tagsInput ? tagsInput.value.trim() : "",
      dueDate: dueDateInput ? dueDateInput.value : "",
      priority: selectedPriority ? selectedPriority.value : "normal",
      archived: archivedInput && archivedInput.checked ? "1" : "0",
    };
  };

  let lastSavedData = readFormData();

  const hasChanges = (data) =>
    data.title !== lastSavedData.title ||
    data.description !== lastSavedData.description ||
    data.tags !== lastSavedData.tags ||
    data.dueDate !== lastSavedData.dueDate ||
    data.priority !== lastSavedData.priority ||
    data.archived !== lastSavedData.archived;

  const renderTags = (tagsArray) => {
    if (!tagsViewEl) {
      return;
    }

    tagsViewEl.innerHTML = "";
    if (!tagsArray || tagsArray.length === 0) {
      const empty = document.createElement("span");
      empty.className = "tag";
      empty.textContent = "no tags";
      tagsViewEl.appendChild(empty);
      return;
    }

    tagsArray.forEach((tag) => {
      const chip = document.createElement("span");
      chip.className = "tag";
      chip.textContent = `#${tag}`;
      tagsViewEl.appendChild(chip);
    });
  };

  const renderPriorityBadge = (priority) => {
    if (!priorityBadgeEl) {
      return;
    }
    priorityBadgeEl.className = `badge priority-${priority}`;
    priorityBadgeEl.textContent = priority;
  };

  const renderArchivedBadge = (archived) => {
    if (!archivedBadgeEl) {
      return;
    }
    archivedBadgeEl.style.display = archived ? "inline-flex" : "none";
  };

  const renderDueBadge = (todo) => {
    if (!dueBadgeEl) {
      return;
    }

    if (!todo.dueAt) {
      dueBadgeEl.style.display = "none";
      return;
    }

    const overdue = Boolean(todo.isOverdue);
    dueBadgeEl.style.display = "inline-flex";
    dueBadgeEl.className = `badge ${overdue ? "overdue-badge" : "due-badge"}`;
    dueBadgeEl.textContent = `${overdue ? "Overdue" : "Due"}: ${new Date(todo.dueAt * 1000).toLocaleDateString()}`;
  };

  const saveData = async () => {
    if (isSaving) {
      return;
    }

    const data = readFormData();

    if (!hasChanges(data)) {
      return;
    }

    if (!data.title) {
      setSaveStatus("Title is required.", "error");
      return;
    }

    isSaving = true;
    suppressNextWsReload = true;
    setSaveStatus("Saving...", "saving");

    try {
      const response = await fetch(form.action, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
          Accept: "application/json",
          "X-Requested-With": "fetch",
        },
        body: new URLSearchParams(data),
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Save failed");
      }

      lastSavedData = data;

      if (titleViewEl) {
        titleViewEl.textContent = result.todo.title;
      }
      if (updatedAtEl) {
        updatedAtEl.textContent = formatTimestamp(result.todo.updatedAt);
      }
      if (dueViewEl) {
        dueViewEl.textContent = formatDueDate(result.todo.dueAt);
      }

      renderPriorityBadge(result.todo.priority || "normal");
      renderArchivedBadge(Boolean(result.todo.archived));
      renderDueBadge(result.todo);
      renderTags(result.todo.tagsArray || []);

      setSaveStatus("Saved.", "saved");
    } catch {
      suppressNextWsReload = false;
      setSaveStatus("Auto-save failed. Try again.", "error");
    } finally {
      isSaving = false;
    }
  };

  if (titleInput) {
    titleInput.addEventListener("blur", saveData);
  }
  if (descriptionInput) {
    descriptionInput.addEventListener("blur", saveData);
  }
  if (tagsInput) {
    tagsInput.addEventListener("blur", saveData);
  }
  if (dueDateInput) {
    dueDateInput.addEventListener("change", saveData);
  }
  priorityInputs.forEach((input) => input.addEventListener("change", saveData));
  if (archivedInput) {
    archivedInput.addEventListener("change", saveData);
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    saveData();
  });

  return {
    shouldSuppressReload: () => {
      if (suppressNextWsReload) {
        suppressNextWsReload = false;
        return true;
      }
      return false;
    },
  };
};

const setupTodoUpdatesSocket = () => {
  let socket;
  let reconnectTimer;
  let shouldReconnect = true;
  const autoSave = setupAutoSaveForm();

  const connect = () => {
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    socket = new WebSocket(`${protocol}://${window.location.host}/ws`);

    socket.addEventListener("message", (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === "todos:changed") {
          if (autoSave.shouldSuppressReload()) {
            return;
          }
          window.location.reload();
        }
      } catch {
        // Ignore non-JSON messages.
      }
    });

    socket.addEventListener("close", () => {
      if (shouldReconnect) {
        reconnectTimer = window.setTimeout(connect, 1000);
      }
    });

    socket.addEventListener("error", () => {
      socket.close();
    });
  };

  connect();

  window.addEventListener("beforeunload", () => {
    shouldReconnect = false;
    window.clearTimeout(reconnectTimer);
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.close(1000, "Page unloading");
    }
  });
};

if (typeof window.setupRandomRickroll === "function") {
  window.setupRandomRickroll({ chance: 100, cooldownMs: 8000 });
}

setupTodoUpdatesSocket();
