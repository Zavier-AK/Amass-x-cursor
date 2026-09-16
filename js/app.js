/* CiteLine UI wiring. Talks to same-origin /api/* — never ships API keys. */
(function (root) {
  "use strict";

  var FALLBACK_DEMO = {
    topic: "GLP-1 receptor",
    question:
      "Why did GLP-1 medicines expand from diabetes into obesity — and which evidence on this timeline actually supports that shift?",
    notesExample:
      "GLP-1 is a hormone that lowers blood sugar. Semaglutide is a GLP-1 drug used for diabetes. I think the receptor was found in the 2000s when these drugs were invented.",
    hasAmass: false,
    hasClaude: false,
  };

  var state = {
    demo: FALLBACK_DEMO,
    data: null,
    selectedId: null,
    citedIds: [],
    teach: null,
    check: null,
    loading: false,
    playing: false,
    askBusy: false,
    checkBusy: false,
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

  function sleep(ms) {
    return new Promise(function (resolve) {
      root.setTimeout(resolve, ms);
    });
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
            var err = new Error(
              (body && (body.error || body.message)) || "Request failed"
            );
            err.status = res.status;
            throw err;
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

  function setDisabled(id, disabled) {
    var node = $(id);
    if (node) node.disabled = !!disabled;
  }

  function setText(id, text) {
    var node = $(id);
    if (node) node.textContent = text;
  }

  function setHtml(id, html) {
    var node = $(id);
    if (node) node.innerHTML = html;
  }

  function busy() {
    return state.loading || state.playing || state.askBusy || state.checkBusy;
  }

  function syncBusy() {
    var loadLock = state.loading || state.playing;
    setDisabled("play-demo", loadLock);
    setDisabled("build-btn", loadLock);
    setDisabled("ask-btn", !state.data || state.askBusy || state.playing);
    setDisabled("check-btn", !state.data || state.checkBusy || state.playing);

    var play = $("play-demo");
    if (play) {
      play.textContent = state.playing ? "Playing golden path…" : "Play 1-min demo";
    }
    var build = $("build-btn");
    if (build) {
      build.textContent = state.loading ? "Retrieving cores…" : "Build timeline";
    }
    var ask = $("ask-btn");
    if (ask) {
      ask.textContent = state.askBusy ? "Grounding…" : "Ask";
    }
    var check = $("check-btn");
    if (check) {
      check.textContent = state.checkBusy ? "Checking…" : "Check understanding";
    }
  }

  function statusLine(text) {
    setText("status", text);
  }

  function learnStatus(data) {
    if (!data) return;
    var parts = [];
    parts.push(
      data.cached ? "Golden-path cache (demo-safe)." : "Live Amass search."
    );
    parts.push(
      data.liveAmass
        ? "Multi-core query succeeded."
        : "Amass live key not required for this path."
    );
    if (data.fallbackReason) {
      parts.push("Fallback: " + data.fallbackReason);
    }
    statusLine(parts.join(" "));
  }

  function selectedMilestone() {
    if (!state.data || !state.selectedId) return null;
    var list = state.data.milestones || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === state.selectedId) return list[i];
    }
    return null;
  }

  function renderSelected() {
    var m = selectedMilestone();
    var card = $("selected-card");
    if (!card) return;
    if (!m) {
      card.innerHTML =
        "<p>Click a milestone — the tutor only narrates that record, with a clickable source.</p>";
      return;
    }
    var year = (m.date || "").slice(0, 4);
    card.innerHTML =
      "<p>" +
      escapeHtml(year) +
      " · " +
      escapeHtml(m.kind) +
      "</p>" +
      "<p>" +
      escapeHtml(m.title) +
      "</p>" +
      "<p>" +
      escapeHtml(m.teach) +
      "</p>" +
      '<a href="' +
      escapeHtml(m.sourceUrl) +
      '" target="_blank" rel="noreferrer">Open source · ' +
      escapeHtml(m.sourceLabel) +
      "</a>";
  }

  function renderTeach() {
    var out = $("teach-out");
    if (!out) return;
    if (!state.teach) {
      out.innerHTML = "";
      return;
    }
    out.innerHTML =
      "<p>Answer · " +
      escapeHtml(state.teach.model) +
      "</p>" +
      "<pre>" +
      escapeHtml(state.teach.answer) +
      "</pre>";
  }

  function renderCheck() {
    var out = $("check-out");
    if (!out) return;
    if (!state.check) {
      out.innerHTML = "";
      return;
    }
    var r = state.check;
    var covered =
      (r.covered || [])
        .map(function (c) {
          return "<li>" + escapeHtml(c) + "</li>";
        })
        .join("") || "<li>Nothing matched yet.</li>";
    var gaps = (r.gaps || [])
      .map(function (c) {
        return "<li>" + escapeHtml(c) + "</li>";
      })
      .join("");
    out.innerHTML =
      "<div><p>Covered</p><ul>" +
      covered +
      "</ul></div>" +
      "<div><p>Gaps</p><ul>" +
      gaps +
      "</ul></div>" +
      "<p>Question · " +
      escapeHtml(r.model) +
      "</p>" +
      "<p>" +
      escapeHtml(r.question) +
      "</p>";
  }

  function renderEvidence() {
    var n = state.data && state.data.milestones ? state.data.milestones.length : 0;
    setText(
      "evidence-count",
      n ? n + " records in the evidence pack" : "Load a topic first"
    );
  }

  function applyHighlight() {
    if (root.CiteLineTimeline && root.CiteLineTimeline.setHighlight) {
      root.CiteLineTimeline.setHighlight(state.selectedId, state.citedIds);
    }
    if (root.CiteLineGraph && root.CiteLineGraph.setHighlight) {
      root.CiteLineGraph.setHighlight(state.selectedId, state.citedIds);
    }
  }

  function onSelectRecord(id) {
    if (!id) return;
    state.selectedId = id;
    renderSelected();
    applyHighlight();
  }

  function pickDefaultId(milestones) {
    if (!milestones || !milestones.length) return null;
    for (var i = 0; i < milestones.length; i++) {
      if (milestones[i].kind === "gene") return milestones[i].id;
    }
    return milestones[0].id;
  }

  function loadTopic(topic) {
    state.loading = true;
    state.teach = null;
    state.check = null;
    state.citedIds = [];
    state.selectedId = null;
    syncBusy();
    renderTeach();
    renderCheck();
    renderSelected();
    applyHighlight();
    statusLine("Retrieving cores…");

    return jsonFetch("/api/learn", {
      method: "POST",
      body: JSON.stringify({ topic: topic }),
    })
      .then(function (json) {
        state.data = json;
        learnStatus(json);
        renderEvidence();

        if (root.CiteLineTimeline && root.CiteLineTimeline.render) {
          root.CiteLineTimeline.render(json.milestones || [], { animate: true });
        }
        if (root.CiteLineGraph && root.CiteLineGraph.render) {
          root.CiteLineGraph.render(json.graph || { nodes: [], edges: [] }, {
            animate: true,
          });
        }
        if (root.CiteLineProtein && root.CiteLineProtein.show) {
          root.CiteLineProtein.show(json.protein || null);
        }

        root.setTimeout(function () {
          state.selectedId = pickDefaultId(json.milestones);
          renderSelected();
          applyHighlight();
        }, 900);

        return json;
      })
      .catch(function (err) {
        statusLine(err && err.message ? err.message : "Learn request failed");
        return null;
      })
      .then(function (json) {
        state.loading = false;
        syncBusy();
        return json;
      });
  }

  function teachQuestion(question) {
    if (!state.data) return Promise.resolve(null);
    state.askBusy = true;
    syncBusy();
    return jsonFetch("/api/teach", {
      method: "POST",
      body: JSON.stringify({
        question: question,
        milestones: state.data.milestones,
      }),
    })
      .then(function (json) {
        state.teach = json;
        state.citedIds = json.citedIds || [];
        if (state.citedIds[0]) state.selectedId = state.citedIds[0];
        renderTeach();
        renderSelected();
        applyHighlight();
        return json;
      })
      .catch(function (err) {
        setHtml(
          "teach-out",
          "<p>" + escapeHtml(err && err.message ? err.message : "Teach failed") + "</p>"
        );
        return null;
      })
      .then(function (json) {
        state.askBusy = false;
        syncBusy();
        return json;
      });
  }

  function checkNotes(notes) {
    if (!state.data) return Promise.resolve(null);
    state.checkBusy = true;
    syncBusy();
    return jsonFetch("/api/check", {
      method: "POST",
      body: JSON.stringify({
        notes: notes,
        milestones: state.data.milestones,
      }),
    })
      .then(function (json) {
        state.check = json;
        renderCheck();
        return json;
      })
      .catch(function (err) {
        setHtml(
          "check-out",
          "<p>" + escapeHtml(err && err.message ? err.message : "Check failed") + "</p>"
        );
        return null;
      })
      .then(function (json) {
        state.checkBusy = false;
        syncBusy();
        return json;
      });
  }

  function playDemo() {
    if (busy()) return;
    var demo = state.demo || FALLBACK_DEMO;
    var topic = demo.topic || "GLP-1 receptor";
    var question = demo.question || FALLBACK_DEMO.question;
    var notes = demo.notesExample || FALLBACK_DEMO.notesExample;

    state.playing = true;
    syncBusy();

    var input = $("topic-input");
    if (input) input.value = topic;

    loadTopic(topic)
      .then(function (json) {
        if (!json) return null;
        return sleep(2200)
          .then(function () {
            var ask = $("ask-input");
            if (ask) ask.value = question;
            return teachQuestion(question);
          })
          .then(function () {
            return sleep(1200);
          })
          .then(function () {
            var notesEl = $("check-notes");
            if (notesEl) {
              notesEl.value = notes;
              notesEl.dispatchEvent(new Event("input", { bubbles: true }));
            }
            return checkNotes(notes);
          });
      })
      .then(function () {
        state.playing = false;
        syncBusy();
      })
      .catch(function () {
        state.playing = false;
        syncBusy();
      });
  }

  function bind() {
    var form = $("topic-form");
    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        if (state.loading || state.playing) return;
        var input = $("topic-input");
        var topic = ((input && input.value) || "").trim() || "GLP-1 receptor";
        if (input) input.value = topic;
        loadTopic(topic);
      });
    }

    var play = $("play-demo");
    if (play) {
      play.addEventListener("click", function (e) {
        e.preventDefault();
        playDemo();
      });
    }

    var askForm = $("ask-form");
    if (askForm) {
      askForm.addEventListener("submit", function (e) {
        e.preventDefault();
        if (!state.data || state.askBusy || state.playing) return;
        var ask = $("ask-input");
        var q = ((ask && ask.value) || "").trim() || (state.demo && state.demo.question) || FALLBACK_DEMO.question;
        teachQuestion(q);
      });
    }

    var checkBtn = $("check-btn");
    if (checkBtn) {
      checkBtn.addEventListener("click", function (e) {
        e.preventDefault();
        if (!state.data || state.checkBusy || state.playing) return;
        var notesEl = $("check-notes");
        var notes = ((notesEl && notesEl.value) || "").trim();
        if (!notes) return;
        checkNotes(notes);
      });
    }
  }

  function mountViews() {
    if (root.CiteLineTimeline && root.CiteLineTimeline.mount) {
      root.CiteLineTimeline.mount($("timeline"));
      root.CiteLineTimeline.onSelect(onSelectRecord);
    }
    if (root.CiteLineGraph && root.CiteLineGraph.mount) {
      root.CiteLineGraph.mount($("graph"));
      root.CiteLineGraph.onSelect(onSelectRecord);
    }
    if (root.CiteLineProtein && root.CiteLineProtein.mount) {
      root.CiteLineProtein.mount($("protein"), $("protein-meta"));
    }
  }

  function applyDemo(demo) {
    state.demo = demo;
    var input = $("topic-input");
    if (input) {
      if (!input.value) input.value = demo.topic || "";
      if (!input.getAttribute("placeholder")) {
        input.setAttribute(
          "placeholder",
          "Drug class, gene, disease — try " + (demo.topic || "GLP-1 receptor")
        );
      }
    }
    var ask = $("ask-input");
    if (ask && !ask.getAttribute("placeholder") && demo.question) {
      ask.setAttribute("placeholder", demo.question);
    }
    var notes = $("check-notes");
    if (notes && !notes.getAttribute("placeholder") && demo.notesExample) {
      notes.setAttribute("placeholder", demo.notesExample);
    }
    statusLine(
      demo.hasAmass
        ? "Live Amass is configured on the proxy. Type a topic or play the golden path."
        : "No Amass key on the proxy — golden-path cache will be used."
    );
    renderEvidence();
    renderSelected();
    syncBusy();
  }

  function boot() {
    mountViews();
    bind();
    renderSelected();
    renderEvidence();
    syncBusy();

    jsonFetch("/api/demo")
      .then(applyDemo)
      .catch(function () {
        applyDemo(FALLBACK_DEMO);
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})(typeof window !== "undefined" ? window : this);
