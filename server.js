import express from "express";
import cors from "cors";
import axios from "axios";
import * as cheerio from "cheerio";

const app = express();

app.use(cors());
app.use(express.json());

/*
========================================
TESTE DO SERVIDOR
========================================
*/

app.get("/", (req, res) => {
  res.send("Backend Story online 🚀");
});

/*
========================================
ANALISAR IMÓVEL
========================================
*/

app.post("/analisar-imovel", async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        erro: "URL não enviada"
      });
    }

    console.log("🔎 Buscando imóvel:", url);

    const response = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
      },
    });

    const html = response.data;

    const $ = cheerio.load(html);

    /*
    ========================================
    TENTAR PEGAR A IMAGEM
    ========================================
    */

    let imageUrl =
      $('meta[property="og:image"]').attr("content") ||
      $('img').first().attr("src");

    if (!imageUrl) {
      return res.status(404).json({
        erro: "Imagem não encontrada"
      });
    }

    if (!imageUrl.startsWith("http")) {
      const base = new URL(url);
      imageUrl = base.origin + imageUrl;
    }

    console.log("🖼 Imagem encontrada:", imageUrl);

    /*
    ========================================
    BAIXAR A IMAGEM
    ========================================
    */

    const imageResponse = await axios.get(imageUrl, {
      responseType: "arraybuffer",
    });

    const base64 =
      "data:image/jpeg;base64," +
      Buffer.from(imageResponse.data, "binary").toString("base64");

    res.json({
      imagem: base64
    });

  } catch (error) {
    console.error("❌ Erro:", error.message);

    res.status(500).json({
      erro: "Erro ao analisar o imóvel"
    });
  }
});

/*
========================================
PORTA PARA RENDER
========================================
*/

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});