chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.action === "getVideoStats") {
    var videoId = getYouTubeVideoId(window.location.href);
    if (videoId) {
      fetchVideoData(videoId, sendResponse);
      return true; // Asynchronous response
    } else {
      sendResponse("Invalid YouTube video URL.");
    }
  }
});

function getYouTubeVideoId(url) {
  var match = url.match(/[?&]v=([^&]+)/);
  return match ? match[1] : null;
}

async function fetchDislikes(videoId) {
  try {
    const headers = new Headers({
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9",
      Pragma: "no-cache",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    const response = await fetch(
      "https://returnyoutubedislikeapi.com/votes?videoId=" + videoId,
      { headers: headers }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch dislikes");
    }

    const data = await response.json();
    console.log(data.dislikes);
    return data.dislikes;
  } catch (error) {
    console.error(error);
    return 0;
  }
}

function fetchVideoData(videoId, callback) {
  var apiKey = "AIzaSyBmEMWOUM5p4VV1lWKnc0U0Z2Q9IVOPoWw"; // Replace with your actual API key
  var apiUrl = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${apiKey}&part=snippet,statistics`;

  const headers = {
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9",
    Pragma: "no-cache",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  };

  fetch(apiUrl, { headers: headers })
    .then((response) => response.json())
    .then(async (data) => {
      if (data.items && data.items.length > 0) {
        var snippet = data.items[0].snippet;
        var statistics = data.items[0].statistics;

        var title = snippet.title;
        var channel = snippet.channelTitle;
        var description = snippet.description;
        var thumbnailUrl = snippet.thumbnails.default.url;

        var views = parseInt(statistics.viewCount);
        var likes = parseInt(statistics.likeCount);
        var dislikes = await fetchDislikes(videoId); // Fetch dislikes

        var commentCount = parseInt(statistics.commentCount);

        var likeDislikeRatio = likes ? dislikes / likes : 0;
        var viewLikeRatio = views ? likes / views : 0;
        var viewCommentRatio = views ? commentCount / views : 0;
        var viewDislikeRatio = views ? dislikes / views : 0;


        var result = {
          Title: title,
          Channel: channel,
          // "Description": description,
          ThumbnailUrl: thumbnailUrl,
          Views: views,
          Likes: likes,
          Dislikes: dislikes,
          Comment_Count: commentCount,
          Like_Dislike_Ratio: likeDislikeRatio,
          View_Like_Ratio: viewLikeRatio,
          View_Dislike_Ratio : viewDislikeRatio,
          View_Comment_Ratio: viewCommentRatio,
        };

        var jsonResult = {
          Views: views,
          Likes: likes,
          Dislikes: dislikes,
          Comment_Count: commentCount,
          Like_Dislike_Ratio: likeDislikeRatio,
          View_Like_Ratio: viewLikeRatio,
          View_Dislike_Ratio : viewDislikeRatio,
          View_Comment_Ratio: viewCommentRatio,
          ThumbnailUrl: thumbnailUrl,
        };

        callback({
          result: JSON.stringify(result, null, 2),
          jsonResult: JSON.stringify(jsonResult, null, 2),
        });
      } else {
        callback("Error fetching video data: No items found.");
      }
    })
    .catch((error) => {
      callback("Error fetching video data: " + error);
    });
}
