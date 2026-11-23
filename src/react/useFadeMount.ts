import { useEffect, useState } from "react";
// How long a Modal fades out before it unmounts.
const FADE_MS = 200;

/* Keep a node mounted through its fade-out, returning [mounted, visible].
   `visible` flips true on the frame after mount so the CSS transition runs. */
export function useFadeMount(open: boolean): [boolean, boolean] {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (open) return setMounted(true);
    setVisible(false);
    const t = setTimeout(() => setMounted(false), FADE_MS);
    return () => clearTimeout(t);
  }, [open]);
  useEffect(() => {
    if (!mounted) return;
    const r = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(r);
  }, [mounted]);
  return [mounted, visible];
}
