// ---------- Curl command parser ----------

function tokenizeCurl(cmd) {
  const tokens = [];
  let current = "";
  let quote = null; // null | "'" | '"'
  let i = 0;

  const str = cmd.trim().replace(/^curl\s+/i, "").replace(/\\\n/g, " ");

  while (i < str.length) {
    const ch = str[i];

    if (quote) {
      if (ch === quote) {
        quote = null;
      } else if (ch === "\\" && quote === '"' && (str[i + 1] === '"' || str[i + 1] === "\\")) {
        current += str[i + 1];
        i++;
      } else {
        current += ch;
      }
    } else if (ch === "'" || ch === '"') {
      quote = ch;
    } else if (/\s/.test(ch)) {
      if (current.length) {
        tokens.push(current);
        current = "";
      }
    } else if (ch === "\\") {
      current += str[i + 1] ?? "";
      i++;
    } else {
      current += ch;
    }
    i++;
  }
  if (current.length) tokens.push(current);
  return tokens;
}

function parseCurl(cmd) {
  const tokens = tokenizeCurl(cmd);
  const result = {
    method: null,
    url: null,
    headers: {},
    body: null,
    isGetData: false,
  };

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];

    if (t === "-X" || t === "--request") {
      result.method = tokens[++i];
    } else if (t === "-H" || t === "--header") {
      const h = tokens[++i] || "";
      const idx = h.indexOf(":");
      if (idx !== -1) {
        const key = h.slice(0, idx).trim();
        const val = h.slice(idx + 1).trim();
        result.headers[key] = val;
      }
    } else if (t === "-d" || t === "--data" || t === "--data-raw" || t === "--data-binary" || t === "--data-ascii") {
      const d = tokens[++i] || "";
      result.body = result.body ? result.body + "&" + d : d;
      if (!result.method) result.method = "POST";
    } else if (t === "-G" || t === "--get") {
      result.isGetData = true;
    } else if (t === "-u" || t === "--user") {
      const cred = tokens[++i] || "";
      result.headers["Authorization"] = "Basic " + btoa(cred);
    } else if (t === "-A" || t === "--user-agent") {
      result.headers["User-Agent"] = tokens[++i] || "";
    } else if (t === "-b" || t === "--cookie") {
      result.headers["Cookie"] = tokens[++i] || "";
    } else if (t === "-k" || t === "--insecure" || t === "--compressed" || t === "-s" || t === "--silent" || t === "-i" || t === "-v" || t === "-L" || t === "--location") {
      // flags with no effect in browser fetch context — ignore
    } else if (t.startsWith("-")) {
      // unknown flag — skip its likely value if it looks like one exists
    } else {
      // bare argument = URL (skip if it's a value already consumed above)
      if (!result.url) result.url = t;
    }
  }

  if (!result.url) throw new Error("No URL found in curl command.");

  if (result.isGetData && result.body) {
    const sep = result.url.includes("?") ? "&" : "?";
    result.url += sep + result.body;
    result.body = null;
    result.method = result.method || "GET";
  }

  result.method = result.method || (result.body ? "POST" : "GET");

  return result;
}

// ---------- JSON pretty printer with syntax highlighting ----------

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function syntaxHighlightJson(jsonString) {
  const escaped = escapeHtml(jsonString);
  return escaped.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false)\b|\bnull\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
    (match) => {
      let cls = "json-number";
      if (/^"/.test(match)) {
        cls = /:$/.test(match) ? "json-key" : "json-string";
      } else if (/true|false/.test(match)) {
        cls = "json-boolean";
      } else if (/null/.test(match)) {
        cls = "json-null";
      }
      return `<span class="${cls}">${match}</span>`;
    }
  );
}

function tryPrettyJson(text) {
  try {
    const parsed = JSON.parse(text);
    return { ok: true, html: syntaxHighlightJson(JSON.stringify(parsed, null, 2)), parsed };
  } catch {
    return { ok: false, html: null, parsed: null };
  }
}

