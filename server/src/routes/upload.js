import { randomUUID } from 'node:crypto';
import multer from 'multer';
import { fileTypeFromBuffer } from 'file-type';
import { config } from '../config.js';
import { AppError, throwSupabaseError } from '../lib/errors.js';
import { getAdminSupabase, requireSupabaseConfiguration } from '../lib/supabase.js';

const receiveFile = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxUploadBytes, files: 1 },
}).single('file');

export async function uploadArticleImage(request, response, next) {
  receiveFile(request, response, async (uploadError) => {
    try {
      if (uploadError) {
        if (uploadError.code === 'LIMIT_FILE_SIZE') {
          throw new AppError(413, 'FILE_TOO_LARGE', 'L’image dépasse la limite serveur de 10 Mo.');
        }
        throw new AppError(400, 'UPLOAD_INVALID', 'Le fichier envoyé n’a pas pu être lu.');
      }
      if (!request.file) throw new AppError(400, 'FILE_REQUIRED', 'Choisissez une image à envoyer.');
      requireSupabaseConfiguration();

      const detected = await fileTypeFromBuffer(request.file.buffer);
      if (!detected || !config.allowedImageTypes.has(detected.mime)) {
        throw new AppError(415, 'UNSUPPORTED_IMAGE', 'Formats acceptés : JPEG, PNG, WebP, AVIF et GIF.');
      }

      const path = `${request.authUser.id}/${randomUUID()}.${detected.ext}`;
      const storage = getAdminSupabase().storage.from(config.storageBucket);
      const { error } = await storage.upload(path, request.file.buffer, {
        contentType: detected.mime,
        cacheControl: '31536000',
        upsert: false,
      });
      if (error) throwSupabaseError(error, 'Le stockage Supabase a refusé cette image.');

      const { data } = storage.getPublicUrl(path);
      response.status(201).json({ url: data.publicUrl, path, mimeType: detected.mime });
    } catch (error) {
      next(error);
    }
  });
}
