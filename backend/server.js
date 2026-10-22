import express from "express";
import cors from "cors";
import axios from "axios";
import * as cheerio from "cheerio";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Pool } from "pg";
import sharp from "sharp";
import { randomBytes, scryptSync, timingSafeEqual, createHmac } from "crypto";

const app = express();
const APP_BUILD = "safe-paid-access-20261016-1625";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, "..");

app.use(cors());
app.use(express.json({ limit: "4mb" }));

function databaseSsl() {
  if (process.env.PGSSLMODE === "disable") return false;
  try {
    const host = new URL(process.env.DATABASE_URL || "").hostname;
    if (!host || host === "localhost" || host.endsWith(".internal")) return false;
  } catch {}
  return { rejectUnauthorized: false };
}

const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: databaseSsl() })
  : null;

const AUTH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;

const ACCESS_PLANS = {
  individual: { id: "individual", name: "Individual", price: 59.90, userLimit: 1 },
  imobiliaria: { id: "imobiliaria", name: "Imobiliária", price: 250.00, userLimit: 3 },
  equipe: { id: "equipe", name: "Equipe", price: 229.90, userLimit: 10 },
};

function accessControlEnabled() {
  return String(process.env.ACCESS_CONTROL_ENABLED || "").toLowerCase() === "true";
}

function accessControlReady() {
  return Boolean(accessControlEnabled() && pool && authSecret());
}

async function optionalAccessGate(req, res, next) {
  // Fail-open enquanto a monetização ainda estiver em configuração.
  // Só exige login quando o recurso está explicitamente ligado e tecnicamente pronto.
  if (!accessControlReady()) return next();
  return requireAuth(req, res, next);
}
let accessTablesPromise = null;

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function makeId(prefix = "id") {
  return prefix + "_" + Date.now().toString(36) + "_" + randomBytes(6).toString("hex");
}

function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  const hash = scryptSync(String(password || ""), salt, 64).toString("hex");
  return salt + ":" + hash;
}

