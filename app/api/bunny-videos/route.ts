import { NextResponse } from "next/server";

const BUNNY_API_KEY = process.env.BUNNY_API_KEY;
const BUNNY_LIBRARY_ID = process.env.BUNNY_LIBRARY_ID;

const BUNNY_CDN_HOSTNAME = "vz-25c7b167-86a.b-cdn.net";

export async function GET() {
  try {
    // ============================================================
    // CHECK ENVIRONMENT VARIABLES
    // ============================================================

    if (!BUNNY_API_KEY || !BUNNY_LIBRARY_ID) {
      return NextResponse.json(
        {
          error: "Bunny environment variables missing",
        },
        { status: 500 }
      );
    }

    // ============================================================
    // GET ALL VIDEOS FROM BUNNY
    // ============================================================

    const allVideos: any[] = [];

    let page = 1;

    const itemsPerPage = 100;

    while (true) {
      const url =
        `https://video.bunnycdn.com/library/${BUNNY_LIBRARY_ID}/videos` +
        `?page=${page}` +
        `&itemsPerPage=${itemsPerPage}` +
        `&orderBy=date`;

      const response = await fetch(url, {
        method: "GET",

        headers: {
          AccessKey: BUNNY_API_KEY,
          Accept: "application/json",
        },

        cache: "no-store",
      });

      // ==========================================================
      // BUNNY API ERROR
      // ==========================================================

      if (!response.ok) {
        const errorText = await response.text();

        console.error(
          "Bunny API Error:",
          response.status,
          errorText
        );

        return NextResponse.json(
          {
            error: `Bunny API Error: ${response.status}`,
            details: errorText,
          },
          {
            status: response.status,
          }
        );
      }

      // ==========================================================
      // PARSE RESPONSE
      // ==========================================================

      const data = await response.json();

      const items = Array.isArray(data.items)
        ? data.items
        : [];

      allVideos.push(...items);

      // ==========================================================
      // LAST PAGE CHECK
      // ==========================================================

      if (items.length < itemsPerPage) {
        break;
      }

      page++;

      // ==========================================================
      // SAFETY LIMIT
      // Maximum 10,000 videos
      // ==========================================================

      if (page > 100) {
        break;
      }
    }

    // ============================================================
    // FORMAT VIDEOS
    // ============================================================

    const videos = allVideos.map((video: any) => {
      const guid = video.guid;

      const thumbnailFileName =
        video.thumbnailFileName;

      return {
        id: guid,

        title:
          video.title ||
          "Untitled Video",

        thumbnail_url:
          thumbnailFileName
            ? `https://${BUNNY_CDN_HOSTNAME}/${guid}/${thumbnailFileName}`
            : `https://${BUNNY_CDN_HOSTNAME}/${guid}/thumbnail.jpg`,

        video_url:
          `https://player.mediadelivery.net/embed/` +
          `${BUNNY_LIBRARY_ID}/${guid}`,

        duration:
          Number(video.length || 0),
      };
    });

    // ============================================================
    // RESPONSE
    // ============================================================

    return NextResponse.json(
      {
        videos,
        total: videos.length,
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    // ============================================================
    // GENERAL ERROR
    // ============================================================

    console.error(
      "Bunny videos error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Bunny videos load nahi ho paaye.",
      },
      {
        status: 500,
      }
    );
  }
}