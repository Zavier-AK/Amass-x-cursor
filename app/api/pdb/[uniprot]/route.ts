import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ uniprot: string }> },
) {
  const { uniprot } = await ctx.params;
  const id = uniprot.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!id) return NextResponse.json({ error: "bad id" }, { status: 400 });

  const url = `https://alphafold.ebi.ac.uk/files/AF-${id}-F1-model_v4.pdb`;
  const res = await fetch(url, { cache: "force-cache" });
  if (!res.ok) {
    return NextResponse.json(
      { error: "alphafold_miss", uniprot: id },
      { status: 404 },
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
