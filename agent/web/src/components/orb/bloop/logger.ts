export const logger = {
  log: (...args: any[]) => console.log("[OrbBloop]", ...args),
  info: (...args: any[]) => console.info("[OrbBloop]", ...args),
  warn: (...args: any[]) => console.warn("[OrbBloop]", ...args),
  error: (...args: any[]) => console.error("[OrbBloop]", ...args),
};
