// Lightweight status-check function — the browser calls this every couple
// seconds to ask "is my estimate ready yet?". Reads the result that
// estimate-background.js saved to Netlify Blobs.

const { getStore } = require('@netlify/blobs');

exports.handler = async function (event) {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const jobId = event.queryStringParameters && event.queryStringParameters.jobId;
  if (!jobId) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'error', error: 'Missing jobId' })
    };
  }

  const store = getStore('scope-lens-jobs');
  const job = await store.get(jobId, { type: 'json' });

  if (!job) {
    // Background function hasn't written its first "pending" marker yet —
    // this is normal in the first second or so after kickoff.
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'pending' })
    };
  }

  // Clean up once the client has picked up a finished result.
  if (job.status === 'done' || job.status === 'error') {
    await store.delete(jobId);
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(job)
  };
};
