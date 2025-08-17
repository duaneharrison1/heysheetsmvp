// Deno global types for VS Code
declare namespace Deno {
  export namespace env {
    export function get(key: string): string | undefined;
  }
}

// Declare the serve function
declare module "https://deno.land/std@0.168.0/http/server.ts" {
  export function serve(handler: (request: Request) => Response | Promise<Response>): void;
}
