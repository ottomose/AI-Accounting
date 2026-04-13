import { Hono } from 'hono';
import { authMiddleware } from '../auth/middleware';
import { chat } from '../ai/service';

const chatRoute = new Hono();

chatRoute.use('*', authMiddleware);

// POST /api/chat
chatRoute.post('/', async (c) => {
  const { user } = c.get('authSession');
  const body = await c.req.json();
  const { messages, companyId } = body;

  if (!companyId) {
    return c.json({ error: 'companyId is required' }, 400);
  }

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return c.json({ error: 'messages array is required' }, 400);
  }

  try {
    const result = await chat(messages, {
      companyId,
      userId: user.id,
      userRole: (user as Record<string, unknown>).role as string ?? 'client',
    });

    return c.json({
      reply: result.reply,
      toolResults: result.toolResults,
    });
  } catch (err) {
    console.error('[Chat Error]', err);
    return c.json({ error: 'AI service error' }, 500);
  }
});

export default chatRoute;
