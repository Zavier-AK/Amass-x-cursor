/* CiteLine canvas graph — rounded white cards on a pan/zoom field. */
(function (root) {
  "use strict";

  var ORANGE = "#f26b21";
  var HAIRLINE = "#e6e1d8";
  var INK = "#1a1a1a";
  var MUTE = "#8a8680";
  var WHITE = "#ffffff";

  var host = null;
  var network = null;
  var nodes = null;
  var edges = null;
  var selectCb = null;
  var timers = [];
  var highlight = { selectedId: null };
  var nodeMeta = {};
  var animGen = 0;

  function visNS() {
    return root.visNetwork || (typeof vis !== "undefined" ? vis : root.vis);
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

  function styleFor(selected) {
    return {
      borderWidth: selected ? 2 : 1,
      color: {
        background: WHITE,
        border: selected ? ORANGE : HAIRLINE,
        highlight: { background: WHITE, border: ORANGE },
        hover: { background: WHITE, border: ORANGE },
      },
    };
  }

  function layoutNodes(list) {
    var years = list.map(function (n) {
      var y = parseInt(n.year || (n.date || "").slice(0, 4), 10);
      return isNaN(y) ? 2000 : y;
    });
    var min = Math.min.apply(null, years);
    var max = Math.max.apply(null, years);
    var span = Math.max(1, max - min);
    return list.map(function (n, i) {
      var y = years[i];
      var x = ((y - min) / span) * 920;
      var row = i % 3;
      var yy = (row - 1) * 130;
      var style = styleFor(false);
      var sub = n.sub || n.title || "";
      return {
        id: n.id,
        label: (n.label || n.id) + "\n" + sub,
        x: x,
        y: yy,
        year: y,
        font: {
          color: INK,
          face: "IBM Plex Sans",
          size: 13,
          multi: true,
          bold: { color: INK, size: 13 },
        },
        shape: "box",
        margin: { top: 12, right: 16, bottom: 12, left: 16 },
        shapeProperties: { borderRadius: 16 },
        borderWidth: style.borderWidth,
        color: style.color,
        shadow: false,
        widthConstraint: { maximum: 210 },
      };
    });
  }

  function toEdge(e) {
    return {
      from: e.from,
      to: e.to,
      arrows: { to: { enabled: true, scaleFactor: 0.45 } },
      color: { color: HAIRLINE, highlight: MUTE, hover: MUTE },
      width: 1,
      smooth: { type: "cubicBezier", forceDirection: "horizontal", roundness: 0.4 },
    };
  }

  function applyHighlight() {
    if (!nodes) return;
    var ids = nodes.getIds();
    var updates = [];
    for (var i = 0; i < ids.length; i++) {
      var id = ids[i];
      var selected = highlight.selectedId === id;
      var style = styleFor(selected);
      updates.push({
        id: id,
        borderWidth: style.borderWidth,
        color: style.color,
      });
    }
    if (updates.length) nodes.update(updates);
    if (network) {
      try {
        network.selectNodes(highlight.selectedId ? [highlight.selectedId] : [], false);
      } catch (err) {
        /* ignore */
      }
    }
  }

  function mount(el) {
    destroy();
    host = el;
    if (!host) return;
    var g = visNS();
    if (!g || !g.Network || !g.DataSet) {
      console.error("CiteLineGraph: vis.Network missing");
      return;
    }
    nodes = new g.DataSet([]);
    edges = new g.DataSet([]);
    network = new g.Network(
      host,
      { nodes: nodes, edges: edges },
      {
        height: "100%",
        width: "100%",
        autoResize: true,
        physics: false,
        interaction: {
          hover: true,
          tooltipDelay: 180,
          zoomView: true,
          dragView: true,
          dragNodes: false,
          navigationButtons: false,
          keyboard: false,
        },
        nodes: {
          shape: "box",
          font: { color: INK, face: "IBM Plex Sans", size: 13 },
        },
        edges: {
          color: { color: HAIRLINE },
          width: 1,
        },
      }
    );
    network.on("click", function (params) {
      var id = params && params.nodes && params.nodes[0];
      if (id && selectCb) selectCb(id);
      if (!id && selectCb) selectCb(null);
    });
    try {
      if (network.canvas && network.canvas.frame) {
        network.canvas.frame.style.background = "transparent";
      }
    } catch (err) {
      /* ignore */
    }
  }

  function render(graph, opts) {
    if (!network || !nodes || !edges) return;
    opts = opts || {};
    var animate = !!opts.animate;
    graph = graph || { nodes: [], edges: [] };
    var payloadNodes = layoutNodes(graph.nodes || []);
    var payloadEdges = (graph.edges || []).map(toEdge);

    clearTimers();
    animGen += 1;
    var gen = animGen;
    nodeMeta = {};
    payloadNodes.forEach(function (n) {
      nodeMeta[n.id] = n;
    });
    nodes.clear();
    edges.clear();

    function finish() {
      if (gen !== animGen) return;
      applyHighlight();
      try {
        network.fit({ animation: animate, padding: 80 });
      } catch (err) {
        /* empty */
      }
    }

    if (!payloadNodes.length) {
      finish();
      return;
    }

    payloadNodes.sort(function (a, b) {
      return (a.year || 0) - (b.year || 0);
    });

    if (!animate) {
      nodes.add(payloadNodes);
      if (payloadEdges.length) edges.add(payloadEdges);
      finish();
      return;
    }

    payloadNodes.forEach(function (row, i) {
      later(function () {
        if (gen !== animGen || !nodes) return;
        nodes.add(row);
        try {
          network.fit({ animation: { duration: 220, easingFunction: "easeInOutQuad" }, padding: 80 });
        } catch (err) {
          /* ignore */
        }
      }, 80 + i * 110);
    });

    later(function () {
      if (gen !== animGen || !edges) return;
      if (payloadEdges.length) edges.add(payloadEdges);
      finish();
    }, 80 + payloadNodes.length * 110 + 60);
  }

  function setHighlight(selectedId) {
    highlight.selectedId = selectedId || null;
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
        /* gone */
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
