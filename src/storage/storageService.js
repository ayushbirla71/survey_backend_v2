import { storageProvider } from "./storageFactory.js";

export const uploadMediaFunction = async (file, folder = "uploads") => {
  return storageProvider.upload(file, folder);
};

export const deleteMediaFunction = async (key) => {
  return storageProvider.delete(key);
};

export const getMediaUrl = async (key, expiresInSeconds = 3600) => {
  return storageProvider.generateUrl(key, expiresInSeconds);
};
