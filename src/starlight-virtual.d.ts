// Starlight resolves this virtual module at build time but does not ship a type declaration for it.
declare module 'virtual:starlight/user-config' {
  const config: import('@astrojs/starlight/types').StarlightConfig;
  export default config;
}
