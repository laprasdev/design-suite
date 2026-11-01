const FOCUSABLE='a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary,[tabindex]';

export const focusableControls=(root: ParentNode)=>[...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(node=>node.tabIndex>=0&&node.getClientRects().length&&getComputedStyle(node).visibility==='visible'&&!node.closest('[inert]'));
