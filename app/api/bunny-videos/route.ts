import { NextResponse } from "next/server";

const BUNNY_API_KEY = process.env.BUNNY_API_KEY;
const BUNNY_LIBRARY_ID = process.env.BUNNY_LIBRARY_ID;

const BUNNY_CDN_HOSTNAME = "vz-25c7b167-86a.b-cdn.net";

export async function GET() {
  try {
    if (!BUNNY_API_KEY || !BUNNY_LIBRARY_ID) {
      return NextResponse.json(
        {
          error: "Bunny environment variables missing",
        },
        { status: 500 }
      );
    }

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

      if (!response.ok) {
        const errorText = await response.text();

        console.error("Bunny API Error:", response.status, errorText);

        return NextResponse.json(
          {
            error: `Bunny API Error: ${response.status}`,
            details: errorText,
          },
          { status: response.status }
        );
      }

      const data = await response.json();

      const items = Array.isArray(data.items) ? data.items : [];

      allVideos.push(...items);

      /*
       * अगर 100 से कम videos मिले,
       * तो आखिरी page है।
       */
      if (items.length < itemsPerPage) {
        break;
      }

      page++;

      /*
       * Safety limit.
       * 100 pages × 100 videos = 10,000 videos maximum.
       */
      if (page > 100) {
        break;
      }
    }

    const videos = allVideos.map((video: any) => {
      const guid = video.guid;

      return {
        id: guid,

        title: video.title || "Untitled Video",

        thumbnail_url:
          video.thumbnailFileName
            ? `https://${BUNNY_CDN_HOSTNAME}/${guid}/${video.thumbnailFileName}`
            : `https://${BUNNY_CDN_HOSTNAME}/${guid}/thumbnail.jpg`,

        video_url:
          `https://player.mediadelivery.net/embed/` +
          `${BUNNY_LIBRARY_ID}/${guid}`,

        duration: Number(video.length || 0),
      };
    });

    return NextResponse.json({
      videos,
      total: videos.length,
    });
  } catch (error) {
    console.error("Bunny videos error:", error);

    return NextResponse.json(
      {
        error: "Bunny videos load nahi ho paaye.",
      },
      { status: 500 }
    );
  }
}