// ---------- DOM refs ----------

const curlInput = document.getElementById("curlInput");
const streamToggle = document.getElementById("streamToggle");
const sendBtn = document.getElementById("sendBtn");
const clearBtn = document.getElementById("clearBtn");
const responseCode = document.getElementById("responseCode");
const responseOutput = document.getElementById("responseOutput");
const statusBar = document.getElementById("statusBar");
const statusCode = document.getElementById("statusCode");
const statusTime = document.getElementById("statusTime");
const statusSize = document.getElementById("statusSize");
const streamState = document.getElementById("streamState");
const copyBtn = document.getElementById("copyBtn");
const tabBtns = document.querySelectorAll(".tab-btn");

let lastRawText = "";
let activeTab = "pretty";

function setStatus(code, ok, timeMs, bytes) {
  statusBar.hidden = false;
  statusCode.textContent = code;
  statusCode.className = "status-pill " + (ok ? "ok" : code >= 400 || code === "ERR" ? "err" : "warn");
  statusTime.textContent = `${timeMs}ms`;
  statusSize.textContent = bytes != null ? formatBytes(bytes) : "";
}

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function renderPretty(text) {
  lastRawText = text;
  const { ok, html } = tryPrettyJson(text);
  responseCode.className = "";
  responseCode.innerHTML = ok ? html : escapeHtml(text);
  if (!ok) responseCode.classList.add("placeholder-off");
}

function renderRaw(text) {
  responseCode.className = "";
  responseCode.textContent = text;
}

function renderCurrentTab() {
  if (activeTab === "pretty") {
    renderPretty(lastRawText);
  } else {
    renderRaw(lastRawText);
  }
}

tabBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    tabBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    activeTab = btn.dataset.tab;
    renderCurrentTab();
  });
});

clearBtn.addEventListener("click", () => {
  curlInput.value = "";
  lastRawText = "";
  responseCode.className = "placeholder";
  responseCode.textContent = "Response will appear here...";
  statusBar.hidden = true;
  streamState.hidden = true;
  streamState.classList.remove("done");
});

copyBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(lastRawText);
    copyBtn.textContent = "Copied!";
    setTimeout(() => (copyBtn.textContent = "Copy JSON"), 1200);
  } catch {
    // clipboard unavailable — ignore
  }
});

// ---------- Streaming response rendering ----------
// Each chunk received is a snapshot, not a byte-level delta. A snapshot is a
// continuation of the one currently in progress when it's an ADDITIVE
// extension of it — every value already present has only grown (a string
// got longer, an array gained elements, an object kept its old fields) — and
// it replaces the in-progress block in place, e.g. {"name":"ar"} ->
// {"name":"arun"}. Once a snapshot is no longer additive over the current
// one, the current one is done: it gets pinned as a completed block and the
// new snapshot starts growing as the next block below it. The final result
// combines every completed block, not just whichever chunk arrived last.

function isAdditive(oldVal, newVal) {
  if (oldVal === newVal) return true;
  if (typeof oldVal === "string" && typeof newVal === "string") {
    return newVal.startsWith(oldVal);
  }
  if (Array.isArray(oldVal) && Array.isArray(newVal)) {
    if (newVal.length < oldVal.length) return false;
    return oldVal.every((v, i) => isAdditive(v, newVal[i]));
  }
  if (
    oldVal && newVal &&
    typeof oldVal === "object" && typeof newVal === "object" &&
    !Array.isArray(oldVal) && !Array.isArray(newVal)
  ) {
    return Object.keys(oldVal).every((k) => k in newVal && isAdditive(oldVal[k], newVal[k]));
  }
  return false;
}

function isContinuation(activeText, newText) {
  const activeParsed = tryPrettyJson(activeText);
  const newParsed = tryPrettyJson(newText);
  if (activeParsed.ok && newParsed.ok) {
    return isAdditive(activeParsed.parsed, newParsed.parsed);
  }
  // one or both are incomplete JSON (split mid-object by the network) —
  // fall back to a straightforward prefix extension check
  return newText.startsWith(activeText) || activeText.startsWith(newText);
}

