/* CiteLine vis-timeline layer. Expects CDN global `vis` (Timeline, DataSet). */
(function (root) {
  "use strict";

  var GROUPS = [
    { id: "literature", content: "Literature" },
    { id: "trial", content: "Trials" },
    { id: "drug", content: "Drugs" },
    { id: "regulatory", content: "Regulatory" },
    { id: "gene", content: "Gene" },
  ];

  var host = null;
  var timeline = null;
  var items = null;
  var selectCb = null;
  var timers = [];
  var highlight = { selectedId: null, citedIds: [] };
  var animGen = 0;

  function visNS() {
    return root.visTimeline || (typeof vis !== "undefined" ? vis : root.vis);
  }

  function TimelineCtor() {
    var g = visNS();
    return g && g.Timeline;
  }

  function DataSetCtor() {
    var g = visNS();
    return g && g.DataSet;
  }

  function clearTimers() {
    for (var i = 0; i < timers.length; i++) root.clearTimeout(timers[i]);
    timers = [];
  }

  function later(fn, ms) {
    var id = root.setTimeout(fn, ms);
    timers.push(id);
    return id;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function truncate(s, n) {
    s = String(s || "");
    return s.length > n ? s.slice(0, n - 1) + "…" : s;
  }

  function classFor(id, kind) {
    var extras = [];
    if (highlight.citedIds.indexOf(id) !== -1) extras.push("cited");
    if (highlight.selectedId === id) extras.push("is-selected");
    return ("kind-" + kind + (extras.length ? " " + extras.join(" ") : "")).trim();
  }

  function toItem(m) {
    var date = m.date || "";
    var year = date.slice(0, 4);
    var tooltip =
      year +
      " · " +
      (m.sourceLabel || "") +
      "\n" +
      (m.summary || m.title || "");
    return {
      id: m.id,
      group: m.kind,
      start: date,
      content: m.title || m.id,
      title: tooltip,
      className: classFor(m.id, m.kind),
    };
  }

  function applyHighlight() {
    if (!timeline || !items) return;
    var ids = items.getIds();
    var updates = [];
    for (var i = 0; i < ids.length; i++) {
      var id = ids[i];
      var current = items.get(id);
      if (!current) continue;
      var base = String(current.className || "").replace(/\s*(cited|is-selected)/g, "");
      var extras = [];
      if (highlight.citedIds.indexOf(id) !== -1) extras.push("cited");
      if (highlight.selectedId === id) extras.push("is-selected");
      updates.push({
        id: id,
        className: (base + (extras.length ? " " + extras.join(" ") : "")).trim(),
      });
    }
    if (updates.length) items.update(updates);
    if (highlight.selectedId) {
      try {
        timeline.setSelection([highlight.selectedId]);
      } catch (err) {
        /* item may not be added yet during animation */
      }
    } else {
      try {
        timeline.setSelection([]);
      } catch (err) {
        /* ignore */
      }
    }
  }

  function mount(el) {
    destroy();
    host = el;
    if (!host) return;

    var Timeline = TimelineCtor();
    var DataSet = DataSetCtor();
    if (!Timeline || !DataSet) {
      console.error("CiteLineTimeline: global vis.Timeline / vis.DataSet missing");
      return;
    }

    items = new DataSet([]);
    timeline = new Timeline(host, items, GROUPS, {
      stack: true,
      horizontalScroll: true,
      zoomable: true,
      moveable: true,
      orientation: "top",
      height: 280,
      margin: { item: { horizontal: 8, vertical: 6 } },
      tooltip: { followMouse: true },
      template: function (item) {
        var label = String((item && item.content) || "");
        var tip = String((item && item.title) || label);
        return (
          '<span title="' +
          escapeHtml(tip) +
          '">' +
          escapeHtml(truncate(label, 42)) +
          "</span>"
        );
      },
    });

    timeline.on("select", function (props) {
      var id = props && props.items && props.items[0];
      if (id && selectCb) selectCb(id);
    });
  }

  function render(milestones, opts) {
    if (!timeline || !items) return;
    opts = opts || {};
    var animate = !!opts.animate;
    var rows = (milestones || []).map(toItem);

    clearTimers();
    animGen += 1;
    var gen = animGen;
    items.clear();

    if (!rows.length) return;

    if (!animate) {
      items.add(rows);
      timeline.fit();
      applyHighlight();
      return;
    }

    rows.forEach(function (row, i) {
      later(function () {
        if (gen !== animGen || !items || !timeline) return;
        items.add(row);
        try {
          timeline.focus(row.id, {
            animation: { duration: 280, easingFunction: "easeInOutQuad" },
          });
        } catch (err) {
          /* ignore focus miss */
        }
        applyHighlight();
      }, 90 + i * 140);
    });

    later(function () {
      if (gen !== animGen || !timeline) return;
      timeline.fit({ animation: true });
      applyHighlight();
    }, 90 + rows.length * 140 + 200);
  }

  function setHighlight(selectedId, citedIds) {
    highlight.selectedId = selectedId || null;
    highlight.citedIds = citedIds ? citedIds.slice() : [];
    applyHighlight();
  }

  function onSelect(cb) {
    selectCb = cb;
  }

  function destroy() {
    clearTimers();
    animGen += 1;
    if (timeline) {
      try {
        timeline.destroy();
      } catch (err) {
        /* already gone */
      }
    }
    timeline = null;
    items = null;
    host = null;
  }

  root.CiteLineTimeline = {
    mount: mount,
    render: render,
    setHighlight: setHighlight,
    onSelect: onSelect,
    destroy: destroy,
  };
})(typeof window !== "undefined" ? window : this);
