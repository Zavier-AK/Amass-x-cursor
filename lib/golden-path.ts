import type { LearnResult, Milestone, ProteinInfo } from "./types";

export const GOLDEN_TOPIC = "GLP-1 receptor";

export const GOLDEN_ALIASES = [
  "glp-1 receptor",
  "glp1 receptor",
  "glp1r",
  "glp-1",
  "glp1",
  "semaglutide",
  "incretin",
];

export function isGoldenTopic(topic: string): boolean {
  const n = topic.trim().toLowerCase();
  return GOLDEN_ALIASES.some((a) => n === a || n.includes(a));
}

export const GOLDEN_PROTEIN: ProteinInfo = {
  symbol: "GLP1R",
  name: "Glucagon-like peptide 1 receptor",
  uniprotId: "P43220",
  geneAmassId: "AMGC_GOLDEN_GLP1R",
  summary:
    "Class B GPCR for the incretin GLP-1. Expressed in pancreatic beta cells, brain, and GI tract. Ligand binding raises cAMP, amplifying glucose-dependent insulin secretion — the molecular target of exenatide, liraglutide, and semaglutide.",
  alphafoldPdbUrl: "https://alphafold.ebi.ac.uk/files/AF-P43220-F1-model_v6.pdb",
};

export const GOLDEN_NOTES_EXAMPLE = `GLP-1 is a hormone that lowers blood sugar. Semaglutide is a GLP-1 drug used for diabetes. I think the receptor was found in the 2000s when these drugs were invented.`;

export const GOLDEN_DEMO_QUESTION =
  "Why did GLP-1 medicines expand from diabetes into obesity — and which evidence on this timeline actually supports that shift?";

