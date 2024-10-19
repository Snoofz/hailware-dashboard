const axios = require('axios');

const apiUrl = 'https://www.qqtube.com/v1-api';
const apiKey = '172a1c261d1d84916d9e7321153d0416acab98fc';
const url = 'https://www.youtube.com/watch?v=jofNR_WkoCE';
const quantity = 2000;
const idService = 5; // Replace with your actual service ID
const geoCountries = 'US'; // Optional if the service requires geo-targeting

const requestData = {
  api_key: apiKey,
  action: 'add',
  url: url,
  quantity: quantity,
  id_service: idService,
  'geo-countries': geoCountries,
};

axios
  .post(apiUrl, requestData, {
    timeout: 30000, // Timeout set to 30 seconds
  })
  .then((response) => {
    console.log('Response:', response.data);
    if (response.data.status === 'success') {
      console.log('Submission ID:', response.data.id_service_submission);
    } else {
      console.log('Error:', response.data.message);
    }
  })
  .catch((error) => {
    console.error('Request failed:', error.message);
  });
