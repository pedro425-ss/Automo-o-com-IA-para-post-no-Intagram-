import express from "express";
import cors from "cors";
import axios from "axios";
import * as cheerio from "cheerio";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Pool } from "pg";

const app = express();

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
app.get("/Style.css", (req, res) => sendFrontendFile(res, "Style.css"));
app.get("/adjustments.css", (req, res) => sendFrontendFile(res, "adjustments.css"));
app.get("/mobile.css", (req, res) => sendFrontendFile(res, "mobile.css"));
app.get("/adjustments.js", (req, res) => sendFrontendFile(res, "adjustments.js"));

app.get("/script.js", (req, res) => {
  disableFrontendCache(res);
  res.type("application/javascript; charset=utf-8");

  try {
    const mainScript = fs.readFileSync(path.join(frontendDir, "script.js"), "utf8");
    const extrasScript = fs.readFileSync(path.join(frontendDir, "extras.js"), "utf8");
    const storySetScript = fs.readFileSync(path.join(frontendDir, "story-set.js"), "utf8");
    const autofillScript = fs.readFileSync(path.join(frontendDir, "autofill.js"), "utf8");
    const templatesScript = fs.readFileSync(path.join(frontendDir, "templates.js"), "utf8");
    const workflowScript = fs.readFileSync(path.join(frontendDir, "workflow.js"), "utf8");
    const exportFormatsScript = fs.readFileSync(path.join(frontendDir, "export-formats.js"), "utf8");
    const propertiesScript = fs.readFileSync(path.join(frontendDir, "properties.js"), "utf8");
    const logoLibraryScript = fs.readFileSync(path.join(frontendDir, "logo-library.js"), "utf8");
    const cloudProfilesScript = fs.readFileSync(path.join(frontendDir, "cloud-profiles.js"), "utf8");

    return res.send(
      `${mainScript}\n\n/* Recursos avançados */\n${extrasScript}\n\n/* Pacote de 3 Stories */\n${storySetScript}\n\n/* Preenchimento automático */\n${autofillScript}\n\n/* Modelos de Story */\n${templatesScript}\n\n/* Rascunhos e histórico */\n${workflowScript}\n\n/* Exportação Feed e Quadrado */\n${exportFormatsScript}\n\n/* Painel de imóveis salvos */\n${propertiesScript}\n\n/* Biblioteca de logos */\n${logoLibraryScript}\n\n/* Perfis sincronizados na nuvem */\n${cloudProfilesScript}`
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
  const imageCandidate = firstAttr($, ['meta[property="og:image"]', 'meta[name="twitter:image"]']) || findImageFromJsonLd(jsonLd) || $("img").first().attr("src") || "";

  const searchable = cleanText(`${titulo} ${descricao}`).toLocaleLowerCase("pt-BR");
  const featureMap = [
    ["Casa sede", ["casa sede"]], ["Lago", ["lago"]], ["Nascente", ["nascente"]], ["Área verde", ["área verde", "area verde"]], ["Fácil acesso", ["fácil acesso", "facil acesso"]], ["Documentação OK", ["documentação ok", "documentacao ok", "documentação em ordem", "documentacao em ordem"]],
  ];
  const diferenciais = featureMap.filter(([, keywords]) => keywords.some((keyword) => searchable.includes(keyword))).map(([label]) => label);

  return { titulo, preco: formatPrice(rawPrice, currency), cidade: city, bairro: district, area, descricao, diferenciais, imagemUrl: absoluteUrl(imageCandidate, pageUrl) };
}

app.post("/analisar-imovel", async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ erro: "URL não enviada" });

    console.log("🔎 Buscando imóvel:", url);
    const response = await axios.get(url, {
      timeout: 15000,
      maxRedirects: 5,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
      },
    });

    const $ = cheerio.load(response.data);
    const dados = extractListingData($, url);
    if (!dados.imagemUrl) return res.status(404).json({ erro: "Imagem não encontrada", dados });

    const imageResponse = await axios.get(dados.imagemUrl, {
      responseType: "arraybuffer",
      timeout: 15000,
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36" },
    });

    const contentType = imageResponse.headers["content-type"] || "image/jpeg";
    const base64 = `data:${contentType};base64,` + Buffer.from(imageResponse.data).toString("base64");

    return res.json({ imagem: base64, titulo: dados.titulo, preco: dados.preco, cidade: dados.cidade, bairro: dados.bairro, area: dados.area, descricao: dados.descricao, diferenciais: dados.diferenciais });
  } catch (error) {
    console.error("❌ Erro:", error.message);
    return res.status(500).json({ erro: "Erro ao analisar o imóvel", detalhe: process.env.NODE_ENV === "development" ? error.message : undefined });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(pool ? "☁️ PostgreSQL configurado para perfis de imobiliária" : "💾 Perfis de imobiliária em modo local (sem DATABASE_URL)");
});