function verifyPassword(password, stored) {
  try {
    const [salt, expectedHex] = String(stored || "").split(":");
    if (!salt || !expectedHex) return false;
    const actual = scryptSync(String(password || ""), salt, 64);
    const expected = Buffer.from(expectedHex, "hex");
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

function authSecret() {
  return process.env.AUTH_SECRET || process.env.BRANDING_SYNC_KEY || "";
}

function signToken(payload) {
  const secret = authSecret();
  if (!secret) throw new Error("AUTH_SECRET não configurado");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return body + "." + sig;
}

function readToken(token) {
  const secret = authSecret();
  if (!secret || !token || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  const a = Buffer.from(sig || "");
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  if (!payload?.uid || !payload?.exp || Date.now() >= Number(payload.exp)) return null;
  return payload;
}

async function ensureAccessTables() {
  if (!pool) throw new Error("DATABASE_URL não configurada");
  if (!accessTablesPromise) {
    accessTablesPromise = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS access_organizations (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          plan TEXT NOT NULL DEFAULT 'individual',
          status TEXT NOT NULL DEFAULT 'active',
          user_limit INTEGER NOT NULL DEFAULT 1,
          expires_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS access_users (
          id TEXT PRIMARY KEY,
          organization_id TEXT REFERENCES access_organizations(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'member',
          active BOOLEAN NOT NULL DEFAULT TRUE,
          last_login_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await pool.query("CREATE INDEX IF NOT EXISTS access_users_org_idx ON access_users(organization_id)");
      await pool.query("CREATE INDEX IF NOT EXISTS access_users_email_idx ON access_users(email)");
      await bootstrapAdminFromEnv();
    })().catch((error) => {
      accessTablesPromise = null;
      throw error;
    });
  }
  return accessTablesPromise;
}

async function bootstrapAdminFromEnv() {
  const email = normalizeEmail(process.env.ADMIN_EMAIL);
  const password = String(process.env.ADMIN_PASSWORD || "");
  if (!email || password.length < 8) return;

  const existing = await pool.query("SELECT id FROM access_users WHERE email = $1", [email]);
  if (existing.rowCount) return;

  const userId = makeId("usr");
  await pool.query(
    `INSERT INTO access_users (id, organization_id, name, email, password_hash, role, active)
     VALUES ($1, NULL, $2, $3, $4, 'superadmin', TRUE)`,
    [userId, String(process.env.ADMIN_NAME || "Administrador").slice(0, 100), email, hashPassword(password)]
  );
  console.log("✅ Administrador inicial criado:", email);
}

function publicOrganization(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    plan: row.plan,
    status: row.status,
    userLimit: row.user_limit,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

function publicUser(row) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    email: row.email,
    role: row.role,
    active: row.active,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
  };
}

async function loadAuthUser(userId) {
  await ensureAccessTables();
  const result = await pool.query(
    `SELECT
       u.*,
       o.name AS org_name,
       o.plan AS org_plan,
       o.status AS org_status,
       o.user_limit AS org_user_limit,
       o.expires_at AS org_expires_at
     FROM access_users u
     LEFT JOIN access_organizations o ON o.id = u.organization_id
     WHERE u.id = $1
     LIMIT 1`,
    [userId]
  );
  return result.rows[0] || null;
}

function organizationAccessState(user) {
  if (!user || !user.active) return { ok: false, reason: "Usuário desativado." };
  if (user.role === "superadmin") return { ok: true };
  if (!user.organization_id) return { ok: false, reason: "Usuário sem imobiliária vinculada." };
  if (user.org_status !== "active") return { ok: false, reason: "Assinatura bloqueada ou inativa." };
  if (user.org_expires_at && new Date(user.org_expires_at).getTime() < Date.now()) {
    return { ok: false, reason: "Assinatura vencida." };
  }
  return { ok: true };
}

async function requireAuth(req, res, next) {
  try {
    if (!pool) return res.status(503).json({ erro: "Controle de acesso ainda não configurado no servidor." });
    const token = String(req.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const payload = readToken(token);
    if (!payload) return res.status(401).json({ erro: "Sessão inválida ou expirada." });

    const user = await loadAuthUser(payload.uid);
    const access = organizationAccessState(user);
    if (!access.ok) return res.status(403).json({ erro: access.reason });

    req.authUser = user;
    next();
  } catch (error) {
    console.error("❌ Auth:", error.message);
    return res.status(500).json({ erro: "Erro ao validar acesso." });
  }
}

function requireOrgAdmin(req, res, next) {
  if (!["owner", "superadmin"].includes(req.authUser?.role)) {
    return res.status(403).json({ erro: "Apenas o administrador da imobiliária pode fazer isso." });
  }
  next();
}

function requireSuperAdmin(req, res, next) {
  if (req.authUser?.role !== "superadmin") {
    return res.status(403).json({ erro: "Acesso exclusivo do administrador da plataforma." });
  }
  next();
}

let brandingTablePromise = null;
function ensureBrandingTable() {
  if (!pool) return Promise.reject(new Error("DATABASE_URL não configurada"));
  if (!brandingTablePromise) {
    brandingTablePromise = pool.query(`
      CREATE TABLE IF NOT EXISTS imobiliaria_profiles (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        logo_data TEXT NOT NULL,
        contact TEXT NOT NULL DEFAULT '',
        logo_size INTEGER NOT NULL DEFAULT 200,
        logo_position TEXT NOT NULL DEFAULT 'top-left',
        content_y INTEGER NOT NULL DEFAULT 0,
        more_photos_url TEXT NOT NULL DEFAULT '',
        show_qr BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      ALTER TABLE organization_design_profiles ADD COLUMN IF NOT EXISTS brand_name TEXT NOT NULL DEFAULT '';
      ALTER TABLE organization_design_profiles ADD COLUMN IF NOT EXISTS contact TEXT NOT NULL DEFAULT '';
    `).catch((error) => {
      brandingTablePromise = null;
      throw error;
    });
  }
  return brandingTablePromise;
}

function requireBrandingAccess(req, res, next) {
  if (!pool) return res.status(503).json({ erro: "Sincronização em nuvem ainda não configurada." });
  const configuredKey = process.env.BRANDING_SYNC_KEY || "";
  if (!configuredKey) return res.status(503).json({ erro: "BRANDING_SYNC_KEY ainda não configurada no servidor." });
  const receivedKey = String(req.get("X-Branding-Key") || "");
  if (!receivedKey || receivedKey !== configuredKey) return res.status(401).json({ erro: "Código de sincronização inválido." });
  next();
}

function mapProfile(row) {
  return {
    id: row.id,
    name: row.name,
    logoData: row.logo_data,
    contact: row.contact,
    logoSize: row.logo_size,
    logoPosition: row.logo_position,
    contentY: row.content_y,
    morePhotosUrl: row.more_photos_url,
    showQr: row.show_qr,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}


let orgDesignTablePromise = null;
function ensureOrgDesignTable() {
  if (!pool) return Promise.reject(new Error("DATABASE_URL não configurada"));
  if (!orgDesignTablePromise) {
    orgDesignTablePromise = pool.query(`
      CREATE TABLE IF NOT EXISTS organization_design_profiles (
        organization_id TEXT PRIMARY KEY REFERENCES access_organizations(id) ON DELETE CASCADE,
        brand_name TEXT NOT NULL DEFAULT '',
        contact TEXT NOT NULL DEFAULT '',
        market TEXT NOT NULL DEFAULT 'urbano',
        positioning TEXT NOT NULL DEFAULT 'tradicional',
        primary_color TEXT NOT NULL DEFAULT '#4f7f43',
        secondary_color TEXT NOT NULL DEFAULT '#d8a23b',
        font_style TEXT NOT NULL DEFAULT 'classico',
        badge_style TEXT NOT NULL DEFAULT 'rounded',
        button_style TEXT NOT NULL DEFAULT 'rounded',
        logo_position TEXT NOT NULL DEFAULT 'top-left',
        logo_size INTEGER NOT NULL DEFAULT 150,
        content_y INTEGER NOT NULL DEFAULT 0,
        cta_text TEXT NOT NULL DEFAULT 'Fale conosco',
        footer_text TEXT NOT NULL DEFAULT '',
        show_qr BOOLEAN NOT NULL DEFAULT TRUE,
        show_footer BOOLEAN NOT NULL DEFAULT TRUE,
        logo_data TEXT NOT NULL DEFAULT '',
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `).catch((error) => {
      orgDesignTablePromise = null;
      throw error;
    });
  }
  return orgDesignTablePromise;
}

function mapOrgDesign(row) {
  if (!row) return null;
  return {
    organizationId: row.organization_id,
    brandName: row.brand_name,
    contact: row.contact,
    market: row.market,
    positioning: row.positioning,
    primaryColor: row.primary_color,
    secondaryColor: row.secondary_color,
    fontStyle: row.font_style,
    badgeStyle: row.badge_style,
    buttonStyle: row.button_style,
    logoPosition: row.logo_position,
    logoSize: row.logo_size,
    contentY: row.content_y,
    ctaText: row.cta_text,
    footerText: row.footer_text,
    showQr: row.show_qr,
    showFooter: row.show_footer,
    logoData: row.logo_data,
    updatedAt: row.updated_at,
  };
}

function validHexColor(value, fallback) {
  const text = String(value || "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(text) ? text.toLowerCase() : fallback;
}

function disableFrontendCache(res) {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
}

function sendFrontendFile(res, fileName) {
  disableFrontendCache(res);
  return res.sendFile(path.join(frontendDir, fileName));
}

app.get("/", (req, res) => sendFrontendFile(res, "index.html"));
app.get("/api/version", (req, res) => res.json({ build: APP_BUILD }));
app.get("/Style.css", (req, res) => sendFrontendFile(res, "Style.css"));
app.get("/adjustments.css", (req, res) => sendFrontendFile(res, "adjustments.css"));
app.get("/mobile.css", (req, res) => sendFrontendFile(res, "mobile.css"));
app.get("/adjustments.js", (req, res) => sendFrontendFile(res, "adjustments.js"));
app.get("/extras.js", (req, res) => sendFrontendFile(res, "extras.js"));
app.get("/story-set.js", (req, res) => sendFrontendFile(res, "story-set.js"));
app.get("/templates.js", (req, res) => sendFrontendFile(res, "templates.js"));
app.get("/workflow.js", (req, res) => sendFrontendFile(res, "workflow.js"));
app.get("/export-formats.js", (req, res) => sendFrontendFile(res, "export-formats.js"));
app.get("/properties.js", (req, res) => sendFrontendFile(res, "properties.js"));
app.get("/logo-library.js", (req, res) => sendFrontendFile(res, "logo-library.js"));
app.get("/cloud-profiles.js", (req, res) => sendFrontendFile(res, "cloud-profiles.js"));
app.get("/brand-theme.js", (req, res) => sendFrontendFile(res, "brand-theme.js"));
app.get("/realty-profile.js", (req, res) => sendFrontendFile(res, "realty-profile.js"));
app.get("/org-design.js", (req, res) => sendFrontendFile(res, "org-design.js"));
app.get("/professional-ui.js", (req, res) => sendFrontendFile(res, "professional-ui.js"));
app.get("/auth.js", (req, res) => sendFrontendFile(res, "auth.js"));
app.get("/admin-acessos", (req, res) => sendFrontendFile(res, "admin-access.html"));
app.get("/admin-access.js", (req, res) => sendFrontendFile(res, "admin-access.js"));
app.get("/autofill.js", (req, res) => sendFrontendFile(res, "autofill.js"));
app.get("/mobile-wizard.js", (req, res) => sendFrontendFile(res, "mobile-wizard.js"));
app.get("/pwa.js", (req, res) => sendFrontendFile(res, "pwa.js"));
app.get("/manifest.webmanifest", (req, res) => {
  disableFrontendCache(res);
  res.type("application/manifest+json; charset=utf-8");
  return res.sendFile(path.join(frontendDir, "manifest.webmanifest"));
});
app.get("/sw.js", (req, res) => {
  res.set("Cache-Control", "no-cache, no-store, must-revalidate");
  res.type("application/javascript; charset=utf-8");
  return res.sendFile(path.join(frontendDir, "sw.js"));
});
app.get("/pwa-icon-192.png", (req, res) => sendFrontendFile(res, "pwa-icon-192.png"));
app.get("/pwa-icon-512.png", (req, res) => sendFrontendFile(res, "pwa-icon-512.png"));
app.get("/pwa-icon-pro-192.png", (req, res) => sendFrontendFile(res, "pwa-icon-pro-192.png"));
app.get("/pwa-icon-pro-512.png", (req, res) => sendFrontendFile(res, "pwa-icon-pro-512.png"));

app.get("/script.js", (req, res) => sendFrontendFile(res, "script.js"));

app.get("/api/access-config", async (req, res) => {
  const enabled = accessControlEnabled();
  const ready = accessControlReady();
  let databaseReady = false;

  if (pool) {
    try {
      await ensureAccessTables();
      databaseReady = true;
    } catch (error) {
      console.warn("⚠️ Controle de acesso ainda não pronto:", error.message);
    }
  }

  return res.json({
    enabled,
    ready: Boolean(ready && databaseReady),
    active: Boolean(ready && databaseReady),
    mode: ready && databaseReady ? "paid-access" : "open",
    plans: Object.values(ACCESS_PLANS),
  });
});

app.post("/api/auth/login", async (req, res) => {
  try {
    if (!pool) return res.status(503).json({ erro: "DATABASE_URL ainda não configurada." });
    await ensureAccessTables();

    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || "");
    const result = await pool.query("SELECT * FROM access_users WHERE email = $1 LIMIT 1", [email]);
    const baseUser = result.rows[0];

    if (!baseUser || !verifyPassword(password, baseUser.password_hash)) {
      return res.status(401).json({ erro: "E-mail ou senha inválidos." });
    }

    const user = await loadAuthUser(baseUser.id);
    const access = organizationAccessState(user);
    if (!access.ok) return res.status(403).json({ erro: access.reason });

    await pool.query("UPDATE access_users SET last_login_at = NOW() WHERE id = $1", [user.id]);

    const token = signToken({
      uid: user.id,
      exp: Date.now() + AUTH_TOKEN_TTL_SECONDS * 1000,
    });

    return res.json({
      token,
      user: publicUser(user),
      organization: user.role === "superadmin" ? null : {
        id: user.organization_id,
        name: user.org_name,
        plan: user.org_plan,
        status: user.org_status,
        userLimit: user.org_user_limit,
        expiresAt: user.org_expires_at,
      },
    });
  } catch (error) {
    console.error("❌ Login:", error.message);
    return res.status(500).json({ erro: "Erro ao entrar." });
  }
});

app.get("/api/auth/me", requireAuth, async (req, res) => {
  const user = req.authUser;
  return res.json({
    user: publicUser(user),
    organization: user.role === "superadmin" ? null : {
      id: user.organization_id,
      name: user.org_name,
      plan: user.org_plan,
      status: user.org_status,
      userLimit: user.org_user_limit,
      expiresAt: user.org_expires_at,
    },
  });
});


app.get("/api/account/design-profile", requireAuth, async (req, res) => {
  try {
    if (req.authUser.role === "superadmin" || !req.authUser.organization_id) {
      return res.status(400).json({ erro: "Selecione uma imobiliária para usar um perfil visual." });
    }
    await ensureOrgDesignTable();
    const result = await pool.query(
      "SELECT * FROM organization_design_profiles WHERE organization_id = $1 LIMIT 1",
      [req.authUser.organization_id]
    );
    return res.json({ profile: mapOrgDesign(result.rows[0]) });
  } catch (error) {
    console.error("❌ Carregar perfil visual:", error.message);
    return res.status(500).json({ erro: "Erro ao carregar perfil visual." });
  }
});

app.put("/api/account/design-profile", requireAuth, requireOrgAdmin, async (req, res) => {
  try {
    if (req.authUser.role === "superadmin" || !req.authUser.organization_id) {
      return res.status(400).json({ erro: "Selecione uma imobiliária para editar um perfil visual." });
    }
    await ensureOrgDesignTable();

    const allowedMarkets = ["urbano","rural","misto"];
    const allowedPositions = ["tradicional","alto","popular"];
    const allowedFonts = ["classico","moderno","elegante","forte"];
    const allowedBadge = ["rounded","square","premium"];
    const allowedButton = ["rounded","square","minimal"];
    const allowedLogoPositions = ["top-left","top-center","top-right"];

    const brandName = String(req.body?.brandName || "").trim().slice(0, 100);
    const contact = String(req.body?.contact || "").trim().slice(0, 120);
    const market = allowedMarkets.includes(req.body?.market) ? req.body.market : "urbano";
    const positioning = allowedPositions.includes(req.body?.positioning) ? req.body.positioning : "tradicional";
    const primaryColor = validHexColor(req.body?.primaryColor, "#4f7f43");
    const secondaryColor = validHexColor(req.body?.secondaryColor, "#d8a23b");
    const fontStyle = allowedFonts.includes(req.body?.fontStyle) ? req.body.fontStyle : "classico";
    const badgeStyle = allowedBadge.includes(req.body?.badgeStyle) ? req.body.badgeStyle : "rounded";
    const buttonStyle = allowedButton.includes(req.body?.buttonStyle) ? req.body.buttonStyle : "rounded";
    const logoPosition = allowedLogoPositions.includes(req.body?.logoPosition) ? req.body.logoPosition : "top-left";
    const logoSize = Math.max(90, Math.min(320, Number(req.body?.logoSize || 150)));
    const contentY = Math.max(-220, Math.min(220, Number(req.body?.contentY || 0)));
    const ctaText = String(req.body?.ctaText || "Fale conosco").trim().slice(0, 80) || "Fale conosco";
    const footerText = String(req.body?.footerText || "").trim().slice(0, 180);
    const showQr = req.body?.showQr !== false;
    const showFooter = req.body?.showFooter !== false;
    const logoData = String(req.body?.logoData || "");
    if (logoData && (!logoData.startsWith("data:image/") || logoData.length > 2500000)) {
      return res.status(400).json({ erro: "Logo inválido ou muito grande." });
    }

    const result = await pool.query(
      `INSERT INTO organization_design_profiles
       (organization_id,brand_name,contact,market,positioning,primary_color,secondary_color,font_style,badge_style,button_style,logo_position,logo_size,content_y,cta_text,footer_text,show_qr,show_footer,logo_data,updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,NOW())
       ON CONFLICT (organization_id) DO UPDATE SET
         brand_name=EXCLUDED.brand_name,
         contact=EXCLUDED.contact,
         market=EXCLUDED.market,
         positioning=EXCLUDED.positioning,
         primary_color=EXCLUDED.primary_color,
         secondary_color=EXCLUDED.secondary_color,
         font_style=EXCLUDED.font_style,
         badge_style=EXCLUDED.badge_style,
         button_style=EXCLUDED.button_style,
         logo_position=EXCLUDED.logo_position,
         logo_size=EXCLUDED.logo_size,
         content_y=EXCLUDED.content_y,
         cta_text=EXCLUDED.cta_text,
         footer_text=EXCLUDED.footer_text,
         show_qr=EXCLUDED.show_qr,
         show_footer=EXCLUDED.show_footer,
         logo_data=EXCLUDED.logo_data,
         updated_at=NOW()
       RETURNING *`,
      [
        req.authUser.organization_id, brandName, contact, market, positioning, primaryColor, secondaryColor,
        fontStyle, badgeStyle, buttonStyle, logoPosition, logoSize, contentY,
        ctaText, footerText, showQr, showFooter, logoData
      ]
    );

    return res.json({ profile: mapOrgDesign(result.rows[0]) });
  } catch (error) {
    console.error("❌ Salvar perfil visual:", error.message);
    return res.status(500).json({ erro: "Erro ao salvar perfil visual." });
  }
});

app.get("/api/account/users", requireAuth, requireOrgAdmin, async (req, res) => {
  try {
    if (req.authUser.role === "superadmin") return res.json({ users: [] });
    const result = await pool.query(
      "SELECT * FROM access_users WHERE organization_id = $1 ORDER BY created_at ASC",
      [req.authUser.organization_id]
    );
    return res.json({ users: result.rows.map(publicUser) });
  } catch (error) {
    return res.status(500).json({ erro: "Erro ao listar usuários." });
  }
});

app.post("/api/account/users", requireAuth, requireOrgAdmin, async (req, res) => {
  try {
    if (req.authUser.role === "superadmin") return res.status(400).json({ erro: "Selecione uma imobiliária pelo painel administrativo." });

    const orgId = req.authUser.organization_id;
    const orgResult = await pool.query("SELECT * FROM access_organizations WHERE id = $1", [orgId]);
    const org = orgResult.rows[0];
    if (!org) return res.status(404).json({ erro: "Imobiliária não encontrada." });

    const count = await pool.query("SELECT COUNT(*)::int AS total FROM access_users WHERE organization_id = $1 AND active = TRUE", [orgId]);
    if (Number(count.rows[0]?.total || 0) >= Number(org.user_limit || 1)) {
      return res.status(409).json({ erro: "Limite de usuários do plano atingido." });
    }

    const name = String(req.body?.name || "").trim().slice(0, 100);
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || "");
    if (!name || !email.includes("@")) return res.status(400).json({ erro: "Nome e e-mail são obrigatórios." });
    if (password.length < 8) return res.status(400).json({ erro: "A senha precisa ter pelo menos 8 caracteres." });

    const id = makeId("usr");
    const result = await pool.query(
      `INSERT INTO access_users (id, organization_id, name, email, password_hash, role, active)
       VALUES ($1,$2,$3,$4,$5,'member',TRUE)
       RETURNING *`,
      [id, orgId, name, email, hashPassword(password)]
    );
    return res.status(201).json({ user: publicUser(result.rows[0]) });
  } catch (error) {
    if (String(error.code) === "23505") return res.status(409).json({ erro: "Este e-mail já está cadastrado." });
    console.error("❌ Criar usuário:", error.message);
    return res.status(500).json({ erro: "Erro ao criar usuário." });
  }
});

app.patch("/api/account/users/:id", requireAuth, requireOrgAdmin, async (req, res) => {
  try {
    if (req.authUser.role === "superadmin") return res.status(400).json({ erro: "Use o painel administrativo." });
    const userId = String(req.params.id || "");
    if (userId === req.authUser.id && req.body?.active === false) {
      return res.status(400).json({ erro: "Você não pode desativar seu próprio acesso." });
    }

    const result = await pool.query(
      `UPDATE access_users
       SET active = COALESCE($1, active), updated_at = NOW()
       WHERE id = $2 AND organization_id = $3
       RETURNING *`,
      [typeof req.body?.active === "boolean" ? req.body.active : null, userId, req.authUser.organization_id]
    );
    if (!result.rowCount) return res.status(404).json({ erro: "Usuário não encontrado." });
    return res.json({ user: publicUser(result.rows[0]) });
  } catch (error) {
    return res.status(500).json({ erro: "Erro ao atualizar usuário." });
  }
});

app.get("/api/admin/organizations", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT o.*,
        COUNT(u.id)::int AS total_users,
        COUNT(u.id) FILTER (WHERE u.active = TRUE)::int AS active_users
      FROM access_organizations o
      LEFT JOIN access_users u ON u.organization_id = o.id
      GROUP BY o.id
      ORDER BY o.created_at DESC
    `);
    return res.json({ organizations: result.rows.map((row) => ({
      ...publicOrganization(row),
      totalUsers: row.total_users,
      activeUsers: row.active_users,
    })) });
  } catch (error) {
    return res.status(500).json({ erro: "Erro ao listar imobiliárias." });
  }
});

app.post("/api/admin/organizations", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim().slice(0, 120);
    const ownerName = String(req.body?.ownerName || "").trim().slice(0, 100);
    const ownerEmail = normalizeEmail(req.body?.ownerEmail);
    const password = String(req.body?.password || "");
    const plan = Object.prototype.hasOwnProperty.call(ACCESS_PLANS, req.body?.plan) ? req.body.plan : "individual";
    const userLimit = Math.max(1, Math.min(100, Number(req.body?.userLimit || ACCESS_PLANS[plan].userLimit)));
    const days = Math.max(1, Math.min(3650, Number(req.body?.days || 30)));

    if (!name || !ownerName || !ownerEmail.includes("@")) return res.status(400).json({ erro: "Preencha imobiliária, responsável e e-mail." });
    if (password.length < 8) return res.status(400).json({ erro: "A senha inicial precisa ter pelo menos 8 caracteres." });

    const orgId = makeId("org");
    const userId = makeId("usr");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const orgResult = await client.query(
        `INSERT INTO access_organizations (id,name,plan,status,user_limit,expires_at)
         VALUES ($1,$2,$3,'active',$4,NOW() + ($5 || ' days')::interval)
         RETURNING *`,
        [orgId, name, plan, userLimit, String(days)]
      );
      const userResult = await client.query(
        `INSERT INTO access_users (id,organization_id,name,email,password_hash,role,active)
         VALUES ($1,$2,$3,$4,$5,'owner',TRUE)
         RETURNING *`,
        [userId, orgId, ownerName, ownerEmail, hashPassword(password)]
      );
      await client.query("COMMIT");
      return res.status(201).json({
        organization: publicOrganization(orgResult.rows[0]),
        owner: publicUser(userResult.rows[0]),
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    if (String(error.code) === "23505") return res.status(409).json({ erro: "Este e-mail já está cadastrado." });
    console.error("❌ Criar imobiliária:", error.message);
    return res.status(500).json({ erro: "Erro ao criar imobiliária." });
  }
});

app.patch("/api/admin/organizations/:id", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const id = String(req.params.id || "");
    const allowedPlans = ["individual","imobiliaria","equipe"];
    const plan = allowedPlans.includes(req.body?.plan) ? req.body.plan : null;
    const status = ["active","blocked","inactive"].includes(req.body?.status) ? req.body.status : null;
    const userLimit = Number.isFinite(Number(req.body?.userLimit)) ? Math.max(1, Math.min(100, Number(req.body.userLimit))) : null;
    const addDays = Number.isFinite(Number(req.body?.addDays)) ? Math.max(0, Math.min(3650, Number(req.body.addDays))) : 0;

    const result = await pool.query(
      `UPDATE access_organizations SET
        plan = COALESCE($1, plan),
        status = COALESCE($2, status),
        user_limit = COALESCE($3, user_limit),
        expires_at = CASE
          WHEN $4::int > 0 THEN GREATEST(COALESCE(expires_at, NOW()), NOW()) + ($4 || ' days')::interval
          ELSE expires_at
        END,
        updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [plan, status, userLimit, addDays, id]
    );
    if (!result.rowCount) return res.status(404).json({ erro: "Imobiliária não encontrada." });
    return res.json({ organization: publicOrganization(result.rows[0]) });
  } catch (error) {
    return res.status(500).json({ erro: "Erro ao atualizar imobiliária." });
  }
});

app.get("/api/admin/organizations/:id/users", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const orgId = String(req.params.id || "");
    const orgResult = await pool.query("SELECT * FROM access_organizations WHERE id = $1 LIMIT 1", [orgId]);
    if (!orgResult.rowCount) return res.status(404).json({ erro: "Imobiliária não encontrada." });
    const usersResult = await pool.query("SELECT * FROM access_users WHERE organization_id = $1 ORDER BY CASE WHEN role = 'owner' THEN 0 ELSE 1 END, created_at ASC", [orgId]);
    return res.json({ organization: publicOrganization(orgResult.rows[0]), users: usersResult.rows.map(publicUser) });
  } catch (error) {
    console.error("❌ Listar acessos da imobiliária:", error.message);
    return res.status(500).json({ erro: "Erro ao listar acessos da imobiliária." });
  }
});

