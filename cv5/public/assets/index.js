const setupTodoUpdatesSocket = () => {
  let socket;
  let reconnectTimer;
  let shouldReconnect = true;

  const connect = () => {
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    socket = new WebSocket(`${protocol}://${window.location.host}/ws`);

    socket.addEventListener("message", (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === "todos:changed") {
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

document.querySelectorAll(".todo-checkbox").forEach((cb) => {
  cb.addEventListener("change", () => {
    const from = encodeURIComponent(cb.dataset.from || "/");
    window.location.href = `/toggle-todo/${cb.dataset.id}?from=${from}`;
  });
});

if (typeof window.setupRandomRickroll === "function") {
  window.setupRandomRickroll({ chance: 100, cooldownMs: 8000 });
}

setupTodoUpdatesSocket();
