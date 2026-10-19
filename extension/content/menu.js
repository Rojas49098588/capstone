// The pet's right-click menu: plain DOM inside the pets' shadow root. No chrome.* here; pet.js
// decides what the items do. Items come from PetLogic.petMenuItems (content/logic.js, loaded first):
// [{ id, label, disabled?, hint?, children? }]. Wrapped in a function so it can be injected twice.
(() => {
  const STYLE = `
    .pet-menu {
      position: fixed; min-width: 180px; max-width: 260px; padding: 4px;
      pointer-events: auto; z-index: 2;
      background: #fff; color: #1a1816; border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,.25);
      font: 13px/1.3 system-ui, sans-serif;
    }
    .pet-menu button {
      display: block; width: 100%; padding: 6px 10px; border: 0; border-radius: 5px;
      background: none; color: inherit; font: inherit; text-align: left; cursor: pointer;
    }
    .pet-menu button:hover, .pet-menu button:focus-visible { background: #eef0f6; outline: none; }
    .pet-menu button[aria-disabled="true"] { color: #8a8e98; cursor: default; background: none; }
    .pet-menu .hint { display: block; font-size: 11px; color: #8a8e98; }
    .pet-menu [role="group"] { padding-left: 12px; }
  `;

  let current = null; // { el, controller }

  function close() {
    if (!current) return;
    current.controller.abort();
    current.el.remove();
    current = null;
  }

  function button(item, onPick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'menuitem');
    b.textContent = item.children ? `${item.label} ▸` : item.label;
    if (item.disabled) {
      b.setAttribute('aria-disabled', 'true');
      if (item.hint) {
        const hint = document.createElement('span');
        hint.className = 'hint';
        hint.textContent = item.hint;
        b.appendChild(hint);
      }
      return b;
    }
    if (item.children) {
      b.setAttribute('aria-haspopup', 'true');
      b.setAttribute('aria-expanded', 'false');
      b.addEventListener('click', () => {
        const open = b.getAttribute('aria-expanded') === 'true';
        b.setAttribute('aria-expanded', String(!open));
        if (open) {
          b.nextElementSibling?.remove();
          return;
        }
        const group = document.createElement('div');
        group.setAttribute('role', 'group');
        for (const child of item.children) group.appendChild(button(child, onPick));
        b.after(group);
        group.querySelector('button')?.focus();
      });
      return b;
    }
    b.addEventListener('click', () => {
      close();
      onPick(item.id);
    });
    return b;
  }

  /** Opens the menu at a point in the window (client pixels), replacing any open one. */
  function open(root, point, items, onPick) {
    close();
    const el = document.createElement('div');
    el.className = 'pet-menu';
    el.setAttribute('role', 'menu');
    for (const item of items) el.appendChild(button(item, onPick));
    root.appendChild(el);

    const rect = el.getBoundingClientRect();
    const pos = globalThis.PetLogic.menuPosition(
      point,
      { width: rect.width, height: rect.height },
      { width: window.innerWidth, height: window.innerHeight },
    );
    el.style.left = `${pos.left}px`;
    el.style.top = `${pos.top}px`;

    const controller = new AbortController();
    const { signal } = controller;
    current = { el, controller };
    // Escape, a click anywhere outside the menu, or scrolling closes it.
    document.addEventListener('keydown', (e) => e.key === 'Escape' && close(), { capture: true, signal });
    document.addEventListener('pointerdown', (e) => !e.composedPath().includes(el) && close(), { capture: true, signal });
    window.addEventListener('scroll', close, { capture: true, signal });
    el.querySelector('button')?.focus();
  }

  globalThis.PetMenu = { STYLE, open, close, isOpen: () => current !== null };
})();
