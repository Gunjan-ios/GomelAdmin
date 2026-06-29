'use strict';

const env = require('../config/env');
const { cloudinary } = require('../config/cloudinary');

async function testConnection() {
  console.log('☁️ Checking Cloudinary Configuration...');
  console.log('------------------------------------');
  console.log(`Cloud Name:   ${env.cloudinaryCloudName || '(Not Configured ❌)'}`);
  console.log(`API Key:      ${env.cloudinaryApiKey ? '••••••••' + env.cloudinaryApiKey.slice(-4) : '(Not Configured ❌)'}`);
  console.log(`API Secret:   ${env.cloudinaryApiSecret ? '••••••••' : '(Not Configured ❌)'}`);
  console.log(`Enabled:      ${env.cloudinaryEnabled ? 'Yes ✅' : 'No ❌ (requires all three variables)'}`);
  console.log('------------------------------------');

  if (!env.cloudinaryEnabled) {
    console.log('\n💡 Cloudinary is currently disabled. The app will fall back to saving uploaded files locally under the /uploads folder.');
    console.log('To enable Cloudinary, please add the following variables to your .env file or server environment:');
    console.log('  CLOUDINARY_CLOUD_NAME=your_cloud_name');
    console.log('  CLOUDINARY_API_KEY=your_api_key');
    console.log('  CLOUDINARY_API_SECRET=your_api_secret');
    return;
  }

  console.log('⌛ Pinging Cloudinary API...');
  try {
    const result = await cloudinary.api.ping();
    console.log('✨ Connection Success! Cloudinary responded:', result);
  } catch (error) {
    console.error('❌ Connection Failed! Could not communicate with Cloudinary.');
    console.error('Error Details:', error.message || error);
    console.log('\n💡 Please check that your API credentials are correct and that you have internet connectivity.');
  }
}

testConnection();
