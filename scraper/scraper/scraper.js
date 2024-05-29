const { google } = require("googleapis");
const createCsvWriter = require("csv-writer").createObjectCsvWriter;
const request = require("request-promise");
const fs = require("fs");
const sharp = require("sharp");
const iconv = require("iconv-lite");
const axios = require("axios");

const apiKey = "AIzaSyCVVZGjk2SY7xEIlAy25zay1SfIYM62-0w";

const legitChannelsIdentificators = [
  "UCB_qr75-ydFVKSF9Dmo6izg",
  "UC6uKrU_WqJ1R2HMTY3LIx5Q",
  "UC-toy9WMImypmLAiU9h_SzQ",
  "UCOKHwx1VCdgnxwbjyb9Iu1g",
  "UCmlrp3y74JN1L1o1tSdeINw",
  "UCkBwnm7GOfYHsacwUjriC-w",
  "UCFhXFikryT4aFcLkLw2LBLA",
  "UC0vBXGSyV14uvJ4hECDOl0Q",
  "UCBobmJyzsJ6Ll7UbfhI4iwQ",
  "UCqECaJ8Gagnn7YCbPEzWH6g",
  "UCw7FkXsC00lH2v2yB5LQoYA",
  "UC6n8I1UDTKP1IWjQMg6_TwA",
  "UCY1kMZp36IQSyNx_9h4mpCg",
  "UC06E4Y_-ybJgBUMtXx8uNNw",
  "UCAs3JC7j50t8QVsm606yJyw",
  "UCblfuW_4rakIf2h6aqANefA",
  "UCFB0dxMudkws1q8w5NJEAmw",
];

const clickbaitChannelsIdentificators = [
  "UCPTdoSP1L42qUSdHtIfnWNQ",
  "UCeAQVFBUKGHpA2I2gfxuonw",
  "UCwuSAGL3vknuXtPRPrXXkTA",
  "UCBwSufNse8VMBvQM_rCSvgQ",
  "UC0PMQXAwF6O6aeTpv962miA",
  "UCe8KUUjbDut26Q183VpZGUg",
  "UCwNEx3HyQ_wiCL9LNn3mTSw",
  "UC-NPQYmHM9AagZg2GfaiiBw",
  "UC295-Dw_tDNtZXFeAPAW6Aw",
  "UCYVinkwSX7szARULgYpvhLw",
  "UCvxfEIG3PHpgM0TMJJ_SH-w",
  "UC0Ucwf_UELqG2GHMaiMqwMg",
  "UCzeB_0FNcPIyUSjL_TL5lEw",
  "UCX6OQ3DkcsbYNE6H8uQQuVA",
  "UCjJYD85vaiBowhJNqY_pZOw",
  "UCsSRxYAK0PiA7d0XUR6sPFA",
  "UCMzjXeAJu7wC0CPaKZqeNHw"
];
const numberOfVideos = 50;

const youtube = google.youtube({
  version: "v3",
  auth: apiKey,
});

async function getAllVideos(channelId, videos, sizeLimit) {
  try {
    let nextPageToken = null;
    do {
      const response = await youtube.search.list({
        part: "snippet",
        channelId: channelId,
        maxResults: 50, 
        pageToken: nextPageToken,
      });

      const videoIds = response.data.items
        .map((item) => item.id.videoId)
        .join(",");

      const videoResponse = await youtube.videos.list({
        part: "snippet,statistics",
        id: videoIds,
      });
      const utf8Videos = videoResponse.data.items.filter(video => isEnglishTitle(video.snippet.title));

      videos.push(...utf8Videos);

      nextPageToken = response.data.nextPageToken;
    } while (nextPageToken && videos.length < sizeLimit); 
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
        { id: "clickbait", title: "clickbait" },
        
      ],
    });

    const sanitizedVideos = await Promise.all(
      videos.map(async (video, index) => {
        await new Promise(resolve => setTimeout(resolve, index * 900)); // Wait to not overload api
        return {
          id: video.id,
          title: sanitizeTitle(video.snippet.title),
          description : sanitizeTitle(video.snippet.description),
          views: video.statistics.viewCount,
          likes: video.statistics.likeCount,
          dislikes: await fetchDislikes(video.id), 
          commentCount : video.statistics.commentCount,
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
    console.log(response.data.dislikes)
    return response.data.dislikes;
  } catch (e) {
    console.error(e);
    return 0;
  }
}

function sanitizeTitle(title) {
  const sanitizedTitle = title.replace(/[,"]/g, " ");
  return iconv.encode(sanitizedTitle, 'utf8');
}

async function downloadThumbnails(videos) {
  try {
    if (!fs.existsSync("thumbnails")) {
      fs.mkdirSync("thumbnails");
    }

    for (const video of videos) {
      const thumbnailUrl = video.snippet.thumbnails.medium.url; 
      const filename = `${video.id}.jpg`;
      const imagePath = `thumbnails/${filename}`;

      await download(thumbnailUrl, imagePath);
      console.log(`Thumbnail downloaded: ${filename}`);

      await resizeThumbnail(imagePath);
      console.log(`Thumbnail resized in-place: ${filename}`);
    }
  } catch (error) {
    console.error("Error downloading thumbnails:", error);
  }
}

async function resizeThumbnail(imagePath) {
  try {
    const imageBuffer = await fs.promises.readFile(imagePath);

    const resizedImageBuffer = await sharp(imageBuffer)
      .resize(320, 180) 
      .toBuffer();
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
  return /^[a-zA-Z0-9\s!"#$%&'()*+,-./:;<=>?@[\]^_`{|}~]+$/.test(title);
}

async function main() {
  try {
    let legitVideoIDs = []; 
    let channelNum = 0;
    for (legitChannel of legitChannelsIdentificators) {
      channelNum++;
      legitVideoIDs = await getAllVideos(legitChannel, legitVideoIDs, channelNum * numberOfVideos);
    }

    channelNum = 0;
    let clickbaitVideoIDs = [];
    for (clickbaitChannel of clickbaitChannelsIdentificators) {
      channelNum++;
      clickbaitVideoIDs = await getAllVideos(clickbaitChannel, clickbaitVideoIDs, channelNum * numberOfVideos);
    }
    if (legitVideoIDs.length > 0) {
      await saveToCsv(legitVideoIDs,"notClickbait.csv", 0);
      await downloadThumbnails(legitVideoIDs);
    } else {
      console.log("Failed to fetch videos");
    }

    if (clickbaitVideoIDs.length > 0) {
      await saveToCsv(clickbaitVideoIDs,"clickbait.csv", 1);
      await downloadThumbnails(clickbaitVideoIDs);
    } else {
      console.log("Failed to fetch videos");
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

main();
