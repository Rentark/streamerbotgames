import logger from './logger.js';

async function sendRequest(params = {}) {
  let { url, method, headers, payload, formData = false, responseType = 'auto' } = params;
  let reqData = {
    method: method,
    headers: headers,
    body: formData ? payload : JSON.stringify(payload)
  }
  if (method === 'GET') delete reqData.body;

  let rawResponse = {};
  try {
    logger.info("Sending request to URL", { url });
    // logger.info("Request params", { reqData });
    rawResponse = await fetch(url, reqData);
    let response = {};
    logger.info("response from streamelements", {rawResponse})

    const autoType = rawResponse.headers.get('content-type') ?? '';
    const parseAs =
      responseType === 'auto'
        ? autoType.includes('application/json')
          ? 'json'
          : 'text'
        : responseType;

    try {
      switch (parseAs) {
        case 'json':
          response = await rawResponse.json();
          break;
        case 'text':
          response.body = await rawResponse.text();
          break;
        case 'raw':
          response.body = rawResponse;
          break;
        default:
          response.body = await rawResponse.text();
      }
    } catch (err) {
      logger.warn('Failed to parse response', { url, parseAs, err });
      response.body = null;
    }

    response.statusCode = rawResponse.status;

    // logger.info("Response", { statusCode: response });

    if (rawResponse.status > 399) throw new Error(`Request to ${url} failed with status ${rawResponse.status}! Payload: ${reqData.data}`);
    return response;
  } catch (e) {
    logger.error('Unable to send to url', { url });
    logger.error("Error trace", { statusCode: rawResponse.status, responseMessage: { statusText: rawResponse.statusText, trace: e } });
    return { statusCode: rawResponse.status, message: { statusText: rawResponse.statusText, trace: e }, body: "" };
  }
}

export default sendRequest;