function blockHtml(text) {
  const { ok, html } = tryPrettyJson(text);
  return ok ? html : escapeHtml(text);
}

function renderStreamState(completed, active) {
  responseCode.className = "";
  const blocks = completed.map(blockHtml);
  if (active) blocks.push(blockHtml(active));
  responseCode.innerHTML = blocks
    .map((html) => `<div class="stream-block">${html}</div>`)
    .join("");
  responseOutput.scrollTop = responseOutput.scrollHeight;
}

function combineStreamShapes(completed) {
  if (completed.length === 0) return "";
  if (completed.length === 1) return completed[0];
  const values = completed.map((chunk) => {
    try {
      return JSON.parse(chunk);
    } catch {
      return chunk;
    }
  });
  return JSON.stringify(values, null, 2);
}

// ---------- Request execution ----------

async function sendRequest() {
  const cmd = curlInput.value.trim();
  if (!cmd) return;

  let parsed;
  try {
    parsed = parseCurl(cmd);
  } catch (err) {
    responseCode.className = "error-text";
    responseCode.textContent = "Parse error: " + err.message;
    statusBar.hidden = true;
    return;
  }

  sendBtn.disabled = true;
  sendBtn.textContent = "Sending...";
  statusBar.hidden = true;
  lastRawText = "";
  responseCode.className = "placeholder";
  responseCode.textContent = "Loading...";

  const start = performance.now();
  const isStreaming = streamToggle.checked;

  try {
    const fetchOpts = {
      method: parsed.method,
      headers: parsed.headers,
    };
    if (parsed.body && parsed.method !== "GET" && parsed.method !== "HEAD") {
      fetchOpts.body = parsed.body;
    }

    const res = await fetch(parsed.url, fetchOpts);
    const elapsed = Math.round(performance.now() - start);

    if (isStreaming && res.body) {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let totalBytes = 0;
      const completed = [];
      let active = "";

      responseCode.className = "placeholder";
      responseCode.textContent = "Waiting for data...";
      streamState.hidden = false;
      streamState.classList.remove("done");
      streamState.textContent = "streaming";
      setStatus(res.status, res.ok, elapsed, null);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        totalBytes += value.byteLength;
        const text = decoder.decode(value, { stream: true });
        if (text.trim().length) {
          if (!active || isContinuation(active, text)) {
            active = text; // same shape still growing — update in place
          } else {
            completed.push(active); // shape changed — previous one is done
            active = text;
          }
          renderStreamState(completed, active);
        }
        setStatus(res.status, res.ok, Math.round(performance.now() - start), totalBytes);
      }
      if (active) completed.push(active);

      streamState.classList.add("done");
      streamState.textContent = "streaming finished";
      activeTab = "pretty";
      tabBtns.forEach((b) => b.classList.toggle("active", b.dataset.tab === "pretty"));
      renderPretty(combineStreamShapes(completed));
    } else {
      const text = await res.text();
      const bytes = new Blob([text]).size;
      setStatus(res.status, res.ok, elapsed, bytes);
      renderPretty(text);
      activeTab = "pretty";
      tabBtns.forEach((b) => b.classList.toggle("active", b.dataset.tab === "pretty"));
    }
  } catch (err) {
    const elapsed = Math.round(performance.now() - start);
    setStatus("ERR", false, elapsed, null);
    streamState.hidden = true;
    responseCode.className = "error-text";
    responseCode.textContent = "Request failed: " + err.message + "\n\n(Note: browser CORS restrictions may block cross-origin requests that curl itself would allow.)";
  } finally {
    sendBtn.disabled = false;
    sendBtn.textContent = "Send Request";
  }
}

sendBtn.addEventListener("click", sendRequest);

curlInput.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
    sendRequest();
  }
});
