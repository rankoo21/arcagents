import { NextRequest, NextResponse } from "next/server";

// Server-side IPFS upload via Pinata. The Pinata JWT stays on the server
// (PINATA_JWT in .env) and is never exposed to the browser.
//
// Accepts multipart/form-data with either:
//   - "file": a binary file to pin, or
//   - "text": a plain string to pin as a .txt file
// Returns: { cid, uri, gatewayUrl }

export const runtime = "nodejs";

const PINATA_ENDPOINT = "https://api.pinata.cloud/pinning/pinFileToIPFS";

export async function POST(req: NextRequest) {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) {
    return NextResponse.json(
      {
        error:
          "IPFS upload is not configured. Set PINATA_JWT in .env to enable it.",
      },
      { status: 501 }
    );
  }

  let incoming: FormData;
  try {
    incoming = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart/form-data." },
      { status: 400 }
    );
  }

  const file = incoming.get("file");
  const text = incoming.get("text");

  // Build the form we forward to Pinata.
  const out = new FormData();
  let suggestedName = "deliverable.txt";

  if (file && file instanceof File) {
    out.append("file", file, file.name || "deliverable");
    suggestedName = file.name || "deliverable";
  } else if (typeof text === "string" && text.trim().length > 0) {
    const blob = new Blob([text], { type: "text/plain" });
    out.append("file", blob, "deliverable.txt");
  } else {
    return NextResponse.json(
      { error: "Provide a 'file' or non-empty 'text' field." },
      { status: 400 }
    );
  }

  out.append(
    "pinataMetadata",
    JSON.stringify({ name: suggestedName })
  );
  out.append("pinataOptions", JSON.stringify({ cidVersion: 1 }));

  try {
    const res = await fetch(PINATA_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${jwt}` },
      body: out,
    });

    if (!res.ok) {
      const detail = await res.text();
      return NextResponse.json(
        { error: `Pinata upload failed (${res.status}).`, detail },
        { status: 502 }
      );
    }

    const data = (await res.json()) as { IpfsHash?: string };
    const cid = data.IpfsHash;
    if (!cid) {
      return NextResponse.json(
        { error: "Pinata did not return a CID." },
        { status: 502 }
      );
    }

    const gateway =
      process.env.PINATA_GATEWAY?.replace(/\/+$/, "") ||
      "https://gateway.pinata.cloud";

    return NextResponse.json({
      cid,
      uri: `ipfs://${cid}`,
      gatewayUrl: `${gateway}/ipfs/${cid}`,
    });
  } catch (err: unknown) {
    const e = err as { message?: string };
    return NextResponse.json(
      { error: e.message || "Upload request failed." },
      { status: 500 }
    );
  }
}
