const { google } = require("googleapis");
const createCsvWriter = require("csv-writer").createObjectCsvWriter;
const request = require("request-promise");
const fs = require("fs");
const sharp = require("sharp");
const iconv = require("iconv-lite");
const axios = require("axios");

const apiKey = "AIzaSyCVVZGjk2SY7xEIlAy25zay1SfIYM62-0w";

const legitChannelsIdentificators = [
  //"UCB_qr75-ydFVKSF9Dmo6izg",
  //"UC6uKrU_WqJ1R2HMTY3LIx5Q",
  //"UC-toy9WMImypmLAiU9h_SzQ",
  //"UCOKHwx1VCdgnxwbjyb9Iu1g",
  //"UCmlrp3y74JN1L1o1tSdeINw",
  //"UCkBwnm7GOfYHsacwUjriC-w",
  //"UCFhXFikryT4aFcLkLw2LBLA",
  //"UC0vBXGSyV14uvJ4hECDOl0Q",
  //"UCBobmJyzsJ6Ll7UbfhI4iwQ",
  //"UCqECaJ8Gagnn7YCbPEzWH6g",
  //"UCw7FkXsC00lH2v2yB5LQoYA",
  //"UC6n8I1UDTKP1IWjQMg6_TwA",
  //"UCY1kMZp36IQSyNx_9h4mpCg",
  //"UC06E4Y_-ybJgBUMtXx8uNNw",
  //"UCAs3JC7j50t8QVsm606yJyw",
  //"UCblfuW_4rakIf2h6aqANefA",
  //"UCFB0dxMudkws1q8w5NJEAmw",
];

const clickbaitChannelsIdentificators = [
  //"UCPTdoSP1L42qUSdHtIfnWNQ",
  //"UCeAQVFBUKGHpA2I2gfxuonw",
  //"UCwuSAGL3vknuXtPRPrXXkTA",
  //"UCBwSufNse8VMBvQM_rCSvgQ",
  //"UC0PMQXAwF6O6aeTpv962miA",
  //"UCe8KUUjbDut26Q183VpZGUg",
  //"UCwNEx3HyQ_wiCL9LNn3mTSw",
  //"UC-NPQYmHM9AagZg2GfaiiBw",
  //"UC295-Dw_tDNtZXFeAPAW6Aw",
  //"UCYVinkwSX7szARULgYpvhLw",
  //"UCvxfEIG3PHpgM0TMJJ_SH-w",
  //"UC0Ucwf_UELqG2GHMaiMqwMg",
  //"UCzeB_0FNcPIyUSjL_TL5lEw",
  //"UCX6OQ3DkcsbYNE6H8uQQuVA",
  //"UCjJYD85vaiBowhJNqY_pZOw",
  //"UCsSRxYAK0PiA7d0XUR6sPFA",
  //"UCMzjXeAJu7wC0CPaKZqeNHw"
];
const numberOfVideos = 50;

// Initialize the YouTube API
const youtube = google.youtube({
  version: "v3",
  auth: apiKey,
});

async function getAllVideos(channelId, videos, sizeLimit) {
  try {
    let nextPageToken = null;
    // Fetch videos page by page
    do {
      const response = await youtube.search.list({
        part: "snippet",
        channelId: channelId,
        maxResults: 50, // Maximum results per page (50 is the maximum allowed)
        pageToken: nextPageToken,
      });

      // Extract video IDs from the search results
      const videoIds = response.data.items
        .map((item) => item.id.videoId)
        .join(",");

      // Fetch video statistics (including view count) for the extracted video IDs
      const videoResponse = await youtube.videos.list({
        part: "snippet,statistics",
        id: videoIds,
      });
      //const englishVideos = videoResponse.data.items.filter(video => video.snippet && video.snippet.language === 'en');
      const utf8Videos = videoResponse.data.items.filter(video => isEnglishTitle(video.snippet.title));

      // Add fetched videos to the array
      videos.push(...utf8Videos);

      // Get the token for the next page
      nextPageToken = response.data.nextPageToken;
    } while (nextPageToken && videos.length < sizeLimit); // Check the length of videos array

    // Slice the array to ensure it contains exactly numberOfVideos
    videos = videos.slice(0, sizeLimit);

    return videos;
  } catch (error) {
    console.error("Error fetching videos:", error);
    return null;
  }
}

