// Proxy handler that forwards auth requests to the Better Auth API server
const handler = async (request: Request) => {
  const url = new URL(request.url);
  const authPath = url.pathname.replace('/api/auth', '');

  // Forward the request to the Better Auth server
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  const forwardUrl = `${apiUrl}/api/auth${authPath}${url.search}`;

  try {
    const response = await fetch(forwardUrl, {
      method: request.method,
      headers: {
        ...Object.fromEntries(request.headers.entries()),
        'x-forwarded-for': request.headers.get('x-forwarded-for') || '',
        'x-real-ip': request.headers.get('x-real-ip') || '',
      },
      body: request.method !== 'GET' && request.method !== 'HEAD'
        ? await request.text()
        : undefined,
    });

    const responseBody = await response.text();

    return new Response(responseBody, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  } catch (error) {
    console.error('Error forwarding auth request:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
};

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
export const PATCH = handler;