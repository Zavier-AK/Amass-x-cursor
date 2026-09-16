/* CiteLine workspace — sidebar + dotted canvas + composer. */
(function (root) {
  "use strict";

  var KIND_LABEL = {
    literature: "Paper",
    trial: "Trial",
    drug: "Drug",
    regulatory: "Label",
    gene: "Gene",
  };

  var state = {
    topics: {},
    activeId: null,
    loading: false,
    selectedId: null,
  };

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function truncate(s, n) {
    s = String(s || "");
    return s.length > n ? s.slice(0, n - 1) + "…" : s;
  }

  function jsonFetch(url, opts) {
    opts = opts || {};
    var headers = opts.headers ? Object.assign({}, opts.headers) : {};
    if (opts.body && !headers["content-type"]) {
      headers["content-type"] = "application/json";
    }
    return fetch(url, {
      method: opts.method || "GET",
      headers: headers,
      body: opts.body,
    }).then(function (res) {
      return res.json().then(
        function (body) {
          if (!res.ok) {
            throw new Error((body && (body.error || body.message)) || "Request failed");
          }
          return body;
        },
        function () {
          if (!res.ok) throw new Error("Request failed");
          return {};
        }
      );
    });
  }

  function topicId(title) {
    return String(title || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-");
  }

  function setStatus(text) {
    var el = $("status");
    if (el) el.textContent = text || "";
  }

  function showEmpty(show) {
    var el = $("empty-state");
    if (!el) return;
    if (show) el.classList.remove("is-hidden");
    else el.classList.add("is-hidden");
  }

  function toast(msg) {
    var el = $("toast");
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
    root.setTimeout(function () {
      el.hidden = true;
    }, 2200);
  }

  function kindLabel(kind) {
    return KIND_LABEL[kind] || "Paper";
  }

  function toCanvasGraph(topic, learn) {
    var miles = (learn.milestones || []).slice().sort(function (a, b) {
      return String(a.date).localeCompare(String(b.date));
    });
    var picked = [];
    var seen = {};
    miles.forEach(function (m) {
      var year = String(m.date || "").slice(0, 4);
      var key = year + ":" + m.kind;
      if (seen[key] && picked.length >= 8) return;
      seen[key] = true;
      picked.push(m);
    });
    picked = picked.slice(0, 12);
    var nodes = picked.map(function (m) {
      var year = String(m.date || "").slice(0, 4);
      return {
        id: m.id,
        year: year,
        date: m.date,
        kind: m.kind,
        label: topic + " · " + year,
        sub: truncate(m.title, 46),
        title: m.title,
      };
    });
    var ids = {};
    nodes.forEach(function (n) {
      ids[n.id] = true;
    });
    var edges = [];
    var seenE = {};
    function addEdge(from, to) {
      if (!from || !to || from === to || !ids[from] || !ids[to]) return;
      var key = from + ">" + to;
      if (seenE[key]) return;
      seenE[key] = true;
      edges.push({ from: from, to: to });
    }
    for (var i = 0; i < nodes.length - 1; i++) addEdge(nodes[i].id, nodes[i + 1].id);
    ((learn.graph && learn.graph.edges) || []).forEach(function (e) {
      addEdge(e.from, e.to);
    });
    return { nodes: nodes, edges: edges };
  }

  function milestoneById(data, id) {
    var list = (data && data.milestones) || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return null;
  }

  function renderInspector(m) {
    var box = $("inspector");
    var body = $("inspector-body");
    if (!box || !body) return;
    if (!m) {
      box.hidden = true;
      body.innerHTML = "";
      return;
    }
    var year = String(m.date || "").slice(0, 4);
    var summary = truncate(m.teach || m.summary || "", 220);
    body.innerHTML =
      '<p class="year-kind">' +
      escapeHtml(year) +
      " · " +
      escapeHtml(kindLabel(m.kind)) +
      "</p>" +
      "<h2>" +
      escapeHtml(m.title) +
      "</h2>" +
      '<p class="summary">' +
      escapeHtml(summary) +
      "</p>" +
      '<a href="' +
      escapeHtml(m.sourceUrl) +
      '" target="_blank" rel="noreferrer">Open source</a>';
    box.hidden = false;
  }

  function markActiveRow(id) {
    var rows = document.querySelectorAll(".topic-row");
    rows.forEach(function (row) {
      var t = row.getAttribute("data-topic") || "";
      row.classList.toggle("is-active", topicId(t) === id);
    });
  }

  function upsertTopicRow(title, subtitle) {
    var list = document.querySelector(".topic-list");
    if (!list) return;
    var id = topicId(title);
    var existing = list.querySelector('[data-topic="' + title.replace(/"/g, "") + '"]');
    if (existing) {
      var sub = existing.querySelector(".topic-sub");
      if (sub) sub.textContent = subtitle;
      return;
    }
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "topic-row";
    btn.setAttribute("data-topic", title);
    btn.innerHTML =
      '<span class="topic-title">' +
      escapeHtml(title) +
      '</span><span class="topic-sub">' +
      escapeHtml(subtitle) +
      '</span><span class="topic-time">Now</span>';
    list.insertBefore(btn, list.firstChild);
    btn.addEventListener("click", function () {
      openTopic(title);
    });
  }

  function showTopicGraph(title, learn, animate) {
    showEmpty(false);
    var graph = toCanvasGraph(title, learn);
    if (root.CiteLineGraph && root.CiteLineGraph.render) {
      root.CiteLineGraph.render(graph, { animate: animate });
    }
    var n = graph.nodes.length;
    upsertTopicRow(title, n + " nodes");
    markActiveRow(topicId(title));
  }

  function openTopic(title) {
    var id = topicId(title);
    state.activeId = id;
    state.selectedId = null;
    renderInspector(null);
    if (root.CiteLineGraph) root.CiteLineGraph.setHighlight(null);
    markActiveRow(id);
    var pack = state.topics[id];
    if (pack && pack.data) {
      setStatus("");
      showTopicGraph(pack.title, pack.data, false);
      return;
    }
    if (title === "New topic" || !title) {
      showEmpty(true);
      setStatus("");
      if (root.CiteLineGraph) root.CiteLineGraph.render({ nodes: [], edges: [] });
      return;
    }
    askTopic(title);
  }

  function askTopic(topic) {
    var title = String(topic || "").trim();
    if (!title || state.loading) return;
    state.loading = true;
    state.activeId = topicId(title);
    state.selectedId = null;
    renderInspector(null);
    $("send-btn").disabled = true;
    setStatus("Researching " + title + "…");
    showEmpty(false);
    markActiveRow(state.activeId);

    jsonFetch("/api/learn", {
      method: "POST",
      body: JSON.stringify({ topic: title }),
    })
      .then(function (json) {
        state.topics[state.activeId] = { title: title, data: json };
        var n = (json.milestones || []).length;
        setStatus(json.liveAmass ? "Live Amass · " + n + " records" : "");
        showTopicGraph(title, json, true);
      })
      .catch(function (err) {
        setStatus(err.message || "Could not research that topic.");
        showEmpty(true);
      })
      .then(function () {
        state.loading = false;
        $("send-btn").disabled = false;
      });
  }

  function onSelectNode(id) {
    state.selectedId = id;
    if (root.CiteLineGraph) root.CiteLineGraph.setHighlight(id);
    var pack = state.topics[state.activeId];
    renderInspector(id && pack ? milestoneById(pack.data, id) : null);
  }

  function resizeComposer() {
    var ta = $("composer-input");
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 76) + "px";
  }

  function bind() {
    var form = $("composer");
    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var ta = $("composer-input");
        var topic = ((ta && ta.value) || "").trim();
        if (!topic) return;
        ta.value = "";
        resizeComposer();
        askTopic(topic);
      });
    }
    var ta = $("composer-input");
    if (ta) {
      ta.addEventListener("input", resizeComposer);
      ta.addEventListener("keydown", function (e) {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          form.dispatchEvent(new Event("submit"));
        }
      });
    }

    $("new-topic").addEventListener("click", function () {
      state.activeId = "new-topic";
      state.topics["new-topic"] = { title: "New topic", data: null };
      var ta2 = $("composer-input");
      if (ta2) ta2.focus();
      showEmpty(true);
      setStatus("");
      renderInspector(null);
      markActiveRow("new-topic");
      if (root.CiteLineGraph) root.CiteLineGraph.render({ nodes: [], edges: [] });
    });

    document.querySelectorAll(".topic-row").forEach(function (row) {
      row.addEventListener("click", function () {
        openTopic(row.getAttribute("data-topic"));
      });
    });

    $("notes-toggle").addEventListener("click", function () {
      var tray = $("notes-tray");
      tray.hidden = !tray.hidden;
    });

    var well = $("notes-well");
    function notesStub(e) {
      if (e) e.preventDefault();
      toast("Demo — notes check not wired");
    }
    well.addEventListener("click", notesStub);
    well.addEventListener("dragover", function (e) {
      e.preventDefault();
    });
    well.addEventListener("drop", notesStub);
    well.addEventListener("paste", notesStub);

    $("inspector-close").addEventListener("click", function () {
      onSelectNode(null);
    });
  }

  function boot() {
    if (root.CiteLineGraph && root.CiteLineGraph.mount) {
      root.CiteLineGraph.mount($("graph"));
      root.CiteLineGraph.onSelect(onSelectNode);
    }
    bind();
    showEmpty(true);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})(typeof window !== "undefined" ? window : this);