async function saveToCsv(videos,name, isClickbait) {
  try {
    const csvWriter = createCsvWriter({
      path: name,
      header: [
        { id: "id", title: "ID" },
        { id: "title", title: "Video Title" },
        { id: "description", title: "Description" },
        { id: "views", title: "Views" },
        { id: "likes", title: "Likes" },
        { id: "dislikes", title: "Dislikes" },
        { id: "commentCount", title: "Comment Count" },
        //{ id: "duration", title: "Duration" },
        { id: "clickbait", title: "clickbait" },
        
      ],
    });

    // Sanitize video titles
    const sanitizedVideos = await Promise.all(
      videos.map(async (video, index) => {
        await new Promise(resolve => setTimeout(resolve, index * 900)); // Wait for the delay
        return {
          id: video.id,
          title: sanitizeTitle(video.snippet.title),
          description : sanitizeTitle(video.snippet.description),
          views: video.statistics.viewCount,
          likes: video.statistics.likeCount,
          dislikes: await fetchDislikes(video.id), // Corrected "dislike" to "dislikes"
          commentCount : video.statistics.commentCount,
          //duration : video.contentDetails.duration,
          clickbait: isClickbait
        };
      })
    );
    await csvWriter.writeRecords(sanitizedVideos);

    console.log("CSV file saved successfully.");
  } catch (error) {
    console.error("Error saving to CSV:", error);
  }
}


async function fetchDislikes(id) {
  try {
    const headers = {
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9",
      Pragma: "no-cache",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    };

    const response = await axios.get(
      "https://returnyoutubedislikeapi.com/votes?videoId=" + id,
      { headers }
    );
    //console.log(response.data.dislikes);
    console.log(response.data.dislikes)
    return response.data.dislikes;
  } catch (e) {
    console.error(e);
    return 0;
  }
}


function sanitizeTitle(title) {
  // Replace commas and quotation marks with empty spaces
  const sanitizedTitle = title.replace(/[,"]/g, " ");

  // Convert to UTF-8
  //console.log(sanitizedTitle)
  return iconv.encode(sanitizedTitle, 'utf8');
}

async function downloadThumbnails(videos) {
  try {
    // Create the 'thumbnails' directory if it doesn't exist
    if (!fs.existsSync("thumbnails")) {
      fs.mkdirSync("thumbnails");
    }

    for (const video of videos) {
      const thumbnailUrl = video.snippet.thumbnails.medium.url; // Use medium resolution thumbnail
      const filename = `${video.id}.jpg`;
      const imagePath = `thumbnails/${filename}`;

      // Download the thumbnail of the desired size
      await download(thumbnailUrl, imagePath);
      console.log(`Thumbnail downloaded: ${filename}`);

      // Resize the downloaded thumbnail to 320x180 pixels in-place
      await resizeThumbnail(imagePath);
      console.log(`Thumbnail resized in-place: ${filename}`);
    }
  } catch (error) {
    console.error("Error downloading thumbnails:", error);
  }
}

async function resizeThumbnail(imagePath) {
  try {
    // Read the image into memory
    const imageBuffer = await fs.promises.readFile(imagePath);

    // Resize the image
    const resizedImageBuffer = await sharp(imageBuffer)
      .resize(320, 180) // Resize to 320x180 pixels
      .toBuffer();

    // Write the resized image back to the same file path
    await fs.promises.writeFile(imagePath, resizedImageBuffer);

    console.log(`Thumbnail resized in-place: ${imagePath}`);
  } catch (error) {
    console.error(`Error resizing thumbnail: ${imagePath}`, error);
  }
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    request.head(url, (err, res, body) => {
      if (err) {
        reject(err);
      }
      request(url).pipe(fs.createWriteStream(dest)).on("close", resolve);
    });
  });
}

function isEnglishTitle(title) {
  // Match only English letters, numbers, and common punctuation
  return /^[a-zA-Z0-9\s!"#$%&'()*+,-./:;<=>?@[\]^_`{|}~]+$/.test(title);
}
async function main() {
  try {
    let legitVideoIDs = []; // Initialize an empty array to store videos
    let channelNum = 0;
    for (legitChannel of legitChannelsIdentificators) {
      channelNum++;
      legitVideoIDs = await getAllVideos(legitChannel, legitVideoIDs, channelNum * numberOfVideos);
    }

    channelNum = 0;
    let clickbaitVideoIDs = []; // Initialize an empty array to store videos
    for (clickbaitChannel of clickbaitChannelsIdentificators) {
      channelNum++;
      clickbaitVideoIDs = await getAllVideos(clickbaitChannel, clickbaitVideoIDs, channelNum * numberOfVideos);
    }
    //console.log(videoIDs[0]);
    if (legitVideoIDs.length > 0) {
      // Save filtered data to CSV file
      //console.log(legitVideoIDs[0])
      await saveToCsv(legitVideoIDs,"notClickbait.csv", 0);

      // Download thumbnails
      await downloadThumbnails(legitVideoIDs);
    } else {
      console.log("Failed to fetch videos");
    }

    if (clickbaitVideoIDs.length > 0) {
      // Save filtered data to CSV file
      await saveToCsv(clickbaitVideoIDs,"clickbait.csv", 1);

      // Download thumbnails
      await downloadThumbnails(clickbaitVideoIDs);
    } else {
      console.log("Failed to fetch videos");
    }

  } catch (error) {
    console.error("Error:", error);
  }
}

main();
