export { default } from "next-auth/middleware";

export const config = {
  matcher: ["/today/:path*", "/find/:path*", "/songs/:path*", "/assistant/:path*", "/id/:path*"]
};
