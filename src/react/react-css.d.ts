// Views set CSS custom properties (design tokens, a view's own variables) in
// their inline styles. Inherited signatures also merge across local package links.
import 'react';
type CSSCustomProperties = {[custom: `--${string}`]: string|number|undefined};
declare module 'react' {
 interface CSSProperties extends CSSCustomProperties {}
}
