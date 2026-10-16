import express from "express";
import cors from "cors";
import axios from "axios";
import * as cheerio from "cheerio";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Pool } from "pg";
import sharp from "sharp";

const app = express();
const APP_BUILD = "villela-gallery-deep-scan-20261016-1410";

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
      )
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
app.get("/brand-theme.js", (req, res) => sendFrontendFile(res, "brand-theme.js"));
app.get("/autofill.js", (req, res) => sendFrontendFile(res, "autofill.js"));

app.get("/script.js", (req, res) => {
  disableFrontendCache(res);
  res.type("application/javascript; charset=utf-8");

  try {
    const mainScript = fs.readFileSync(path.join(frontendDir, "script.js"), "utf8");
    const extrasScript = fs.readFileSync(path.join(frontendDir, "extras.js"), "utf8");
    const storySetScript = fs.readFileSync(path.join(frontendDir, "story-set.js"), "utf8");
    const templatesScript = fs.readFileSync(path.join(frontendDir, "templates.js"), "utf8");
    const workflowScript = fs.readFileSync(path.join(frontendDir, "workflow.js"), "utf8");
    const exportFormatsScript = fs.readFileSync(path.join(frontendDir, "export-formats.js"), "utf8");
    const propertiesScript = fs.readFileSync(path.join(frontendDir, "properties.js"), "utf8");
    const logoLibraryScript = fs.readFileSync(path.join(frontendDir, "logo-library.js"), "utf8");
    const cloudProfilesScript = fs.readFileSync(path.join(frontendDir, "cloud-profiles.js"), "utf8");
    const mobileWizardScript = fs.readFileSync(path.join(frontendDir, "mobile-wizard.js"), "utf8");

    return res.send(
      `${mainScript}\n\n/* Recursos avançados */\n${extrasScript}\n\n/* Pacote de 3 Stories */\n${storySetScript}\n\n/* Modelos de Story */\n${templatesScript}\n\n/* Rascunhos e histórico */\n${workflowScript}\n\n/* Exportação Feed e Quadrado */\n${exportFormatsScript}\n\n/* Painel de imóveis salvos */\n${propertiesScript}\n\n/* Biblioteca de logos */\n${logoLibraryScript}\n\n/* Perfis sincronizados na nuvem */\n${cloudProfilesScript}\n\n/* Fluxo mobile em etapas */\n${mobileWizardScript}`
    );
  } catch (error) {
    console.error("❌ Erro ao montar script do frontend:", error.message);
    return res.status(500).send("console.error('Erro ao carregar o editor.');");
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

  const city = cleanText(address.addressLocality || address.addressRegion || "");
  const district = cleanText(address.addressDistrict || address.neighborhood || address.subLocality || "");
  const listingCode = extractPropertyCode(pageUrl);
  const villelaGallery = isVillelaUrl(pageUrl)
    ? collectVillelaGalleryCandidates($, pageUrl, listingCode)
    : [];
  const embeddedGallery = isVillelaUrl(pageUrl)
    ? collectEmbeddedListingImages($, pageUrl, listingCode)
    : [];

  const safeVillelaCandidates = [];
  const safeKeys = new Set();
  for (const item of [...villelaGallery, ...embeddedGallery].sort((a, b) => b.score - a.score)) {
    const key = canonicalImageKey(item.url);
    if (safeKeys.has(key)) continue;
    safeKeys.add(key);
    safeVillelaCandidates.push(item);
  }

  const imageCandidates = safeVillelaCandidates.length >= 2
    ? safeVillelaCandidates
    : collectImageCandidates($, pageUrl, jsonLd, listingCode);

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

    const resolvedUrl = await resolveVillelaListingUrl(requestedUrl);
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

    if (!hasUsefulData && canonical && canonical !== finalPageUrl) {
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