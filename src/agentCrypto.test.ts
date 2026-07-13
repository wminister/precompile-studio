// @vitest-environment node

import { describe, expect, it } from "vitest";
import { hexToBytes } from "viem";
import { decrypt, PrivateKey } from "eciesjs";
import { encryptAgentProviderSecret } from "./agentCrypto";

describe("Agent secret encryption", () => {
  it("encrypts the Ritual provider secret for the selected executor", async () => {
    const privateKey = new PrivateKey();
    const publicKey = `0x${privateKey.publicKey.toHex(false)}`;
    const encrypted = await encryptAgentProviderSecret(publicKey);
    const plaintext = decrypt(privateKey.toHex(), hexToBytes(encrypted));
    expect(new TextDecoder().decode(plaintext)).toBe('{"LLM_PROVIDER":"ritual"}');
  });

  it("rejects registry keys that are not uncompressed secp256k1 keys", async () => {
    await expect(encryptAgentProviderSecret("0x1234")).rejects.toThrow("65-byte uncompressed");
  });
});
