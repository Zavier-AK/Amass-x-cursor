import { NextResponse } from "next/server";

const AF_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json, chemical/x-pdb, */*",
};

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ uniprot: string }> },
) {
  const { uniprot } = await ctx.params;
  const id = uniprot.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!id) return NextResponse.json({ error: "bad id" }, { status: 400 });

  const metaRes = await fetch(
    `https://alphafold.ebi.ac.uk/api/prediction/${id}`,
    { headers: AF_HEADERS, cache: "no-store" },
  );
  if (!metaRes.ok) {
    return NextResponse.json(
      { error: "alphafold_miss", uniprot: id },
      { status: 404 },
    );
  }
  const meta = (await metaRes.json()) as Array<{ pdbUrl?: string }>;
  const pdbUrl = meta[0]?.pdbUrl;
  if (!pdbUrl) {
    return NextResponse.json(
      { error: "alphafold_no_pdb", uniprot: id },
      { status: 404 },
    );
  }

  const res = await fetch(pdbUrl, { headers: AF_HEADERS, cache: "no-store" });
  if (!res.ok) {
    return NextResponse.json(
      { error: "alphafold_pdb_fetch", uniprot: id },
      { status: 502 },
    );
  }
  const pdb = await res.text();
  return new NextResponse(pdb, {
    headers: {
      "content-type": "chemical/x-pdb",
      "cache-control": "public, max-age=86400",
    },
  });
}
