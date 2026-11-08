/**
 * Opens a native modal so it grows out of the control that opened it: sets `--origin`
 * (used by `.dialog-pop` in globals.css) to the trigger's centre, relative to the dialog's box.
 */
export function showModalFrom(dialog: HTMLDialogElement | null, trigger: Element | null): void {
  if (!dialog || dialog.open) return;
  // Open with the default centre origin: scaling about the centre leaves the box centre where
  // it will settle, so it can be read even while the opening scale is applied.
  dialog.style.removeProperty("--origin");
  dialog.showModal();
  if (!trigger) return;
  const d = dialog.getBoundingClientRect();
  const t = trigger.getBoundingClientRect();
  const left = d.left + d.width / 2 - dialog.offsetWidth / 2;
  const top = d.top + d.height / 2 - dialog.offsetHeight / 2;
  const x = t.left + t.width / 2 - left;
  const y = t.top + t.height / 2 - top;
  dialog.style.setProperty("--origin", `${Math.round(x)}px ${Math.round(y)}px`);
}
