import { randomUUID } from 'node:crypto';
import multer from 'multer';
import { fileTypeFromBuffer } from 'file-type';
import { config } from '../config.js';
import { AppError, throwSupabaseError } from '../lib/errors.js';
import { getAdminSupabase, requireSupabaseConfiguration } from '../lib/supabase.js';

const receiveFile = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxDigitalUploadBytes, files: 1 },
}).single('file');

export async function uploadStoreAsset(request, response, next) {
  receiveFile(request, response, async (uploadError) => {
    try {
      if (uploadError) {
        if (uploadError.code === 'LIMIT_FILE_SIZE') throw new AppError(413, 'FILE_TOO_LARGE', 'Le fichier dépasse la limite serveur de 50 Mo.');
        throw new AppError(400, 'UPLOAD_INVALID', 'Le fichier envoyé n’a pas pu être lu.');
      }
      if (!request.file) throw new AppError(400, 'FILE_REQUIRED', 'Choisissez un fichier à envoyer.');
      requireSupabaseConfiguration();
      const kind = String(request.query.kind || 'product-image');
      const detected = await fileTypeFromBuffer(request.file.buffer);
      if (!detected) throw new AppError(415, 'UNSUPPORTED_FILE', 'Le type réel du fichier ne peut pas être vérifié.');

      if (kind === 'product-image') {
        if (!config.allowedImageTypes.has(detected.mime) || request.file.size > config.maxUploadBytes) {
          throw new AppError(415, 'UNSUPPORTED_IMAGE', 'Image invalide. Formats acceptés : JPEG, PNG, WebP et AVIF, jusqu’à 10 Mo.');
        }
        const path = `${request.authUser.id}/${randomUUID()}.${detected.ext}`;
        const storage = getAdminSupabase().storage.from(config.productImageBucket);
        const { error } = await storage.upload(path, request.file.buffer, { contentType: detected.mime, cacheControl: '31536000', upsert: false });
        if (error) throwSupabaseError(error, 'Le stockage Supabase a refusé cette image.');
        const { data } = storage.getPublicUrl(path);
        response.status(201).json({ item: { storage_path: path, url: data.publicUrl, alt_text: request.file.originalname.slice(0, 180), mime_type: detected.mime } });
        return;
      }

      if (kind === 'digital-file') {
        if (!config.allowedDigitalTypes.has(detected.mime)) throw new AppError(415, 'UNSUPPORTED_DIGITAL_FILE', 'Formats numériques acceptés : PDF, ZIP, EPUB, MP3 et MP4.');
        const productId = String(request.body?.product_id || '');
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(productId)) {
          throw new AppError(400, 'PRODUCT_ID_REQUIRED', 'Enregistrez d’abord le produit numérique avant d’ajouter son fichier.');
        }
        const product = await getAdminSupabase().from('products').select('id,product_type').eq('id', productId).maybeSingle();
        if (product.error) throwSupabaseError(product.error);
        if (!product.data || product.data.product_type !== 'digital') throw new AppError(404, 'DIGITAL_PRODUCT_NOT_FOUND', 'Produit numérique introuvable.');
        const path = `${request.authUser.id}/${productId}/${randomUUID()}.${detected.ext}`;
        const storage = getAdminSupabase().storage.from(config.digitalFilesBucket);
        const uploaded = await storage.upload(path, request.file.buffer, { contentType: detected.mime, cacheControl: '0', upsert: false });
        if (uploaded.error) throwSupabaseError(uploaded.error, 'Le stockage privé a refusé ce fichier.');
        const asset = await getAdminSupabase().from('digital_assets').insert({
          product_id: productId,
          storage_path: path,
          original_filename: request.file.originalname.slice(0, 220),
          mime_type: detected.mime,
          file_size_bytes: request.file.size,
        }).select('id,original_filename,mime_type,file_size_bytes').single();
        if (asset.error) throwSupabaseError(asset.error, 'Le fichier a été téléversé, mais son association au produit a échoué.');
        response.status(201).json({ item: asset.data });
        return;
      }

      throw new AppError(400, 'UPLOAD_KIND_INVALID', 'Type de téléversement non pris en charge.');
    } catch (error) {
      next(error);
    }
  });
}
