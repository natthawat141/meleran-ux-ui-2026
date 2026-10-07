/// <reference types="vite/client" />

declare module '*.png' {
  const src: string;
  export default src;
}

declare module '*.PNG' {
  const src: string;
  export default src;
}

declare module '*.jpg' {
  const src: string;
  export default src;
}

declare module '*.jpeg' {
  const src: string;
  export default src;
}

declare module '*.svg' {
  const src: string;
  export default src;
}

declare module '*.webp' {
  const src: string;
  export default src;
}

declare module '*.mp4' {
  const src: string;
  export default src;
}

interface ImportMetaEnv {
  readonly VITE_APP_ENV?: string;
  /** Public same-origin API path prefix, for example /api. Never put secrets here. */
  readonly VITE_API_BASE_URL?: string;
}
