const allowedNextPaths = [
  "/train",
  "/wizard",
  "/kpi",
  "/settings",
  "/library/exercises"
] as const;

export const resolveNextPath = (candidate?: string | null): string | null => {
  if (!candidate || typeof candidate !== "string") return null;
  if (!candidate.startsWith("/") || candidate.startsWith("//")) return null;

  try {
    const url = new URL(candidate, "http://localhost");
    const isAllowed = allowedNextPaths.some(
      (path) =>
        url.pathname === path ||
        (url.pathname.startsWith(path) && url.pathname.charAt(path.length) === "/")
    );

    return isAllowed ? `${url.pathname}${url.search}${url.hash}` : null;
  } catch {
    return null;
  }
};

export const isProgramEmpty = (
  value: Record<string, unknown> | null | undefined
): boolean => {
  if (!value) return true;
  return Object.keys(value).length === 0;
};

export const defaultRedirectForProfile = (activeProgram: {
  active_program_json: Record<string, unknown> | null;
}): "/wizard" | "/train" =>
  isProgramEmpty(activeProgram.active_program_json) ? "/wizard" : "/train";
