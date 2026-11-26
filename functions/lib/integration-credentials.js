export const base64Url = (bytes) => btoa(String.fromCharCode(...bytes))
  .replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");

const decode = (value) => Uint8Array.from(atob(value.replaceAll("-", "+").replaceAll("_", "/")), (char) => char.charCodeAt(0));

async function credentialKey(secret, salt, usage) {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    [usage],
  );
}

export async function encryptCredential(value, secret) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await credentialKey(secret, salt, "encrypt");
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(value));
  return `${base64Url(salt)}.${base64Url(iv)}.${base64Url(new Uint8Array(encrypted))}`;
}

export async function decryptCredential(value, secret) {
  const [salt, iv, data] = String(value).split(".");
  if (!salt || !iv || !data) throw new Error("invalid_credential");
  const key = await credentialKey(secret, decode(salt), "decrypt");
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: decode(iv) }, key, decode(data));
  return new TextDecoder().decode(plain);
}
