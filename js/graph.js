/* CiteLine vis-network citation graph. Expects CDN global `vis` (Network, DataSet). */
(function (root) {
  "use strict";

  var COLORS = {
    literature: { background: "#64748b", border: "#94a3b8", highlight: "#94a3b8" },
    trial: { background: "#2fd2b8", border: "#7eead9", highlight: "#7eead9" },
    drug: { background: "#e3b04a", border: "#f0c97a", highlight: "#f0c97a" },
    regulatory: { background: "#d46a6a", border: "#e8a0a0", highlight: "#e8a0a0" },
    gene: { background: "#8b7cf6", border: "#b4aaf8", highlight: "#b4aaf8" },
  };
  var TEAL = "#2fd2b8";
  var PAPER = "#e7e1d4";

  var host = null;
  var network = null;
  var nodes = null;
  var edges = null;
  var selectCb = null;
  var timers = [];
  var highlight = { selectedId: null, citedIds: [] };
  var nodeMeta = {};
  var animGen = 0;

  function visNS() {
    return typeof vis !== "undefined" ? vis : root.vis;
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

  function palette(group) {
    return COLORS[group] || COLORS.literature;
  }

  function nodeStyle(id, group, selected, cited) {
    var pal = palette(group);
    return {
      size: selected ? 28 : 16,
      borderWidth: selected ? 4 : cited ? 3 : 1,
      color: {
        background: pal.background,
        border: selected || cited ? TEAL : pal.border,
        highlight: {
          background: pal.background,
          border: TEAL,
        },
        hover: {
          background: pal.highlight,
          border: TEAL,
        },
      },
    };
  }

  function toNode(n) {
    var group = n.group || "literature";
    var style = nodeStyle(n.id, group, false, false);
    var year = n.date ? String(n.date).slice(0, 4) : "";
    return {
      id: n.id,
      label: n.label || n.id,
      group: group,
      title: n.title || (year ? year + " · " + (n.label || n.id) : n.label || n.id),
      font: { color: PAPER, face: "IBM Plex Sans", size: 12 },
      shape: "dot",
      size: style.size,
      borderWidth: style.borderWidth,
      color: style.color,
    };
  }

  function toEdge(e) {
    return {
      from: e.from,
      to: e.to,
      label: e.label || "",
      arrows: e.arrows || "to",
      color: { color: "#3a4254", highlight: TEAL, hover: TEAL },
      font: { color: "#8b93a7", size: 10, strokeWidth: 0 },
      width: 1.2,
      smooth: { type: "continuous" },
    };
  }

  function applyHighlight() {
    if (!nodes) return;
    var ids = nodes.getIds();
    var updates = [];
    for (var i = 0; i < ids.length; i++) {
      var id = ids[i];
      var meta = nodeMeta[id] || { group: "literature" };
      var selected = highlight.selectedId === id;
      var cited = highlight.citedIds.indexOf(id) !== -1;
      var style = nodeStyle(id, meta.group, selected, cited);
      updates.push({
        id: id,
        size: style.size,
        borderWidth: style.borderWidth,
        color: style.color,
      });
    }
    if (updates.length) nodes.update(updates);
    if (network) {
      try {
        network.selectNodes(highlight.selectedId ? [highlight.selectedId] : [], false);
      } catch (err) {
        /* node may not exist yet */
      }
    }
  }

  function mount(el) {
    destroy();
    host = el;
    if (!host) return;

    var g = visNS();
    if (!g || !g.Network || !g.DataSet) {
      console.error("CiteLineGraph: global vis.Network / vis.DataSet missing");
      return;
    }

    nodes = new g.DataSet([]);
    edges = new g.DataSet([]);
    network = new g.Network(
      host,
      { nodes: nodes, edges: edges },
      {
        height: "280px",
        width: "100%",
        autoResize: true,
        physics: {
          enabled: true,
          solver: "barnesHut",
          barnesHut: {
            gravitationalConstant: -1800,
            centralGravity: 0.12,
            springLength: 130,
            springConstant: 0.04,
            damping: 0.42,
            avoidOverlap: 0.28,
          },
          minVelocity: 0.75,
          stabilization: { enabled: true, iterations: 80 },
        },
        interaction: {
          hover: true,
          tooltipDelay: 120,
          zoomView: true,
          dragView: true,
          dragNodes: true,
        },
        nodes: {
          shape: "dot",
          size: 16,
          font: { color: PAPER, face: "IBM Plex Sans", size: 12 },
          borderWidth: 1,
        },
        edges: {
          arrows: { to: { enabled: true, scaleFactor: 0.55 } },
          color: { color: "#3a4254", highlight: TEAL },
          smooth: { type: "continuous" },
          width: 1.2,
        },
      }
    );

    network.on("click", function (params) {
      var id = params && params.nodes && params.nodes[0];
      if (id && selectCb) selectCb(id);
    });
  }

  function render(graph, opts) {
    if (!network || !nodes || !edges) return;
    opts = opts || {};
    var animate = !!opts.animate;
    graph = graph || { nodes: [], edges: [] };
    var payloadNodes = (graph.nodes || []).map(toNode);
    var payloadEdges = (graph.edges || []).map(toEdge);

    clearTimers();
    animGen += 1;
    var gen = animGen;
    nodeMeta = {};
    payloadNodes.forEach(function (n) {
      nodeMeta[n.id] = { group: n.group };
    });

    nodes.clear();
    edges.clear();

    function finish() {
      if (gen !== animGen) return;
      applyHighlight();
      try {
        network.fit({ animation: animate });
      } catch (err) {
        /* empty graph */
      }
    }

    if (!payloadNodes.length) {
      finish();
      return;
    }

    if (!animate || payloadNodes.length < 2) {
      nodes.add(payloadNodes);
      if (payloadEdges.length) edges.add(payloadEdges);
      finish();
      return;
    }

    payloadNodes.forEach(function (row, i) {
      later(function () {
        if (gen !== animGen || !nodes) return;
        nodes.add(row);
        applyHighlight();
      }, 70 + i * 90);
    });

    later(function () {
      if (gen !== animGen || !edges) return;
      if (payloadEdges.length) edges.add(payloadEdges);
      finish();
    }, 70 + payloadNodes.length * 90 + 80);
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
    if (network) {
      try {
        network.destroy();
      } catch (err) {
        /* already gone */
      }
    }
    network = null;
    nodes = null;
    edges = null;
    nodeMeta = {};
    host = null;
  }

  root.CiteLineGraph = {
    mount: mount,
    render: render,
    setHighlight: setHighlight,
    onSelect: onSelect,
    destroy: destroy,
  };
})(typeof window !== "undefined" ? window : this);
