import { supabase } from "./supabase";
import { assertSupabaseConfiguration } from "./supabase-admin";

export interface AuthenticatedUser {
  id: string;
  email: string;
}

/**
 * Validates the Authorization Bearer token from the request headers.
 * Returns the authenticated user object (UUID & Email).
 * Throws an error if authentication fails.
 */
export async function getAuthUser(request: Request): Promise<AuthenticatedUser> {
  assertSupabaseConfiguration();
  const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("Missing or invalid Authorization header");
  }

  const token = authHeader.substring(7).trim(); // Strip "Bearer " prefix

  if (!token) {
    throw new Error("Empty access token provided");
  }

  // Retrieve user using the JWT token (Safe server-side token validation)
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    console.error("Token verification error:", error?.message);
    throw new Error("Unauthorized: Session is invalid or has expired");
  }

  return {
    id: user.id,
    email: user.email || "",
  };
}
