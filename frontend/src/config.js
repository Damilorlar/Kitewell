/**
 * Kitewell frontend config.
 *
 * Horizon URLs, network passphrases and explorer bases live in ./network so a
 * network switch updates them in one place.
 */
export const API_BASE =
  import.meta.env.VITE_API_BASE?.replace(/\/$/, "") || "http://localhost:8787";
