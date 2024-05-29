document.addEventListener("DOMContentLoaded", function () {
  document.getElementById("detectBtn").addEventListener("click", function () {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      var tab = tabs[0];
      if (tab.url.includes("youtube.com/watch")) {
        chrome.tabs.sendMessage(
          tab.id,
          { action: "getVideoStats" },
          function (response) {
            if (chrome.runtime.lastError) {
              displayResult("Error: " + chrome.runtime.lastError.message);
            } else {
              displayResult(response.result);
              //displayJSON(response.jsonResult);
              displayModelResults(response.result);
            }
          }
        );
      } else {
        displayResult("Please navigate to a YouTube video page.");
      }
    });
  });
});

function displayResult(result) {
  var resultElement = document.getElementById("result");
  try {
    var data = JSON.parse(result);

    resultElement.innerHTML = `
            <div class="result-item">
                <img src="${data.ThumbnailUrl}" alt="Thumbnail">
            </div>
            <div class="result-item result-title">${data.Title}</div>
            <div class="result-item result-channel">Channel: ${data.Channel}</div>
            <div class="result-item result-main-stats">
                <div>Views: ${data.Views}</div>
                <div>Likes: ${data.Likes}</div>
                <div>DisLikes: ${data.Dislikes}</div>
                <div>Comments: ${data.Comment_Count}</div>
                
            </div>
            <div class="result-item result-stats">
                <div>Like/Dislike Ratio: ${data.Like_Dislike_Ratio.toFixed(4)}</div>
                <div>View/Like Ratio: ${data.View_Like_Ratio.toFixed(4)}</div>
                <div>View/DisLike Ratio: ${data.View_Dislike_Ratio.toFixed(4)}</div>
                <div>View/Comment Ratio: ${data.View_Comment_Ratio.toFixed(4)}</div>
            </div>
        `;
    resultElement.classList.add("show");
  } catch (error) {
    resultElement.innerHTML = `<pre>${result}</pre>`;
    resultElement.classList.add("show");
  }
}


function displayJSON(jsonResult) {
  var jsonElement = document.getElementById("json-result");
  jsonElement.innerHTML = `<pre>${jsonResult}</pre>`;
  jsonElement.classList.add("show");
}

async function getModelResult(data) {
  const requestData = {
    Views: data.Views,
    Likes: data.Likes,
    Dislikes: data.Dislikes,
    Comment_Count: data.Comment_Count,
    Like_Dislike_Ratio: data.Like_Dislike_Ratio,
    View_Like_Ratio: data.View_Like_Ratio,
    View_Comment_Ratio: data.View_Comment_Ratio,
    View_Dislike_Ratio: data.View_Dislike_Ratio,
    url: data.ThumbnailUrl,
  };

  const requestOptions = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestData),
  };
  var result =  fetch("http://127.0.0.1:5000/api/classification", requestOptions)
    .then(async (response) => await response.json())
    .then((classification) => {
      console.log(classification);
      return classification;
    })
    .catch((err) => {
      return "Error receiving data from model";
    });
    return result;
}

async function displayModelResults(result) {
  var data = JSON.parse(result);

  var classificationResult = await getModelResult(data);
  //console.log(classificationResult);

  var model1Element = document.getElementById("model1-result");
  model1Element.innerHTML = `
        <div class="model-title">Results of the 1st model (video statistics):</div>
        <div class="model-content">They say this is clickbait: ${classificationResult.ClickbaitProbabilityStatistics}%</div>`;
  model1Element.classList.add("show");

  var model2Element = document.getElementById("model2-result");
  model2Element.innerHTML = `
        <div class="model-title">Results of the 1st model (thumbnail):</div>
        <div class="model-content">They say this is clickbait: ${classificationResult.ClickbaitProbabilityThumbnail}%</div>
    `;
  model2Element.classList.add("show");
}
