/// <reference types="vite/client" />
declare module '*.html?url' {
  const url: string;
  export default url;
}

declare module '*.html?raw' {
  const raw: string;
  export default raw;
} 