import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

class RequestError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type ManageRequest = {
  action?: "invite" | "update" | "revoke";
  email?: unknown;
  userId?: unknown;
  accessType?: unknown;
  expiresAt?: unknown;
  isActive?: unknown;
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status, headers: corsHeaders });
}

function getApiKey(currentName: string, legacyName: string) {
  const currentValue = Deno.env.get(currentName);

  if (currentValue) {
    try {
      const keys = JSON.parse(currentValue) as Record<string, string>;
      const key = keys.default ?? Object.values(keys)[0];
      if (key) return key;
    } catch {
      throw new RequestError(500, `Configuration ${currentName} invalide.`);
    }
  }

  const legacyValue = Deno.env.get(legacyName);
  if (legacyValue) return legacyValue;

  throw new RequestError(
    500,
    "Configuration Supabase incomplète côté serveur.",
  );
}

function requireUserId(value: unknown) {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      .test(value)
  ) {
    throw new RequestError(400, "Identifiant administrateur invalide.");
  }
  return value;
}

function requireEmail(value: unknown) {
  if (typeof value !== "string") {
    throw new RequestError(400, "Adresse email requise.");
  }

  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new RequestError(400, "Adresse email invalide.");
  }
  return email;
}

function parseExpiration(accessTypeValue: unknown, expiresAtValue: unknown) {
  if (accessTypeValue === "unlimited") return null;
  if (accessTypeValue !== "temporary") {
    throw new RequestError(400, "Choisissez un accès illimité ou temporaire.");
  }
  if (typeof expiresAtValue !== "string") {
    throw new RequestError(400, "La date d'expiration est requise.");
  }

  const expiresAt = new Date(expiresAtValue);
  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
    throw new RequestError(
      400,
      "La date d'expiration doit être dans le futur.",
    );
  }
  return expiresAt.toISOString();
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return jsonResponse({ error: "Méthode non autorisée." }, 405);
  }

  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) {
      throw new RequestError(401, "Session requise.");
    }

    const token = authorization.slice("Bearer ".length).trim();
    if (!token) throw new RequestError(401, "Session requise.");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    if (!supabaseUrl) {
      throw new RequestError(
        500,
        "Configuration Supabase incomplète côté serveur.",
      );
    }

    const publishableKey = getApiKey(
      "SUPABASE_PUBLISHABLE_KEYS",
      "SUPABASE_ANON_KEY",
    );
    const callerClient = createClient(supabaseUrl, publishableKey, {
      accessToken: () => Promise.resolve(token),
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });

    // Validate the JWT against Supabase Auth, then authorize against the database.
    // No elevated key is read or client created before these two checks pass.
    const { data: userData, error: userError } = await callerClient.auth
      .getUser(token);
    if (userError || !userData.user) {
      throw new RequestError(401, "Session invalide ou expirée.");
    }

    const { data: owner, error: ownerError } = await callerClient.rpc(
      "is_owner",
    );
    if (ownerError) {
      throw new RequestError(
        500,
        "Impossible de vérifier les droits du propriétaire.",
      );
    }
    if (owner !== true) {
      throw new RequestError(403, "Action réservée au propriétaire.");
    }

    const secretKey = getApiKey(
      "SUPABASE_SECRET_KEYS",
      "SUPABASE_SERVICE_ROLE_KEY",
    );
    const adminClient = createClient(supabaseUrl, secretKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });

    let payload: ManageRequest;
    try {
      payload = await request.json() as ManageRequest;
    } catch {
      throw new RequestError(400, "Corps de requête JSON invalide.");
    }

    if (payload.action === "invite") {
      const email = requireEmail(payload.email);
      const expiresAt = parseExpiration(payload.accessType, payload.expiresAt);
      const redirectTo = Deno.env.get("ADMIN_INVITE_REDIRECT_URL");
      if (!redirectTo) {
        throw new RequestError(
          500,
          "L'URL de redirection des invitations n'est pas configurée.",
        );
      }

      const { data: invitation, error: invitationError } = await adminClient
        .auth.admin.inviteUserByEmail(
          email,
          { redirectTo },
        );
      if (invitationError || !invitation.user) {
        throw new RequestError(
          409,
          invitationError?.message ?? "L'invitation n'a pas pu être envoyée.",
        );
      }

      const { error: insertError } = await adminClient.from("admin_users")
        .insert({
          user_id: invitation.user.id,
          role: "admin",
          is_active: true,
          expires_at: expiresAt,
          created_by: userData.user.id,
        });
      if (insertError) {
        throw new RequestError(
          409,
          "L'invitation a été envoyée, mais l'accès administrateur n'a pas pu être créé. Vérifiez ce compte dans Supabase.",
        );
      }

      return jsonResponse({
        ok: true,
        message: `Invitation envoyée à ${email}.`,
      }, 201);
    }

    const userId = requireUserId(payload.userId);
    const { data: target, error: targetError } = await adminClient
      .from("admin_users")
      .select("user_id, role, is_active, expires_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (targetError) {
      throw new RequestError(500, "Impossible de charger cet administrateur.");
    }
    if (!target) throw new RequestError(404, "Administrateur introuvable.");
    if (target.role === "owner") {
      throw new RequestError(
        403,
        "Le compte propriétaire est permanent et protégé.",
      );
    }

    if (payload.action === "revoke") {
      const { error } = await adminClient
        .from("admin_users")
        .update({ is_active: false })
        .eq("user_id", userId)
        .eq("role", "admin");

      if (error) {
        throw new RequestError(
          500,
          "La révocation n'a pas pu être enregistrée.",
        );
      }
      return jsonResponse({
        ok: true,
        message: "Accès administrateur révoqué.",
      });
    }

    if (payload.action === "update") {
      if (typeof payload.isActive !== "boolean") {
        throw new RequestError(400, "L'état du compte est requis.");
      }
      const expiresAt = parseExpiration(payload.accessType, payload.expiresAt);

      const { error } = await adminClient
        .from("admin_users")
        .update({ is_active: payload.isActive, expires_at: expiresAt })
        .eq("user_id", userId)
        .eq("role", "admin");

      if (error) {
        throw new RequestError(
          500,
          "La modification n'a pas pu être enregistrée.",
        );
      }
      return jsonResponse({
        ok: true,
        message: "Accès administrateur mis à jour.",
      });
    }

    throw new RequestError(400, "Action inconnue.");
  } catch (error) {
    if (error instanceof RequestError) {
      return jsonResponse({ error: error.message }, error.status);
    }
    return jsonResponse({
      error: "Une erreur serveur inattendue est survenue.",
    }, 500);
  }
});
