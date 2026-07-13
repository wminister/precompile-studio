import { bytesToHex, hexToBytes, stringToHex } from "viem";

export async function encryptAgentProviderSecret(publicKey: string) {
  if (!/^0x04[0-9a-f]{128}$/i.test(publicKey)) {
    throw new Error("Executor registry public key must be a 65-byte uncompressed secp256k1 key.");
  }
  const { ECIES_CONFIG, encrypt } = await import("eciesjs");
  ECIES_CONFIG.symmetricNonceLength = 12;
  const plaintext = hexToBytes(stringToHex(JSON.stringify({ LLM_PROVIDER: "ritual" })));
  return bytesToHex(encrypt(publicKey.slice(2), plaintext));
}
