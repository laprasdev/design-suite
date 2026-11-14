// Loaded with --import by the cycle gate test: the typescript module can't be resolved in this process or the ones it
// starts, as on a machine where dependency-cruiser has no TypeScript compiler beside it.
import { registerHooks } from 'node:module';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'typescript' || specifier.startsWith('typescript/')) {
      throw new Error(`${specifier} is withheld by tests/withoutTypeScript.ts.`);
    }
    return nextResolve(specifier, context);
  },
});