const M: Milestone[] = [
  {
    id: "AMBC_glp1_1983",
    kind: "literature",
    core: "biomedcore",
    date: "1983-07-28",
    title: "GLP-1 sequence identified from the proglucagon gene",
    summary:
      "Bell and colleagues predicted glucagon-like peptides encoded in the mammalian proglucagon gene, opening the incretin chapter of peptide endocrinology.",
    teach: "Before anyone had a diabetes shot, the gene for glucagon was found to encode extra peptides — GLP-1 and GLP-2. That prediction is the starting gun for this entire drug class.",
    sourceLabel: "PMID 6130460 · Nature",
    sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/6130460/",
    citationCount: 1200,
  },
  {
    id: "AMBC_glp1_1987",
    kind: "literature",
    core: "biomedcore",
    date: "1987-09-01",
    title: "GLP-1 shown to be a potent incretin in humans",
    summary:
      "Infused GLP-1(7-36) amide markedly stimulated insulin and suppressed glucagon in healthy volunteers, establishing it as a true incretin hormone.",
    teach: "An incretin is a gut hormone that tells the pancreas to release insulin after a meal. This human infusion study is why GLP-1 looked like a medicine, not just a sequence on a gene.",
    sourceLabel: "PMID 2889136 · J Clin Endocrinol Metab",
    sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/2889136/",
    citationCount: 2100,
  },
  {
    id: "AMGC_glp1r_cloned",
    kind: "gene",
    core: "genecore",
    date: "1992-01-15",
    title: "Human GLP-1 receptor cloned",
    summary:
      "Thorens isolated the pancreatic GLP-1 receptor — a class B GPCR now catalogued as GLP1R / UniProt P43220 — giving chemists a defined protein target.",
    teach: "Cloning the receptor is the moment a hormone becomes a drug target. Everything that follows (exenatide, liraglutide, semaglutide) is a ligand for this one protein. Rotate the AlphaFold model: that is P43220.",
    sourceLabel: "PMID 1328865 · PNAS",
    sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/1328865/",
    citationCount: 900,
    extra: "UniProt P43220",
  },
  {
    id: "AMBC_exendin_1992",
    kind: "literature",
    core: "biomedcore",
    date: "1992-03-15",
    title: "Exendin-4 isolated from Gila monster venom",
    summary:
      "Exendin-4, a GLP-1 receptor agonist resistant to DPP-4 cleavage, was characterized from Heloderma suspectum venom and later became exenatide.",
    teach: "Human GLP-1 lasts minutes in blood because DPP-4 chops it. A lizard peptide happened to activate the same receptor and survive longer — nature's SAR experiment, later a twice-daily injection.",
    sourceLabel: "PMID 1312696 · J Biol Chem",
    sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/1312696/",
    citationCount: 1500,
  },
  {
    id: "AMRC_exenatide_2005",
    kind: "regulatory",
    core: "regulatorycore",
    date: "2005-04-28",
    title: "FDA approves exenatide (Byetta) for type 2 diabetes",
    summary:
      "First-in-class GLP-1 receptor agonist authorized in the US as adjunct therapy for type 2 diabetes — proof the receptor could be a medicine, not only a paper.",
    teach: "Approval is the regulatory receipt. The class is no longer a hypothesis: you can write a prescription for a GLP-1 receptor agonist.",
    sourceLabel: "FDA NDA 021773",
    sourceUrl: "https://www.accessdata.fda.gov/drugsatfda_docs/nda/2005/021773_Byetta_toc.cfm",
  },
  {
    id: "AMDC_liraglutide",
    kind: "drug",
    core: "drugcore",
    date: "2010-01-25",
    title: "Liraglutide (Victoza) — once-daily human GLP-1 analogue",
    summary:
      "Acylated GLP-1 analogue engineered for albumin binding and once-daily dosing; later also approved at a higher dose for weight management (Saxenda).",
    teach: "Chemists stopped copying the lizard and started editing human GLP-1: a fatty-acid side chain sticks it to albumin so it lasts a day. Same receptor, better pharmacokinetics.",
    sourceLabel: "ChEMBL CHEMBL1201511",
    sourceUrl: "https://www.ebi.ac.uk/chembl/compound_report_card/CHEMBL1201511/",
    extra: "maxClinicalStage APPROVAL",
  },
  {
    id: "AMTC_sustain6",
    kind: "trial",
    core: "trialcore",
    date: "2016-09-16",
    title: "SUSTAIN-6: semaglutide cardiovascular outcomes",
    summary:
      "Phase 3 randomized trial (NCT01720446) showed once-weekly semaglutide reduced major adverse cardiovascular events in type 2 diabetes.",
    teach: "Regulators asked: does this class hurt the heart? SUSTAIN-6 answered the opposite — MACE went down. That is why GLP-1 drugs became cardiometabolic medicines, not just glucose pills.",
    sourceLabel: "NCT01720446 · NEJM 2016",
    sourceUrl: "https://clinicaltrials.gov/study/NCT01720446",
    extra: "PHASE3 · COMPLETED",
  },
  {
    id: "AMDC_semaglutide",
    kind: "drug",
    core: "drugcore",
    date: "2017-12-05",
    title: "Semaglutide (Ozempic) approved for type 2 diabetes",
    summary:
      "Once-weekly GLP-1 receptor agonist with enhanced albumin binding; trade names later include Wegovy (obesity) and Rybelsus (oral).",
    teach: "Semaglutide is still a GLP-1 receptor agonist — just longer-acting and more potent. The weekly shot is a chemistry story (fatty diacid spacer) sitting on the same receptor you can spin in 3D.",
    sourceLabel: "ChEMBL CHEMBL1201477",
    sourceUrl: "https://www.ebi.ac.uk/chembl/compound_report_card/CHEMBL3707340/",
    extra: "maxClinicalStage APPROVAL",
  },
  {
    id: "AMTC_step1",
    kind: "trial",
    core: "trialcore",
    date: "2021-03-18",
    title: "STEP 1: semaglutide 2.4 mg for obesity",
    summary:
      "NCT03548935 — 68 weeks of once-weekly semaglutide 2.4 mg plus lifestyle produced ~15% mean weight loss versus placebo in adults with obesity.",
    teach: "This is the evidence for the expansion into obesity. Same receptor, higher dose, different primary endpoint (weight, not HbA1c). The teaching point: indication follows trial design, not a new molecule.",
    sourceLabel: "NCT03548935 · NEJM 2021",
    sourceUrl: "https://clinicaltrials.gov/study/NCT03548935",
    extra: "PHASE3 · COMPLETED",
  },
  {
    id: "AMRC_wegovy_2021",
    kind: "regulatory",
    core: "regulatorycore",
    date: "2021-06-04",
    title: "FDA approves Wegovy (semaglutide 2.4 mg) for chronic weight management",
    summary:
      "Regulatory authorization translating STEP-program evidence into a labeled obesity indication for a GLP-1 receptor agonist.",
    teach: "The label is the last clickable receipt: obesity is now an official use of a GLP-1 receptor agonist, not an off-label rumor.",
    sourceLabel: "FDA NDA 215256",
    sourceUrl: "https://www.accessdata.fda.gov/drugsatfda_docs/nda/2021/215256Orig1s000TOC.cfm",
  },
  {
    id: "AMTC_select",
    kind: "trial",
    core: "trialcore",
    date: "2023-11-11",
    title: "SELECT: semaglutide cuts MACE in obesity without diabetes",
    summary:
      "NCT03574597 — cardiovascular outcomes trial in adults with overweight/obesity and established CVD but without diabetes; semaglutide 2.4 mg reduced MACE.",
    teach: "The remaining objection was 'it only helps because it treats diabetes.' SELECT enrolled people without diabetes. Heart events still fell. That is the current edge of the story on this timeline.",
    sourceLabel: "NCT03574597 · NEJM 2023",
    sourceUrl: "https://clinicaltrials.gov/study/NCT03574597",
    extra: "PHASE3 · COMPLETED",
  },
];

export const GOLDEN_MILESTONES: Milestone[] = M;

export const GOLDEN_LEARN: LearnResult = {
  topic: GOLDEN_TOPIC,
  queryUsed: GOLDEN_TOPIC,
  cached: true,
  liveAmass: false,
  milestones: GOLDEN_MILESTONES,
  protein: GOLDEN_PROTEIN,
};
