import { useEffect } from 'react';

/**
 * Closes a popover when the user clicks anywhere outside `ref` or hits Escape.
 * Pass the wrapper element ref + the close callback.
 *
 *   const ref = useRef(null);
 *   const [open, setOpen] = useState(false);
 *   usePopoverDismiss(open, ref, () => setOpen(false));
 */
export default function usePopoverDismiss(open, ref, onClose) {
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (ref?.current && !ref.current.contains(e.target)) onClose?.();
    };
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, ref, onClose]);
}