app.post("/api/admin/organizations/:id/users", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const orgId = String(req.params.id || "");
    const name = String(req.body?.name || "").trim().slice(0, 100);
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || "");
    if (!name || !email.includes("@")) return res.status(400).json({ erro: "Nome e e-mail são obrigatórios." });
    if (password.length < 8) return res.status(400).json({ erro: "A senha precisa ter pelo menos 8 caracteres." });
    const orgResult = await pool.query("SELECT * FROM access_organizations WHERE id = $1 LIMIT 1", [orgId]);
    const org = orgResult.rows[0];
    if (!org) return res.status(404).json({ erro: "Imobiliária não encontrada." });
    const countResult = await pool.query("SELECT COUNT(*)::int AS total FROM access_users WHERE organization_id = $1 AND active = TRUE", [orgId]);
    const activeUsers = Number(countResult.rows[0]?.total || 0);
    if (activeUsers >= Number(org.user_limit || 1)) return res.status(409).json({ erro: "Limite de acessos do plano atingido." });
    const id = makeId("usr");
    const result = await pool.query(
      "INSERT INTO access_users (id, organization_id, name, email, password_hash, role, active) VALUES ($1,$2,$3,$4,$5,'member',TRUE) RETURNING *",
      [id, orgId, name, email, hashPassword(password)]
    );
    return res.status(201).json({ user: publicUser(result.rows[0]) });
  } catch (error) {
    if (String(error.code) === "23505") return res.status(409).json({ erro: "Este e-mail já está cadastrado." });
    console.error("❌ Criar acesso da imobiliária:", error.message);
    return res.status(500).json({ erro: "Erro ao criar acesso." });
  }
});

app.patch("/api/admin/organizations/:orgId/users/:userId", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const orgId = String(req.params.orgId || "");
    const userId = String(req.params.userId || "");
    const existingResult = await pool.query("SELECT * FROM access_users WHERE id = $1 AND organization_id = $2 LIMIT 1", [userId, orgId]);
    const existing = existingResult.rows[0];
    if (!existing) return res.status(404).json({ erro: "Usuário não encontrado." });
    const updates = []; const values = []; let index = 1;
    if (typeof req.body?.active === "boolean") {
      if (existing.role === "owner" && req.body.active === false) return res.status(400).json({ erro: "Para bloquear o responsável, bloqueie a imobiliária inteira." });
      if (req.body.active === true && existing.active !== true) {
        const orgResult = await pool.query("SELECT user_limit FROM access_organizations WHERE id = $1 LIMIT 1", [orgId]);
        const limit = Number(orgResult.rows[0]?.user_limit || 1);
        const countResult = await pool.query("SELECT COUNT(*)::int AS total FROM access_users WHERE organization_id = $1 AND active = TRUE", [orgId]);
        if (Number(countResult.rows[0]?.total || 0) >= limit) return res.status(409).json({ erro: "Limite de acessos do plano atingido." });
      }
      updates.push("active = $" + index++); values.push(req.body.active);
    }
    const name = String(req.body?.name || "").trim();
    if (name) { updates.push("name = $" + index++); values.push(name.slice(0, 100)); }
    const password = String(req.body?.password || "");
    if (password) {
      if (password.length < 8) return res.status(400).json({ erro: "A nova senha precisa ter pelo menos 8 caracteres." });
      updates.push("password_hash = $" + index++); values.push(hashPassword(password));
    }
    if (!updates.length) return res.status(400).json({ erro: "Nenhuma alteração enviada." });
    values.push(userId, orgId);
    const result = await pool.query("UPDATE access_users SET " + updates.join(", ") + " WHERE id = $" + index++ + " AND organization_id = $" + index + " RETURNING *", values);
    return res.json({ user: publicUser(result.rows[0]) });
  } catch (error) {
    console.error("❌ Atualizar acesso da imobiliária:", error.message);
    return res.status(500).json({ erro: "Erro ao atualizar acesso." });
  }
});

