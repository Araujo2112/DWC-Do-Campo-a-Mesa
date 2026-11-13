// Passo 8: imagens dos produtos.
// Com STORAGE_CONN: Azure Blob Storage (produção). Sem ela: pasta api/uploads, só para desenvolvimento
// (no App Service o disco não é permanente, por isso em produção a STORAGE_CONN é obrigatória).
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { BlobServiceClient } = require('@azure/storage-blob');

const PASTA_LOCAL = path.join(__dirname, '..', '..', 'uploads');
const NOME_VALIDO = /^[0-9a-f-]{36}\.(jpg|png|webp)$/;

const usaAzure = () => Boolean(process.env.STORAGE_CONN);

// O tipo vem dos primeiros bytes do ficheiro: o mimetype e o nome que o cliente envia não são de confiança.
function detectarTipo(b) {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: 'jpg', mime: 'image/jpeg' };
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { ext: 'png', mime: 'image/png' };
  }
  if (b.length >= 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
    return { ext: 'webp', mime: 'image/webp' };
  }
  return null;
}

let container;
function obterContainer() {
  // Os blobs têm de ser legíveis sem autenticação para o <img> da SPA os mostrar (acesso "blob":
  // lê-se o ficheiro se se souber o URL, mas não se lista o contentor).
  container ??= (async () => {
    const c = BlobServiceClient
      .fromConnectionString(process.env.STORAGE_CONN)
      .getContainerClient(process.env.STORAGE_CONTAINER || 'produtos');
    await c.createIfNotExists({ access: 'blob' });
    return c;
  })().catch((err) => { container = undefined; throw err; });
  return container;
}

/** @returns {Promise<string>} URL público da imagem. O nome é gerado aqui (nunca o do cliente). */
async function guardarImagem(buffer, tipo, baseUrl) {
  const nome = `${crypto.randomUUID()}.${tipo.ext}`;
  if (usaAzure()) {
    const blob = (await obterContainer()).getBlockBlobClient(nome);
    await blob.uploadData(buffer, {
      blobHTTPHeaders: { blobContentType: tipo.mime, blobCacheControl: 'public, max-age=31536000, immutable' },
    });
    return blob.url;
  }
  await fs.mkdir(PASTA_LOCAL, { recursive: true });
  await fs.writeFile(path.join(PASTA_LOCAL, nome), buffer);
  return `${baseUrl}/uploads/${nome}`;
}

// Limpeza que nunca falha: uma imagem esquecida no storage não pode estragar a operação que a pediu.
async function apagarImagem(url) {
  if (typeof url !== 'string') return;
  try {
    const nome = decodeURIComponent(new URL(url).pathname.split('/').pop());
    if (!NOME_VALIDO.test(nome)) return;
    if (usaAzure()) await (await obterContainer()).deleteBlobIfExists(nome);
    else await fs.rm(path.join(PASTA_LOCAL, nome), { force: true });
  } catch (err) {
    console.error('Apagar imagem:', err.message);
  }
}

// Para o painel do administrador: o contentor está acessível? (sem STORAGE_CONN é só um aviso)
async function estadoStorage() {
  if (!usaAzure()) return { estado: 'aviso', detalhe: 'Disco local (STORAGE_CONN vazia): só para desenvolvimento' };
  const c = await obterContainer();
  if (!(await c.exists())) throw new Error('contentor em falta');
  return { detalhe: `Contentor "${c.containerName}" acessível`, medirLatencia: true };
}

module.exports = { guardarImagem, apagarImagem, detectarTipo, estadoStorage, usaAzure, PASTA_LOCAL };
