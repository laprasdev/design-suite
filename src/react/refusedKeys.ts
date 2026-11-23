// Keys a type refuses: a value naming any of them fails the type check. `Omit` alone only drops a key, so an object
// held under a wider type still carries it through; refusing the key closes that.
export type Refused<T,K extends keyof T=keyof T>={[Key in K]?: never};
// A type less some of its keys, which it refuses.
export type Without<T,K extends keyof T>=Omit<T,K>&Refused<T,K>;
