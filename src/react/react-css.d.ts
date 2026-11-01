// Views set CSS custom properties (design tokens, a view's own variables) in
// their inline styles.
import 'react';
declare module 'react' {
 interface CSSProperties {
  [custom: `--${string}`]: string|number|undefined;
 }
}
