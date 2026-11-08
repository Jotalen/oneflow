/** sessionStorage key: the intro plays once per tab. Add `?intro` to the URL to play it again. */
export const INTRO_KEY = "oneflow:intro-seen";

/**
 * Runs in <head> before first paint: marks html[data-intro="play"] so the overlay covers the
 * page from the very first frame (no flash of the dashboard). Skipped for reduced motion.
 */
export const INTRO_INIT_SCRIPT = `try{var f=/[?&]intro(=|&|$)/.test(location.search);if((f||!sessionStorage.getItem(${JSON.stringify(INTRO_KEY)}))&&!matchMedia("(prefers-reduced-motion: reduce)").matches)document.documentElement.dataset.intro="play"}catch(e){}`;
