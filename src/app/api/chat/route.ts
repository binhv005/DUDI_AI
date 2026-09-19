import { NextResponse } from 'next/server';
import { ConversationService } from '@/features/conversations/conversation.service';
import { POST as handleMessagePost } from './conversations/[id]/messages/route';

export const dynamic = 'force-dynamic';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-session-id, x-anonymous-session-id',
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      service: 'DUDI SOFTWARE AI Chat API',
      timestamp: new Date().toISOString(),
    },
    {
      headers: corsHeaders,
    }
  );
}

export async function POST(req: Request) {
  try {
    const rawBody = await req.json();

    // Support various client payload formats (message / content / prompt / messages array)
    let content = '';
    if (typeof rawBody.message === 'string') {
      content = rawBody.message;
    } else if (typeof rawBody.content === 'string') {
      content = rawBody.content;
    } else if (typeof rawBody.prompt === 'string') {
      content = rawBody.prompt;
    } else if (Array.isArray(rawBody.messages) && rawBody.messages.length > 0) {
      const lastMsg = rawBody.messages[rawBody.messages.length - 1];
      content = typeof lastMsg === 'string' ? lastMsg : (lastMsg?.content || lastMsg?.message || '');
    }

    if (!content || !content.trim()) {
      return NextResponse.json(
        { success: false, error: 'Thiếu nội dung tin nhắn (message hoặc content).' },
        { status: 400, headers: corsHeaders }
      );
    }

    const anonymousSessionId =
      rawBody.anonymousSessionId ||
      rawBody.sessionId ||
      rawBody.userId ||
      'widget_session_' + Math.random().toString(36).substring(2, 10);

    let conversationId = rawBody.conversationId;
    if (!conversationId) {
      const conversation = await ConversationService.getOrCreateConversation(
        anonymousSessionId,
        undefined,
        false
      );
      conversationId = conversation._id.toString();
    }

    // Build standard request payload expected by message handler
    const innerReq = new Request(req.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: content.trim(),
        anonymousSessionId,
      }),
    });

    const response = await handleMessagePost(innerReq, {
      params: { id: conversationId },
    });

    // Add CORS & conversationId headers to response
    const headers = new Headers(response.headers);
    Object.entries(corsHeaders).forEach(([k, v]) => headers.set(k, v));
    headers.set('X-Conversation-Id', conversationId);
    headers.set('X-Session-Id', anonymousSessionId);

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch (error: any) {
    console.error('[API /api/chat Error]:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Lỗi xử lý yêu cầu trò chuyện AI',
      },
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
}
