import { getBearerToken, validateJWT } from "../auth";
import { respondWithJSON } from "./json";
import { getVideo,updateVideo, type Video } from "../db/videos";
import type { ApiConfig } from "../config";
import type { BunRequest } from "bun";
import { BadRequestError, UserForbiddenError } from "./errors";
import path from "path";

function getFileExtensionFromMimeType(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/svg+xml": "svg",
  };
  
  return mimeToExt[mimeType] || "jpg";
}

export async function handlerUploadThumbnail(cfg: ApiConfig, req: BunRequest) {
  try {
  const { videoId } = req.params as { videoId?: string };
  if (!videoId) {
    throw new BadRequestError("Invalid video ID");
  }

  const token = getBearerToken(req.headers);
  const userID = validateJWT(token, cfg.jwtSecret);

  console.log("uploading thumbnail for video", videoId, "by user", userID);
  const video = await getVideo(cfg.db, videoId);
  if (!video) throw new BadRequestError("Video does not exist");
  if (video.userID !== userID) throw new UserForbiddenError("You are not authorized to upload a thumbnail for this video");

   
    const formData = await req.formData();
    const thumbnail = formData.get("thumbnail")
    if(!thumbnail || !(thumbnail instanceof File)){
       throw new BadRequestError("Invalid thumbnail");
    } 
    const MAX_UPLOAD_SIZE = 10 * 1024 * 1024; // 10MB
    if(thumbnail.size > MAX_UPLOAD_SIZE){
      throw new BadRequestError("Thumbnail is too large");
    } 
    
    const mediaType = thumbnail.type;
    const fileExtension = getFileExtensionFromMimeType(mediaType);
    const fileName = `${videoId}.${fileExtension}`;
    const filePath = path.join(cfg.assetsRoot, fileName);
    
    const arrayBuffer = await thumbnail.arrayBuffer();
    await Bun.write(filePath, arrayBuffer);

    const thumbnailURL = `http://localhost:${cfg.port}/assets/${fileName}`;
    const updatedVideo: Video = {
      ...video,
      thumbnailURL, // updated URL
    };
    
    updateVideo(cfg.db, updatedVideo); // write to DB
    
    return respondWithJSON(200, updatedVideo);
    } catch (error) {
      console.error("Error uploading thumbnail:", error);
      throw new Error("Failed to upload thumbnail");
    }
  }
