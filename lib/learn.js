"use strict";

const { searchCore, amassGet } = require("./amass");
const { GOLDEN_LEARN, isGoldenTopic } = require("./golden-path");

const EDGE_CAP = 40;

function pubmedUrl(pmid, doi) {
  if (pmid) return `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`;
  if (doi) return `https://doi.org/${doi}`;
  return "https://pubmed.ncbi.nlm.nih.gov/";
}

function asDate(...cands) {
  for (const c of cands) {
    if (c && /^\d{4}/.test(String(c))) return String(c).slice(0, 10);
  }
  return null;
}

function firstDateField(obj) {
  if (!obj || typeof obj !== "object") return null;
  const preferred = [
    "publicationDate",
    "startDate",
    "authorizationDate",
    "firstAuthorizationDate",
    "completionDate",
    "resultsFirstPostDate",
    "decisionDate",
    "approvalDate",
    "lastUpdateDate",
    "createDate",
  ];
  const cands = preferred.map((k) => obj[k]);
  for (const [k, v] of Object.entries(obj)) {
    if (/date/i.test(k) && typeof v === "string") cands.push(v);
  }
  return asDate(...cands);
}

function ids(arr) {
  return Array.isArray(arr) ? arr.map(String) : [];
}

function graphNode(m) {
  const label =
    m.title.length > 48 ? `${m.title.slice(0, 45)}…` : m.title;
  return {
    id: m.id,
    label,
    group: m.kind,
    title: m.title,
    date: m.date,
  };
}

/**
 * Citation graph from live Amass:
 * - a node for every literature milestone
 * - extra nodes for other milestones that appear as edge endpoints
 * - paper→paper when references / citedBy intersect retrieved paper IDs
 *   (from citer → cited, arrows: "to")
 * - paper→trial when referencesTrialCore intersects retrieved trials
 * - cap ~40 edges
 */
function buildCitationGraph(milestones, citeById) {
  const byId = new Map(milestones.map((m) => [m.id, m]));
  const nodeIds = new Set();
  const edges = [];
  const seen = new Set();

  function addNode(id) {
    if (byId.has(id)) nodeIds.add(id);
  }

  function addEdge(from, to, label) {
    if (edges.length >= EDGE_CAP) return;
    if (!from || !to || from === to) return;
    if (!byId.has(from) || !byId.has(to)) return;
    const key = `${from}\t${to}`;
    if (seen.has(key)) return;
    seen.add(key);
    addNode(from);
    addNode(to);
    edges.push({ from, to, label, arrows: "to" });
  }

  for (const m of milestones) {
    if (m.kind === "literature") addNode(m.id);
  }

  for (const m of milestones) {
    if (m.kind !== "literature") continue;
    const cite = citeById.get(m.id) || {};
    for (const rid of ids(cite.references)) {
      addEdge(m.id, rid, "cites");
    }
    for (const cid of ids(cite.citedBy)) {
      addEdge(cid, m.id, "cites");
    }
    for (const tid of ids(cite.referencesTrialCore)) {
      addEdge(m.id, tid, "cites trial");
    }
  }

  return {
    nodes: [...nodeIds].map((id) => graphNode(byId.get(id))),
    edges,
  };
}

async function expandCitedNeighbors(papers, apiKey) {
  const have = new Set(papers.map((p) => String(p.amassId)));
  const counts = new Map();
  for (const p of papers) {
    for (const id of [...ids(p.references), ...ids(p.citedBy)]) {
      if (!have.has(id)) counts.set(id, (counts.get(id) || 0) + 1);
    }
  }
  const extraIds = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(([id]) => id);
  if (!extraIds.length) return [];
  const fetched = await Promise.all(
    extraIds.map(async (id) => {
      try {
        return await amassGet(
          `/cores/biomedcore/records/${id}?include=references&include=citedBy`,
          apiKey,
        );
      } catch {
        return null;
      }
    }),
  );
  return fetched.filter(Boolean);
}

