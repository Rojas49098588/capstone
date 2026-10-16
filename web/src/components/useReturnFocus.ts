import { useEffect, useState } from "react";

/** For dialogs: remembers what had focus when the dialog opened and gives focus back when it closes. */
export function useReturnFocus() {
  // Read during the first render, before autoFocus inside the dialog moves focus.
  const [opener] = useState(() => (document.activeElement instanceof HTMLElement ? document.activeElement : null));
  useEffect(
    () => () => {
      if (opener?.isConnected) opener.focus();
    },
    [opener],
  );
}