app.get("/api/cloud-status", async (req, res) => {
  if (!pool) return res.json({ connected: false, reason: "DATABASE_URL ausente" });
  try {
    await ensureBrandingTable();
    await pool.query("SELECT 1");
    return res.json({ connected: true });
  } catch (error) {
    console.error("❌ PostgreSQL:", error.message);
    return res.status(503).json({ connected: false, reason: "Banco indisponível" });
  }
});

app.get("/api/imobiliarias", requireBrandingAccess, async (req, res) => {
  try {
    await ensureBrandingTable();
    const result = await pool.query("SELECT * FROM imobiliaria_profiles ORDER BY name ASC");
    return res.json({ perfis: result.rows.map(mapProfile) });
  } catch (error) {
    console.error("❌ Erro ao listar imobiliárias:", error.message);
    return res.status(500).json({ erro: "Erro ao carregar perfis das imobiliárias." });
  }
});

app.post("/api/imobiliarias", requireBrandingAccess, async (req, res) => {
  try {
    await ensureBrandingTable();
    const body = req.body || {};
    const id = String(body.id || "").trim();
    const name = String(body.name || "").trim();
    const logoData = String(body.logoData || "").trim();

    if (!/^[a-zA-Z0-9._-]{1,120}$/.test(id)) return res.status(400).json({ erro: "ID do perfil inválido." });
    if (!name || name.length > 100) return res.status(400).json({ erro: "Informe um nome válido para a imobiliária." });
    if (!logoData.startsWith("data:image/") || logoData.length > 2500000) return res.status(400).json({ erro: "Logo inválido ou muito grande." });

    const logoSize = Math.max(80, Math.min(400, Number(body.logoSize || 200)));
    const contentY = Math.max(-300, Math.min(300, Number(body.contentY || 0)));
    const logoPosition = ["top-left", "top-center", "top-right"].includes(body.logoPosition) ? body.logoPosition : "top-left";

    const result = await pool.query(
      `INSERT INTO imobiliaria_profiles
        (id, name, logo_data, contact, logo_size, logo_position, content_y, more_photos_url, show_qr, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),NOW())
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         logo_data = EXCLUDED.logo_data,
         contact = EXCLUDED.contact,
         logo_size = EXCLUDED.logo_size,
         logo_position = EXCLUDED.logo_position,
         content_y = EXCLUDED.content_y,
         more_photos_url = EXCLUDED.more_photos_url,
         show_qr = EXCLUDED.show_qr,
         updated_at = NOW()
       RETURNING *`,
      [
        id,
        name,
        logoData,
        String(body.contact || "").slice(0, 200),
        logoSize,
        logoPosition,
        contentY,
        String(body.morePhotosUrl || "").slice(0, 1200),
        body.showQr !== false,
      ]
    );
    return res.json({ perfil: mapProfile(result.rows[0]) });
  } catch (error) {
    console.error("❌ Erro ao salvar imobiliária:", error.message);
    return res.status(500).json({ erro: "Erro ao salvar perfil da imobiliária." });
  }
});

app.delete("/api/imobiliarias/:id", requireBrandingAccess, async (req, res) => {
  try {
    await ensureBrandingTable();
    await pool.query("DELETE FROM imobiliaria_profiles WHERE id = $1", [String(req.params.id || "")]);
    return res.json({ ok: true });
  } catch (error) {
    console.error("❌ Erro ao excluir imobiliária:", error.message);
    return res.status(500).json({ erro: "Erro ao excluir perfil da imobiliária." });
  }
});

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function firstText($, selectors) {
  for (const selector of selectors) {
    const value = cleanText($(selector).first().text());
    if (value) return value;
  }
  return "";
}

function firstAttr($, selectors, attr = "content") {
  for (const selector of selectors) {
    const value = cleanText($(selector).first().attr(attr));
    if (value) return value;
  }
  return "";
}

function absoluteUrl(candidate, baseUrl) {
  if (!candidate) return "";
  try {
    return new URL(candidate, baseUrl).href;
  } catch {
    return candidate;
  }
}


const listingUrlCache = new Map();

function extractPropertyCode(url) {
  const match = String(url || "").match(/\/imovel\/(?:[^?#]*\/)?([A-Z]{2,5}\d{2,8}_[A-Z0-9]+)(?:[/?#]|$)/i);
  return match ? match[1].toUpperCase() : "";
}

function isVillelaUrl(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    return host === "villelaimoveis.com.br";
  } catch {
    return false;
  }
}

function extractSitemapLocs(xml) {
  return [...String(xml || "").matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)]
    .map((match) => match[1].replace(/&amp;/g, "&").trim())
    .filter(Boolean);
}

async function fetchText(url, timeout = 12000) {
  const response = await axios.get(url, {
    timeout,
    maxRedirects: 5,
    responseType: "text",
    validateStatus: (status) => status >= 200 && status < 400,
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; ImovelStoryBot/1.0; +https://story-villela.onrender.com)",
      "Accept": "text/html,application/xhtml+xml,application/xml,text/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
      "Cache-Control": "no-cache",
    },
  });
  return {
    text: typeof response.data === "string" ? response.data : String(response.data || ""),
    finalUrl: response.request?.res?.responseUrl || url,
  };
}


