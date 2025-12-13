import { getBearerToken, validateJWT } from "../auth";
import { respondWithJSON } from "./json";
import { getVideo,updateVideo, type Video } from "../db/videos";
import type { ApiConfig } from "../config";
import type { BunRequest } from "bun";
import { BadRequestError, NotFoundError,UserForbiddenError } from "./errors";

type Thumbnail = {
  data: ArrayBuffer;
  mediaType: string;
};

const videoThumbnails: Map<string, Thumbnail> = new Map();

export async function handlerGetThumbnail(cfg: ApiConfig, req: BunRequest) {
  const { videoId } = req.params as { videoId?: string };
  if (!videoId) {
    throw new BadRequestError("Invalid video ID");
  }

  const video = getVideo(cfg.db, videoId);
  if (!video) {
    throw new NotFoundError("Couldn't find video");
  }

  const thumbnail = videoThumbnails.get(videoId);
  if (!thumbnail) {
    throw new NotFoundError("Thumbnail not found");
  }

  return new Response(thumbnail.data, {
    headers: {
      "Content-Type": thumbnail.mediaType,
      "Cache-Control": "no-store",
    },
  });
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
    const thumbnailBuffer = await thumbnail.arrayBuffer();
    const thumbnailType = thumbnail.type;
    videoThumbnails.set(videoId, {
      data: thumbnailBuffer,
      mediaType: thumbnailType,
    });
    const thumbnailURL = `http://localhost:${cfg.port}/api/thumbnails/:videoID`;
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
