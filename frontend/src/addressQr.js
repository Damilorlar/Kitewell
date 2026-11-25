import { toDataURL } from "qrcode";

/**
 * Build a scannable QR code data URL for a public address.
 * Returns null when no address is provided so callers can hide the code.
 */
export async function generateAddressQrCode(address) {
  if (!address) return null;
  return toDataURL(address);
}