async function resolveVillelaViaPublicSearch(code) {
  const queries = [
    "site:villelaimoveis.com.br/imovel " + code,
    '"' + code + '" villelaimoveis',
  ];

  for (const query of queries) {
    const endpoints = [
      "https://html.duckduckgo.com/html/?q=" + encodeURIComponent(query),
      "https://www.google.com/search?q=" + encodeURIComponent(query),
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await axios.get(endpoint, {
          timeout: 12000,
          maxRedirects: 5,
          responseType: "text",
          validateStatus: (status) => status >= 200 && status < 400,
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
            "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
            "Accept": "text/html,application/xhtml+xml,*/*;q=0.8",
          },
        });

        const html = String(response.data || "");
        const urls = new Set();

        // Links diretos presentes no HTML da busca.
        for (const match of html.matchAll(/https?:\/\/(?:www\.)?villelaimoveis\.com\.br\/imovel\/[^"'&<>\s]+/gi)) {
          urls.add(match[0].replace(/&amp;/g, "&"));
        }

        // DuckDuckGo costuma encapsular a URL no parâmetro uddg.
        for (const match of html.matchAll(/[?&]uddg=([^&"']+)/gi)) {
          try {
            const decoded = decodeURIComponent(match[1]);
            if (/^https?:\/\/(?:www\.)?villelaimoveis\.com\.br\/imovel\//i.test(decoded)) {
              urls.add(decoded);
            }
          } catch {}
        }

        const found = [...urls].find((url) => url.toUpperCase().includes(code.toUpperCase()));
        if (found) {
          console.log("✅ URL Villela resolvida por busca pública:", found);
          return found;
        }
      } catch (error) {
        console.warn("⚠️ Busca pública não resolveu", code, error.message);
      }
    }
  }
  return "";
}

function isPublicHttpUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    if (!["http:", "https:"].includes(url.protocol)) return false;

    const host = url.hostname.toLowerCase();
    if (!host || host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return false;

    if (/^(?:127\.|0\.|169\.254\.|10\.|192\.168\.)/.test(host)) return false;

    const private172 = host.match(/^172\.(\d{1,3})\./);
    if (private172) {
      const second = Number(private172[1]);
      if (second >= 16 && second <= 31) return false;
    }

    if (host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80:")) return false;
    return true;
  } catch {
    return false;
  }
}

async function resolveVillelaListingUrl(inputUrl) {
  if (!isVillelaUrl(inputUrl)) return inputUrl;

  const code = extractPropertyCode(inputUrl);
  if (!code) return inputUrl;

  const cached = listingUrlCache.get(code);
  if (cached && Date.now() - cached.savedAt < 30 * 60 * 1000) return cached.url;

  // Primeiro tenta descobrir uma URL canônica no próprio HTML curto.
  try {
    const initial = await fetchText(inputUrl);
    const $initial = cheerio.load(initial.text);
    const canonical = absoluteUrl(
      $initial('link[rel="canonical"]').attr("href") ||
      $initial('meta[property="og:url"]').attr("content") ||
      "",
      initial.finalUrl
    );
    if (canonical && canonical !== inputUrl && canonical.toUpperCase().includes(code)) {
      listingUrlCache.set(code, { url: canonical, savedAt: Date.now() });
      return canonical;
    }
  } catch (error) {
    console.warn("⚠️ URL curta da Villela não revelou canonical:", error.message);
  }

  // Depois procura o código nos sitemaps do domínio.
  const roots = [
    "https://www.villelaimoveis.com.br/sitemap.xml",
    "https://www.villelaimoveis.com.br/sitemap_index.xml",
    "https://www.villelaimoveis.com.br/sitemap-index.xml",
  ];

  const visited = new Set();
  const queue = [...roots];

  while (queue.length && visited.size < 18) {
    const sitemapUrl = queue.shift();
    if (!sitemapUrl || visited.has(sitemapUrl)) continue;
    visited.add(sitemapUrl);

    try {
      const { text } = await fetchText(sitemapUrl, 10000);
      const locs = extractSitemapLocs(text);

      const direct = locs.find((loc) =>
        /\/imovel\//i.test(loc) &&
        loc.toUpperCase().includes(code)
      );

      if (direct) {
        listingUrlCache.set(code, { url: direct, savedAt: Date.now() });
        console.log("✅ URL Villela resolvida pelo sitemap:", direct);
        return direct;
      }

      // Se for um índice de sitemap, visita somente alguns filhos relevantes.
      const childMaps = locs.filter((loc) => /\.xml(?:$|\?)/i.test(loc));
      for (const child of childMaps.slice(0, 10)) {
        if (!visited.has(child)) queue.push(child);
      }
    } catch (error) {
      console.warn("⚠️ Sitemap indisponível:", sitemapUrl, error.message);
    }
  }

  const publicSearchUrl = await resolveVillelaViaPublicSearch(code);
  if (publicSearchUrl) {
    listingUrlCache.set(code, { url: publicSearchUrl, savedAt: Date.now() });
    return publicSearchUrl;
  }

  return inputUrl;
}

function flattenJsonLd(value, output = []) {
  if (!value) return output;
  if (Array.isArray(value)) {
    value.forEach((item) => flattenJsonLd(item, output));
    return output;
  }
  if (typeof value === "object") {
    output.push(value);
    if (Array.isArray(value["@graph"])) value["@graph"].forEach((item) => flattenJsonLd(item, output));
  }
  return output;
}

function readJsonLd($) {
  const items = [];
  $('script[type="application/ld+json"]').each((_, element) => {
    const raw = $(element).html();
    if (!raw) return;
    try { flattenJsonLd(JSON.parse(raw.trim()), items); } catch {}
  });
  return items;
}

function findNestedObject(items, key) {
  for (const item of items) {
    if (!item || typeof item !== "object" || !item[key]) continue;
    const value = item[key];
    if (Array.isArray(value)) {
      const firstObject = value.find((entry) => entry && typeof entry === "object");
      if (firstObject) return firstObject;
    }
    if (typeof value === "object") return value;
  }
  return null;
}

function findFirstValue(items, keys) {
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    for (const key of keys) {
      const value = item[key];
      if (typeof value === "string" || typeof value === "number") {
        const text = cleanText(value);
        if (text) return text;
      }
    }
  }
  return "";
}

function findImageFromJsonLd(items) {
  for (const item of items) {
    const image = item?.image;
    if (typeof image === "string") return image;
    if (Array.isArray(image) && image.length) {
      const first = image[0];
      if (typeof first === "string") return first;
      if (first?.url) return first.url;
    }
    if (image?.url) return image.url;
  }
  return "";
}


function addImageCandidate(list, candidate, pageUrl, score = 0, source = "", listingCode = "") {
  const raw = cleanText(candidate);
  if (!raw) return;

  const values = raw.includes(",") && /\s\d+(?:w|x)(?:,|$)/i.test(raw)
    ? raw.split(",").map((part) => part.trim().split(/\s+/)[0])
    : [raw];

  for (const value of values) {
    if (!value || /^data:/i.test(value)) continue;
    const url = absoluteUrl(value, pageUrl);
    if (!/^https?:\/\//i.test(url)) continue;

    const explicitCodes = [...decodeURIComponent(url).matchAll(/([A-Z]{2,5}\d{2,8}_[A-Z0-9]+)/gi)]
      .map((match) => String(match[1] || "").toUpperCase());
    if (listingCode && explicitCodes.some((code) => code !== listingCode.toUpperCase())) continue;

    let finalScore = score;
    const lower = url.toLowerCase();
    if (/(logo|icon|favicon|avatar|sprite|placeholder|loading|blank|banner|brand|marca)/i.test(lower)) finalScore -= 140;
    if (/(imovel|property|foto|photo|image|img|galeria|gallery)/i.test(lower)) finalScore += 18;

    const existing = list.find((item) => item.url === url);
    if (existing) {
      existing.score = Math.max(existing.score, finalScore);
      if (!existing.source && source) existing.source = source;
      continue;
    }
    list.push({ url, score: finalScore, source });
  }
}

function collectEmbeddedListingImages($, pageUrl, listingCode = "") {
  const candidates = [];
  if (!listingCode) return candidates;

  const imageKeys = /^(?:image|images|photo|photos|foto|fotos|gallery|galeria|pictures|media|slides)$/i;

  function collectFromValue(value, score = 210, source = "embedded-data") {
    if (!value) return;

    if (typeof value === "string") {
      const cleaned = value
        .replace(/\\u002F/gi, "/")
        .replace(/\\\//g, "/")
        .replace(/&amp;/g, "&");
      if (/^https?:\/\//i.test(cleaned) || /\.(?:jpe?g|png|webp|avif)(?:[?#]|$)/i.test(cleaned)) {
        addImageCandidate(candidates, cleaned, pageUrl, score, source, listingCode);
      }
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item) => collectFromValue(item, score, source));
      return;
    }

    if (typeof value === "object") {
      Object.entries(value).forEach(([key, nested]) => {
        const nextScore = imageKeys.test(key) ? score + 35 : score - 4;
        if (
          imageKeys.test(key) ||
          typeof nested === "object" ||
          (typeof nested === "string" && /(?:https?:\/\/|\.(?:jpe?g|png|webp|avif))/i.test(nested))
        ) {
          collectFromValue(nested, nextScore, source + ":" + key);
        }
      });
    }
  }

  function objectMentionsListing(value) {
    if (!value || typeof value !== "object") return false;
    try {
      return JSON.stringify(value).toUpperCase().includes(listingCode.toUpperCase());
    } catch {
      return false;
    }
  }

  $("script").each((_, el) => {
    const raw = $(el).html() || "";
    if (!raw || !raw.toUpperCase().includes(listingCode.toUpperCase())) return;

    // Primeiro tenta JSON real e coleta somente ramos que pertencem ao imóvel atual.
    try {
      const parsed = JSON.parse(raw.trim());

      const walk = (value, depth = 0) => {
        if (!value || depth > 12) return;

        if (Array.isArray(value)) {
          value.forEach((item) => walk(item, depth + 1));
          return;
        }

        if (typeof value !== "object") return;

        if (objectMentionsListing(value)) {
          const directKeys = Object.keys(value).filter((key) => imageKeys.test(key));
          if (directKeys.length) {
            directKeys.forEach((key) => collectFromValue(value[key], 250, "embedded-json:" + key));
          }
        }

        Object.values(value).forEach((nested) => {
          if (nested && typeof nested === "object") walk(nested, depth + 1);
        });
      };

      walk(parsed);
    } catch {}

    // Fallback para estados JS serializados: lê somente uma janela próxima ao código do imóvel.
    const upper = raw.toUpperCase();
    let offset = 0;
    while (true) {
      const hit = upper.indexOf(listingCode.toUpperCase(), offset);
      if (hit < 0) break;

      const start = Math.max(0, hit - 35000);
      const end = Math.min(raw.length, hit + 35000);
      const slice = raw.slice(start, end)
        .replace(/\\u002F/gi, "/")
        .replace(/\\\//g, "/");

      for (const match of slice.matchAll(/https?:\/\/[^"'<>\\\s]+?(?:jpe?g|png|webp|avif)(?:\?[^"'<>\\\s]*)?/gi)) {
        addImageCandidate(candidates, match[0], pageUrl, 205, "embedded-script", listingCode);
      }

      offset = hit + listingCode.length;
    }
  });

  const unique = [];
  const used = new Set();
  for (const item of candidates.sort((a, b) => b.score - a.score)) {
    const key = canonicalImageKey(item.url);
    if (used.has(key)) continue;
    used.add(key);
    unique.push(item);
  }

  if (unique.length) {
    console.log("✅ Fotos embutidas do anúncio Villela:", unique.length);
  }

  return unique;
}

function collectVillelaGalleryCandidates($, pageUrl, listingCode = "") {
  const containers = [];
  const selectors = [
    '[class*="gallery"]',
    '[class*="galeria"]',
    '[class*="carousel"]',
    '[class*="swiper"]',
    '[class*="photo"]',
    '[class*="foto"]',
    '[id*="gallery"]',
    '[id*="galeria"]',
    '[id*="carousel"]',
    '[data-testid*="gallery"]',
    '[data-testid*="photo"]'
  ];

  const seen = new Set();

  function collectFromContainer(node, selectorIndex = 0) {
    const container = $(node);
    const key = node;
    if (seen.has(key)) return;
    seen.add(key);

    const images = [];

    container.find("img").each((index, el) => {
      const img = $(el);

      const srcText = [
        img.attr("src"),
        img.attr("data-src"),
        img.attr("data-lazy-src"),
        img.attr("data-original"),
        img.attr("data-image"),
        img.attr("data-url"),
        img.attr("srcset"),
        img.attr("data-srcset"),
        img.attr("alt"),
        img.attr("class")
      ].filter(Boolean).join(" ").toLowerCase();

      if (/(logo|brand|marca|banner|icon|favicon|sprite|avatar|placeholder)/i.test(srcText)) return;

      const linkedListing = img.closest('a[href*="/imovel/"]').attr("href") || "";
      const linkedCode = extractPropertyCode(linkedListing);
      if (listingCode && linkedCode && linkedCode !== listingCode) return;

      const ancestry = [
        img.closest('[class*="similar"]').attr("class"),
        img.closest('[class*="related"]').attr("class"),
        img.closest('[class*="recommend"]').attr("class"),
        img.closest('[class*="card"]').attr("class")
      ].filter(Boolean).join(" ").toLowerCase();

      if (/(similar|related|recommend)/i.test(ancestry)) return;

      const base = 160 - Math.min(index, 24);
      ["src","data-src","data-lazy-src","data-original","data-image","data-url"].forEach((attr) => {
        const value = img.attr(attr);
        if (value) addImageCandidate(images, value, pageUrl, base, "villela-gallery:" + attr, listingCode);
      });
      ["srcset","data-srcset"].forEach((attr) => {
        const value = img.attr(attr);
        if (value) addImageCandidate(images, value, pageUrl, base + 8, "villela-gallery:" + attr, listingCode);
      });
    });

    // Muitas galerias modernas guardam as demais fotos em <source>, links e atributos data-*.
    container.find("source").each((index, el) => {
      const source = $(el);
      ["src", "srcset", "data-src", "data-srcset"].forEach((attr) => {
        const value = source.attr(attr);
        if (value) addImageCandidate(images, value, pageUrl, 172 - Math.min(index, 20), "villela-gallery:source:" + attr, listingCode);
      });
    });

    container.find("a").each((index, el) => {
      const anchor = $(el);
      ["href", "data-src", "data-image", "data-photo", "data-foto", "data-full", "data-original"].forEach((attr) => {
        const value = anchor.attr(attr);
        if (!value) return;
        if (/\.(?:jpe?g|png|webp|avif)(?:[?#]|$)/i.test(value) || /(?:foto|photo|image|img|gallery|galeria)/i.test(value)) {
          addImageCandidate(images, value, pageUrl, 168 - Math.min(index, 20), "villela-gallery:a:" + attr, listingCode);
        }
      });
    });

    container.find("*").each((index, el) => {
      const nodeEl = $(el);
      const attrs = el.attribs || {};
      for (const [attrName, attrValue] of Object.entries(attrs)) {
        if (!attrValue || typeof attrValue !== "string") continue;
        if (!/^(?:data-|src|srcset|href|poster)/i.test(attrName)) continue;

        const cleaned = attrValue.replace(/\\u002F/gi, "/").replace(/\\\//g, "/");
        if (
          /\.(?:jpe?g|png|webp|avif)(?:[?#\s]|$)/i.test(cleaned) ||
          /(?:foto|photo|image|img|gallery|galeria)/i.test(attrName)
        ) {
          addImageCandidate(images, cleaned, pageUrl, 150 - Math.min(index, 30), "villela-gallery:attr:" + attrName, listingCode);
        }
      }
    });

    container.find('[style*="background"]').each((index, el) => {
      const nodeEl = $(el);
      const linkedListing = nodeEl.closest('a[href*="/imovel/"]').attr("href") || "";
      const linkedCode = extractPropertyCode(linkedListing);
      if (listingCode && linkedCode && linkedCode !== listingCode) return;

      const style = nodeEl.attr("style") || "";
      for (const match of style.matchAll(/url\((['"]?)(.*?)\1\)/gi)) {
        addImageCandidate(images, match[2], pageUrl, 135 - Math.min(index, 18), "villela-gallery:bg", listingCode);
      }
    });

    const unique = [];
    const usedKeys = new Set();
    for (const item of images.sort((a,b)=>b.score-a.score)) {
      const keyUrl = canonicalImageKey(item.url);
      if (usedKeys.has(keyUrl)) continue;
      usedKeys.add(keyUrl);
      unique.push(item);
    }

    if (unique.length >= 2) {
      const classText = ((container.attr("class") || "") + " " + (container.attr("id") || "")).toLowerCase();
      const rawImgCount = container.find("img").length;

      let score = unique.length * 100 - selectorIndex * 3;
      if (/(gallery|galeria|photo|foto|carousel|swiper)/i.test(classText)) score += 180;
      if (/(similar|related|recommend|card|header|navbar|footer)/i.test(classText)) score -= 500;

      // A galeria principal da Villela costuma ser um bloco pequeno com poucas fotos.
      if (rawImgCount >= 2 && rawImgCount <= 8) score += 260;
      if (rawImgCount > 12) score -= 700;

      containers.push({ score, images: unique, classText, rawImgCount });
    }
  }

  selectors.forEach((selector, selectorIndex) => {
    $(selector).each((_, el) => collectFromContainer(el, selectorIndex));
  });

  containers.sort((a,b)=>b.score-a.score);
  const best = containers[0];

  if (best?.images?.length >= 2) {
    console.log("✅ Galeria principal Villela identificada:", best.images.length, "fotos");
    return best.images;
  }

  return [];
}


function siteDomain(pageUrl) {
  try {
    return new URL(pageUrl).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function universalListingIdentity(pageUrl) {
  try {
    const url = new URL(pageUrl);
    const segments = url.pathname.split("/").filter(Boolean);
    const last = segments[segments.length - 1] || "";
    const idMatch = (url.pathname + url.search).match(/(?:imovel|property|listing|codigo|code|id)[\/_=-]*([a-z0-9_-]{3,})/i);
    return cleanText(idMatch?.[1] || last).toLowerCase();
  } catch {
    return "";
  }
}

function collectUniversalGalleryCandidates($, pageUrl) {
  const candidates = [];
  const containers = [];
  const identity = universalListingIdentity(pageUrl);

  const selectors = [
    '[class*="gallery"]','[class*="galeria"]','[class*="carousel"]','[class*="swiper"]',
    '[class*="slider"]','[class*="photo"]','[class*="foto"]','[class*="image"]',
    '[id*="gallery"]','[id*="galeria"]','[id*="carousel"]','[id*="slider"]',
    '[data-testid*="gallery"]','[data-testid*="photo"]','[data-testid*="image"]',
    'main','article'
  ];

  const seen = new Set();

  function badContext(node) {
    const text = [
      node.attr("class") || "",
      node.attr("id") || "",
      node.closest("header,footer,nav").attr("class") || "",
      node.closest('[class*="similar"],[class*="related"],[class*="recommend"]').attr("class") || ""
    ].join(" ").toLowerCase();
    return /(logo|brand|marca|avatar|icon|menu|navbar|footer|header|similar|related|recommend|banner|ads?|advert)/i.test(text);
  }

  function addFromNode(container, selectorIndex) {
    const domNode = container.get(0);
    if (!domNode || seen.has(domNode) || badContext(container)) return;
    seen.add(domNode);

    const local = [];
    const add = (value, score, source) => {
      if (!value) return;
      addImageCandidate(local, value, pageUrl, score, source, "");
    };

    container.find("img").each((index, el) => {
      const img = $(el);
      if (badContext(img)) return;

      const text = [
        img.attr("alt") || "", img.attr("class") || "", img.attr("id") || "",
        img.attr("src") || "", img.attr("data-src") || ""
      ].join(" ").toLowerCase();
      if (/(logo|avatar|icon|sprite|placeholder|banner|brand|marca)/i.test(text)) return;

      const score = 195 - Math.min(index, 35);
      ["src","data-src","data-lazy-src","data-original","data-image","data-url","data-full","data-large"].forEach((attr) => add(img.attr(attr), score, "universal-gallery:img:" + attr));
      ["srcset","data-srcset"].forEach((attr) => add(img.attr(attr), score + 8, "universal-gallery:img:" + attr));
    });

    container.find("source").each((index, el) => {
      const source = $(el);
      ["src","srcset","data-src","data-srcset"].forEach((attr) => add(source.attr(attr), 202 - Math.min(index, 30), "universal-gallery:source:" + attr));
    });

    container.find("a").each((index, el) => {
      const a = $(el);
      if (badContext(a)) return;
      ["href","data-src","data-image","data-photo","data-foto","data-full","data-original","data-large"].forEach((attr) => {
        const value = a.attr(attr);
        if (!value) return;
        if (/\.(?:jpe?g|png|webp|avif)(?:[?#]|$)/i.test(value) || /(?:foto|photo|image|img|gallery|galeria)/i.test(attr + " " + value)) {
          add(value, 190 - Math.min(index, 30), "universal-gallery:a:" + attr);
        }
      });
    });

    container.find("*").each((index, el) => {
      const attrs = el.attribs || {};
      for (const [name, rawValue] of Object.entries(attrs)) {
        if (!rawValue || typeof rawValue !== "string") continue;
        if (!/^(?:data-|src|srcset|href|poster)/i.test(name)) continue;
        const value = rawValue.replace(/\\u002F/gi, "/").replace(/\\\//g, "/");
        if (/\.(?:jpe?g|png|webp|avif)(?:[?#\s]|$)/i.test(value) || /(?:foto|photo|image|img|gallery|galeria|full|large)/i.test(name)) {
          add(value, 170 - Math.min(index, 40), "universal-gallery:attr:" + name);
        }
      }
    });

    container.find('[style*="background"]').each((index, el) => {
      const style = $(el).attr("style") || "";
      for (const match of style.matchAll(/url\((['"]?)(.*?)\1\)/gi)) {
        add(match[2], 160 - Math.min(index, 25), "universal-gallery:bg");
      }
    });

    const unique = [];
    const keys = new Set();
    for (const item of local.sort((a,b) => b.score - a.score)) {
      const key = canonicalImageKey(item.url);
      if (keys.has(key)) continue;
      keys.add(key);
      unique.push(item);
    }

    if (unique.length >= 2) {
      const classText = ((container.attr("class") || "") + " " + (container.attr("id") || "")).toLowerCase();
      let score = unique.length * 80 - selectorIndex * 4;
      if (/(gallery|galeria|carousel|swiper|slider|photo|foto)/i.test(classText)) score += 260;
      if (identity && container.text().toLowerCase().includes(identity)) score += 50;
      if (container.is("main,article")) score -= 120;
      containers.push({ score, images: unique });
    }
  }

  selectors.forEach((selector, selectorIndex) => {
    $(selector).each((_, el) => addFromNode($(el), selectorIndex));
  });

  containers.sort((a,b) => b.score - a.score);
  for (const group of containers.slice(0, 3)) {
    group.images.forEach((item) => candidates.push(item));
  }

  const output = [];
  const keys = new Set();
  for (const item of candidates.sort((a,b) => b.score - a.score)) {
    const key = canonicalImageKey(item.url);
    if (keys.has(key)) continue;
    keys.add(key);
    output.push(item);
  }
  return output;
}

function collectUniversalEmbeddedImages($, pageUrl) {
  const candidates = [];
  const identity = universalListingIdentity(pageUrl);
  const imageKey = /(?:image|images|photo|photos|foto|fotos|gallery|galeria|picture|pictures|media|slides|carousel|photoswipe|full|large)/i;

  function add(value, score = 215, source = "universal-embedded") {
    if (typeof value !== "string") return;
    const cleaned = value
      .replace(/\\u002F/gi, "/")
      .replace(/\\\//g, "/")
      .replace(/&amp;/g, "&");
    if (/^https?:\/\//i.test(cleaned) || /\.(?:jpe?g|png|webp|avif)(?:[?#]|$)/i.test(cleaned)) {
      addImageCandidate(candidates, cleaned, pageUrl, score, source, "");
    }
  }

  function walk(value, path = "", depth = 0) {
    if (depth > 14 || value == null) return;
    if (typeof value === "string") {
      if (imageKey.test(path) || /\.(?:jpe?g|png|webp|avif)(?:[?#]|$)/i.test(value)) add(value, imageKey.test(path) ? 245 : 195, "embedded-json:" + path);
      return;
    }
    if (Array.isArray(value)) {
      value.slice(0, 250).forEach((item, index) => walk(item, path + "[" + index + "]", depth + 1));
      return;
    }
    if (typeof value === "object") {
      Object.entries(value).forEach(([key, nested]) => {
        walk(nested, path ? path + "." + key : key, depth + 1);
      });
    }
  }

  $('script[type="application/ld+json"], script#__NEXT_DATA__, script[type="application/json"], script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).html() || "";
    if (!raw.trim()) return;
    try { walk(JSON.parse(raw.trim())); } catch {}
  });

  $("script").each((_, el) => {
    const raw = $(el).html() || "";
    if (!raw || raw.length > 4000000) return;

    const normalized = raw.replace(/\\u002F/gi, "/").replace(/\\\//g, "/");
    const identityHit = identity && normalized.toLowerCase().includes(identity);
    const sourceScore = identityHit ? 225 : 180;

    for (const match of normalized.matchAll(/https?:\/\/[^"'<>\\\s]+?(?:jpe?g|png|webp|avif)(?:\?[^"'<>\\\s]*)?/gi)) {
      add(match[0], sourceScore, identityHit ? "embedded-script:listing" : "embedded-script");
    }

    for (const match of normalized.matchAll(/["'](?:src|url|image|photo|foto|original|large|full)["']\s*:\s*["']([^"']+\.(?:jpe?g|png|webp|avif)(?:\?[^"']*)?)["']/gi)) {
      add(match[1], sourceScore + 12, "embedded-script:keyed");
    }
  });

  const unique = [];
  const keys = new Set();
  for (const item of candidates.sort((a,b) => b.score - a.score)) {
    const key = canonicalImageKey(item.url);
    if (keys.has(key)) continue;
    keys.add(key);
    unique.push(item);
  }
  return unique;
}

function mergeImageCandidateGroups(...groups) {
  const merged = [];
  const keys = new Set();
  for (const group of groups) {
    for (const item of group || []) {
      if (!item?.url) continue;
      const key = canonicalImageKey(item.url);
      if (keys.has(key)) continue;
      keys.add(key);
      merged.push(item);
    }
  }
  return merged.sort((a,b) => Number(b.score || 0) - Number(a.score || 0));
}

function collectImageCandidates($, pageUrl, jsonLd = [], listingCode = "") {
  const candidates = [];

  [
    ['meta[property="og:image:secure_url"]', 120, "og:image:secure_url"],
    ['meta[property="og:image"]', 115, "og:image"],
    ['meta[name="twitter:image"]', 110, "twitter:image"],
    ['meta[name="twitter:image:src"]', 108, "twitter:image:src"],
    ['link[rel="image_src"]', 105, "image_src"],
  ].forEach(([selector, score, source]) => {
    const attr = selector.startsWith("link") ? "href" : "content";
    $(selector).each((_, el) => addImageCandidate(candidates, $(el).attr(attr), pageUrl, score, source, listingCode));
  });

  for (const item of jsonLd) {
    const itemUrl = cleanText(item?.url || item?.["@id"] || "");
    const itemCode = extractPropertyCode(itemUrl);
    if (listingCode && itemCode && itemCode !== listingCode) continue;

    const image = item?.image;
    const values = Array.isArray(image) ? image : image ? [image] : [];
    values.forEach((value) => {
      if (typeof value === "string") addImageCandidate(candidates, value, pageUrl, 112, "json-ld:image", listingCode);
      else if (value?.url) addImageCandidate(candidates, value.url, pageUrl, 112, "json-ld:image", listingCode);
      else if (value?.contentUrl) addImageCandidate(candidates, value.contentUrl, pageUrl, 112, "json-ld:contentUrl", listingCode);
    });
    if (item?.thumbnailUrl) addImageCandidate(candidates, item.thumbnailUrl, pageUrl, 92, "json-ld:thumbnail", listingCode);
  }

  $("img").each((index, el) => {
    const img = $(el);

    const linkedListing = img.closest('a[href*="/imovel/"]').attr("href") || "";
    const linkedCode = extractPropertyCode(linkedListing);
    if (listingCode && linkedCode && linkedCode !== listingCode) return;

    const ancestorText = [
      img.closest('[class*="similar"]').attr("class"),
      img.closest('[class*="related"]').attr("class"),
      img.closest('[class*="recommend"]').attr("class"),
      img.closest('[class*="card"]').attr("class"),
    ].filter(Boolean).join(" ").toLowerCase();
    if (linkedCode && linkedCode !== listingCode) return;
    if (!linkedCode && /(similar|related|recommend)/i.test(ancestorText)) return;

    const width = Number(img.attr("width") || img.attr("data-width") || 0);
    const height = Number(img.attr("height") || img.attr("data-height") || 0);
    const areaBonus = width && height ? Math.min(28, Math.log10(Math.max(1, width * height)) * 4) : 0;
    const classAndAlt = ((img.attr("class") || "") + " " + (img.attr("alt") || "")).toLowerCase();
    let semanticBonus = 0;
    if (/(principal|destaque|gallery|galeria|imovel|property|foto)/i.test(classAndAlt)) semanticBonus += 24;
    if (/(logo|icone|icon|avatar)/i.test(classAndAlt)) semanticBonus -= 70;

    const baseScore = 54 - Math.min(index, 18) + areaBonus + semanticBonus;
    ["src", "data-src", "data-lazy-src", "data-original", "data-image", "data-url"].forEach((attr) => {
      addImageCandidate(candidates, img.attr(attr), pageUrl, baseScore, "img:" + attr, listingCode);
    });
    ["srcset", "data-srcset"].forEach((attr) => {
      addImageCandidate(candidates, img.attr(attr), pageUrl, baseScore + 6, "img:" + attr, listingCode);
    });
  });

  $("picture source, source").each((index, el) => {
    const source = $(el);
    ["src", "srcset", "data-src", "data-srcset"].forEach((attr) => {
      const value = source.attr(attr);
      if (value) addImageCandidate(candidates, value, pageUrl, 76 - Math.min(index, 18), "source:" + attr, listingCode);
    });
  });

  $('[style*="background"]').each((index, el) => {
    const node = $(el);
    const linkedListing = node.closest('a[href*="/imovel/"]').attr("href") || "";
    const linkedCode = extractPropertyCode(linkedListing);
    if (listingCode && linkedCode && linkedCode !== listingCode) return;

    const style = node.attr("style") || "";
    const matches = [...style.matchAll(/url\((['"]?)(.*?)\1\)/gi)];
    matches.forEach((match) => addImageCandidate(candidates, match[2], pageUrl, 48 - Math.min(index, 12), "background-image", listingCode));
  });

  return candidates.sort((a, b) => b.score - a.score);
}

async function downloadFirstValidImage(candidates, pageUrl) {
  const errors = [];
  for (const candidate of candidates.slice(0, 24)) {
    try {
      const response = await axios.get(candidate.url, {
        responseType: "arraybuffer",
        timeout: 12000,
        maxRedirects: 5,
        validateStatus: (status) => status >= 200 && status < 400,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
          "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
          "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
          "Referer": pageUrl,
        },
      });

      const contentType = String(response.headers["content-type"] || "").toLowerCase();
      const buffer = Buffer.from(response.data || []);
      if (!buffer.length) throw new Error("arquivo vazio");
      if (!contentType.startsWith("image/")) throw new Error("tipo inválido: " + (contentType || "sem content-type"));
      if (buffer.length < 2500 && !contentType.includes("svg")) throw new Error("imagem pequena demais");

      return {
        base64: "data:" + contentType.split(";")[0] + ";base64," + buffer.toString("base64"),
        url: candidate.url,
        source: candidate.source,
      };
    } catch (error) {
      errors.push((candidate.source || "imagem") + ": " + error.message);
    }
  }
  return { base64: "", url: "", source: "", errors };
}

function canonicalImageKey(rawUrl) {
  try {
    const url = new URL(rawUrl);
    url.hash = "";
    [
      "w","h","width","height","resize","fit","crop","quality","q","format",
      "fm","auto","dpr","sharp","tr","transform"
    ].forEach((key) => url.searchParams.delete(key));

    let pathName = url.pathname.toLowerCase();
    pathName = pathName
      .replace(/[-_](?:\d{2,4})x(?:\d{2,4})(?=\.[a-z]{2,5}$)/i, "")
      .replace(/\/(?:thumb|thumbnail|small|medium|large|original)\//gi, "/")
      .replace(/\/(?:w|h|width|height)[-_]?\d{2,4}\//gi, "/");

    return url.hostname.toLowerCase() + pathName;
  } catch {
    return String(rawUrl || "").toLowerCase().split("?")[0].split("#")[0];
  }
}

function readRasterSize(buffer, contentType = "") {
  try {
    const type = String(contentType || "").toLowerCase();

    // PNG
    if (type.includes("png") && buffer.length >= 24 &&
        buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
      return {
        width: buffer.readUInt32BE(16),
        height: buffer.readUInt32BE(20),
      };
    }

    // JPEG
    if ((type.includes("jpeg") || type.includes("jpg")) && buffer.length > 4 &&
        buffer[0] === 0xff && buffer[1] === 0xd8) {
      let offset = 2;
      while (offset + 9 < buffer.length) {
        if (buffer[offset] !== 0xff) { offset += 1; continue; }
        const marker = buffer[offset + 1];
        if (marker === 0xd8 || marker === 0xd9) { offset += 2; continue; }
        const length = buffer.readUInt16BE(offset + 2);
        if (!length || offset + length + 2 > buffer.length) break;

        if (
          marker === 0xc0 || marker === 0xc1 || marker === 0xc2 ||
          marker === 0xc3 || marker === 0xc5 || marker === 0xc6 ||
          marker === 0xc7 || marker === 0xc9 || marker === 0xca ||
          marker === 0xcb || marker === 0xcd || marker === 0xce ||
          marker === 0xcf
        ) {
          return {
            height: buffer.readUInt16BE(offset + 5),
            width: buffer.readUInt16BE(offset + 7),
          };
        }
        offset += length + 2;
      }
    }

    return null;
  } catch {
    return null;
  }
}

function hammingDistance(a = "", b = "") {
  if (!a || !b || a.length !== b.length) return Infinity;
  let distance = 0;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) distance += 1;
  }
  return distance;
}

async function analyzePropertyPhoto(buffer, contentType = "") {
  try {
    if (String(contentType || "").toLowerCase().includes("svg")) {
      return { valid: false, reason: "svg" };
    }

    const image = sharp(buffer, { failOn: "none" });
    const metadata = await image.metadata();
    const width = Number(metadata.width || 0);
    const height = Number(metadata.height || 0);
    if (!width || !height) return { valid: false, reason: "sem dimensões" };

    const aspect = width / height;
    if (width < 520 || height < 300) {
      return { valid: false, reason: "resolução pequena", width, height };
    }
    if (aspect < 0.58 || aspect > 2.15) {
      return { valid: false, reason: "proporção não fotográfica", width, height };
    }

    const stats = await image.stats();
    const entropy = Number(stats.entropy || 0);
    if (entropy < 3.15) {
      return { valid: false, reason: "baixa entropia / possível logo", width, height, entropy };
    }

    const pixels = await sharp(buffer, { failOn: "none" })
      .resize(9, 8, { fit: "fill" })
      .grayscale()
      .raw()
      .toBuffer();

    let hash = "";
    for (let y = 0; y < 8; y += 1) {
      for (let x = 0; x < 8; x += 1) {
        const left = pixels[y * 9 + x];
        const right = pixels[y * 9 + x + 1];
        hash += left > right ? "1" : "0";
      }
    }

    return {
      valid: true,
      width,
      height,
      entropy,
      hash,
    };
  } catch (error) {
    return { valid: false, reason: "falha na análise: " + error.message };
  }
}

async function downloadValidImages(candidates, pageUrl, limit = 6) {
  const images = [];
  const buffers = [];
  const visualHashes = [];
  const usedKeys = new Set();

  for (const candidate of candidates.slice(0, 60)) {
    const candidateText = (candidate.url + " " + (candidate.source || "")).toLowerCase();
    if (/(logo|icon|favicon|sprite|placeholder|banner|brand|marca)/i.test(candidateText)) continue;

    const key = canonicalImageKey(candidate.url);
    if (usedKeys.has(key)) continue;
    if (images.length >= limit) break;
    try {
      const response = await axios.get(candidate.url, {
        responseType: "arraybuffer",
        timeout: 12000,
        maxRedirects: 5,
        validateStatus: (status) => status >= 200 && status < 400,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
          "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
          "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
          "Referer": pageUrl,
        },
      });

      const contentType = String(response.headers["content-type"] || "").toLowerCase();
      const buffer = Buffer.from(response.data || []);
      if (!buffer.length) continue;
      if (!contentType.startsWith("image/")) continue;
      if (contentType.includes("svg")) continue;
      if (buffer.length < 12000) continue;
      if (buffer.length > 4000000) continue;

      const analysis = await analyzePropertyPhoto(buffer, contentType);
      if (!analysis.valid) {
        console.warn("⚠️ Imagem descartada:", analysis.reason, candidate.source, candidate.url);
        continue;
      }

      const exactDuplicate = buffers.some((existing) => existing.length === buffer.length && existing.equals(buffer));
      if (exactDuplicate) continue;

      const visualDuplicate = visualHashes.some((hash) => hammingDistance(hash, analysis.hash) <= 7);
      if (visualDuplicate) {
        console.log("↩️ Variante repetida da mesma foto ignorada:", candidate.url);
        continue;
      }

      usedKeys.add(key);
      buffers.push(buffer);
      visualHashes.push(analysis.hash);
      images.push({
        base64: "data:" + contentType.split(";")[0] + ";base64," + buffer.toString("base64"),
        url: candidate.url,
        source: candidate.source,
        width: analysis.width,
        height: analysis.height,
        entropy: analysis.entropy,
      });
    } catch {}
  }

  return images;
}

function formatPrice(value, currency = "BRL") {
  const raw = cleanText(value);
  if (!raw) return "";
  if (/R\$|US\$|€|£/.test(raw)) return raw;
  const normalized = raw.replace(/[^\d.,-]/g, "").replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", ".");
  const numeric = Number(normalized);
  if (!Number.isFinite(numeric)) return raw;
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: currency || "BRL", maximumFractionDigits: 2 }).format(numeric);
  } catch {
    return `R$ ${numeric.toLocaleString("pt-BR")}`;
  }
}

function extractArea(text) {
  const source = cleanText(text);
  if (!source) return "";
  const match = source.match(/(\d{1,3}(?:[.\s]\d{3})*(?:,\d+)?|\d+(?:[.,]\d+)?)\s*(m²|m2|metros? quadrados?|ha|hectares?|alqueires?)/i);
  return match ? `${match[1]} ${match[2]}` : "";
}

function extractListingData($, pageUrl) {
  const jsonLd = readJsonLd($);
  const address = findNestedObject(jsonLd, "address") || {};
  const offers = findNestedObject(jsonLd, "offers") || {};
  const floorSize = findNestedObject(jsonLd, "floorSize") || {};

  const titulo = firstAttr($, ['meta[property="og:title"]', 'meta[name="twitter:title"]']) || findFirstValue(jsonLd, ["name", "headline"]) || firstText($, ["h1"]);
  const descricao = firstAttr($, ['meta[property="og:description"]', 'meta[name="description"]']) || findFirstValue(jsonLd, ["description"]);
  const rawPrice = cleanText(offers.price) || firstAttr($, ['meta[property="product:price:amount"]', 'meta[itemprop="price"]']) || firstText($, ['[itemprop="price"]', '[data-testid*="price"]', '[class*="price"]', '[class*="preco"]']);
  const currency = cleanText(offers.priceCurrency) || firstAttr($, ['meta[property="product:price:currency"]']) || "BRL";

  let area = "";
  if (floorSize && (floorSize.value || floorSize.name)) {
    const unit = cleanText(floorSize.unitText || floorSize.unitCode || "m²");
    area = `${cleanText(floorSize.value || floorSize.name)} ${unit}`.trim();
  }
  if (!area) area = extractArea(`${titulo} ${descricao}`);

  const city = cleanText(address.addressLocality || address.addressRegion || "") ||
    firstText($, ['[itemprop="addressLocality"]','[data-testid*="city"]','[class*="cidade"]','[class*="city"]']);
  const district = cleanText(address.addressDistrict || address.neighborhood || address.subLocality || "") ||
    firstText($, ['[itemprop="addressRegion"]','[data-testid*="neighborhood"]','[class*="bairro"]','[class*="neighborhood"]']);
  const listingCode = extractPropertyCode(pageUrl);
  const villela = isVillelaUrl(pageUrl);

  const specificGallery = villela
    ? collectVillelaGalleryCandidates($, pageUrl, listingCode)
    : [];
  const specificEmbedded = villela
    ? collectEmbeddedListingImages($, pageUrl, listingCode)
    : [];

  const universalGallery = villela ? [] : collectUniversalGalleryCandidates($, pageUrl);
  const universalEmbedded = villela ? [] : collectUniversalEmbeddedImages($, pageUrl);
  const genericCandidates = collectImageCandidates($, pageUrl, jsonLd, listingCode);

  const specificCandidates = mergeImageCandidateGroups(specificGallery, specificEmbedded);
  const universalCandidates = mergeImageCandidateGroups(universalGallery, universalEmbedded, genericCandidates);

  const imageCandidates = villela && specificCandidates.length >= 2
    ? specificCandidates
    : villela
      ? mergeImageCandidateGroups(specificCandidates, genericCandidates)
      : universalCandidates;

  const extractionMethod = villela
    ? (specificCandidates.length >= 2 ? "adaptador-villela" : "villela + fallback universal")
    : (universalGallery.length >= 2 ? "galeria universal" : universalEmbedded.length >= 2 ? "dados embutidos universais" : "metadados universais");

  const searchable = cleanText(`${titulo} ${descricao}`).toLocaleLowerCase("pt-BR");
  const featureMap = [
    ["Suíte", ["suíte", "suite"]],
    ["Vagas", ["vaga", "vagas", "garagem"]],
    ["Quintal", ["quintal"]],
    ["Área gourmet", ["área gourmet", "area gourmet", "espaço gourmet", "espaco gourmet"]],
    ["Fácil acesso", ["fácil acesso", "facil acesso", "boa localização", "boa localizacao"]],
    ["Documentação OK", ["documentação ok", "documentacao ok", "documentação em ordem", "documentacao em ordem"]],
    ["Pé-direito alto", ["pé-direito", "pe-direito", "pé direito", "pe direito"]],
    ["Pátio", ["pátio", "patio"]],
    ["Docas", ["doca", "docas"]],
    ["Energia trifásica", ["trifásica", "trifasica", "energia trifásica", "energia trifasica"]],
    ["Zoneamento industrial", ["zoneamento industrial", "zona industrial"]],
    ["Acesso à rodovia", ["acesso à rodovia", "acesso a rodovia", "acesso rodoviário", "acesso rodoviario", "rodovia"]],
  ];
  const diferenciais = featureMap.filter(([, keywords]) => keywords.some((keyword) => searchable.includes(keyword))).map(([label]) => label);

  return {
    titulo,
    preco: formatPrice(rawPrice, currency),
    cidade: city,
    bairro: district,
    area,
    descricao,
    diferenciais,
    imagemUrl: imageCandidates[0]?.url || "",
    imagensCandidatas: imageCandidates,
    extractionMethod,
    extractionDiagnostics: {
      dominio: siteDomain(pageUrl),
      candidatos: imageCandidates.length,
      galeriaUniversal: universalGallery.length,
      embutidasUniversais: universalEmbedded.length,
      especificas: specificCandidates.length,
      genericas: genericCandidates.length,
    },
  };
}

app.post("/analisar-imovel", async (req, res) => {
  try {
    const { url } = req.body || {};
    if (!url) return res.status(400).json({ erro: "URL não enviada" });

    let requestedUrl;
    try {
      requestedUrl = new URL(url).href;
    } catch {
      return res.status(400).json({ erro: "URL inválida" });
    }

    if (!isPublicHttpUrl(requestedUrl)) {
      return res.status(400).json({ erro: "Use um link público http/https de um anúncio imobiliário." });
    }

    const resolvedUrl = await resolveVillelaListingUrl(requestedUrl);
    if (!isPublicHttpUrl(resolvedUrl)) {
      return res.status(400).json({ erro: "O link redirecionou para um endereço não público." });
    }
    console.log("🔎 Buscando imóvel:", resolvedUrl);

    const response = await axios.get(resolvedUrl, {
      timeout: 18000,
      maxRedirects: 5,
      validateStatus: (status) => status >= 200 && status < 400,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
        "Referer": resolvedUrl,
      },
    });

    let finalPageUrl = response.request?.res?.responseUrl || resolvedUrl;
    let $ = cheerio.load(response.data);
    let dados = extractListingData($, finalPageUrl);

    // Alguns links curtos retornam uma casca de SPA. Se ela trouxer canonical, refaz a leitura pela página real.
    const canonical = absoluteUrl(
      $('link[rel="canonical"]').attr("href") ||
      $('meta[property="og:url"]').attr("content") ||
      "",
      finalPageUrl
    );

    const hasUsefulData = Boolean(
      dados.titulo ||
      dados.preco ||
      dados.descricao ||
      dados.area ||
      dados.cidade ||
      dados.bairro ||
      (dados.imagensCandidatas || []).length
    );

    if (!hasUsefulData && canonical && canonical !== finalPageUrl && isPublicHttpUrl(canonical)) {
      try {
        const canonicalResponse = await axios.get(canonical, {
          timeout: 18000,
          maxRedirects: 5,
          validateStatus: (status) => status >= 200 && status < 400,
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
            "Referer": finalPageUrl,
          },
        });
        finalPageUrl = canonicalResponse.request?.res?.responseUrl || canonical;
        $ = cheerio.load(canonicalResponse.data);
        dados = extractListingData($, finalPageUrl);
      } catch (error) {
        console.warn("⚠️ Falha ao abrir canonical:", error.message);
      }
    }

    const downloadedImages = await downloadValidImages(dados.imagensCandidatas || [], finalPageUrl, 6);
    const downloaded = downloadedImages[0] || await downloadFirstValidImage(dados.imagensCandidatas || [], finalPageUrl);
    const publicData = {
      titulo: dados.titulo,
      preco: dados.preco,
      cidade: dados.cidade,
      bairro: dados.bairro,
      area: dados.area,
      descricao: dados.descricao,
      diferenciais: dados.diferenciais,
      imagemUrl: downloaded.url || dados.imagemUrl || "",
      imagens: downloadedImages.map((item) => item.base64),
      imagensUrls: downloadedImages.map((item) => item.url),
      quantidadeFotosSeguras: downloadedImages.length,
      fontesFotos: downloadedImages.map((item) => item.source),
      urlResolvida: finalPageUrl,
      dominio: dados.extractionDiagnostics?.dominio || siteDomain(finalPageUrl),
      metodoExtracao: dados.extractionMethod || "metadados universais",
      diagnosticoExtracao: {
        ...(dados.extractionDiagnostics || {}),
        fotosValidas: downloadedImages.length,
      },
    };

    const foundAnything = Boolean(
      publicData.titulo ||
      publicData.preco ||
      publicData.cidade ||
      publicData.bairro ||
      publicData.area ||
      publicData.descricao ||
      downloaded.base64 ||
      publicData.imagemUrl
    );

    if (!foundAnything) {
      return res.status(422).json({
        erro: "A página abriu, mas o site não entregou os dados do imóvel no HTML.",
        dados: publicData,
        urlResolvida: finalPageUrl,
      });
    }

    if (!downloaded.base64) {
      console.warn("⚠️ Dados encontrados, mas imagem não baixada:", finalPageUrl);
      return res.status(200).json({
        ...publicData,
        dados: publicData,
        imagem: "",
        imagemUrl: publicData.imagemUrl,
        aviso: "Encontrei os dados do imóvel, mas não consegui baixar a foto automaticamente.",
        candidatos: (dados.imagensCandidatas || []).slice(0, 8).map(({ url, source }) => ({ url, source })),
      });
    }

    console.log("✅ Imagem encontrada:", downloaded.source, downloaded.url);
    return res.json({
      ...publicData,
      imagem: downloaded.base64,
      imagemUrl: downloaded.url,
      fonteImagem: downloaded.source,
      imagens: downloadedImages.map((item) => item.base64),
      imagensUrls: downloadedImages.map((item) => item.url),
      dados: publicData,
    });
  } catch (error) {
    const status = error?.response?.status;
    console.error("❌ Erro ao analisar imóvel:", status || "", error.message);
    return res.status(status && status >= 400 && status < 500 ? 502 : 500).json({
      erro: status
        ? "O site do imóvel respondeu com erro " + status + "."
        : "Erro ao analisar o imóvel",
      detalhe: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(pool ? "☁️ PostgreSQL configurado para perfis de imobiliária" : "💾 Perfis de imobiliária em modo local (sem DATABASE_URL)");
});