import {
  DecryptCommand,
  EncryptCommand,
  KMSClient,
} from "@aws-sdk/client-kms";

const client = new KMSClient({});

export async function encryptToken(
  keyArn: string,
  token: string,
): Promise<string> {
  const response = await client.send(
    new EncryptCommand({
      KeyId: keyArn,
      Plaintext: Buffer.from(token, "utf8"),
    }),
  );

  if (response.CiphertextBlob === undefined) {
    throw new Error("KMS did not return an encrypted token.");
  }

  return Buffer.from(response.CiphertextBlob).toString("base64");
}

export async function decryptToken(ciphertext: string): Promise<string> {
  const response = await client.send(
    new DecryptCommand({
      CiphertextBlob: Buffer.from(ciphertext, "base64"),
    }),
  );

  if (response.Plaintext === undefined) {
    throw new Error("KMS did not return a decrypted token.");
  }

  return Buffer.from(response.Plaintext).toString("utf8");
}
