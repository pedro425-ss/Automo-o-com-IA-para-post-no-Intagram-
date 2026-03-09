import axios from "axios";
import * as cheerio from "cheerio";

// função principal que o server.js vai usar
export async function analisarImovel(url) {

  try {

    const response = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
      }
    });

    const html = response.data;

    const $ = cheerio.load(html);

    // tenta pegar imagens da página
    let imagem = null;

    // tenta og:image
    imagem = $('meta[property="og:image"]').attr("content");

    // se não encontrar tenta img da página
    if (!imagem) {
      imagem = $("img").first().attr("src");
    }

    if (!imagem) {
      throw new Error("Nenhuma imagem encontrada");
    }

    // também podemos pegar título do imóvel
    const titulo =
      $('meta[property="og:title"]').attr("content") ||
      $("title").text() ||
      "Imóvel";

    return {
      titulo,
      imagem
    };

  } catch (error) {

    console.error("Erro no scraper:", error.message);

    throw new Error("Erro ao fazer scraping do imóvel");
  }
}