async function learnFromAmass(topic, apiKey) {
  const [papers, trials, drugs, genes, regs] = await Promise.all([
    searchCore(
      "biomedcore",
      topic,
      apiKey,
      {
        minJournalQualityJufo: "2",
        include: ["references", "citedBy", "referencesTrialCore"],
      },
      10,
    ),
    searchCore("trialcore", topic, apiKey, {}, 8),
    searchCore("drugcore", topic, apiKey, {}, 6),
    searchCore(
      "genecore",
      topic,
      apiKey,
      { geneType: "PROTEIN_CODING", include: "protein" },
      5,
    ),
    searchCore("regulatorycore", topic, apiKey, {}, 6),
  ]);

  const neighbors = await expandCitedNeighbors(papers, apiKey);
  const seenPaper = new Set(papers.map((p) => String(p.amassId)));
  for (const extra of neighbors) {
    const id = extra && extra.amassId && String(extra.amassId);
    if (!id || seenPaper.has(id)) continue;
    seenPaper.add(id);
    papers.push(extra);
  }

  const milestones = [];
  const citeById = new Map();

  for (const p of papers) {
    const date = asDate(p.publicationDate);
    if (!date) continue;
    const pmid = p.pmid || null;
    const title = p.title || "Untitled publication";
    const abs = String(p.abstract || "").slice(0, 600);
    const id = String(p.amassId);
    citeById.set(id, {
      references: p.references,
      citedBy: p.citedBy,
      referencesTrialCore: p.referencesTrialCore,
    });
    milestones.push({
      id,
      kind: "literature",
      core: "biomedcore",
      date,
      title,
      summary: abs || title,
      teach: abs
        ? `From the abstract: ${abs.slice(0, 420)}`
        : "This paper is in the retrieved BioMedCore set; open the source for the full record.",
      sourceLabel: pmid
        ? `PMID ${pmid}${p.journal ? ` · ${p.journal}` : ""}`
        : String(p.doi || p.amassId),
      sourceUrl: pubmedUrl(pmid, p.doi),
      citationCount: p.citationCount ?? null,
    });
  }

  for (const t of trials) {
    const date = asDate(t.startDate, t.completionDate, t.lastUpdateDate);
    if (!date) continue;
    const nct = t.nctId || t.registryId || "";
    const title = t.acronym
      ? `${t.acronym}: ${t.briefTitle}`
      : String(t.briefTitle || t.officialTitle || "Clinical trial");
    const summary = String(t.briefSummary || title).slice(0, 600);
    milestones.push({
      id: String(t.amassId),
      kind: "trial",
      core: "trialcore",
      date,
      title,
      summary,
      teach: `Trial ${nct || t.amassId} (${t.phase ?? "phase n/a"}, ${t.overallStatus ?? "status n/a"}). ${summary.slice(0, 360)}`,
      sourceLabel: nct || String(t.amassId),
      sourceUrl:
        t.sourceUrl ||
        (String(nct).startsWith("NCT")
          ? `https://clinicaltrials.gov/study/${nct}`
          : "https://clinicaltrials.gov/"),
      extra: [t.phase, t.overallStatus].filter(Boolean).join(" · ") || undefined,
    });
  }

  for (const d of drugs) {
    const date = firstDateField(d);
    if (!date) continue;
    const name = String(d.name || "Drug");
    const trade =
      Array.isArray(d.tradeNames) && d.tradeNames[0] ? ` (${d.tradeNames[0]})` : "";
    milestones.push({
      id: String(d.amassId),
      kind: "drug",
      core: "drugcore",
      date,
      title: `${name}${trade}`,
      summary: String(d.description || `${name} — ${d.maxClinicalStage ?? ""}`).slice(
        0,
        600,
      ),
      teach: `${name} is a ${d.drugType ?? "molecule"} in DrugCore at stage ${d.maxClinicalStage ?? "unknown"}. ${String(d.description || "").slice(0, 280)}`,
      sourceLabel: d.chemblId || String(d.amassId),
      sourceUrl: d.chemblId
        ? `https://www.ebi.ac.uk/chembl/compound_report_card/${d.chemblId}/`
        : "https://www.ebi.ac.uk/chembl/",
      extra: [d.drugType, d.maxClinicalStage].filter(Boolean).join(" · ") || undefined,
    });
  }

  for (const r of regs) {
    const date = asDate(
      r.authorizationDate,
      r.firstAuthorizationDate,
      r.decisionDate,
    );
    if (!date) continue;
    const title = String(
      r.name || r.productName || r.inventedName || r.activeSubstance || "Authorization",
    );
    milestones.push({
      id: String(r.amassId),
      kind: "regulatory",
      core: "regulatorycore",
      date,
      title: `${r.agency ?? "Regulator"}: ${title}`,
      summary: String(
        r.therapeuticIndication || r.indication || r.authorizationStatus || "Regulatory authorization",
      ).slice(0, 600),
      teach: `A ${r.agency ?? "regulatory"} record for ${title}. Status: ${r.authorizationStatus ?? "n/a"}.`,
      sourceLabel: String(r.agency || r.amassId),
      sourceUrl: r.sourceUrl || "https://www.fda.gov/",
    });
  }

  milestones.sort((a, b) => a.date.localeCompare(b.date));

  let protein = null;
  const gene = genes[0];
  if (gene) {
    const uniprot =
      (Array.isArray(gene.uniprotIds) && gene.uniprotIds[0]) ||
      (gene.protein &&
        gene.protein.identity &&
        gene.protein.identity.canonicalAccession) ||
      null;
    if (uniprot) {
      protein = {
        symbol: String(gene.symbol || "GENE"),
        name: String(gene.name || gene.symbol || "Protein"),
        uniprotId: String(uniprot),
        geneAmassId: String(gene.amassId),
        summary: String(gene.summary || "").slice(0, 800),
        alphafoldPdbUrl: `https://alphafold.ebi.ac.uk/files/AF-${uniprot}-F1-model_v6.pdb`,
      };
      const geneDate = firstDateField(gene) || "1992-01-01";
      milestones.unshift({
        id: String(gene.amassId),
        kind: "gene",
        core: "genecore",
        date: geneDate,
        title: `${protein.symbol} — ${protein.name}`,
        summary: protein.summary || "GeneCore protein-coding gene.",
        teach: `${protein.symbol} maps to UniProt ${protein.uniprotId}. That accession is the AlphaFold lookup key.`,
        sourceLabel: `UniProt ${protein.uniprotId}`,
        sourceUrl: `https://www.uniprot.org/uniprotkb/${protein.uniprotId}`,
        extra: protein.symbol,
      });
    }
  }

  const kept = milestones.slice(0, 24);
  const graph = buildCitationGraph(kept, citeById);
  return { milestones: kept, protein, graph };
}

/**
 * Golden path unless apiKey and (forceLive or not golden).
 * On live failure, return golden + fallbackReason.
 */
async function learnTopic(topic, apiKey, forceLive) {
  const t = String(topic || "").trim();
  const wantLive = Boolean(apiKey) && (forceLive || !isGoldenTopic(t));
  if (!wantLive) {
    return {
      ...GOLDEN_LEARN,
      topic: t || GOLDEN_LEARN.topic,
      queryUsed: t || GOLDEN_LEARN.queryUsed,
    };
  }
  try {
    const live = await learnFromAmass(t, apiKey);
    return {
      topic: t,
      queryUsed: t,
      cached: false,
      liveAmass: true,
      milestones: live.milestones,
      protein: live.protein,
      graph: live.graph,
    };
  } catch (err) {
    return {
      ...GOLDEN_LEARN,
      topic: t || GOLDEN_LEARN.topic,
      queryUsed: t || GOLDEN_LEARN.queryUsed,
      cached: true,
      liveAmass: false,
      fallbackReason: err instanceof Error ? err.message : "amass_failed",
    };
  }
}

module.exports = {
  learnFromAmass,
  learnTopic,
  buildCitationGraph,
};
