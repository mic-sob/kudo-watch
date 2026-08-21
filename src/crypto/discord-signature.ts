import { createPublicKey, verify } from "node:crypto";

const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

export function verifyDiscordSignature(input: {
  readonly body: string;
  readonly publicKeyHex: string;
  readonly signatureHex: string;
  readonly timestamp: string;
}): boolean {
  try {
    const publicKeyBytes = Buffer.from(input.publicKeyHex, "hex");
    const signature = Buffer.from(input.signatureHex, "hex");

    if (publicKeyBytes.length !== 32 || signature.length !== 64) {
      return false;
    }

    const publicKey = createPublicKey({
      key: Buffer.concat([ED25519_SPKI_PREFIX, publicKeyBytes]),
      format: "der",
      type: "spki",
    });

    return verify(
      null,
      Buffer.from(`${input.timestamp}${input.body}`, "utf8"),
      publicKey,
      signature,
    );
  } catch {
    return false;
  }
}

