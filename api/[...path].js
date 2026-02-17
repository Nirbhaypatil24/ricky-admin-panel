// api/[...path].js
import axios from 'axios';

const BACKEND_URL = 'https://ec2-3-110-29-119.ap-south-1.compute.amazonaws.com/api';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { path } = req.query;
    const apiPath = Array.isArray(path) ? path.join('/') : path || '';
    const backendUrl = `${BACKEND_URL}/${apiPath}`;
    
    console.log(`[Proxy] ${req.method} → ${backendUrl}`);

    // Use axios with timeout
    const axiosConfig = {
      method: req.method,
      url: backendUrl,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 25000, // 25 second timeout
      validateStatus: () => true, // Don't throw on any status code
    };

    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
      axiosConfig.data = req.body;
    }

    const response = await axios(axiosConfig);
    
    console.log(`[Proxy] Response: ${response.status}`);

    return res.status(response.status).json(response.data);

  } catch (error) {
    console.error('[Proxy] Error:', error.message);
    
    if (error.code === 'ECONNABORTED') {
      return res.status(504).json({ 
        error: 'Gateway Timeout',
        message: 'Backend request timed out'
      });
    }

    return res.status(500).json({ 
      error: 'Proxy failed',
      message: error.message,
      code: error.code
    });
  }
}

