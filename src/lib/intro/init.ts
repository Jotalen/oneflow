/** sessionStorage key: the intro plays once per tab. Add `?intro` to the URL to play it again. */
export const INTRO_KEY = "oneflow:intro-seen";

/** The intro is a desktop moment: never on phones (phone width or a touch-first screen) or with reduced motion. */
const SKIP_INTRO_QUERY = "(prefers-reduced-motion: reduce), (max-width: 767px), (pointer: coarse)";

/**
 * Runs in <head> before first paint: marks html[data-intro="play"] so the overlay covers the
 * page from the very first frame (no flash of the dashboard). Desktop only.
 */
export const INTRO_INIT_SCRIPT = `try{var f=/[?&]intro(=|&|$)/.test(location.search);if((f||!sessionStorage.getItem(${JSON.stringify(INTRO_KEY)}))&&!matchMedia(${JSON.stringify(SKIP_INTRO_QUERY)}).matches)document.documentElement.dataset.intro="play"}catch(e){}`;
