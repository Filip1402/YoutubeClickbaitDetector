from io import BytesIO
import requests
import torch
import torch.nn as nn
import torch.nn.functional as F
from torchvision import  transforms
from flask import Flask, jsonify, request
import joblib
import os
from PIL import Image
from flask_cors import CORS

app = Flask(__name__)
CORS(app)


@app.route('/api/classification', methods=['POST'])
def get_data():
    request_data = request.json
    try:
        result_stat, result_thumbnail = evaluate(request_data)
        response = {
            'ClickbaitProbabilityStatistics': f"{result_stat.item()*100:.3f}" ,  
            'ClickbaitProbabilityThumbnail': f"{result_thumbnail.item()*100:.3f}" 
        }
    except Exception as e:
        response = {'error': str(e)}
    return jsonify(response)

# Model class
class ConvolutionalNetwork(nn.Module):
  def __init__(self):
    super().__init__()
    self.conv1 = nn.Conv2d(3,12,3,1)
    self.conv2 = nn.Conv2d(12,24,3,1)
    self.conv3 = nn.Conv2d(24,48,3,1)

    #Full connected layers
    self.fc1 = nn.Linear(48*28*28,200)
    self.fc2 = nn.Linear(200,100)
    self.fc3 = nn.Linear(100,1)
    # Dropout layers
    self.dropout2 = nn.Dropout(0.25)
    #Batch normalization
    self.bn1 = nn.BatchNorm1d(120)
    self.bn2 = nn.BatchNorm1d(84)

  def forward(self,X):
    #first pass
    X = F.relu(self.conv1(X))
    #X = F.max_pool2d(X,2,2)
    X = F.max_pool2d(X,2,2)
    #second pass
    X = F.relu(self.conv2(X))
    X = F.max_pool2d(X,2,2)
    #third pass
    X = F.relu(self.conv3(X))
    #Review data to flatten
    X = X.view(-1,48*28*28)
    #Fully conected layers
    X = F.relu(self.fc1(X))
    X = self.dropout2(X)
    X = F.relu(self.fc2(X))
    X = self.fc3(X)
    return X


class ModelStatistics(nn.Module):
    def __init__(self, in_features=8, h1=64, h2=128, h3=128, h4=64, h5=32, h6=16, output_features=2):
        super().__init__()
        self.fc1 = nn.Linear(in_features, h1)
        self.fc2 = nn.Linear(h1, h2)
        self.fc3 = nn.Linear(h2, h3)
        self.fc4 = nn.Linear(h3, h4)
        self.fc5 = nn.Linear(h4, h5)
        self.fc6 = nn.Linear(h5, h6)
        self.out = nn.Linear(h6, output_features)

    def forward(self, x):
        x = F.relu(self.fc1(x))
        x = F.relu(self.fc2(x))
        x = F.relu(self.fc3(x))
        x = F.relu(self.fc4(x))
        x = F.relu(self.fc5(x))
        x = F.relu(self.fc6(x))
        x = self.out(x)
        return F.softmax(x)

scaler_path = 'scaler_params.pkl'
if not os.path.exists(scaler_path):
    raise FileNotFoundError(f"Scaler parameters file not found at {scaler_path}")
scaler_params = joblib.load(scaler_path)


def scale_element(element, min_, scale_):
    return (element - min_) * scale_

def scale_data(data, scaler_params):
    min_ = scaler_params['min_']
    scale_ = scaler_params['scale_']
    scaled_data = [scale_element(data[i], min_[i], scale_[i]) for i in range(len(data))]
    return scaled_data

def preProcessData(data):
    url = data.get('url', None)
    # Remove URL field from data to prevent it from being processed
    if 'url' in data:
        del data['url']

    data_values = list(data.values())
    scaled_data_values = scale_data(data_values, scaler_params)
    data_tensor_scaled = torch.tensor(scaled_data_values, dtype=torch.float32)


    return (data_tensor_scaled.view(-1).unsqueeze(0), download_and_resize_image(url))

def download_and_resize_image(url):
    try:
        # Send a HTTP request to the URL
        response = requests.get(url)
        response.raise_for_status()  # Raise an error on a bad status
    except requests.RequestException as e:
        print(f"Error downloading image: {e}")
        return None

    try:
        # Open the image from the response content
        img = Image.open(BytesIO(response.content))
        # Resize the image
        convert_tensor = transforms.ToTensor()
        img = convert_tensor(img.resize((128, 128)))
        print(img.shape)
        return img
    except Exception as e:
        print(f"Error processing image: {e}")
        return None
    
def evaluate(data):
    modelStatistcis = ModelStatistics()
    modelThumbnails = ConvolutionalNetwork()
    modelStatistcis.load_state_dict(torch.load('statisticModel.pt'))
    modelThumbnails.load_state_dict(torch.load('thumbnailModel.pt'))

    modelStatistcis.eval()  # Set the ModelStatistics  to evaluation mode
    modelThumbnails.eval()
    stattistics_data, image_data = preProcessData(data)
    #print(stattistics_data.shape)
    #print(stattistics_data)

    with torch.no_grad():  # Disable gradient calculation
        y_pred_stat = modelStatistcis(stattistics_data)
        clickbait_probability_stat = y_pred_stat[0][1]
        print("STAT")
        print(y_pred_stat)
        print(clickbait_probability_stat)
        y_pred_thumbnail = modelThumbnails(image_data)
        clickbait_probability_thumbnail = torch.sigmoid(y_pred_thumbnail)
        print("Thumb")
        print(y_pred_thumbnail)
        print(clickbait_probability_thumbnail)

        return clickbait_probability_stat, clickbait_probability_thumbnail
    
if __name__ == '__main__':
    app.run(debug=True)
