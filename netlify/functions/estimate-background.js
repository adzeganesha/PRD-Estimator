// Background function — runs for up to 15 minutes, no 10-second wall.
// The browser gets a 202 "OK, I'm on it" reply immediately, then this
// keeps working in the background and saves the result to Netlify Blobs.
// The browser checks in on the result via estimate-status.js.
//
// Requires ANTHROPIC_API_KEY set in Netlify > Site configuration > Environment variables.

const { getStore } = require('@netlify/blobs');

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const store = getStore('scope-lens-jobs');
  let jobId;

  try {
    const body = JSON.parse(event.body);
    jobId = body.jobId;
    const { model, max_tokens, system, messages } = body;

    if (!jobId) {
      throw new Error('Missing jobId');
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      await store.setJSON(jobId, {
        status: 'error',
        error: 'Server is missing ANTHROPIC_API_KEY. Set it in Netlify > Site configuration > Environment variables.'
      });
      return { statusCode: 202, body: '' };
    }

    // Mark as in-progress right away so the status endpoint has something to find.
    await store.setJSON(jobId, { status: 'pending' });

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({ model, max_tokens, system, messages })
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      await store.setJSON(jobId, {
        status: 'error',
        error: (data.error && data.error.message) || `Claude API returned ${response.status}`
      });
      return { statusCode: 202, body: '' };
    }

    await store.setJSON(jobId, { status: 'done', data });
    return { statusCode: 202, body: '' };
  } catch (err) {
    if (jobId) {
      await store.setJSON(jobId, { status: 'error', error: err.message || 'Background job failed' });
    }
    return { statusCode: 202, body: '' };
  }
};
