// Passo 8: guardar as imagens dos produtos no storage da Cloud (Azure Blob Storage).
// Em AWS: @aws-sdk/client-s3 · Em Google Cloud: @google-cloud/storage
const { BlobServiceClient } = require('@azure/storage-blob');

let container;
function obterContainer() {
  if (!container) {
    if (!process.env.STORAGE_CONN) throw new Error('STORAGE_CONN não está definida');
    container = BlobServiceClient
      .fromConnectionString(process.env.STORAGE_CONN)
      .getContainerClient(process.env.STORAGE_CONTAINER || 'produtos');
  }
  return container;
}

/**
 * @param {{ buffer: Buffer, originalname: string, mimetype: string }} ficheiro (multer)
 * @returns {Promise<string>} URL público da imagem
 */
async function guardarImagem(ficheiro) {
  // TODO: validar o tipo (image/jpeg, image/png, image/webp) e gerar um nome único
  const blob = obterContainer().getBlockBlobClient(`${Date.now()}-${ficheiro.originalname}`);
  await blob.uploadData(ficheiro.buffer, {
    blobHTTPHeaders: { blobContentType: ficheiro.mimetype }
  });
  return blob.url;
}

module.exports = { guardarImagem };
