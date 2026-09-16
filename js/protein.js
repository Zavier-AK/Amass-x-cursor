/* CiteLine 3Dmol protein viewer. Expects CDN global `$3Dmol.createViewer`. */
(function (root) {
  "use strict";

  var EMPTY_COPY =
    "No UniProt mapping yet. GeneCore → UniProt → AlphaFold is the path we prove on the golden topic.";

  var host = null;
  var metaEl = null;
  var viewer = null;
  var showGen = 0;
  var resizeBound = false;

  function mol() {
    return root.$3Dmol;
  }

  function setMeta(html) {
    if (metaEl) metaEl.innerHTML = html;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function clearViewer() {
    if (viewer) {
      try {
        viewer.spin(false);
        viewer.clear();
      } catch (err) {
        /* ignore */
      }
      viewer = null;
    }
    if (host) host.innerHTML = "";
  }

  function proteinMeta(protein, statusHtml) {
    var uni = protein.uniprotId;
    return (
      '<p class="protein-kicker">AlphaFold · ' +
      escapeHtml(uni) +
      "</p>" +
      "<h2>" +
      escapeHtml(protein.symbol || protein.name || uni) +
      (protein.name && protein.symbol
        ? ' <span class="protein-name">' + escapeHtml(protein.name) + "</span>"
        : "") +
      "</h2>" +
      '<a href="https://www.uniprot.org/uniprotkb/' +
      encodeURIComponent(uni) +
      '" target="_blank" rel="noreferrer">UniProt</a>' +
      "<p>" +
      escapeHtml(protein.summary || "") +
      "</p>" +
      (statusHtml || "")
    );
  }

  function mount(el, meta) {
    host = el || null;
    metaEl = meta || null;
    if (host && !host.style.minHeight) host.style.minHeight = "280px";
    if (!resizeBound) {
      resizeBound = true;
      root.addEventListener("resize", function () {
        if (viewer && viewer.resize) viewer.resize();
      });
    }
    show(null);
  }

  function show(protein) {
    showGen += 1;
    var gen = showGen;
    clearViewer();

    if (!protein || !protein.uniprotId) {
      setMeta(
        '<p class="protein-kicker">Structure</p><p>' + EMPTY_COPY + "</p>"
      );
      return;
    }

    setMeta(proteinMeta(protein, "<p>Loading AlphaFold…</p>"));

    if (!host) return;

    fetch("/api/pdb/" + encodeURIComponent(protein.uniprotId))
      .then(function (res) {
        if (!res.ok) throw new Error("No AlphaFold model");
        return res.text();
      })
      .then(function (pdb) {
        if (gen !== showGen) return;
        var lib = mol();
        if (!lib || !lib.createViewer) {
          throw new Error("3Dmol failed to load");
        }
        host.innerHTML = "";
        viewer = lib.createViewer(host, {
          backgroundColor: "#10141c",
          antialias: true,
        });
        viewer.addModel(pdb, "pdb");
        viewer.setStyle({}, { cartoon: { color: "spectrum", thickness: 0.2 } });
        viewer.zoomTo();
        viewer.render();
        viewer.spin("y", 0.6);
        setMeta(
          proteinMeta(
            protein,
            "<p>Drag to rotate — this is the AlphaFold model, not an illustration.</p>"
          )
        );
      })
      .catch(function (err) {
        if (gen !== showGen) return;
        var msg = err && err.message ? err.message : "structure failed";
        setMeta(proteinMeta(protein, "<p>" + escapeHtml(msg) + "</p>"));
      });
  }

  root.CiteLineProtein = {
    mount: mount,
    show: show,
  };
})(typeof window !== "undefined" ? window : this);
